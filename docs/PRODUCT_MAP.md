# MILDINCIDENT product map

[Constitution](PRODUCT_CONSTITUTION.md) owns intent; [sprint status](SPRINT_STATUS.md) owns current evidence. This map describes the existing platform, not a replacement architecture. Engineering owners below are modules, not new services.

| Founder task | Existing implementation owner | Authority / current maturity | Next acceptance evidence |
| --- | --- | --- | --- |
| Today / Review | `web/review.js`, `founder-review.js`, `research-store.js` | Local versioned founder decisions; real native results separated from history. Working in fixture browser tests and cached-data smoke. | Founder reviews the populated restored Studio on their own computer (Gate A). |
| Discover / Explore | `photography/service.js`, `discovery/publication-feeds.js`, `n8n/editorial-development-engine.js` | Local private research plus existing n8n orchestration. Archive adapters/feed parsing are fixture-tested; publication hosts currently blocked. Native Brave historically observed, current costs unknown. | Approved legitimate live source path with inspectable new photographs (Gate B). |
| Develop | `web/app.js`, `workspace/store.js`, `editorial-readiness.js` | Versioned local caption/sequence/direction/history. No production save. Cached real stories and synthetic browser edit tests. | Founder image/claim/working-copy review; demonstrate scoped feedback effect on a subsequent authorized run (Gates A/C). |
| Production | `production-bridge.js`, `production-packet-contract.js`, existing native workflows | Read-only inspection/validated packet and fixture import proof. Native production remains sole authority. No live importer or atomicity proof. | Separately approved isolated native concurrency/import test before any migration or writer (Gate D). |
| Library / Learn | `workspace/previews.js`, `founder-review.js`, `photography/fingerprint.js`, backup helpers | Private sources, decisions, metadata and pixel fingerprints when uploaded. Verified backup/restore. No autonomous retraining; future performance contract only. | Founder-visible fresh-image evaluations and measured use (Gates C/E). |

Paths without a prefix above are in `src/` or `src/workspace/` as appropriate; the UI remains the existing single app with backward-compatible routes. The five tasks are a logical navigation model, not five rebuilt apps.

## Existing native integration

| Workflow / native records | Identity | Last verified role/state |
| --- | --- | --- |
| Development editorial worker | `6CkqfYc4Pyd4k8vi` | Inactive saved version `8b3e1293-5990-451c-8358-2cbe9e752a44` (Oct30 readback). Scoped feedback, exact-image continuation and source-aware photographic credit/series logic staged, unexecuted. |
| Development jobs / candidates | `z22YLsWc4lO1yCG4` / `W40NQ6jFBZWbpB3U` | Studio read-only correlation/import. Two historical results recovered; one incomplete unmatched job left untouched. |
| Free photo research proof | `7Ju5AhcNJ9qkATwo` | Inactive, never executed; offline packet/receipt proof only. |
| Editorial research / media sourcing | `75BYc3JkTnA2eQVc` / `Zouc5I3MQwRJhfXG` | Existing active production sources, unchanged. Brave images node observed historically. |
| Native Founder Studio / production builder | `ecWr4PeKU4vKLQ1m` / `YdW8V9Qxl2qn5mC8` | Existing production authority; local Studio does not replace native data ownership. |
| Manual Buffer / guarded / release coordinator | `BzMqQS8lfkwN7peQ` / `Q02tRHMtZ90Kib18` / `v5ThKs5ZYP3RhZop` | Existing production paths, unchanged; deeper Buffer work deferred. |

States are dated observations, not perpetual live guarantees. Full historical native inventory: [LIVE_ARCHITECTURE.md](LIVE_ARCHITECTURE.md). Contracts: [photographic research](N8N_PHOTOGRAPHIC_RESEARCH.md), [source strategy](DISCOVERY_SOURCE_STRATEGY.md), [production bridge](PRODUCTION_BRIDGE.md), [production approval](PRODUCTION_REVIEW.md), [private portability](PRIVATE_BACKUP.md).

## Acceptance gates today

A: local launch/restore/browser proof implemented, actual founder-device acceptance pending. B: no new live discovery this sprint; source permission and cost verification remain. C: scoped feedback changes request context in tests, real selection improvement unproven. D: read-only inbox and isolated import contracts work; live production atomicity/import unverified. E: recurring paid operation and performance loop neither approved nor built as an active service.
