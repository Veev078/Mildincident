# V12 Improve with AI — implemented, live activation gated

November 6, 2026, America/New_York. Continues a4a0669 on development/photography-review-20261029. This checkpoint implements the operational Studio request path and prepares the existing native worker patch. **Policy disabled by default. No Render deployment, live workflow mutation/activation, real permit installation, paid model/search call or Buffer action.**

## Founder workflow now implemented

Improve with AI supports a closed list of directions: stronger opening, concise, narrative, another angle and supported perspective. Review request saves an unpaid source-bound proposal; it does not start AI. The review shows the retained story context, planned 1,800-output-token drafting limit, zero research/searches, expiry and estimated exposure. Confirmation is available only with an approved private policy, an exact active worker version/checksum, unchanged story/working caption and available allowance.

Confirm reserves one action, daily allowance and in-flight slot before network work. It creates a fresh 20-minute maxRuns: 1 authorization, queues through the existing development table and dispatches through the existing authenticated webhook once. The ledger survives duplicate clicks, concurrent windows, lost responses and restart. Starting without a confirmed execution is labelled unconfirmed; queued, running, completed, failed and uncertain outcomes remain distinct.

The result must match job/candidate/execution, original research/evidence, source revision, working version and chosen direction. A successful new draft opens Compare; working text is preserved until **Use selected draft** is explicitly chosen. Caption, sources, photo order, approvals and earlier edits remain separate. Empty/rejected/mismatched results cannot become a successful caption. Failed/uncertain requests are not resent automatically. A new request after a recorded terminal failure needs another explicit review/confirmation and consumes another allowance; uncertainty continues blocking new starts.

Disable future AI starts writes a durable stop flag, without waiting for a caption save. It survives refresh, restart and policy-file removal. It does not cancel accepted provider work, refund claims or re-enable automatically. Re-enabling requires separate operator approval/maintenance, not a browser switch.

## Authorization and accounting

`CaptionPilot` uses the existing research.sqlite with additive action/control/policy-event tables. One transaction reserves confirmed attempts and creates the fresh per-action grant; the existing engine transaction separately claims the exact dispatch. Source/working copy are rechecked within both claim boundaries, including after asynchronous inspection. Research packets from earlier confirmed actions can be reused after native execution-history expiry: only the same source revision/job/candidate/execution qualifies, evidence is revalidated, and the old permit is removed before preparing a fresh action. Hashes assume trusted private storage; they are integrity checks, not signatures against an operator rewriting both packet and hash. Failed/uncertain confirmed attempts count; no grant reset/refund. Existing correlated legacy/manual jobs participate in the in-flight check and existing authorized story starts share the daily allowance. Durable tables are queried directly, not the capped activity UI list. Dates reset in America/New_York; an unresolved prior-day operation still blocks a new start.

The proposed maximums are **six caption improvements and three full-story generations per day**, one operation at a time. These are limits within this persistent Studio ledger, not account-wide provider limits or guarantees about external/manual n8n activity. Automatic per-action provisioning is implemented for caption improvements. Full-story generation retains its existing separately authorized route; this sprint counts/guards those runs but does not introduce automatic story-grant renewal.

The **$2 usage-review threshold is monitoring**, not a guaranteed billing cap or automatic cancellation. Measured response tokens/search counts are retained with the request and available in its Draft receipt; missing measurements are identified rather than displayed as free usage. The daily estimate assumes previously used rates ($2.50/M input,$15/M output,$0.01 per reported search); account pricing, incomplete tool records and hidden retries remain unverified. Missing usage stays unknown. The current caption estimate is approximately **$0.04–$0.08 per planned draft**, not a cap. Native node retries remain off; no application resubmission was added. No new transport investigation was performed.

