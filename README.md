# MILDINCIDENT

An editorial workspace for an independent archival publication, backed by the existing n8n and Buffer system.

The product-wide development workspace includes editorial home, story pipeline, unified research/caption/music desk, image library, carousel review, publishing center, archive and measured analytics. It uses actual source snapshots and keeps edits in versioned private local proposals. **It has not replaced Founder Studio or changed any live workflow, story, Buffer item, schedule or Instagram post.**

Start with [workspace usage and deployment boundaries](docs/WORKSPACE.md), [product friction addressed](docs/PRODUCT_FRICTION.md), [editorial intelligence](docs/EDITORIAL_INTELLIGENCE.md), and the [current checkpoint](docs/SPRINT_STATUS.md).

The autonomous sprint connected both APIs and inspected the actual production system. Start with [current live findings](docs/LIVE_AUDIT.md), [sprint checkpoint](docs/SPRINT_STATUS.md), [Halloween review](docs/HALLOWEEN_REVIEW.md), and [proposed production changes](docs/PRODUCTION_REVIEW.md). The connection failures described in the initial assessment are resolved.

The starting checkout contained only a blank `01-Central` file. The supplied [handoff](docs/reference/handoff-2026-10-28.md) is a dated historical source, not verified live data. See the [engineering assessment](docs/engineering-assessment.md), [architecture](docs/architecture.md), and [backlog](docs/backlog.md).

## Develop

Use the existing checkout; a cloud task is already isolated. Node **24.19.0** is available and pinned in `.node-version`.

```sh
cd /workspace/Mildincident
npm ci
npm run check
npm test
npm run workspace
```

The workspace starts on **loopback port 4174**, loads the last completed source cache and refreshes read-only n8n/Buffer observations. Local caption, sequence, notes and music edits autosave with history and revision checks. Proposal JSON downloads are review artifacts, not production updates. There is no send, schedule, publish, delete or rights-clearance endpoint. In a sandbox, HTTP/child-process/browser tests may require execution permission; do not skip them or call a denied test passing.

`npm run test:browser` runs the local Chromium workflow/regression suite with labeled synthetic fixtures and a temporary private store. The system Chromium path is configurable with `CHROMIUM_PATH`. Screenshots/reports stay under ignored `.local/`. `npm run studio` still starts the older historical launch brief on port 4173; it is not the primary product-wide workspace.

No build step is required: backend modules run directly in Node; the frontend uses browser ES modules and reusable components. Tests decode generated JPGs, exercise durable state across processes, simulate remote failures, and make functional HTTP/browser requests. Automated edit tests use fixtures, not real editorial assets or production writes. Production dependency audit reported zero vulnerabilities.

## Prepare private JPGs

Use a private directory for an existing, approved editorial selection. Create `manifest.json` next to already framed **1080 × 1350 JPGs**. This is a local export receipt, not a new story record.

```json
{
  "schemaVersion": 1,
  "storyId": "EXISTING_STORY_ID",
  "packageVersion": 8,
  "sourceRevision": "CURRENT_AUTHORITATIVE_REVISION",
  "channelId": "VERIFIED_BUFFER_CHANNEL_ID",
  "caption": "The actual edited caption from the current package.",
  "slides": [{
    "assetId": "EXISTING_SELECTED_ASSET_ID",
    "file": "selected/01.jpg",
    "sha256": "REPLACE_WITH_THE_FILE_SHA256",
    "source": {
      "url": "https://example.org/original-source-record",
      "creator": "Actual photographer or creator"
    },
    "rights": { "status": "pending", "evidence": [] }
  }]
}
```

Compute the selected input file's SHA-256 with `sha256sum selected/01.jpg` from that private directory. Then:

```sh
npm run preflight -- /absolute/private/path/manifest.json
npm run ledger
```

Preparation fully decodes the JPGs, verifies hashes/dimensions/order, strips embedded metadata, and writes private numbered JPGs and a receipt under ignored `.local/exports/`. It does not resize/crop, remove visible watermarks/text, judge authenticity, fetch URLs, upload, or create drafts. JPG encoding is lossy; originals remain untouched. Captions and provenance stay in the receipt. Input paths must stay within the manifest's directory. The conservative local limit is ten slides, pending a verified provider contract.

