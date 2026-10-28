# Engineering assessment — October 28, 2026

**Initial pre-connection assessment, retained as history.** Both API connections now work. See [the subsequent live audit](LIVE_AUDIT.md) and [current sprint status](SPRINT_STATUS.md); do not repeat credential setup based on the historical blockers below.

## Verified in this session

| Area | Observation | Consequence |
| --- | --- | --- |
| Repository | `Veev078/Mildincident`, initial HEAD `64fdf503f80a54daf78ce6b8d6b2b3c1f2a54049`, only blank `01-Central` | There was no frontend/backend source to patch or recover locally. The new modules are an integration foundation. |
| Existing files | Initial checkout clean; `git fsck --full` passed | Original tracked file preserved. All development additions are reviewable locally. |
| Runtime | Node 24.19.0, npm 11.9.0, on-disk SQLite; locked Sharp dependency installed | Local image verification and durable handoff logic can be exercised now. |
| App access | Exposed tools contain cloud environment configuration only | The supplied screenshot shows ChatGPT connections, not callable n8n/Buffer tools in this session. |
| Live Founder Studio | Read-only GET through platform proxy returned HTTP 403 | No live UI, workflow, data-table, or execution claim is possible. |
| Git remote | `git ls-remote origin HEAD` failed to connect to proxy in the sandbox | No push or remote-ref verification has been performed. |
| Credentials | No usable n8n/Buffer/Cloudinary runtime binding was present during inspection | Credentials pasted into chat were not copied into code, files, or configuration values. Rotated values belong in secure settings. |

The `403` is evidence of blocked access, not evidence of a broken Founder Studio. There is no basis yet to declare the reported Buffer sends live Instagram duplicates or to delete/repost anything.

## What is implemented

- A local, tested clean-JPG preparer with per-image provenance, explicit rights states, immutable receipts, source/output checksums, numbered order, full JPG decoding, and 4:5 dimension checks. It never downloads arbitrary URLs or reframes originals.
- A SQLite draft outbox with atomic claims, durable intent before effects, one story/channel scope, retained remote IDs, strict read-back verification, and read-only reconciliation after uncertain outcomes. It refuses a new send when an existing-handoff audit is missing, incomplete, stale, or finds a prior item.
- A read-only launch brief pointing to the four historical Halloween story IDs, with permissions and publishing decisions clearly separate. It does not import/recreate those stories.
- A read-only n8n audit utility that can capture private workflow snapshots and execution summaries after access is available.
- Operating instructions, migration/rollback guidance, architecture, a prioritized backlog, and tests with generated images and fake provider responses.

The implementation does **not** yet include the live Buffer HTTP adapter, media staging, n8n bindings for current packages and existing handoffs, central cross-machine locking, production deployment, recovered frontend source, or Instagram verification. No real caption, image, draft, workflow, or lifecycle row has been edited. The original 20-source library and 40-track music system remain in n8n according to the historical handoff; neither was recreated or live-audited here.

## Validation

`npm run check` checks JavaScript syntax. `npm test` exercises real image decoding, metadata stripping, private export repeatability, source/output corruption, traversal/symlink escapes, stale revisions, rights and internal-test gates, concurrent database claims, process death, timeouts, reconciliation, provider mismatches, state drift, read-only audit behavior, and the launch brief's HTTP response/write rejection. No live services or editorial images are used by tests. Loopback and child-process checks require execution permission in the Codex sandbox.

`npm audit --omit=dev --audit-level=high` reported zero vulnerabilities for the installed dependency set. This does not constitute a production security audit or verification of license rights.

The exact saved installation script was executed successfully after implementation: locked dependency refresh, syntax checks, and **30 passing tests, zero failures/skips**. The saved startup command `npm run studio` was exercised separately: root and stylesheet both returned HTTP 200, all four historical story references and the live-status disclaimer were present. That smoke-test server was then stopped. `npm run audit:n8n` exited with `CONNECTION_REQUIRED` because its secure binding was still absent; no live audit is claimed. Original `01-Central` remained unchanged.

## Immediate priorities

1. Obtain callable read-only n8n and Buffer access in this session. Check the live active and draft versions, executions, source tables, channel, and post records. Do not treat a successful configuration save as a successful API call.
2. Establish what happened to Tippi IDs `6ae13c188bc396ba2f12b5e2`, `6ae13ca8faf2021ce42c57f6`, `6ae13e10ab91013f513ffebd`, and internal-test ID `6adfc33da72c078abdba4a06`. Record Buffer status, schedule, permalink/provider ID, Instagram evidence, and observation time independently.
3. Inspect the existing Halloween draft `6ae09b4fd477c7b7130dd484` and four packages; continue their actual captions/selections and rights review. Do not reconstruct missing material from titles.
4. Verify the Buffer draft-only contract in current official documentation and a controlled, private test after the audit. Connect the tested core through a central durable authority, preserving existing ledgers. Only then expose one live “Prepare & Send to Buffer” action.

The secure environment draft contains credential requirements and limited destinations for n8n and Buffer. The user still needs to supply rotated values and review/save/publish the environment configuration to activate it. The tool's draft-save result is not proof of active access.