Runtime configuration uses the operator-only `STUDIO_CAPTION_POLICY_FILE`. Missing/malformed/unapproved/expired configuration leaves policy disabled. The file must be private (0600), within STUDIO_DATA_DIR but outside its backed-up editorial workspace. It carries enabled/approved flags, a new policy UUID/expiry, exact native version and graph SHA, limits and the existing dedicated native authentication. Provider credentials remain in n8n; no browser endpoint installs credentials, permissions, graphs or grants. JSON responses redact retained research packets and authorization IDs; proposal responses contain only review/status fields. Existing private authentication, same-origin and explicit-intent checks protect the new endpoints.

Configuration shape (documentation only, deliberately unapproved and non-executable):

```json
{
  "enabled": false,
  "approved": false,
  "id": "NEW_OPERATOR_POLICY_UUID_AFTER_APPROVAL",
  "expiresAt": "OPERATOR_APPROVED_EXPIRY",
  "workerVersion": "EXACT_INSTALLED_ACTIVE_VERSION",
  "graphSha256": "ea9b5178b77a69b7c1f5408da7c139f4c61587a44bd876746c25210af60793da",
  "dailyCaptionLimit": 6,
  "dailyStoryLimit": 3,
  "reviewThresholdUsd": 2,
  "connection": {
    "jobsTableId": "z22YLsWc4lO1yCG4",
    "candidatesTableId": "W40NQ6jFBZWbpB3U",
    "editorialWorkerId": "6CkqfYc4Pyd4k8vi",
    "headerName": "X-Mildincident-Development-Key",
    "token": "SUPPLY_EXISTING_PRIVATE_AUTH_SECURELY"
  }
}
```

The raw policy is never checked into Git or installed by this sprint. A first bounded acceptance can use caption limit 1, story limit 0 and a 20-minute policy expiry instead of activating the full pilot. The installed per-action worker is reused between caption requests; each confirmation creates a new exact packet/grant without rebuilding a graph through Codex.

## Precise native patch and current state

Same development worker **6CkqfYc4Pyd4k8vi**, existing queue/claim/lease, GPT5.4 drafting node, quality gate, one-result persistence and receipt. **No parallel engine or workflow.** The reviewed combined graph preserves standard research and adds four routing/validation nodes. Caption requests supply retained evidence through existing editorial_context_json; the caption branch skips every research model and source/image HTTP fetch node. The validator checks the full request hash, lease, exact single-use job-bound expiry, source identity, evidence hash, working caption/version, closed direction, captured Brand Brain and source qualification. Malformed caption packets fail closed rather than falling through into research.

For the first request, Studio needs access to the captured native execution; later confirmed packets provide a durable server-side source without another history fetch. If neither full capture is available, preparation stops—no research rerun or source invention. The actual draft input includes the current caption as writing context only, not additional factual evidence. Existing source passages remain authoritative. Input guard includes escaped working text and added instructions. New result lineage contains original job/candidate/execution/evidence plus source/working revision and direction. The client independently pins the exact full active graph checksum and request before queueing or dispatching.

Prepared graph SHA256:

`ea9b5178b77a69b7c1f5408da7c139f4c61587a44bd876746c25210af60793da`

Private review artifacts: `.local/caption-improvement-native/prepared-worker.json`, `review.json`, `render-report.json`, and `live-readback-delta.json`. The graph is based on the **proven execution 2359 Muse configuration** (saved revision 79a1d082, base hash fcbf3804…), not an assertion that the restored inactive graph already contains those changes. Read-only native inspection captured current saved **832bc6fd-6006-478b-946b-60109b9669d1**, inactive/activeVersion null, projection SHA 066ce0ae…. From that restored version, intended installation changes seven existing processor/template nodes and adds four gates/validator. Existing connections are rerouted at three origins plus the new edges. Model choices/options, credential references and settings (including availableInMCP=true) are preserved. Full checksum readback remains mandatory before activation; no settings are ignored.

Actual retained Marcie execution 2353 evidence passes offline validation. The actual n8n expression parser renders the new drafting input at **23,493 characters including instructions**, within the existing 30,000-character guard, with GPT-5.4 / max 1,800 and zero research/search/source-fetch operations. This is preparation, not a real new AI result.

