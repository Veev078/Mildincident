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
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'reserved', owner: 'execution-owner-B' }, 'idle'), /TRANSITION_FAILED/);
  await transitionPackageClaim(repository, { ...input, state: 'reserved' }, 'create_started');
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'create_started' }, 'idle'), /UNSAFE_CLAIM_TRANSITION/);
  await transitionPackageClaim(repository, { ...input, state: 'create_started' }, 'needs_reconciliation');
  await assert.rejects(transitionPackageClaim(repository, { ...input, state: 'needs_reconciliation' }, 'idle'), /UNSAFE_CLAIM_TRANSITION/);
  await assert.rejects(acquirePackageClaim(repository, { ...input, owner: 'execution-owner-B' }), /CLAIM_NOT_ACQUIRED/);
  await transitionPackageClaim(repository, { ...input, state: 'needs_reconciliation' }, 'confirmed_draft');
});

test('claim protocol refuses repositories with unverified atomic update behavior', async () => {
  await assert.rejects(acquirePackageClaim({ updateMatching() { throw new Error('must not run'); } }, {}), /ATOMIC_CONDITIONAL_UPDATE_UNVERIFIED/);
});
