# Studio → existing production contract

The Studio reads authoritative n8n records and prepares local review packets. It has no production importer, Buffer writer, new publishing ledger or authority. Opening Publishing shows package, export, approval and handoff observations together.

| Relationship | Required evidence |
| --- | --- |
| Story → production package | Exact `concept_id`, exactly one package row; ambiguity blocks selection |
| Package → export | Exact story ID and `production_version`; matching version does not prove matching bytes/revision |
| Package → private archive | Exact story, `package_id` and `package_version` |
| Package → proof | Explicit `proof_execution_id` / `execution_id`, exclusive to one package; proof version remains unverified |
| Story → manual/guarded handoff | Exact `concept_id`; preserve all versions, abandoned records and missing IDs |
| Handoff → Buffer observation | Exact recorded `buffer_id` / `buffer_post_id`; never caption/subject matching |
| Development candidate → production | No relationship inferred from its virtual Studio package. Native acceptance/record creation remains a separate approved operation |

`GET /api/stories/:id/production-packet` downloads `mildincident_editorial_to_production_review` JSON. It includes native package identity/digest, source and local revisions, saved caption, ordered assets/roles, credits, source/claim references, recorded native fact review, soundtrack direction, approval scope, exports/proofs, provider observations and blockers. A SHA-256 digest covers the exact serialized JSON apart from `digest`. The browser saves pending local edits before download; it refuses this packet if unsaved edits remain, while the earlier proposal export remains available for recovery.

Native final-caption approval is recorded only for exact equality with native final copy. Local changes still need native review. Private previews and file URLs do not verify production files, photographic identity or rights. Missing mappings, stale snapshots, incomplete provider reads and uncertain outcomes remain blockers. An old successful transfer is historical; Buffer sent is not independent Instagram verification.

Four additional fixed tables are read for optional context: `export_packages`, `production_render_proofs`, guarded handoff log and public-media staging. Failed reads are unknown coverage, not empty evidence. Old complete caches remain usable with explicit coverage gaps.

`scripts/prepare-production-integration.mjs` prepares PRIVATE version/graph-pinned review material from captured workflows, reusing the existing manual-import patch and claim protocol. It makes no network calls. The candidate remains `deployable:false`: founder approval, separately approved schema work, verified deployed atomic-update semantics, shared authority across manual/guarded/coordinator paths and independent provider readback are required. Do not deploy only one create path or publish unrelated saved workflow drafts.
