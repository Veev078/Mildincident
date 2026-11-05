# V12 / V1 living status

Updated November 4, 2026 (America/New_York). **Sprint B is in progress on top of verified Sprint A HEAD `70dd9b6bd3ed25de346c702bf049bb10534f5a63`; end-to-end live V1 acceptance remains incomplete.** The constitution owns product direction; older sprint evidence below retains history.

## Sprint B — operational discovery

B1 implements a read-only native theme catalog and request-bound selection through the **existing `brief`/prompt contract**. Every selection retains the exact native direction, key and content-derived version in an additive private SQLite table. It never writes the shared preset selection. Exact-content retries survive restarts/catalog changes; stale or ambiguous choices fail closed. Missing catalog access shows an unavailable state. Custom directions/source links now follow delivered proposals into Develop; later private edits take precedence.

Live GET-only inspection November 4, 10:45 PM ET: native intake `75BYc3JkTnA2eQVc` active version `7240d849-d676-43ef-86ca-9b367d99add5` has authenticated founder forms and scheduled intake, no authenticated per-request preset selector. Studio worker `6CkqfYc4Pyd4k8vi` is a separate inactive development workflow. Chief AI `bc6s9K5aMPNPzsPU` is inactive; its native approval responsibility is not replaced by local source triage. Preset table `2NoRbvxCc120cM8t` has Original MILDINCIDENT, Forgotten Pop Culture, Fashion & Subcultures and Halloween / Dark Curiosities; all four `is_active=false`. Shared selection `OQUJtdxjKZQLhYwS` points to `original_mildincident`. Halloween remains a saved October 28–31 overlay, not a newly activated season. Catalog selection saves a research direction, **not native preset activation or a research execution**. No invented native preset field was added.

B1 targeted checks: 36 pass (catalog reads/failure, immutable versioned direction/retry/restart, existing launch/receipt/idempotency, source caching, founder views). New execution is still blocked by read-only hosting, inactive worker, absent authorized dispatch/version and spend approval. No workflow/credential change, native write, paid call or deployment.

The remaining Sprint A sections are the prior acceptance baseline; Sprint B verification and editorial evaluation will supersede their counts and blockers below.

Branch: `development/photography-review-20261029`.

- Verified starting GitHub/local HEAD: `a772c317cadc2d00a9bdc2a1b083e5f59fcd5a10`.
- A — founder workflow and guarded launch mapping: `a533038100dc6e7a5d2a47537ea02c068bc27f54`.
- B — recorded source evidence and saved-research continuation: `934342f8c1827f32e63a046ee5c318673b08e3a4`.
- C — polish, background delivery/freshness fixes and final regression: the commit containing this update. Resolve its exact SHA with `git rev-parse HEAD`; the release response records the pushed SHA. All checkpoints use `[skip render]`.

## Workstreams / capability → interface

| Workstream / existing contract | Current founder experience and status |
| --- | --- |
| Entry / five primary destinations | Today leads with **Start a new discovery**, with Surprise Me, Theme / preset and Custom direction entry. Legacy routes remain. Verified empty and existing-work states. |
| Discovery configuration / request POST | Surprise Me uses the existing general `discovery` brief; Custom direction uses the existing `brief` + source URL contract. Inactive fields cannot invalidate another mode; unsaved custom input survives mode switches/general saves. **Native preset selection is not exposed:** no invented catalog or preset parameter. |
| Existing `/engine/queue` → `/engine/start` | Explicit Start research only under configured, non-read-only, approved, active/available flags. Separate confirmation discloses possible charges and requires an existing approved spend limit. Version-bound start, stable saved identity, no automatic retry after uncertainty. Implemented and adapter-tested; **hosted live launch remains blocked**. |
| Result refresh / native GET-only delivery | Check for results; queued/running/received/reviewable/failed/history distinctions. New proposals lead Discover when present; requests/admin details remain secondary. Passive progress rows no longer block background delivery; open editable details still protect pending input. Two real historical results remain historical. |
| Existing story draft PATCH / history | Develop → Photographs → Review has a coherent state/next action. Caption, natural-language direction, opening image, order, frame feedback, history and legacy focused tools retained. Private edits never imply production approval. |
| Existing `/engine/evidence` | **Read recorded source evidence** directly in a development story’s Research & sources view. Flush pending edits first; retain execution/job/hash guards. Reads earlier captured evidence, never reruns search/model or exposes raw execution headers. Read connection absence is explicit. |
| Readiness / package check / production observations | Immediate task first, completed preparation and all remaining tasks visible; codes/original decisions/evidence secondary. Rights, factual review and final approval independent. Earlier recorded handoffs take priority. Stale/incomplete provider observations without a recorded handoff lead to **Check for updates**, not an invented prior post. Production rows show preparation and one task link. |
| Native approval / publishing | Existing Founder Studio continuation, packet download/check and provider records retained. **No new production writer, approval endpoint, native preset selector, Buffer sender or orchestration system.** |

## Verified operational

