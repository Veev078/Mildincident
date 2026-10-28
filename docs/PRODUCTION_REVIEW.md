# Production change review and rollback

No change here has been deployed. No publish, schedule, delete, credential rotation or production data write is authorized. The local branch contains the source and tests needed to review proposed changes.

## A — Founder Studio feedback (ready for approval)

Target: `ecWr4PeKU4vKLQ1m`, active version `9a32cde5-40b3-4d90-8d6e-30c7e2505cf9`.

Two text changes in `Build Editorial Dashboard HTML`:

- Draft success becomes a timestamp-scoped statement: the transfer confirmed a draft then; check its current Buffer status before scheduling or sending again.
- Uncertain transfer explicitly says do not send again; review the recorded ID and provider status first.

The patch preserves the existing editorial UI, routes, source data and controls. Generated JS compiles; active and patched nodes render HTML from captured table rows. Conditional feedback text has regression coverage. Authenticated browser interaction/visual review is still pending.

Private artifact: `.local/patches/ecWr4PeKU4vKLQ1m-9a32cde5-40b3-4d90-8d6e-30c7e2505cf9.json`.

## B — Draft import verification and recovery (tested patch; release blocked)

Target: `BzMqQS8lfkwN7peQ`, active version `c6c0d049-57bf-4d18-b687-aa9745988fc4`.

- Block earlier non-abandoned story handoffs across versions; reject internal-test captions.
- Parse and preserve a candidate post ID from the create response independently of success.
- Save candidate ID to the existing claim row before any read-back request.
- Independently query Buffer for ID, channel, caption, status, explicit null dueAt/sentAt, and ordered media URLs.
- On errors, preserve reconciliation state and the candidate ID. No create retry is added.
- Reuse the existing credential reference. Do not replace working JPG export/staging or guess a new creation payload.

Private artifact: `.local/patches/BzMqQS8lfkwN7peQ-c6c0d049-57bf-4d18-b687-aa9745988fc4.json`.

Remaining release prerequisites: verify that the existing Bearer credential works with the API read endpoint; verify remote engine/version and implement a shared atomic claim; govern the guarded/coordinator create paths; validate current source revision again immediately before creation; run isolated staging/integration tests with approved assets; obtain founder approval. Exact media URL order is verified, not provider-side file hashes—Buffer does not expose SHA-256 in the observed schema. The input ZIP checksum remains the existing byte-integrity boundary.

## Atomic claim inside the existing backend

`src/n8n/claim-contract.js` prepares conditional updates on **one existing `production_packages` row per story**, preserving n8n as the authority. It proposes three new columns: `buffer_claim_state`, `buffer_claim_owner`, `buffer_claim_digest`. No columns or rows were added remotely.

The public n8n upstream implementation was inspected: its Postgres path applies filters directly to `UPDATE ... RETURNING` within a transaction. The source was read from the moving `master` branch; it is **not proof of the deployed Cloud version or engine**, especially the non-Postgres return-data path. Keep the adapter disabled until these semantics are verified for the deployed version in an isolated test.

Migration proposal, requiring separate approval:

1. Re-read current tables and handoffs. Fail on multiple production rows for one story. Back up the schema and affected rows privately.
2. Add dedicated claim columns to existing package rows. Initialize stories with any prior/uncertain handoff to `blocked_existing_handoff`, not idle. Never initialize from a truncated scan or infer no handoff from an empty local ledger.
3. A claimant conditionally updates the exact row ID/story/version where state is `idle`; exactly one returned row with its owner/digest is success. No insert/upsert or separate read/write pair is allowed.
4. Persist `create_started` before calling Buffer. Only `reserved` can return to idle after a proven pre-provider failure. `create_started` and `needs_reconciliation` never expire/reset automatically. Provider confirmation requires independent read-back.
5. Reconcile existing IDs and use the same authority for every create path. Preserve historical manual ledger rows. Test owner/digest checks, stale versions, concurrent executions, process death and uncertain responses before enabling.

The SQL tests validate the protocol locally; a live concurrency test and migration are explicitly unrun. The current private publishing patch reports `deployable: false` rather than pretending the existing insert/read claim is fixed.

## Application and rollback procedure after approval

1. Re-fetch current saved and active workflows; compare expected version and code/graph SHA-256 from the patch artifact. Stop on drift; never overwrite intervening edits or publish unrelated saved drafts.
2. Capture fresh private backup JSON of the exact active graph/settings and record execution activity. Apply only reviewed nodes/connections in an isolated copy first.
3. Verify actual n8n node schema, expression evaluation, credential mapping and error routing. Run safe private tests before activation. Do not schedule/publish test posts.
4. After approved activation, verify the actual active version and one controlled permitted result with an independent read-back. Disable the new entry point on uncertainty.
5. Roll back only the reviewed graph changes against the latest version after checking intervening edits. Preserve all claims, remote IDs, media and drafts. A rollback must never clear a claim or resend a post. Reconcile any possible side effect read-only.

Approval requested when the founder returns: **A, the two Studio feedback changes only.** B and its schema migration remain blocked on the technical prerequisites above; they are not offered as a ready production release.
