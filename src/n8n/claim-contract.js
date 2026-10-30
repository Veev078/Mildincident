// Proposed contract for conditional updates on the EXISTING production_packages row.
// This is not connected to production. Schema/engine verification and approval are required.
export const CLAIM_COLUMNS = Object.freeze(['buffer_claim_state', 'buffer_claim_owner', 'buffer_claim_digest']);

// Inputs and evidence are normalized records produced by trusted adapters, never raw
// request bodies. Bounded plain JSON shapes prevent coercion/accessor/toJSON surprises.
function plainRecord(value, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  return keys.length <= 100 && keys.every(key => typeof key === 'string' && (!allowedKeys || allowedKeys.includes(key)) && 'value' in descriptors[key]);
}

function validateClaim(input) {
  if (!plainRecord(input, ['packageRowId', 'conceptId', 'packageVersion', 'owner', 'digest', 'state', 'candidatePostId'])) throw new Error('INVALID_CLAIM_INPUT');
  const { packageRowId, conceptId, packageVersion, owner, digest } = input;
  if (!Number.isSafeInteger(packageRowId) || packageRowId < 1 || !Number.isSafeInteger(packageVersion) || packageVersion < 1 ||
    typeof conceptId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(conceptId) || typeof owner !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(owner) ||
    typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest) ||
    (input.state !== undefined && (typeof input.state !== 'string' || !/^[a-z_]{1,40}$/.test(input.state))) ||
    (input.candidatePostId !== undefined && (typeof input.candidatePostId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(input.candidatePostId)))) throw new Error('INVALID_CLAIM_INPUT');
  return input;
}

function evidenceScope(input, evidence, kind, allowedKeys) {
  if (!plainRecord(evidence, ['kind', 'observedAt', 'packageRowId', 'conceptId', 'packageVersion', 'owner', 'digest', ...allowedKeys]) ||
    evidence.kind !== kind || evidence.packageRowId !== input.packageRowId || evidence.conceptId !== input.conceptId ||
    evidence.packageVersion !== input.packageVersion || evidence.owner !== input.owner || evidence.digest !== input.digest ||
    typeof evidence.observedAt !== 'string' || evidence.observedAt.length > 40 || !/^\d{4}-\d\d-\d\dT/.test(evidence.observedAt)) throw new Error('INVALID_CLAIM_EVIDENCE');
  const age = Date.now() - Date.parse(evidence.observedAt);
  if (!Number.isFinite(age) || age < -5000 || age > 60_000) throw new Error('STALE_CLAIM_EVIDENCE');
}

function verifyTransitionEvidence(input, nextState, evidence) {
  if (nextState === 'create_started') {
    // digest is recomputed by the source adapter from the current caption, ordered
    // media, rights and source revision, not merely copied from the existing claim.
    evidenceScope(input, evidence, 'current_package', []);
  } else if (nextState === 'idle') {
    evidenceScope(input, evidence, 'pre_provider_failure', ['remoteRequestStarted', 'failureCode']);
    if (evidence.remoteRequestStarted !== false || typeof evidence.failureCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(evidence.failureCode)) throw new Error('RELEASE_EVIDENCE_REQUIRED');
  } else if (nextState === 'confirmed_draft') {
    evidenceScope(input, evidence, 'independent_provider_readback', ['post', 'expectedChannelId', 'expectedCaption', 'expectedMediaUrls']);
    const post = evidence.post;
    const urls = evidence.expectedMediaUrls;
    if (!input.candidatePostId || !plainRecord(post) || post.id !== input.candidatePostId ||
      typeof evidence.expectedChannelId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(evidence.expectedChannelId) || post.channelId !== evidence.expectedChannelId ||
      typeof evidence.expectedCaption !== 'string' || !evidence.expectedCaption.trim() || evidence.expectedCaption.length > 10000 || [...evidence.expectedCaption].length > 2200 || post.text !== evidence.expectedCaption ||
      post.status !== 'draft' || !Object.hasOwn(post, 'dueAt') || post.dueAt !== null || !Object.hasOwn(post, 'sentAt') || post.sentAt !== null ||
      !Array.isArray(urls) || urls.length < 1 || urls.length > 10 || !Array.isArray(post.assets) || post.assets.length !== urls.length) throw new Error('DRAFT_READBACK_PROOF_REQUIRED');
    for (let i = 0; i < urls.length; i++) {
      let url;
      if (typeof urls[i] !== 'string' || urls[i].length > 4096) throw new Error('DRAFT_READBACK_PROOF_REQUIRED');
      try { url = new URL(urls[i]); } catch { throw new Error('DRAFT_READBACK_PROOF_REQUIRED'); }
      if (url.protocol !== 'https:' || url.username || url.password || !plainRecord(post.assets[i]) || post.assets[i].source !== urls[i]) throw new Error('DRAFT_READBACK_PROOF_REQUIRED');
    }
  }
}