Live **read-only** observation November 4, 10:08 PM ET: **27 native stories, 302 media records, 15 Buffer records, two recovered historical research results; one unmatched native job held**. Current worker saved version `8b3e1293-5990-451c-8358-2cbe9e752a44`, inactive, no active version; readOnly=true, generationApproved=false, generationAvailable=false. Existing source/native APIs worked. New proof storage `.local/v12-live/` is separate from founder stores; no native/production write or paid request was made.

Final engineering verification:

| Check | Result |
| --- | --- |
| Automated unit/integration suite | **347 pass**, zero failures/skips |
| Existing Chromium regression | **42 workflows pass** |
| HTTPS hosted fixture | **11 pass**, including auth/CSRF, background delivery, private backup and cold restart |
| UX / photographic refinement | **8 / 9 pass** |
| V11 Discover / Develop regression | **5 / 7 pass** |
| New V12 founder journey | **7 pass**, including blocked and authorized-adapter launch, cancellation, uncertainty/no retry, direct captured evidence, source freshness and editing continuity |
| Syntax / whitespace / desktop-mobile layout | pass; zero browser JavaScript errors |

New V12 tests use the actual local application/routes/SQLite stores with injected adapters and **labeled synthetic pixels**, not live generation. Read-only live integration is separately verified above. The existing Render host was not changed or tested as a V12 deployment.

Before/after captures against `a772c31`: Today, Discover, Story, Review and Production at **1366×768, 1440×900 and 390×844**, under private `.local/v12/`. Fresh real-record copies (27 native + 2 historical results) are under `.local/v12/real-data/`; baseline comparison `report.json` and final `after-report.json` verify unchanged original snapshot/database hashes and zero writes. Captures retain observed/cached timestamps; freshness can change as time passes. External photograph requests were deliberately aborted, never replaced. **No real photograph pixels or new editorial quality were verified.**

Measured fixture friction: the immediate review action’s lower edge moves from **y=1353 to y=663** at1366×768 (below fold → visible). At1440×900:1355→665. New proposals precede setup when present; empty inboxes lead with setup. Direct evidence access no longer requires finding a request’s administrative record. These are interaction measurements, not founder satisfaction or aesthetic-quality proof.

Authoritative reports: `.local/v12/workflow-report.json`, `.local/browser-tests/report.json`, `.local/v12/ux-regression/report.json`, `.local/ux-refinement/refinement-report.json`, `.local/v11/discover-report.json`, `.local/v11/develop-report.json`. Old `*-failure.png` files are development artifacts, not final evidence.

## Implemented but not live-accepted / blocked

- Actual hosted research launch is read-only and the worker inactive. A separately authorized dispatch connection, active/version-approved bounded worker and current spend/pricing approval are missing. **Saving is not running research.**
- Studio cannot select a named native preset: no verified catalog/selection contract is exposed. Custom theme requests work as briefs, not as preset changes.
- Fresh source yield, inspectable real photographs, attribution/editorial quality and founder taste acceptance remain unproven. Legitimate source/preview access is required; no proxy workaround or fabricated photography.
- Native rights/fact/final approvals and guarded production import remain existing-workflow operations. Shared atomic handoff/production acceptance is still required before any separately approved writer or Buffer action.
- Founder acceptance and actual-host post-deploy verification are outstanding. No V1 completion percentage is claimed.

## Release and remaining acceptance

The frontend branch is ready for a **separately authorized manual update of the existing Render service**, retaining current read-only behavior. No new secrets, environment change, schema migration or dependency update is required by V12. Do not apply a new Blueprint/service. Preserve an offsite private backup, disk and histories; manually deploy the exact tested SHA with auto-deploy off; verify HTTPS login, unauthenticated401, discovery saved/blocked/history states, caption/order/direction persistence and safe source refresh. Follow the existing-service procedure in `docs/PRIVATE_HOSTING.md`. **No deploy was performed.**

A–C engineering acceptance is complete. Live V1 acceptance still requires founder use on the existing host, one genuinely new inspectable source-grounded proposal and separately validated native approval/production continuation. Existing authentication, private persistence, factual/rights and idempotency safeguards remain; no workflow activation, Buffer draft, publication, credential change or paid research occurred.

## Three highest-impact next tasks

1. Founder acceptance of Today → Discover → Story → Photographs → Review → Production after an authorized existing-service update; confirm actual-device previews and restart persistence.
2. Separately authorize and verify the bounded launch/source-access path to deliver one new inspectable photographic proposal. Verify the native preset catalog/selection contract before exposing selectable names.
3. Validate current native fact/rights/final approval and production handoff with exact package/provider evidence and concurrency/idempotency proof before any approved production writer.

Reproduce in the managed Node24.19.0 / system-Chromium environment: `npm run check`, `npm test`, `npm run test:browser`, `npm run test:hosted`, `npm run test:ux -- --baseline=a772c31 --artifacts=.local/v12/ux-regression`, `npm run test:refinement`, `node test/browser-v12.mjs`. Loopback tests need execution permission in a restricted sandbox. `node test/browser-v12-live.mjs` additionally requires the private read-only snapshot/research copies, intentionally excluded from Git.
