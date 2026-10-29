# MILDINCIDENT release readiness — 2026-10-29 UTC

## Scope and recovery

Audited the existing checkout, history, source and tests. No new product features, external research sprint, production writes, workflow changes, scheduling, publishing, environment publication or deployment.

Original branch: `development/launch-reliability`, HEAD `eb082a4`. GitHub initially contained only `main` at `64fdf50`, the original blank `01-Central` commit. The substantial application commits had never been pushed. This explains the absent GitHub code.

Interrupted changes are preserved verbatim in recovery branch `recovery/interrupted-photography-20261029`, commit `7d94c18`. Stable branch: `staging/release-readiness-20261029`; startup repair: `0bdffe3`. The missing `src/image-curation.js` was absent from the checkout and all local Git history. Prior agent messages describe an interrupted transfer, not a usable recovered module. Removed only its imports, derived calls and shared-module route. The exact interrupted references remain in the recovery commit; no replacement module or fabricated curation output was introduced.

Private previews backend and its five tests remain. Unavailable agent-side photography UI, carousel rehearsal, curation module and proposal-review additions are NOT counted as delivered. No other agent filesystem is assumed recoverable.

## Feature evidence

WORKING means the specified local scope passed checks; it does not mean hosted, published or production-integrated.

| Feature | Status | Verified scope / limitation | Evidence |
| --- | --- | --- | --- |
| Workspace startup, dashboard, pipeline/navigation | WORKING | Loopback Node server; actual-data pages render | server.js; browser suite + actual smoke |
| Story dossiers, research, existing source notes | WORKING | Read-only n8n snapshot with current refresh; citations are not automatically fact-checked | model.js; browser tests |
| Captions, notes, autosave, history, explicit rebase | WORKING | Private SQLite proposals; save/reload/restart and conflict checks use synthetic fixtures | workspace-store/server tests; Chromium |
| Photography discovery | PARTIAL | Existing candidates, metadata search/rights filters, archive/source-search links; no automated new image acquisition or pixel-based taste assessment | views.js; editorial-direction.js |
| Real archival thumbnails | BROKEN | Actual cloud-browser check loaded zero images; CDN availability/expired URLs not independently resolved | actual smoke image counts below |
| Provenance and side-by-side comparison | WORKING | Metadata dialog and synthetic image comparison; no rights clearance inferred | Chromium image comparison |
| Carousel composition | WORKING | Local add/remove/order and accessible move controls; actual photo presentation limited by thumbnails | browser suite; draft validation |
| Caption tools and creative direction | WORKING | Deterministic metadata/citation warnings, hook/brief/role suggestions and manual taste ratings; no autonomous verified rewrite | editorial-intelligence/direction tests; Chromium |
| Music direction | PARTIAL | Metadata-based suggestions/manual choice persisted locally; no audio playback, license or Instagram availability validation | browser suite; intelligence tests |
| Video production/editing | NOT BUILT | No video editor, rendering pipeline or tested video playback feature | inspected web/ and src/ routes |
| Export preparation | PARTIAL | Tested local CLI prepares JPGs/manifests from supplied private files with rights gates; no connected browser-to-production export | package/cli tests; src/package.js |
| Duplicate prevention/reconciliation | PARTIAL | Tested local ledger/claims, source/provider checks; shared live n8n atomic authority and write adapter remain unverified/disabled | handoff/claim tests; ATOMIC_CLAIM_REVIEW.md |
| Private uploaded previews | PARTIAL | Decode/strip/retain/checksum/scoped API tests pass; upload UI absent and current image renderer rejects relative preview URLs | workspace-previews tests; web/components.js |
| Publishing/archive and analytics | WORKING | Read-only provider status, manual lifecycle and measured metrics with missing-data handling; not independent Instagram verification | model/analytics tests; actual smoke |
| Apply local edits back to n8n / create Buffer drafts | NOT BUILT | Proposal download only; no connected production writer or verified Buffer create adapter | server.js allowlist; handoff adapter gate |
| Authenticated browser-accessible staging | NOT BUILT | No usable Codex forwarding control; local host/origin checks reject hosted origins; no founder sign-in | runtime capabilities; server.js |

## Data boundaries

Product loads the last complete private source cache and refreshes fixed read-only n8n table routes and Buffer queries. On this run refresh succeeded at `2026-10-29T03:07:25.631Z`: **18 stories, 264 media records, 11 Buffer posts**, no refresh errors. This is fresh live-read data represented as a snapshot, not a continuously synchronized editor. Metrics are only those actually supplied; citations/provenance/rights/Instagram outcomes are not independently verified.

Mocks are restricted to tests and explicitly labeled browser fixtures. There is no product fallback to fake stories. Real snapshots, draft SQLite/history, image blobs and reports stay under ignored `.local/`; nothing from that private directory was pushed. Local edits do not update n8n/Buffer. Existing production Founder Studio remains a separate system.

