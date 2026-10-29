import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { acquirePackageClaim, transitionPackageClaim } from '../src/n8n/claim-contract.js';

// Exercise equivalent conditional UPDATE ... RETURNING semantics on an actual SQL engine.
// This proves the protocol, not the version/engine in the remote n8n Cloud deployment.
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE packages(id INTEGER PRIMARY KEY, concept_id TEXT, production_version INTEGER,
    buffer_claim_state TEXT, buffer_claim_owner TEXT, buffer_claim_digest TEXT);
    INSERT INTO packages VALUES (1, 'existing-story', 4, 'idle', '', '');`);
  const repository = { atomicConditionalUpdate: true, async updateMatching(update) {
    const pairs = Object.entries(update.columns.value);
    const filters = update.filters.conditions;
    const columns = new Set(['id', 'concept_id', 'production_version', 'buffer_claim_state', 'buffer_claim_owner', 'buffer_claim_digest']);
    if ([...pairs.map(p => p[0]), ...filters.map(f => f.keyName)].some(k => !columns.has(k))) throw new Error('Unsupported fixture column');
    return db.prepare(`UPDATE packages SET ${pairs.map(([key]) => `${key} = ?`).join(', ')} WHERE ${filters.map(f => `${f.keyName} = ?`).join(' AND ')} RETURNING *`)
      .all(...pairs.map(([, value]) => value), ...filters.map(f => f.keyValue));
  } };
  const input = { packageRowId: 1, conceptId: 'existing-story', packageVersion: 4, owner: 'execution-owner-A', digest: 'a'.repeat(64) };
  return { db, repository, input };
}

function proof(input, kind, extra = {}) {
  const { packageRowId, conceptId, packageVersion, owner, digest } = input;
  return { kind, packageRowId, conceptId, packageVersion, owner, digest, observedAt: new Date().toISOString(), ...extra };
}

function readback(input, overrides = {}) {
  return proof(input, 'independent_provider_readback', {
    expectedChannelId: 'fixture-channel', expectedCaption: 'Approved fixture caption', expectedMediaUrls: ['https://example.org/one.jpg', 'https://example.org/two.jpg'],
    post: { id: input.candidatePostId, channelId: 'fixture-channel', text: 'Approved fixture caption', status: 'draft', dueAt: null, sentAt: null,
      assets: [{ source: 'https://example.org/one.jpg' }, { source: 'https://example.org/two.jpg' }], ...overrides },
  });
}

test('conditional claim on one existing package row admits exactly one contender and blocks stale package versions', async t => {
  const { repository, input } = fixture(t);
  await assert.rejects(acquirePackageClaim(repository, { ...input, packageVersion: 3 }), /CLAIM_NOT_ACQUIRED/);
  const results = await Promise.allSettled([
    acquirePackageClaim(repository, input), acquirePackageClaim(repository, { ...input, owner: 'execution-owner-B' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});

test('create-started and uncertain claims cannot expire/reset or be released by a competing execution', async t => {
  const { repository, input } = fixture(t);
  await acquirePackageClaim(repository, input);
  const competing = { ...input, state: 'reserved', owner: 'execution-owner-B' };
  await assert.rejects(transitionPackageClaim(repository, competing, 'idle', proof(competing, 'pre_provider_failure', { remoteRequestStarted: false, failureCode: 'EXPORT_FAILED' })), /TRANSITION_FAILED/);
  await transitionPackageClaim(repository, { ...input, state: 'reserved' }, 'create_started', proof(input, 'current_package'));
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'create_started' }, 'idle'), /UNSAFE_CLAIM_TRANSITION/);
  await transitionPackageClaim(repository, { ...input, state: 'create_started' }, 'needs_reconciliation');
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'needs_reconciliation' }, 'idle'), /UNSAFE_CLAIM_TRANSITION/);
  await assert.rejects(acquirePackageClaim(repository, { ...input, owner: 'execution-owner-B' }), /CLAIM_NOT_ACQUIRED/);
  const candidate = { ...input, state: 'needs_reconciliation', candidatePostId: '0123456789abcdef01234567' };
  await transitionPackageClaim(repository, candidate, 'confirmed_draft', readback(candidate));
});

test('claim protocol refuses repositories with unverified atomic update behavior', async () => {
  await assert.rejects(acquirePackageClaim({ updateMatching() { throw new Error('must not run'); } }, {}), /ATOMIC_CONDITIONAL_UPDATE_UNVERIFIED/);
});

test('release requires explicit fresh pre-provider failure evidence and cannot erase a possibly-started request', async t => {
  const { db, repository, input } = fixture(t);
  await acquirePackageClaim(repository, input);
  const reserved = { ...input, state: 'reserved' };
  await assert.rejects(transitionPackageClaim(repository, reserved, 'idle'), /INVALID_CLAIM_EVIDENCE/);
  await assert.rejects(transitionPackageClaim(repository, reserved, 'idle', proof(input, 'pre_provider_failure', { remoteRequestStarted: true, failureCode: 'EXPORT_FAILED' })), /RELEASE_EVIDENCE_REQUIRED/);
  await assert.rejects(transitionPackageClaim(repository, reserved, 'idle', proof(input, 'pre_provider_failure', { remoteRequestStarted: false, failureCode: 'EXPORT_FAILED', observedAt: '2020-01-01T00:00:00Z' })), /STALE_CLAIM_EVIDENCE/);
  assert.equal(db.prepare('SELECT buffer_claim_state FROM packages').get().buffer_claim_state, 'reserved');
  await transitionPackageClaim(repository, reserved, 'idle', proof(input, 'pre_provider_failure', { remoteRequestStarted: false, failureCode: 'EXPORT_FAILED' }));
  assert.equal(db.prepare('SELECT buffer_claim_state FROM packages').get().buffer_claim_state, 'idle');
});

test('confirmation cannot be obtained from a flag, mismatched/stale scope, scheduled result, or reordered media', async t => {
  const { db, repository, input } = fixture(t);
  await acquirePackageClaim(repository, input);
  await transitionPackageClaim(repository, { ...input, state: 'reserved' }, 'create_started', proof(input, 'current_package'));
  const candidate = { ...input, state: 'create_started', candidatePostId: '0123456789abcdef01234567' };
  const evidence = readback(candidate);
  const bad = [
    undefined,
    { ...evidence, kind: 'create_response' },
    { ...evidence, digest: 'b'.repeat(64) },
    { ...evidence, observedAt: '2020-01-01T00:00:00Z' },
    readback(candidate, { status: 'scheduled' }),
    readback(candidate, { dueAt: '' }),
    readback(candidate, { id: 'wrong-id' }),
    readback(candidate, { text: 'Different caption' }),
    readback(candidate, { assets: [...evidence.post.assets].reverse() }),
  ];
  for (const invalid of bad) await assert.rejects(transitionPackageClaim(repository, candidate, 'confirmed_draft', invalid), /CLAIM_EVIDENCE|READBACK_PROOF/);
  assert.equal(db.prepare('SELECT buffer_claim_state FROM packages').get().buffer_claim_state, 'create_started');
  await transitionPackageClaim(repository, candidate, 'confirmed_draft', evidence);
  assert.equal(db.prepare('SELECT buffer_claim_state FROM packages').get().buffer_claim_state, 'confirmed_draft');
});

test('source edits and unknown transition names cannot bypass retained version and owner checks', async t => {
  const { db, repository, input } = fixture(t);
  await acquirePackageClaim(repository, input);
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: '__proto__' }, 'idle'), /UNSAFE_CLAIM_TRANSITION/);
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'reserved' }, 'create_started', proof(input, 'current_package', { digest: 'b'.repeat(64) })), /INVALID_CLAIM_EVIDENCE/);
  db.exec('UPDATE packages SET production_version = 5');
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'reserved' }, 'create_started', proof(input, 'current_package')), /TRANSITION_FAILED/);
  assert.equal(db.prepare('SELECT buffer_claim_state FROM packages').get().buffer_claim_state, 'reserved');
});

test('claim inputs reject coercible, oversized and accessor values before repository mutation', async t => {
  const { repository, input } = fixture(t);
  const cases = [
    { ...input, owner: 'a'.repeat(10000) }, { ...input, conceptId: { toString: () => 'existing-story' } },
    { ...input, digest: { toString: () => 'a'.repeat(64) } }, { ...input, packageRowId: NaN },
    { ...input, state: { toString: () => 'reserved' } },
    Object.defineProperty({ ...input }, 'owner', { get() { throw new Error('getter must not run'); } }),
  ];
  for (const invalid of cases) await assert.rejects(acquirePackageClaim(repository, invalid), /INVALID_CLAIM_INPUT/);
  assert.equal((await acquirePackageClaim(repository, input)).buffer_claim_state, 'reserved');
});
