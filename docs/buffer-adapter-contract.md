# Buffer integration and reversible release

**Not connected or activated.** This contract describes the interface used by the local tests. It does not assert that current Buffer endpoints accept any particular mutation flags.

## First: inspect, preserve, and reconcile

1. Attach `BUFFER` and `Business HQ – N8N` to this session if supported, or configure the secure environment bindings. Inspect names/presence and actual read-only responses without printing values. Proxy placeholders must use the configured authenticated HTTPS route; they are not raw signing keys.
2. Read current workflow versions, active versions, recent executions, production-file registry, export log, Buffer manual-import ledger, and Buffer handoff log. Capture private rollback snapshots before any remote change. Do not overwrite concurrent n8n edits.
3. Read actual Buffer account/channel and all relevant post statuses with pagination. Compare the four anomaly IDs and the Halloween draft against Instagram permalink/provider evidence. Buffer `sent` is not sufficient Instagram confirmation.
4. Reconcile existing story-to-post mappings before enabling new creation. The historical Halloween draft must not be recreated. A fresh local SQLite file is not an empty remote account.

## Core interface

`prepareAndSend({manifest, inputRoot, privateRoot, ledger, adapter, readCurrentPackage, readExistingHandoffs})` expects:

- `readCurrentPackage(storyId)` returns the strict manifest shape from the authoritative existing package. The version, revision, caption, provenance, rights, and ordered original hashes must be current. Local filenames may differ; bytes and selection must not.
- `readExistingHandoffs({storyId, channelId})` returns `{complete: true, storyId, channelId, postIds: [], observedAt: ISO_TIMESTAMP}` only after a complete, recent read of source handoff ledgers and provider records (all statuses, including sent/scheduled). Missing permissions, pagination gaps, uncertain mappings, or stale observations mean `complete: false`. Known IDs block automatic creation and require reconciliation. The core only accepts observations within one minute.
- `adapter.createUnscheduledDraft({idempotencyKey, channelId, caption, assets})` accepts only ordered local verified assets (`file`, `sha256`, `assetId`) and returns `{id}`. It must upload through approved private/staging infrastructure, rehash actual bytes, and invoke a **verified draft-only** API operation. Do not forward arbitrary manifest fields to Buffer. No default scheduling, auto-queue, publish, update-existing, or delete operation is permitted.
- `adapter.readPost(id)` independently returns normalized evidence `{id, channelId, status: 'draft', scheduledAt: null, caption, assetHashes: [ordered_clean_sha256s]}`. It must come from a provider read, not the create request or create response. Missing fields fail closed. Verify asset identity using the production-file/staging registry and actual media mapping; do not fabricate provider hashes where Buffer does not expose them. Record the provenance of normalized evidence.

The core has **no automatic retries around creation**. A timeout, malformed create response, crash after intent, or failed read-back preserves the claim. `reconcileKnownDraft({ledger, key, adapter})` performs only a read for an already recorded provider ID. With no ID, a provider/ledger audit is required. It cannot reset or resend an uncertain request.

## Conditions before a production adapter can be enabled

- Current official Buffer documentation and observed API semantics establish an unscheduled draft. The historical combination `mode: addToQueue`, `schedulingType: automatic`, `saveToDraft: true` is **not** an accepted contract until independently verified. No such payload is shipped here.
- Draft creation cannot accidentally queue or schedule, including default behavior and validation failures. Tests verify the real normalized response and a separate read-back. Any controlled live private-draft test requires a verified safe account/channel and assets; never post an internal-test caption to a live queue.
- Per-image rights review and staging authorization are recorded. Cloudinary signing needs a supported secure runtime signer; a proxy placeholder cannot perform local HMAC signing. Do not paste signing credentials into setup scripts.
- All production callers share a central durable claim/outbox (or a verified native provider idempotency boundary). Preserve it independently of deployment snapshots. Local SQLite is a reference implementation for a single shared disk, not a cross-cloud exactly-once claim.
- The current source revision is protected against concurrent editing during final handoff, staging is idempotent, output hashes/order are checked immediately before transfer, and provider read-back can prove the resulting item and media.
- Missing credentials, existing drafts, stale packages, double clicks, retries, process death, read-back failure, provider 429/5xx, and status drift have meaningful tests. A failed attempt is visible and never silently labeled success.

## Migration and rollback

1. Keep Founder Studio and existing webhooks in place. Run this module in isolation with generated fixtures first. Map real schemas only after inspection; do not guess table columns or source revision fields.
2. Add the smallest draft-only integration behind a disabled feature flag. Capture the exact active workflow/version and rollback JSON privately. Establish a single writer authority and preserve prior handoff mappings.
3. Activate only after the required private validations and production safeguards above are satisfied. Keep scheduling/publication controls separate from the new action. Verify the actual active workflow version after activation.
4. On regression, disable the new entry point and restore only the changed workflow/version after checking intervening edits. Preserve every draft, JPG, source record, ledger row, event, and remote ID. Never delete the ledger or create a replacement draft as a rollback strategy. Reconcile ambiguous outcomes read-only.

There has been no production activation in this session. Local rollback is simply to stop the read-only server and leave the original `01-Central` and production system untouched. Preserve `.local/` receipts and ledger state if any real integration is later introduced.
