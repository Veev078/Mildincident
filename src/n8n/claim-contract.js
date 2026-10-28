// Proposed contract for conditional updates on the EXISTING production_packages row.
// This is not connected to production. Schema/engine verification and approval are required.
export const CLAIM_COLUMNS = Object.freeze(['buffer_claim_state', 'buffer_claim_owner', 'buffer_claim_digest']);

export function claimUpdate({ packageRowId, conceptId, packageVersion, owner, digest }) {
  if (!Number.isSafeInteger(packageRowId) || packageRowId < 1 || !Number.isSafeInteger(packageVersion) || packageVersion < 1 ||
    typeof conceptId !== 'string' || !conceptId || typeof owner !== 'string' || owner.length < 16 || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error('INVALID_CLAIM_INPUT');
  }
  return {
    resource: 'row', operation: 'update',
    dataTableId: { __rl: true, mode: 'id', value: 'cCFwaHyKVVTZvr5s' },
    matchType: 'allConditions', filters: { conditions: [
      { keyName: 'id', condition: 'eq', keyValue: packageRowId },
      { keyName: 'concept_id', condition: 'eq', keyValue: conceptId },
      { keyName: 'production_version', condition: 'eq', keyValue: packageVersion },
      { keyName: 'buffer_claim_state', condition: 'eq', keyValue: 'idle' },
    ] },
    columns: { mappingMode: 'defineBelow', value: { buffer_claim_state: 'reserved', buffer_claim_owner: owner, buffer_claim_digest: digest } },
  };
}

export async function acquirePackageClaim(repository, input) {
  // An ordinary read-then-write mock or n8n insert/upsert is NOT this capability.
  if (repository.atomicConditionalUpdate !== true) throw new Error('ATOMIC_CONDITIONAL_UPDATE_UNVERIFIED');
  const update = claimUpdate(input);
  const rows = await repository.updateMatching(update);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== input.packageRowId ||
    rows[0].concept_id !== input.conceptId || rows[0].production_version !== input.packageVersion || rows[0].buffer_claim_owner !== input.owner ||
    rows[0].buffer_claim_digest !== input.digest || rows[0].buffer_claim_state !== 'reserved') {
    throw new Error('CLAIM_NOT_ACQUIRED_DO_NOT_SEND');
  }
  return rows[0];
}

export async function transitionPackageClaim(repository, input, nextState) {
  if (repository.atomicConditionalUpdate !== true) throw new Error('ATOMIC_CONDITIONAL_UPDATE_UNVERIFIED');
  const allowed = { reserved: ['create_started', 'idle'], create_started: ['confirmed_draft', 'needs_reconciliation'], needs_reconciliation: ['confirmed_draft'] };
  if (!allowed[input.state]?.includes(nextState)) throw new Error('UNSAFE_CLAIM_TRANSITION');
  const update = claimUpdate(input);
  update.filters.conditions = update.filters.conditions.filter(c => c.keyName !== 'production_version' && c.keyName !== 'buffer_claim_state');
  update.filters.conditions.push(
    { keyName: 'buffer_claim_state', condition: 'eq', keyValue: input.state },
    { keyName: 'buffer_claim_owner', condition: 'eq', keyValue: input.owner },
    { keyName: 'buffer_claim_digest', condition: 'eq', keyValue: input.digest },
  );
  update.columns.value = { buffer_claim_state: nextState };
  const rows = await repository.updateMatching(update);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== input.packageRowId || rows[0].concept_id !== input.conceptId || rows[0].buffer_claim_owner !== input.owner || rows[0].buffer_claim_digest !== input.digest || rows[0].buffer_claim_state !== nextState) {
    throw new Error('CLAIM_TRANSITION_FAILED_DO_NOT_SEND');
  }
  return rows[0];
}
