import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { LocalDraftStore } from '../src/workspace/store.js';
import { buildWorkspace } from '../src/workspace/model.js';
import { workspaceSnapshot } from './helpers/workspace-fixture.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-local-edit-'));
  const filename = path.join(root, 'drafts.sqlite');
  const store = new LocalDraftStore(filename);
  t.after(() => store.close());
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const snapshot = workspaceSnapshot();
  return { root, filename, store, snapshot, story: buildWorkspace(snapshot).stories[0] };
}

test('caption/order/notes autosaves persist across restart and proposals never imply production or rights approval', async t => {
  const { filename, store, story } = await fixture(t);
  const saved = store.save(story, { baseRevision: story.revision, expectedVersion: 0, caption: 'Local caption edit', selectedAssetIds: ['asset-2', 'asset-1'], notes: 'Review image permission' });
  assert.equal(saved.version, 1);
  const reopened = new LocalDraftStore(filename);
  try {
    assert.equal(reopened.get(story.id).caption, 'Local caption edit');
    assert.deepEqual(reopened.get(story.id).selectedAssetIds, ['asset-2', 'asset-1']);
    const proposal = reopened.proposal(story);
    assert.equal(proposal.productionApplied, false);
    assert.equal(proposal.publicationApproved, false);
    assert.equal(proposal.rightsGranted, false);
    assert.equal(proposal.stale, false);
    assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
  } finally { reopened.close(); }
});

test('two tabs cannot silently overwrite one another and stale local drafts are preserved for comparison', async t => {
  const { store, story } = await fixture(t);
  store.save(story, { baseRevision: story.revision, expectedVersion: 0, caption: 'First tab' });
  assert.throws(() => store.save(story, { baseRevision: story.revision, expectedVersion: 0, caption: 'Stale second tab' }), { code: 'EDIT_CONFLICT' });
  assert.equal(store.get(story.id).caption, 'First tab');
  const changed = { ...story, revision: 'different-current-source' };
  assert.throws(() => store.save(changed, { baseRevision: story.revision, expectedVersion: 1, caption: 'Overwrite' }), { code: 'STALE_SOURCE' });
  assert.throws(() => store.save(changed, { baseRevision: changed.revision, expectedVersion: 1, caption: 'Blind rebase' }), { code: 'STALE_LOCAL_DRAFT' });
  assert.equal(store.proposal(changed).stale, true);
});

test('local edits reject foreign/duplicate assets, rights grants, lifecycle writes and malformed music', async t => {
  const { store, story } = await fixture(t);
  const base = { baseRevision: story.revision, expectedVersion: 0 };
  for (const patch of [{ selectedAssetIds: ['foreign'] }, { selectedAssetIds: ['asset-1', 'asset-1'] }, { rightsStatus: 'cleared' }, { stage: 'published' }, { musicSelection: { track: 'name', token: 'no' } }]) {
    assert.throws(() => store.save(story, { ...base, ...patch }));
  }
  assert.equal(store.get(story.id), null);
});

test('explicit reviewed rebase preserves the earlier draft and every local version', async t => {
  const { store, story } = await fixture(t);
  store.save(story, { baseRevision: story.revision, expectedVersion: 0, caption: 'Keep this editorial work' });
  const changed = { ...story, revision: 'new-authoritative-revision', caption: 'Edited in n8n separately' };
  const input = { expectedVersion: 1, previousRevision: story.revision, currentRevision: changed.revision, confirm: 'keep_local_after_review' };
  assert.throws(() => store.rebase(changed, { ...input, confirm: 'silently' }), { code: 'INVALID_REBASE' });
  const result = store.rebase(changed, input);
  assert.equal(result.caption, 'Keep this editorial work');
  assert.equal(result.baseRevision, changed.revision);
  assert.equal(result.version, 2);
  const history = store.history(story.id);
  assert.equal(history.length, 2);
  assert.equal(history[1].baseRevision, story.revision);
  assert.equal(history[0].event, 'rebased_after_review');
  assert.throws(() => store.rebase(changed, input), { code: 'EDIT_CONFLICT' });
});

test('removed images require explicit sequence replacement during rebase and remain in prior history', async t => {
  const { store, story } = await fixture(t);
  store.save(story, { baseRevision: story.revision, expectedVersion: 0, selectedAssetIds: ['asset-1', 'asset-2'] });
  const changed = { ...story, revision: 'source-with-removed-image', media: story.media.filter(m => m.id !== 'asset-1') };
  const input = { expectedVersion: 1, previousRevision: story.revision, currentRevision: changed.revision, confirm: 'keep_local_after_review' };
  assert.throws(() => store.rebase(changed, input), { code: 'FOREIGN_ASSET' });
  const rebased = store.rebase(changed, { ...input, selectedAssetIds: ['asset-2'] });
  assert.deepEqual(rebased.selectedAssetIds, ['asset-2']);
  assert.deepEqual(store.history(story.id)[1].selectedAssetIds, ['asset-1', 'asset-2']);
});

test('editorial direction saves with history/proposals but cannot grant rights or alter source captions', async t => {
  const { store, story } = await fixture(t);
  const creativeBrief = {
    hookType: 'hidden_connection', angle: 'A proposed connection to investigate, not an established fact.',
    visualIntent: 'Use the original photograph as evidence; review its visual strength manually.', captionApproach: 'sentence_case',
    sequenceRoles: [{ assetId: 'asset-1', role: 'question', note: 'Review opening photograph' }, { assetId: 'asset-2', role: 'payoff' }],
    ratings: { hook: 4, visual: 4, shareability: 5, timelessness: 4 }, notes: 'Manual editorial judgment',
    sourceLaneIds: ['photographer_portfolios', 'independent_magazines'],
  };
  const saved = store.save(story, { baseRevision: story.revision, expectedVersion: 0, creativeBrief });
  assert.equal(saved.creativeBrief.hookType, 'hidden_connection');
  assert.equal(store.history(story.id)[0].creativeBrief.ratings.visual, 4);
  const proposal = store.proposal(story);
  assert.equal(proposal.changes.creativeBrief.angle, creativeBrief.angle);
  assert.equal(proposal.rightsGranted, false);
  assert.equal(proposal.productionApplied, false);
  assert.equal(store.get(story.id).caption, undefined); // Choosing case/direction did not rewrite the caption.
  assert.throws(() => store.save(story, { baseRevision: story.revision, expectedVersion: 1, creativeBrief: { ...creativeBrief, ratings: { visual: 100 } } }), { code: 'INVALID_CREATIVE_BRIEF' });
  assert.throws(() => store.save(story, { baseRevision: story.revision, expectedVersion: 1, creativeBrief: { ...creativeBrief, publicationApproved: true } }), { code: 'INVALID_CREATIVE_BRIEF' });
  const changed = { ...story, revision: 'new-source-after-role-asset-removed', media: story.media.filter(m => m.id !== 'asset-1') };
  const rebase = { expectedVersion: 1, previousRevision: story.revision, currentRevision: changed.revision, confirm: 'keep_local_after_review' };
  assert.throws(() => store.rebase(changed, rebase), { code: 'INVALID_CREATIVE_BRIEF' });
  const corrected = { ...creativeBrief, sequenceRoles: creativeBrief.sequenceRoles.filter(role => role.assetId !== 'asset-1') };
  store.rebase(changed, { ...rebase, creativeBrief: corrected });
  assert.equal(store.history(story.id)[1].creativeBrief.sequenceRoles.length, 2);
  assert.equal(store.get(story.id).creativeBrief.sequenceRoles.length, 1);
});
