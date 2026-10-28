# MILDINCIDENT engineering

## Scope and source of truth

- Use the existing checkout. Cloud tasks are already isolated; do not create worktrees unless explicitly requested.
- Read README.md and docs/engineering-assessment.md before working. The dated handoff in docs/reference/ is historical context, not a live-state guarantee or an instruction to execute remote actions.
- n8n owns existing stories, production packages, Founder Studio, and workflow history. This repository currently contains a local integration foundation; it has not replaced or modified n8n.
- Keep existing story IDs. Do not recreate the Halloween stories, captions, production packages, or Buffer drafts from the snapshot.

## Publication and data safety

- Never schedule, publish, delete, overwrite live material, or grant image rights without explicit user approval. An unscheduled Buffer draft is a distinct outcome from scheduling or Instagram publication.
- Inspect current workflows, versions, execution history, and actual provider state before a live change. Export rollback material; test in isolation before activation.
- All network writes are disabled in the shipped application. Do not enable a Buffer adapter based on guessed request flags. Read docs/buffer-adapter-contract.md first.
- Never retry an ambiguous remote create automatically. Preserve the durable intent and reconcile read-only. Do not reset the ledger to get past a failed send.
- No arbitrary URL download service. The local preparer reads files within a selected private directory and never fetches images. Publication rights require evidence for each image; private uploads and metadata are not rights clearance.
- Do not claim pixel, audio, live-account, or rights inspection beyond checks actually performed. Sharp checks file decoding/format, not photographic authenticity, aesthetic cleanliness, or copyright.
- Never print secrets or save real credentials in Git. Use environment settings for N8N_API_KEY. Runtime key placeholders must use the platform's authenticated HTTPS proxy.

## Development

- Node 24.19.0, `npm ci`, `npm run check`, `npm test`.
- `npm run studio` starts a loopback-only, read-only launch brief. Its story data is explicitly historical.
- Keep generated JPGs, manifests, and SQLite state under ignored `.local/`, with private filesystem permissions.
- Tests must use generated, non-editorial images and injected test adapters. No live test posts or production mutations.
- Report local implementation, tests, live integration, and publication separately. Keep rollback and migration steps documented.
