# V12 operational integration — local checkpoints, activation gated

November 6, 2026 (America/New_York). Continues `7fdbd32` on `development/photography-review-20261029`. This sprint authorizes implementation, read-only inspection, isolated simulations and pushes only. No deployment, environment/credential change, workflow installation/activation, paid operation or Buffer write is performed.

## Proven baseline

Real founder-triggered caption execution **2360** used GPT-5.4, 4,564 input / 626 output tokens (including 75 reasoning output tokens), no research/searches. Estimated standard-rate cost **$0.0208**, not an invoice. Captured request/evidence/recovery hashes match Marcie, retained research 2353 and working version 6. Four photo references/order are retained. Native cleanup restored exact graph/settings SHA `066ce0ae56fdb219440442d475bdba931e7eca919731ab3a256914fa796f4ca7`, inactive saved revision `af24832e-702c-4f2f-b725-bad6479d5e1f`. The founder confirms hosted policy revocation/authentication removal and all hosted preservation checks passed. Those hosted checks are founder evidence, not a direct Codex browser audit. Hosted code remains `7fdbd32` until separately released.

## Checkpoint 1 — recurring founder-confirmed operations

The existing `CaptionPilot` now supports an explicit **version 2 / founder_confirmed** private approval in addition to the original bounded acceptance policy. Version 2 has no request-count quota, no daily reset limit and no invented spending cap. It supports a caption/story operation allowlist and optional operator expiry; omission of expiry is the explicit recurring approval contract. Missing, malformed, unapproved or disabled configuration still cannot spend. Old bounded policies are not silently upgraded.

Every actual request still requires an unpaid source-bound review followed by a separate founder confirmation. Confirmation creates a fresh exact job-bound, maxRuns:1, 20-minute grant and reserves the same durable ledger before network effects. Caption and story operations share one in-flight slot, including correlated legacy work and uncertain outcomes. Failures consume their attempt, never reset claims or automatically resubmit. Source and working revision checks, retained evidence, strict request hashes, exact full graph/version checks and deliberate Apply are preserved. The founder's permanent preference is not a live activation permission for this sprint.

Generate Stories uses the same native standard research/drafting route proven in execution 2359. Its review freezes the existing request/preset/feedback context. Surprise Me, Choose a Theme, Custom Direction and private themes remain the existing contracts. A confirmed action queues/dispatches the **original saved request ID** once, delivers a correlated result into that same Studio request, and links directly to Develop. No parallel engine or per-action workflow installation is introduced. Per-operation limits remain one planned research/3,500 output tokens/up to two searches and at most one draft/1,800 output tokens. Caption improvements use one planned draft/1,800 output tokens and zero research/searches/fetches. Hidden Cloud/provider retries and tool continuation remain disclosed residual risks.

Studio now shows a compact cumulative usage panel and individual receipts with execution identity, measured tokens, an estimated cost and unknown-usage counts. Estimates assume $2.50/M input, $15/M output and $0.01 per reported search, not verified account billing. A durable Disable future AI starts control covers both operations and survives restarts/config removal. No browser route can enable a policy or install credentials/workflows.

### One-time operator setup and maintenance

Reuse the existing `STUDIO_CAPTION_POLICY_FILE` path, persistent disk and existing dedicated dispatch authentication. Do **not** create a legacy research connection file or substitute `N8N_API_KEY`. Configuration is disabled by default. `scripts/studio-ai-policy.mjs` supports status, prepare, enable, disable and revoke. It prints only whitelisted status, never authentication. It never installs/activates a workflow, creates a grant, dispatches a model or changes provider credentials.

After separate approval and installation of the exact reviewed worker, an operator can stage recurring approval once:

```sh
node --use-env-proxy --use-system-ca scripts/studio-ai-policy.mjs prepare \
  --graph-sha 6d9fb599a810f6b931e09c35c6d51542b7d36443d45dfaacabeb6a8ce1407e28 \
  --worker-version EXACT_INSTALLED_VERSION --operations caption,story
```

This reuses the secret already in the private policy if present. If it was revoked, supply `--dispatch-secret-file /PRIVATE_EXISTING_FILE` only after a secure one-time transfer of the existing dedicated dispatch secret into a private 0600 file inside STUDIO_DATA_DIR and outside workspace/backups. No values belong in command arguments, history, Git or chat. The encrypted transfer procedure used for 2360 is an available manual bootstrap, not something required for ordinary requests.

`prepare` verifies the exact saved graph and leaves enabled/approved false. An expressly approved operator then activates/pins the reviewed native version separately and runs:

```sh
node --use-env-proxy --use-system-ca scripts/studio-ai-policy.mjs enable --confirm-reviewed-policy
```

If the founder previously used Disable, `--clear-stop` is additionally required for deliberate operator re-enablement. It does not clear request counts, claims, results or history. `disable` stops future starts while retaining private connection configuration; `revoke` also removes copied authentication from the policy. All operator actions append maintenance events to the existing ledger. There is no recurring shell step for ordinary founder-confirmed captions/stories once installation is approved and enabled.

### Native activation checkpoint

The exact dual-path graph is the reviewed persisted-order SHA **6d9fb599a810f6b931e09c35c6d51542b7d36443d45dfaacabeb6a8ce1407e28**, prepared privately under `.local/caption-pilot/live-acceptance/persisted-order-proposal.json`. It preserves the execution-2359 Muse standard path and the execution-2360 caption branch. No native graph logic change is needed for this recurring caption/story authorization mechanism. The caption builder now emits the observed persisted Code-node property order; regenerating from the exact execution-2359 graph, including its existing settings order and availableInMCP flag, reproduces the approved 6d9fb599… checksum. An older standard graph with different settings is not interchangeable. Live preparation must freshly capture the current inactive worker, compare settings/credentials, verify no running executions, install only the separately approved graph, verify the full persisted checksum, activate the exact saved version and verify active nodes/connections. No checksum fields or property ordering are ignored. On drift, stop and reconcile; no paid retry. This sprint performs none of those actions.

### Verification

Focused tests cover more than six manually confirmed captions without a quota, shared caption/story reservations across two database connections, duplicate prepare/confirm, frozen directions, disabled operation types, lost queue/dispatch responses, restart receipts and per-use cost history. Operator tests cover exact graph pinning, explicit enable approval, persistent Disable and separate clear-stop authorization without resetting history.

The retained-data desktop/mobile browser journey uses real Marcie research/caption in disposable stores and **explicitly simulated** new responses. It checks direction → review → duplicate confirmation → delivery → Compare → manual Apply → preserved copy/research/photo order → refresh/cold restart, then Generate Stories → unpaid review → duplicate confirmation → exact new story → cumulative usage, and failure/uncertainty/disable. No simulated text is claimed as new AI output. Screenshots are private under `.local/major-integration/`.

## Remaining checkpoints

Photographic request/delivery integration and exact-content native approval preparation are the next local checkpoints. Source permissions, native mutation approvals, production atomicity, reviewed original files/rights and Buffer write semantics remain separate boundaries. No current roadmap statement grants publication authority.
