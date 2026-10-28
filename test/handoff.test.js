import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAndSend, reconcileKnownDraft } from '../src/handoff.js';
import { DraftLedger, scopeKey } from '../src/ledger.js';
import { fakeAdapter, fixture, handoffOptions } from './helpers/fixtures.js';

test('single action prepares clean files, creates only one draft, records its ID, and verifies each repeated click', async t => {
  const f = await fixture(t);
  const adapter = fakeAdapter();
  const options = handoffOptions(f, adapter);
  const first = await prepareAndSend(options);
  assert.equal(first.reused, false);
  assert.equal(first.attempt.state, 'confirmed_draft');
  assert.equal(first.attempt.remote_id, 'fake-draft-1');
  const second = await prepareAndSend(options);
  assert.equal(second.reused, true);
  assert.equal(second.attempt.remote_id, first.attempt.remote_id);
  assert.equal(adapter.creates, 1);
  assert.equal(adapter.reads, 2);
  assert.deepEqual(f.ledger.events(scopeKey(f.manifest)).map(e => e.event), [
    'intent_committed', 'remote_id_recorded', 'draft_readback_verified', 'draft_readback_verified',
  ]);
});

test('simultaneous clicks from separate ledger connections cannot create two drafts', async t => {
  const f = await fixture(t);
  const otherLedger = new DraftLedger(f.ledgerFile);
  t.after(() => otherLedger.close());
  const adapter = fakeAdapter();
  const results = await Promise.allSettled([
    prepareAndSend(handoffOptions(f, adapter)),
    prepareAndSend({ ...handoffOptions(f, adapter), ledger: otherLedger }),
  ]);
  assert.equal(adapter.creates, 1);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  for (const result of results.filter(r => r.status === 'rejected')) {
    assert.equal(result.reason.code, 'RECONCILIATION_REQUIRED');
  }
});

test('timeout after a remote side effect retains intent and prevents retry after database reopen', async t => {
  const f = await fixture(t);
  let creates = 0;
  const adapter = {
    async createUnscheduledDraft() { creates++; throw new Error('Request timed out after possible creation'); },
    async readPost() { throw new Error('No ID received'); },
  };
  await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RECONCILIATION_REQUIRED' });
  const reopened = new DraftLedger(f.ledgerFile);
  t.after(() => reopened.close());
  assert.equal(reopened.get(scopeKey(f.manifest)).state, 'needs_reconciliation');
  await assert.rejects(prepareAndSend({ ...handoffOptions(f, adapter), ledger: reopened }), { code: 'RECONCILIATION_REQUIRED' });
  await assert.rejects(reconcileKnownDraft({ ledger: reopened, key: scopeKey(f.manifest), adapter }), { code: 'REMOTE_ID_UNKNOWN' });
  assert.equal(creates, 1);
});

test('read-back failure retains a known ID, reconciles read-only, and never creates a second draft', async t => {
  const f = await fixture(t);
  const adapter = fakeAdapter();
  const read = adapter.readPost;
  adapter.readPost = async () => { throw new Error('Read temporarily unavailable'); };
  await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RECONCILIATION_REQUIRED' });
  assert.equal(f.ledger.get(scopeKey(f.manifest)).remote_id, 'fake-draft-1');
  adapter.readPost = read;
  const reconciled = await reconcileKnownDraft({ ledger: f.ledger, key: scopeKey(f.manifest), adapter });
  assert.equal(reconciled.state, 'confirmed_draft');
  const repeat = await prepareAndSend(handoffOptions(f, adapter));
  assert.equal(repeat.reused, true);
  assert.equal(adapter.creates, 1);
});

test('blocks pending rights, missing connection, and missing current-package reader before any external effect', async t => {
  const f = await fixture(t, { rights: 'pending' });
  const adapter = fakeAdapter();
  await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RIGHTS_NOT_CLEARED' });
  await assert.rejects(prepareAndSend({ ...handoffOptions(f, adapter), adapter: null }), { code: 'CONNECTION_REQUIRED' });
  await assert.rejects(prepareAndSend({ ...handoffOptions(f, adapter), readCurrentPackage: undefined }), { code: 'SOURCE_CONNECTION_REQUIRED' });
  assert.equal(adapter.creates, 0);
  assert.deepEqual(f.ledger.list(), []);
});

