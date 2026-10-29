# Photography review increment — 2026-10-29

Existing records remain authoritative. Open any candidate's provenance dialog, choose **Private preview file**, confirm private review and save. JPG/PNG/WebP up to25 MiB are decoded server-side; originals and metadata-stripped previews stay under `.local/workspace/previews/`. Images display in comparison and carousel after reload. Uploads never grant rights or verify that the file depicts the recorded source. Source metadata and production packages are untouched.

External thumbnails load in the browser, with loading/failure/retry states. Windows success and cloud failure can coexist: cloud outbound policy and provider/CDN restrictions differ from a local browser; stale URLs are another possible cause. Prior cloud diagnostics observed proxy/CDN failures. No universal source outage is inferred, and no unrestricted server-side downloader was added.

The current n8n sourcing workflow was fetched read-only into private `.local/photography-review/sourcing-before.json`: version `83023876-09a8-49af-97b1-326fb04f2678`, active,165 nodes. Existing paths include original-page extraction, Brave broader search, a seven-lead shortlist and an eight-attempt per-story cap. Do not create a parallel search engine. No workflow activation or production write occurred in the UI increment.

Original inspiration-report text exists privately at `.local/workspace/inspiration-reference.txt`. Its public-post data is dated and has no reach/saves/retention evidence; it is not current first-party analytics. No new visual/model inspection or competitor metrics are claimed.

Verification:104 automated tests and18 Chromium workflows pass. Browser upload test uses generated synthetic pixels, verifies decoded image display/reload and unchanged source rights. Source-image failures and retries are tested separately. Browser fixtures are not evidence of successful real CDN delivery.

## Update from a Windows ZIP installation

1. Stop the app with Ctrl+C. Back up your existing folder.
2. Download/extract the new development branch ZIP to a **new folder**.
3. With the old app stopped, copy your `.env.local` and entire `.local` folder into the new folder. Copy the complete directory, including SQLite WAL/SHM files; do not cherry-pick one database file or run both copies against the same storage.
4. In the new folder, run `npm ci --omit=dev`, then `npm run workspace:local` using Node24.19.0.
5. Open http://127.0.0.1:4174/ and hard-refresh (Ctrl+F5). Keep the old folder as rollback. Never copy credentials or private state into GitHub.

Next: review and test the existing n8n qualification contracts before any versioned patch; then connect bounded discovery to the existing intake/research pipeline. Autonomous discovery, on-demand requests, vision analysis and scheduled loops are not implemented by this increment. Ongoing scheduling/cost approval is still required.

## Prepared n8n guard increment

`src/n8n/photo-url-guard.js` prepares a guarded edit of the **existing** `Broaden — Qualify Cross-Source Preview Leads` node. It rejects private/numeric host references and credential/signature query parameters before they become browser preview records. This is URL syntax screening, not DNS validation or availability verification. Existing metadata ranking, output fields, seven-lead cap and per-story query limits remain unchanged. It adds no downloader, external call or second sourcing engine.

The captured existing node code was executed locally with synthetic Brave results: a legitimate archive candidate passes; a172.16 address and a credential-bearing URL do not. Two regression tests cover the self-contained n8n helper, code/version drift, mapping preservation and no input mutation. Final totals: **106 automated tests,18 Chromium workflows**, syntax checks pass. Actual-snapshot Chromium also opens the updated candidate/upload dialog across18 source stories, with no JS errors or actual draft writes.

**Not applied or activated.** Saved workflow version `83023876-09a8-49af-97b1-326fb04f2678` differs from active version `75efdc48-8cdf-467d-983a-fc164524867d`. Do not publish the full saved workflow and accidentally activate unrelated pending changes. Proposed full workflow and version/hash review are private in `.local/photography-review/sourcing-proposed.json` and `guard-review.json`. Before deployment, review callers, derive the exact minimal patch from the chosen active version, capture a fresh rollback export, confirm current hashes, and test on an isolated version. Existing user authorization permits safe non-destructive changes once those checks are complete; no new approval is inferred merely from this drift.

No autonomous recurring jobs, AI charges, Buffer creates or live edits were enabled. Next priority is the active-version sourcing contract, followed by a bounded manual discovery-to-review run in the existing research/intake workflow; recurring activation remains separately approval-gated.
