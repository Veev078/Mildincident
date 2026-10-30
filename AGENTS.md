# MILDINCIDENT engineering

## Scope and source of truth

- `docs/PRODUCT_CONSTITUTION.md` is the founder-approved product direction. Use `docs/PRODUCT_MAP.md` for module/authority mapping, `docs/DECISIONS.md` for consequential choices and `docs/SPRINT_STATUS.md` for current evidence. Current founder instructions and verified implementation truth take precedence over target-capability descriptions. Historical research is supporting context, not a competing roadmap.

- Use the existing checkout. Cloud tasks are already isolated; do not create worktrees unless explicitly requested.
- Read README.md and docs/engineering-assessment.md before working. The dated handoff in docs/reference/ is historical context, not a live-state guarantee or an instruction to execute remote actions.
- Current verified observations supersede the initial assessment: read docs/SPRINT_STATUS.md and docs/LIVE_AUDIT.md. Resume from existing private snapshots and commits; refresh only facts needed for the next operation.
- The latest sprint is product-wide. Read docs/WORKSPACE.md and docs/PRODUCT_FRICTION.md; do not refocus on the historical Halloween idea bank except when it is necessary to validate a broader feature.
- n8n owns existing stories, production packages, Founder Studio, and workflow history. This repository currently contains a local integration foundation; it has not replaced or modified n8n.
- Keep existing story IDs. Do not recreate the Halloween stories, captions, production packages, or Buffer drafts from the snapshot.

## Publication and data safety

- Never schedule, publish, delete, overwrite live material, or grant image rights without explicit user approval. An unscheduled Buffer draft is a distinct outcome from scheduling or Instagram publication.
- Inspect current workflows, versions, execution history, and actual provider state before a live change. Export rollback material; test in isolation before activation.
- Production network mutations are disabled. Local HTTP writes for private draft proposals/history and cache refresh are permitted with origin/intent/revision checks; they must never be presented as n8n or Buffer saves. Do not enable a Buffer adapter based on guessed request flags. Read docs/buffer-adapter-contract.md first.
- Read-only GraphQL POST queries are permitted; no mutation is shipped in the Buffer reader. Do not treat HTTP POST alone as publication or expose a generic GraphQL executor.
- Existing production patches are local and unapproved. Read docs/PRODUCTION_REVIEW.md before any deployment. Preserve version/hash checks and distinguish the conditional-claim protocol tests from verification of n8n Cloud's actual engine.
- Never retry an ambiguous remote create automatically. Preserve the durable intent and reconcile read-only. Do not reset the ledger to get past a failed send.
- No arbitrary URL download service. The local preparer reads files within a selected private directory and never fetches images. Publication rights require evidence for each image; private uploads and metadata are not rights clearance.
- Do not claim pixel, audio, live-account, or rights inspection beyond checks actually performed. Sharp checks file decoding/format, not photographic authenticity, aesthetic cleanliness, or copyright.
- Never print secrets or save real credentials in Git. Use environment settings for N8N_API_KEY. Runtime key placeholders must use the platform's authenticated HTTPS proxy.

## Development

- Node 24.19.0, `npm ci`, `npm run check`, `npm test`.
- Hosted mode is opt-in via `STUDIO_MODE=hosted`, exact HTTPS `STUDIO_PUBLIC_ORIGIN`, persistent `STUDIO_DATA_DIR` and `STUDIO_PASSWORD_HASH`. Keep authentication/session/origin boundaries and hosted native read-only mode. Hosted preparation is not deployment authorization.
- `npm run test:hosted` tests an isolated HTTPS fixture workflow, never production or paid providers.
- `npm run workspace` starts the product-wide frontend/BFF on loopback port 4174, refreshes fixed read-only APIs, and retains local proposals under `.local/workspace/`. Never expose it publicly without authentication, authorization and explicit deployment approval. `npm run studio` remains the old historical launch brief on port 4173.
- `npm run test:browser` uses system Chromium and labeled fixtures. Keep fixture write tests off the actual private user draft store. No mock stories may replace failed live source loads in the product.
- Raw snapshots/credentials/founder tokens stay server-side. Static realpath containment, strict source-route allowlists and browser field sanitization must remain. No server-side arbitrary image download/proxy route.
- Local saves require base source revision and expected local version. Preserve append-only local history and pending browser edits; never silently rebase after source refresh. Any reviewed removed-image replacement must retain the earlier version.
- Keep generated JPGs, manifests, and SQLite state under ignored `.local/`, with private filesystem permissions.
- Tests must use generated, non-editorial images and injected test adapters. No live test posts or production mutations.
- Report local implementation, tests, live integration, and publication separately. Keep rollback and migration steps documented.
