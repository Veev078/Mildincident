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
