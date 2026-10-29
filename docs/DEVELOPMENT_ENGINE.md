# Development editorial engine — 2026-10-29

## Native state and evidence

Four development workflows were created; all are now inactive after bounded zero-AI tests:

- `3GKf8xnHA6JmnAJP`: sourcing replay sandbox derived from the active source graph.
- `qyoKwV3QFLhqA4Qj`: header-auth replay runner. n8n execution2249 succeeded with7 actual cached source references; unauthenticated calls returned403 while active.
- `yZD8xGulV8McGuGw`: isolated conditional job-claim test. Four concurrent calls yielded exactlyone claim (2252), three no-ops. No AI calls.
- `6CkqfYc4Pyd4k8vi`:37-node research worker derived from ACTIVE research+sourcing graphs. Never activated/executed.

New tables: `mildincident_dev_editorial_jobs`, `mildincident_dev_editorial_candidates`. Existing production workflows/tables/credentials were not modified. A new isolated header credential was created; its value remains in private server configuration, never Git or browser JSON. Rollback: leave the development workflows inactive; preserve tables/SQLite; use prior Git commit if needed. No record deletion is necessary.

## What is implemented

Studio requests can be queued through the server into n8n development storage under the same UUID and content hash. Durable local claims prevent duplicate POSTs in concurrent requests. An uncertain create/dispatch is reconciled read-only, not automatically repeated. A queued read cannot reset an uncertain dispatch to allow another charge. Native execution failures are checked against the configured worker identity.

One real creative brief is queued as development row2, correlated with local request `99de2099-d762-40d5-85d9-222ba3c241db`. It has no generated candidate. Browser verification showed18 source stories, that queued request, disabled generation, no JS errors and no development secret in the JSON response.

The worker reuses existing Brand Brain/read-only context, prompts, duplicate checks, AI credential references, source checks, quality gates and first-party preview extraction. All writes go to the new development tables. It accepts at mostone candidate per job, rejects ambiguous claims before model work, uses at mostone research andone draft node, caps output at3500/1800 tokens, research tool calls at2, model input at30000 characters per call, and workflow runtime at240 seconds. n8n node retries are disabled; provider SDK retry behavior and actual price have not been verified. Character caps are not token or currency quotes.

Result imports require matching job/content hash and execution provenance. Unknown/raw model fields and credentials are not exposed. Results can open in the normal Studio caption, research, image, carousel and soundtrack tools under `CON-DEV-<job UUID>`, with an explicit development banner. Source facts/rights/pixel analysis remain unverified. Local caption/history, image feedback and development editorial decisions persist. This does not insert a production-table story or approve publication.

## Current boundary

Automatic approval review rejected activating/running the AI-backed worker because the specific internal context/provider destination and unknown spend were not approved to its satisfaction. No AI payload was sent and no paid generation call was started. `generationEnabled=false`; the client also requires a pinned approved active version and matching model budgets before any dispatch. No UI/API route can arm generation.

Therefore **new autonomous discovery has not been demonstrated**. Native lease/replay execution is verified; generation/result browser flows use labeled synthetic fixtures. Authenticated native forms remain a separate existing fallback. Production admission is still a separate integration; local development approval does not write production rows.

Required next approval: one bounded request through the existing n8n OpenAI connection (`gpt-5.4`), disclosing the brief, Brand Brain rules, recent/rejected-subject exclusions and retrieved public source context, accepting the provider's charge for the stated logical-call/input/output/tool caps. No recurring activation. Then inspect the actual execution, cost/usage, quality and persisted result before broader use.

## Private artifacts and tests

Private connection: `.local/engine-build/development-connection.json`; backups, execution evidence and screenshots live beside it. The file is required server-side for development engine access and is excluded from Git. A fresh GitHub checkout does not contain this credential. Existing native-form handoffs still work without this new connection.

Regression run:126 tests passed before two additional budget/ambiguity checks were added; subsequent focused builder/client checks passed.26 browser workflows passed, including disabled queue/start, candidate import into existing editors and local decision persistence. Synthetic adapters cover lost responses, concurrency, restart recovery, mismatched provenance, secret/URL sanitization and no automatic paid redispatch. Native generation has0 executions, verified by the API.
