import { HandoffError, requireThat } from './errors.js';
import { assertDraftRights, canonical, preparePackage, sourceFingerprint, validateManifest, verifyPrepared } from './package.js';
import { scopeKey } from './ledger.js';

function assertAdapter(adapter) {
  requireThat(adapter && typeof adapter.createUnscheduledDraft === 'function' && typeof adapter.readPost === 'function', 'CONNECTION_REQUIRED', 'No verified Buffer draft adapter is connected. Live creation is disabled.');
}

async function assertCurrent(manifest, readCurrentPackage) {
  requireThat(typeof readCurrentPackage === 'function', 'SOURCE_CONNECTION_REQUIRED', 'A current-package reader is required; the historical handoff cannot establish the current package.');
  const current = await readCurrentPackage(manifest.storyId);
  requireThat(sourceFingerprint(current) === sourceFingerprint(manifest), 'STALE_PACKAGE', 'The current story revision, caption, rights, or slide selection differs. Refresh the package before handoff.');
}

async function assertNoExistingHandoff(manifest, readExistingHandoffs) {
  requireThat(typeof readExistingHandoffs === 'function', 'HANDOFF_AUDIT_REQUIRED', 'A fresh ledger is not proof of an empty Buffer account. A complete source-ledger and provider audit is required.');
  const audit = await readExistingHandoffs({ storyId: manifest.storyId, channelId: manifest.channelId });
  requireThat(audit?.complete === true && audit.storyId === manifest.storyId && audit.channelId === manifest.channelId &&
    Array.isArray(audit.postIds) && audit.postIds.every(id => typeof id === 'string' && id.length > 0),
  'HANDOFF_AUDIT_INCOMPLETE', 'Existing handoffs could not be established for this story/channel.');
  const age = Date.now() - Date.parse(audit.observedAt);
  requireThat(Number.isFinite(age) && age >= -5000 && age <= 60_000, 'HANDOFF_AUDIT_STALE', 'The existing-handoff audit must be current (within one minute).');
  requireThat(audit.postIds.length === 0, 'EXISTING_HANDOFF_FOUND', 'An existing draft, scheduled item, or prior post needs read-only reconciliation. No new draft will be created.');
}

function verifyRemote(attempt, observed) {
  requireThat(observed && typeof observed === 'object', 'UNVERIFIED_REMOTE', 'Provider read-back returned no post.');
  requireThat(observed.id === attempt.remote_id && observed.channelId === attempt.channel_id, 'REMOTE_MISMATCH', 'Provider read-back does not match the expected post/channel.');
  requireThat(observed.status === 'draft' && Object.hasOwn(observed, 'scheduledAt') && observed.scheduledAt === null, 'NOT_UNSCHEDULED_DRAFT', 'Provider did not verify an unscheduled draft. Review remotely without resending.');
  requireThat(observed.caption === attempt.expected.caption, 'REMOTE_MISMATCH', 'Remote draft caption differs from the approved package.');
  requireThat(Array.isArray(observed.assetHashes) && canonical(observed.assetHashes) === canonical(attempt.expected.assetHashes), 'REMOTE_MISMATCH', 'Remote draft media or slide order differs from the verified export.');
}

async function readBack({ ledger, attempt, adapter }) {
  let observed;
  try {
    observed = await adapter.readPost(attempt.remote_id);
    verifyRemote(attempt, observed);
    return ledger.confirm(attempt.scope_key);
  } catch (error) {
    // Store bounded codes/status only, never raw provider errors (which can contain keys or URLs).
    const code = error instanceof HandoffError ? error.code : 'READBACK_FAILED';
    const status = typeof observed?.status === 'string' ? observed.status.slice(0, 60) : null;
    ledger.markUncertain(attempt.scope_key, code, status);
    throw new HandoffError('RECONCILIATION_REQUIRED', `Draft read-back failed (${code}). The saved attempt must be reconciled; do not resend.`, { cause: error });
  }
}

/**
 * One application action, with remote effects accessible only through an injected,
 * independently audited adapter. No production Buffer HTTP contract is assumed here.
 */
export async function prepareAndSend({ manifest, inputRoot, privateRoot, ledger, adapter, readCurrentPackage, readExistingHandoffs }) {
  manifest = validateManifest(manifest); // Freeze a caller-owned selection before awaiting anything.
  assertAdapter(adapter);
  await assertCurrent(manifest, readCurrentPackage);
  const prepared = await preparePackage(manifest, { inputRoot, privateRoot });
  assertDraftRights(prepared);
  await assertCurrent(manifest, readCurrentPackage); // Export may have taken time.
  const verified = await verifyPrepared(prepared.directory);
  requireThat(verified.fingerprint === prepared.fingerprint, 'EXPORT_TAMPERED', 'Private export changed after preparation.');
  if (!ledger.get(scopeKey(manifest))) await assertNoExistingHandoff(manifest, readExistingHandoffs);
  const { attempt, reused } = ledger.claim(prepared); // Durable atomic intent BEFORE remote effects.
  if (reused) {
    // A previous success is historical; confirm it is still a draft without creating another.
    return { attempt: await readBack({ ledger, attempt, adapter }), reused: true, prepared };
  }
  try {
    const result = await adapter.createUnscheduledDraft({
      idempotencyKey: attempt.request_key,
      channelId: manifest.channelId,
      caption: manifest.caption,
      assets: prepared.slides.map(slide => ({
        file: `${prepared.directory}/${slide.file}`,
        sha256: slide.sha256,
        assetId: slide.assetId,
      })),
    });
    requireThat(typeof result?.id === 'string' && result.id.trim().length > 0 && result.id.length <= 300, 'UNVERIFIED_REMOTE', 'Create returned no usable remote ID.');
    ledger.recordRemoteId(attempt.scope_key, result.id);
  } catch (error) {
    // Even a timeout may mean creation succeeded. Never automatically release/retry this intent.
    ledger.markUncertain(attempt.scope_key, 'CREATE_OUTCOME_UNKNOWN');
    throw new HandoffError('RECONCILIATION_REQUIRED', 'Create outcome is unknown. The durable intent is retained; inspect the provider before further action.', { cause: error });
  }
  return { attempt: await readBack({ ledger, attempt: ledger.get(attempt.scope_key), adapter }), reused: false, prepared };
}

export async function reconcileKnownDraft({ ledger, key, adapter }) {
  requireThat(adapter && typeof adapter.readPost === 'function', 'CONNECTION_REQUIRED', 'A read-only provider connection is required for reconciliation.');
  const attempt = ledger.get(key);
  requireThat(attempt, 'ATTEMPT_NOT_FOUND', 'No draft intent exists for this key.');
  requireThat(attempt.remote_id, 'REMOTE_ID_UNKNOWN', 'No provider ID was received. A read-only provider audit is required; matching captions alone cannot safely identify this attempt. No automatic reset or resend is available.');
  return readBack({ ledger, attempt, adapter });
}