test('rejects a package edited during export before claiming or creating', async t => {
  const f = await fixture(t);
  const adapter = fakeAdapter();
  let reads = 0;
  const readCurrentPackage = async () => {
    const current = structuredClone(f.manifest);
    if (++reads > 1) current.caption = 'A later caption edit';
    return current;
  };
  await assert.rejects(prepareAndSend({ ...handoffOptions(f, adapter), readCurrentPackage }), { code: 'STALE_PACKAGE' });
  assert.equal(reads, 2);
  assert.equal(adapter.creates, 0);
  assert.deepEqual(f.ledger.list(), []);
});

test('a fresh local ledger requires a complete current audit and blocks known prior drafts or posts', async t => {
  const f = await fixture(t);
  const adapter = fakeAdapter();
  const audit = { complete: true, storyId: f.manifest.storyId, channelId: f.manifest.channelId, postIds: [], observedAt: new Date().toISOString() };
  const cases = [
    [undefined, 'HANDOFF_AUDIT_REQUIRED'],
    [async () => ({ ...audit, complete: false }), 'HANDOFF_AUDIT_INCOMPLETE'],
    [async () => ({ ...audit, observedAt: '2020-01-01T00:00:00Z' }), 'HANDOFF_AUDIT_STALE'],
    [async () => ({ ...audit, postIds: ['historical-existing-draft'] }), 'EXISTING_HANDOFF_FOUND'],
  ];
  for (const [readExistingHandoffs, code] of cases) {
    await assert.rejects(prepareAndSend({ ...handoffOptions(f, adapter), readExistingHandoffs }), { code });
  }
  assert.equal(adapter.creates, 0);
  assert.deepEqual(f.ledger.list(), []);
});

test('changing version, caption, or slide order cannot bypass story/channel deduplication', async t => {
  const f = await fixture(t);
  const adapter = fakeAdapter();
  await prepareAndSend(handoffOptions(f, adapter));
  const variants = [
    m => { m.packageVersion++; m.sourceRevision = 'new-revision'; },
    m => { m.caption = 'A changed caption'; },
    m => { m.slides.reverse(); },
  ];
  for (const mutate of variants) {
    const manifest = structuredClone(f.manifest);
    mutate(manifest);
    await assert.rejects(prepareAndSend({ ...handoffOptions(f, adapter), manifest, readCurrentPackage: async () => manifest }), { code: 'PACKAGE_CONFLICT' });
  }
  assert.equal(adapter.creates, 1);
});

test('never confirms scheduled/sent status, missing schedule evidence, or mismatched caption/media/channel', async t => {
  const changes = [
    p => { p.status = 'scheduled'; p.scheduledAt = '2026-10-31T09:00:00Z'; },
    p => { p.status = 'sent'; },
    p => { delete p.scheduledAt; },
    p => { p.caption = 'Changed remotely'; },
    p => { p.assetHashes.reverse(); },
    p => { p.channelId = 'wrong-account'; },
  ];
  for (const change of changes) {
    await t.test(change.toString(), async t => {
      const f = await fixture(t);
      const adapter = fakeAdapter();
      const read = adapter.readPost;
      adapter.readPost = async id => { const post = await read(id); change(post); return post; };
      await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RECONCILIATION_REQUIRED' });
      assert.equal(f.ledger.get(scopeKey(f.manifest)).state, 'needs_reconciliation');
      assert.equal(adapter.creates, 1);
      await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RECONCILIATION_REQUIRED' });
      assert.equal(adapter.creates, 1);
    });
  }
});

test('a prior confirmed draft later marked sent is surfaced and never recreated', async t => {
  const f = await fixture(t);
  const adapter = fakeAdapter();
  await prepareAndSend(handoffOptions(f, adapter));
  adapter.posts.get('fake-draft-1').status = 'sent';
  await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RECONCILIATION_REQUIRED' });
  assert.equal(adapter.creates, 1);
  const attempt = f.ledger.get(scopeKey(f.manifest));
  assert.equal(attempt.observed_status, 'sent');
  assert.equal(attempt.state, 'needs_reconciliation');
});