Rights may remain `pending` or `restricted` for private preparation. The conservative external-handoff gate requires every image's `rights.status` to be `cleared`, with `evidence` (HTTPS references), `reviewedBy`, and `reviewedAt` (ISO timestamp). Optional `credit` records the required attribution. This validates the **presence of a human decision**, not the legal validity of a license. An upload, archive URL, or generated checksum grants no rights.

## Draft handoff: implemented locally, live adapter disabled

`prepareAndSend()` in [src/handoff.js](src/handoff.js) is the single orchestrated action for a future Studio integration. It requires injected current-package, existing-handoff, and verified provider adapters. Only test adapters are shipped. There is deliberately no production send command or guessed Buffer mutation.

- Rechecks the current package, prepares files, and requires per-image rights evidence.
- Requires a complete recent audit of pre-existing handoffs before claiming a new story/channel.
- Commits an atomic on-disk intent before calling the provider.
- Reuses one confirmed ID after fresh read-back. Changing caption, version, or images does not create another draft for the same story/channel.
- Confirms only read-back evidence of `draft`, `scheduledAt: null`, correct channel, exact caption, and ordered verified media.
- On timeout/crash/uncertain read-back, blocks blind retry. A known ID can be reconciled read-only; an unknown ID requires a provider audit.

These guarantees apply to clients sharing **one preserved SQLite file**. Independent restored cloud machines must not write to production until a shared authoritative lock/outbox or verified provider-native idempotency is installed. See the [adapter and release contract](docs/buffer-adapter-contract.md).

## Live audit connection

The ChatGPT apps **BUFFER** and **Business HQ – N8N** are visible in the supplied screenshot, but their tools are not exposed in this Codex session. A ChatGPT app permission setting does not establish Codex tool access.

The existing environment has working secure `N8N_API_KEY` and `BUFFER_ACCESS_TOKEN` bindings. Reuse them; no new token or rotation is required by this code. Keep values out of repository files, logs and chat. The browser receives only allowlisted editorial fields, never credentials or founder tokens. Cloudinary signing credentials are not needed for this local workspace.

Both n8n and Buffer access were verified after the new environment was published. Use the existing configured credentials; no new token is needed. Commands remain read-only:

```sh
npm run audit:n8n
npm run audit:production
npm run audit:buffer
```

The audit uses the platform HTTPS proxy and system CA trust. It issues only GET requests to the eight known n8n workflow IDs and their recent execution summaries. Redirects are rejected. Raw workflow snapshots go under private, ignored `.local/audits/`; summaries keep saved vs active version IDs distinct and omit raw code, credential values, and execution payloads. This is a starting audit, not a completed inspection of workflow history, tables, Buffer, or Instagram. It fails clearly when access is missing.

`audit:production` inventories all workflows and table schemas/rows with pagination and records the complete retained error listing. `audit:buffer` discovers the exact existing Instagram channel and reads every post page through fixed GraphQL queries. It cannot create/edit/delete/schedule posts. Reports include observed timestamps; recheck relevant provider records before action. A Buffer permalink is reported evidence, not an independently verified Instagram page.

To review captured records or generate private, version-bound workflow patches:

```sh
node scripts/review-production-snapshot.mjs .local/audits/production-RUN .local/audits/buffer-RUN/posts.json .local/review.json
node scripts/prepare-production-patch.mjs .local/audits/production-RUN/workflow-BzMqQS8lfkwN7peQ.json .local/patches
node scripts/validate-private-workflow-snapshots.mjs .local/audits/production-RUN
```

Replace RUN paths with actual audit outputs. Generated patches stay private because workflow code/metadata can contain sensitive material. Patch preparation has no remote update/activation function. The existing-table atomic claim contract is a tested protocol, not a verified deployed migration. Local SQLite is not a second production backend.

## Next product actions

Review the local frontend across existing stories and stage it only after authentication/origin/deployment approval. Use proposal downloads to review caption/sequence work against current n8n records. Existing source permissions, atomic claim validation and provider/Instagram reconciliation remain separate prerequisites for production publishing changes; see [atomic claim review](docs/ATOMIC_CLAIM_REVIEW.md). No dates or UI actions grant scheduling/publication approval.