## Verification performed

- `npm run check`: passed.
- `npm test`: **102 passed, zero failed/skipped** (97 baseline + five preserved preview tests).
- `npm run test:browser`: **16 workflow checks passed**, no browser JS errors; nine views at desktop/tablet/390/375 widths. Uses synthetic fixtures and intercepted synthetic images.
- Actual repaired startup: `PORT=4175 npm run workspace`; private health endpoint OK; production mutations disabled. Port 4175 avoids the earlier temporary committed-copy preview on 4174.
- Actual-source Chromium: six top-level views + seven existing-story tabs rendered (13 routes), no JS errors and no edits to actual drafts.
- Actual photography check after four seconds in library: 232 rendered image tags; **0 loaded, 8 failed, 224 pending/lazy**. Pending tags are not proven failures. Image access is not verified by successful metadata rendering.
- Persistence: isolated fixture SQLite reopen/restart tests and Chromium reload pass. Did not edit actual source stories/drafts to demonstrate this.
- Private evidence: `.local/release-audit/actual-smoke.json`, `library.png`, `secret-scan.json`; fixture browser evidence under `.local/browser-tests/`. Full test console logs were captured under `/tmp/mi-*.log`.

## GitHub and backup

Initial remote read confirmed only blank `main`. New staging branch push succeeded, leaving main unchanged; final remote SHA/tree verification is recorded in the checkpoint. Recovery commit is an ancestor of the stable branch, preserving interrupted work in its history. Local recovery branch also retained.

Pre-push scan covered 136 historical Git blobs for private keys, common provider tokens, literal credential assignments and credential-bearing URLs. Four URL findings were inspected: deliberately invalid synthetic test URLs, not credentials. No tracked `.env`, private snapshots, SQLite, uploads or generated media were found. Tracked handoff/architecture docs were reviewed: they contain internal system identifiers and historical operational notes, not authentication material. This is a heuristic scan, not a guarantee that every possible secret pattern is detectable.

A complete Git source bundle (all branches/history including recovery) and staging source tarball are prepared in `/workspace/`. They deliberately exclude credentials, `.local/` editorial data and dependencies; `npm ci` restores dependencies. Existing private local state remains intact in the original checkout.

## Render Free: NO as currently implemented

Free could support a restricted preview only after changes; it is not safe for this current editable workspace.

| Requirement | Observed state / consequence |
| --- | --- |
| Node/dependencies | Pinned `.node-version` 24.19.0; package engines >=24.17 <25. Local Node 24.19.0 + Sharp 0.35.5 work. Exact Render native dependency compatibility not tested. |
| Build | Proposed `npm ci --omit=dev`; no frontend compilation. Playwright is development-only. This command has not been run on Render. |
| Start/port | `npm run workspace`; PORT parsed correctly, but listener is hard-coded to 127.0.0.1 and Host/Origin checks permit only local HTTP origins. Needs reviewed proxy/origin handling and 0.0.0.0 binding for Render; simply changing host would remove an existing security boundary. |
| Authentication | None. All app/API/media/history/proposal routes need authentication and authorization before external access, with secure session/CSRF handling. Do not expose the raw server. |
| Persistence | Draft/history SQLite + WAL, preview SQLite/blobs and source cache use `.local/workspace/`. Render Free has ephemeral disk and no persistent disk option; instance replacement/redeploy loses these files. Sleep alone is not a reliable durability boundary. No external durable DB/blob integration exists. |
| Credentials | n8n/Buffer credentials stay server-side. Codex proxy bindings do not transfer to Render; enter existing credentials securely in Render settings, never Git/browser. Render API access and permissions remain untested. No token rotation is needed to establish this. |
| RAM/runtime | Measured repaired server RSS about 105 MiB during this local smoke. No Render deployment/load test; concurrent 40-megapixel Sharp decoding can exceed a Free instance's 512 MiB. No verified production RAM ceiling. |
| Sleep | Free service sleeps after inactivity and may restart; cold starts expected. Never treat its filesystem as a durable draft store. |

No deployable Blueprint was created because shipping one now would imply that authentication, origin handling and storage were ready. Do not click Deploy or enable Auto-Deploy yet.

Simplest durable staging path: Render paid Node service with a persistent disk, authenticated HTTPS reverse proxy/session boundary, and reviewed host/origin handling. A Free alternative is an authenticated **read-only** preview with edits/uploads disabled and live snapshots rebuilt on restart; that mode is not implemented. Keeping editable Free staging requires an external durable database/object store and is more work.

## Next action

In Render, disable Auto-Deploy and select the pushed `staging/release-readiness-20261029` branch for inspection, without deploying. Choose/approve either authenticated Free read-only preview or a paid persistent staging editor. Then implement only that small hosting/access boundary and verify its real HTTPS URL. Do not reopen the product roadmap, deploy n8n patches, enable publishing or claim the current site is browser-accessible.
