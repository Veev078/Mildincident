import test from 'node:test';
import assert from 'node:assert/strict';
import { browserUrl, buildWorkspace } from '../src/workspace/model.js';
import { workspaceSnapshot } from './helpers/workspace-fixture.js';

test('browser model uses existing story identities and strips founder tokens and raw provider records', () => {
  const snapshot = workspaceSnapshot();
  const model = buildWorkspace(snapshot);
  const serialized = JSON.stringify(model);
  assert.equal(model.stories[0].id, 'CON-EXISTING-01');
  assert.equal(model.stories[0].media.length, 3);
  assert.ok(!serialized.includes('never-expose-founder-token'));
  assert.ok(!serialized.includes('never-expose-final-token'));
  assert.ok(!serialized.includes('Private provider text'));
  assert.equal(model.source.productionMutationsEnabled, false);
  assert.equal(model.stories[0].publishing.observed, 'buffer_unscheduled_draft');
});

test('source revisions follow editorial changes but not unrelated provider-status refreshes', () => {
  const snapshot = workspaceSnapshot();
  const first = buildWorkspace(snapshot).stories[0];
  snapshot.buffer.posts[0].status = 'sent';
  assert.equal(buildWorkspace(snapshot).stories[0].revision, first.revision);
  snapshot.records.packages[0].caption_draft += ' Edited in n8n.';
  const draft = { caption: 'Preserved local draft', baseRevision: first.revision, version: 1 };
  const second = buildWorkspace(snapshot, new Map([[first.id, draft]])).stories[0];
  assert.notEqual(second.revision, first.revision);
  assert.equal(second.localDraft.stale, true);
  assert.equal(second.localDraft.caption, draft.caption);
});

test('browser links reject executable URLs and credential-bearing references', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://example.org', 'https://name:secret@example.org', 'https://example.org/?access_token=private', 'https://example.org/?apiKey=private', 'https://example.org/?X-Amz-Signature=private', 'https://example.org/?review-token=private']) assert.equal(browserUrl(url), '');
  assert.equal(browserUrl('https://example.org/source'), 'https://example.org/source');
});

test('carousel and provenance changes invalidate draft revisions even without a version increment', () => {
  for (const mutate of [s => { s.records.packages[0].target_slide_count = 5; }, s => { s.records.stories[0].format = 'single_image'; }, s => { s.records.stories[0].approval_status = 'rejected'; }, s => { s.records.media[0].license = 'New restrictions'; }]) {
    const snapshot = workspaceSnapshot();
    const old = buildWorkspace(snapshot).stories[0].revision;
    mutate(snapshot);
    assert.notEqual(buildWorkspace(snapshot).stories[0].revision, old);
  }
});