Read-only inspection also found historical row 41949fff… still labelled generating, referencing execution 2252, whose current detail endpoint returns 404. The retained inventory fails the existing hash check for that row, so it remains unlinked; no record is reset/deleted or treated as proof of success. The browser test preserves the full retained inventory and verifies this exclusion using the existing identity rule. Any genuinely unsettled correlated job in the real persistent ledger must still be reconciled before an allowed start.

## Tests and visual evidence

Unit/integration coverage includes disabled defaults/no grant, input rejection, private-packet redaction, exact job scope, two-connection reservation races, two source-edit races, quotas across restart/day boundaries, legacy in-flight/allowance checks, disabled controls, queue/dispatch uncertainty, malformed result lineage, failed/empty/rejected output, and no automatic resubmission. The existing main browser and HTTPS fixture checks remain separate from actual hosting.

The local browser uses **real retained Marcie execution 2353 research and execution 2355 caption** in isolated stores, the full retained native inventory, and an injected simulated execution transport. Its returned draft is prominently labelled SIMULATED / NOT AI GENERATED. It verifies direction→unpaid review→duplicate Confirm→one simulated dispatch→starting/running→exact result in Compare→manual Apply→preserved original/four-photo order/research/approval→refresh/restart; then failure without retry, a separately confirmed fresh request, uncertainty without resend, and persistent disable/counts. Desktop/mobile screenshots were inspected and spacing corrected. Native writes / paid calls: 0; no new actual model quality or hosted behavior is claimed.

Verified: `npm run check`; 434 unit/integration tests; 40 existing workspace browser checks; 11 isolated HTTPS-fixture checks; and the six-group retained-data caption browser journey. Screenshots cover review and comparison on desktop/mobile, running, the draft receipt, failure, uncertainty and disabled state. Private review index: `.local/caption-pilot/REVIEW.md`; detailed report: `.local/caption-pilot/browser-report.json`. Tests use disposable writable stores; existing founder stories, drafts, approvals and historical native records are untouched. Hosted behavior and a new real AI caption are not verified by this sprint.

## Minimum separate approval for first founder-triggered live improvement

1. Authorize a backed-up release of the completed pushed commit to the existing Studio (or an explicitly isolated private Studio), preserving disk/sessions/data. Current code is not deployed by this task.
2. Recheck current native state and capture rollback. Explicitly authorize installing **only the full graph SHA above** in the same development worker, exact persisted readback verification, then activation of that exact installed version using existing private authentication. Stop on drift/mismatch; no silent normalization or retry.
3. Approve **one caption action**, not the full pilot: private policy caption limit 1 / story limit 0, expiry 20 minutes, pinned installed version/SHA. Founder chooses a direction and confirms the reviewed Marcie request in Studio. One planned GPT-5.4 draft / max 1,800 output tokens, zero research/search/fetch calls, approximately $0.04–$0.08 with disclosed residual hidden retry/billing risk; not a hard cap. No old permit reuse.
4. Observe exact execution/usage/delivery and founder Compare/Apply behavior. On failure or uncertain outcome, reconcile read-only without resubmitting. Then disable the policy, deactivate the worker and restore the captured original graph/settings inactive, preserving every claim/result/history. Restoration may create a new saved revision. No production/preset/credential/Buffer mutations are included.

This is a concrete approval checkpoint, not authorization to perform those actions now. To enable the full recurring 6 / 3 policy later requires separate explicit approval; ordinary future caption improvements then reuse the installed reviewed worker and auto-provision one new authorization per confirmed action.

## Rollback

Three additive tables in existing research.sqlite; no database replacement/reset or destructive migration. Code rollback to a4a0669 must retain all policy reservations, request/evidence/draft histories and native records. Keep the private policy disabled during rollback; old code does not enforce this new pilot policy. Worker restoration is a separately authorized live operation and is not performed here.