function matchesClaimRow(row, input, state) {
  return plainRecord(row) && row.id === input.packageRowId && row.concept_id === input.conceptId &&
    row.production_version === input.packageVersion && row.buffer_claim_owner === input.owner && row.buffer_claim_digest === input.digest && row.buffer_claim_state === state;
}

export function claimUpdate(input) {
  const { packageRowId, conceptId, packageVersion, owner, digest } = validateClaim(input);
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
  if (repository?.atomicConditionalUpdate !== true || typeof repository.updateMatching !== 'function') throw new Error('ATOMIC_CONDITIONAL_UPDATE_UNVERIFIED');
  const update = claimUpdate(input);
  const rows = await repository.updateMatching(update);
  if (!Array.isArray(rows) || rows.length !== 1 || !matchesClaimRow(rows[0], input, 'reserved')) {
    throw new Error('CLAIM_NOT_ACQUIRED_DO_NOT_SEND');
  }
  return rows[0];
}

// Existing handoff ledgers retain provider IDs; no candidate-ID column or parallel authority is proposed.
function matchesCandidateRecord(row,input){return plainRecord(row)&&row.recordId&&row.conceptId===input.conceptId&&row.packageVersion===input.packageVersion&&row.owner===input.owner&&row.digest===input.digest&&row.candidatePostId===input.candidatePostId;}
export async function retainPackageCandidate(repository,input){
 validateClaim(input);if(!input.candidatePostId||!['create_started','needs_reconciliation'].includes(input.state))throw new Error('CANDIDATE_RETENTION_SCOPE_REQUIRED');
 if(repository?.atomicConditionalUpdate!==true||typeof repository.persistCandidate!=='function'||typeof repository.readCandidate!=='function')throw new Error('DURABLE_CANDIDATE_ADAPTER_UNVERIFIED');
 await repository.persistCandidate(input);const record=await repository.readCandidate(input);
 if(!matchesCandidateRecord(record,input))throw new Error('CANDIDATE_NOT_DURABLY_RETAINED_DO_NOT_RETRY');return record;
}

export async function transitionPackageClaim(repository, input, nextState, evidence) {
  if (repository?.atomicConditionalUpdate !== true || typeof repository.updateMatching !== 'function') throw new Error('ATOMIC_CONDITIONAL_UPDATE_UNVERIFIED');
  validateClaim(input);
  const allowed = { reserved: ['create_started', 'idle'], create_started: ['confirmed_draft', 'needs_reconciliation'], needs_reconciliation: ['confirmed_draft'] };
  if (!Object.hasOwn(allowed, input.state) || !allowed[input.state].includes(nextState)) throw new Error('UNSAFE_CLAIM_TRANSITION');
  verifyTransitionEvidence(input, nextState, evidence);
  if(nextState==='confirmed_draft'&&(typeof repository.readCandidate!=='function'||!matchesCandidateRecord(await repository.readCandidate(input),input)))throw new Error('CANDIDATE_NOT_DURABLY_RETAINED_DO_NOT_RETRY');
  const update = claimUpdate(input);
  // Version remains in the conditional UPDATE. A source edit cannot be silently
  // confirmed under the old claim; failure retains the existing claim for review.
  update.filters.conditions = update.filters.conditions.filter(c => c.keyName !== 'buffer_claim_state');
  update.filters.conditions.push(
    { keyName: 'buffer_claim_state', condition: 'eq', keyValue: input.state },
    { keyName: 'buffer_claim_owner', condition: 'eq', keyValue: input.owner },
    { keyName: 'buffer_claim_digest', condition: 'eq', keyValue: input.digest },
  );
  update.columns.value = { buffer_claim_state: nextState };
  const rows = await repository.updateMatching(update);
  if (!Array.isArray(rows) || rows.length !== 1 || !matchesClaimRow(rows[0], input, nextState)) {
    throw new Error('CLAIM_TRANSITION_FAILED_DO_NOT_SEND');
  }
  return rows[0];
}
