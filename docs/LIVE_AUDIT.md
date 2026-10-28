# Live audit — October 28, 2026

Observed approximately **7:29–7:38 PM America/New_York**. This is a time-bounded observation, not a continuing guarantee. No production data, workflow, credential, environment configuration, schedule, or post was changed.

## Access and inventory

- The newly published cloud environment is attached. Both secret bindings report ready and are present in the process. n8n GETs and Buffer read-only GraphQL queries succeeded. No additional token or rotation was requested.
- **27 workflows: 18 active, 9 inactive.** All saved workflow graphs and available active graphs were captured privately; **390 Code-node instances** across those graphs passed JS syntax compilation. This is not a business-behavior test of every node.
- **30 tables, 779 rows**, including all pagination of the 264-row media library. Catalog and row scans finished without truncation. Saved schemas and relationships were inspected; duplicate story IDs, duplicate package/story IDs, duplicate media IDs, orphan package/media records, and orphan clean archives were not found.
- All workflows' latest ten available execution summaries were inspected. There are **63 retained error executions** in the complete error listing. The 15 newest error details were inspected: they include historical render-input/manifest and dashboard errors, plus a lifecycle validation denial. These are historical records, not 63 confirmed current outages; remaining detailed root-cause review is pending.
- GitHub read-only Git access succeeded; remote HEAD remains the initial `64fdf503f80a54daf78ce6b8d6b2b3c1f2a54049`. Sprint commits are local on `development/launch-reliability`; nothing was pushed.
- Direct Founder Studio HTTP GET returns 403; its main webhooks require n8n OAuth2. API access does not supply the founder's browser session. The active and patched HTML Code nodes were instead rendered locally from captured table rows, each producing valid HTML with the masthead and existing Halloween references. No browser visual or authenticated end-to-end UI test is claimed.
- Lovable source/project tools are not available. Existing frontend architecture remains n8n-owned. Instagram pages were not independently fetched or authenticated.

Research intake, media sourcing, and clean export have saved/active version differences. Use their **active graphs**, not their unpublished drafts, as production baselines. The Studio active version remains `9a32cde5-40b3-4d90-8d6e-30c7e2505cf9`; manual import active version is `c6c0d049-57bf-4d18-b687-aa9745988fc4`.

## P0 findings

| Finding | Verified evidence | Prepared response |
| --- | --- | --- |
| Create response is treated as verification | Manual import has no independent provider read after `create_post` | Patch adds a fixed Buffer read query and exact ID/channel/caption/schedule/media-order checks |
| Returned ID lost on uncertainty | Verifier outputs blank ID on mismatch; reconciliation update writes only state/details | Patch records candidate ID durably before provider read-back, keeping uncertain outcomes recoverable |
| Duplicate scope is per version | Manual validation checks `import_key`, containing package version | Patch blocks existing non-abandoned handoffs for the entire story, including other versions |
| Concurrent claim is not proven atomic | Current flow inserts a ledger row, reads competing rows, then checks a sole winner | Tested conditional-update protocol prepared for the existing package row; deployed engine/version and schema migration still require isolated verification and approval |
| Internal-test content is not explicitly blocked in manual validator | Caption check tests length/editorial markers but not INTERNAL TEST / DO NOT PUBLISH | Added and tested fail-closed caption guard |
| Ledger success is historical | Nine manual import rows include seven `draft_created` entries; most now correspond to sent posts | Read-only lifecycle projection keeps manual status, provider observations and Instagram confirmation separate |
| Not all sends are mapped | Four of eleven Buffer posts are absent from manual-import mappings | Report unmapped IDs; do not infer identity from captions or reset claims |

The guarded handoff and release coordinator remain separate existing entry points. A complete production release must govern **all create paths** with the same authority, not only patch the manual route. Current guarded-path production-file, media-staging and handoff tables are empty, while the manual path is actively used. No claim is made that these routes were consolidated.

## Buffer and Instagram evidence

One connected, unlocked Instagram channel named `mildincident`, timezone America/New_York, was found. The complete channel scan returned **11 posts: 1 draft, 10 sent**, no scheduled/error posts at observation time.

| Group | Buffer observation | Independent Instagram verification |
| --- | --- | --- |
| New York Halloween | `6ae09b4fd477c7b7130dd484`: draft, nine images, null dueAt/sentAt | Not applicable; existing private draft retained |
| Tippi | Three sent records; two have reported Instagram links | Not performed. Two captions match; the third differs, so the old “three identical captions” description is inaccurate now |
| Internal test | `6adfc33da72c078abdba4a06`: sent, two images, INTERNAL CAROUSEL TEST / DO NOT PUBLISH caption | No external link returned; actual Instagram outcome unresolved |
| FRUiTS | Three sent records; one reported Instagram link | Not performed; two distinct package versions are recorded in the manual ledger |
| Batcave | `6ae1e78538e33389fb6102aa`: sent, four images, reported Instagram link | Not performed; do not recreate its historical Oct 30 draft |
| Duo / Nicholson | One sent record each, reported Instagram links | Not performed |

Tippi links reported by Buffer: [first](https://www.instagram.com/p/DfBGqp-mNBt/) and [third](https://www.instagram.com/p/DfBHOuNDuDx/). Batcave: [reported post](https://www.instagram.com/p/DfCaiczkUC5/). These are provider-reported links, not proof that pages remain live.

Unmapped sent IDs: `6ae14886c8a09d4e6f69c576`, `6ae13e10ab91013f513ffebd`, `6ae13ca8faf2021ce42c57f6`, `6adfc33da72c078abdba4a06`. Preserve all records pending review. No deletion, edit, repost, or scheduling is proposed automatically.

## Editorial and data quality

- All **264 media rows** have unreviewed, discovery-only, restricted, invalid, missing or permission-required states; none is explicitly cleared. Metadata suggesting public domain or attribution does not complete per-image rights review. The audit cannot establish whether separate permissions exist outside these tables.
- All four Halloween stories and packages exist. New York is v8 with nine selected images, all rights-pending. Batcave is v4 with four selected images, rights-pending, already Buffer-sent. Rick Baker and Ghost Ship are v1 with no curated saved sequence/current handoff.
- Rick Baker's caption includes production instructions; Batcave's includes directions to the editor and permission reminders. These are editorial-quality findings, not authorization to change a sent post.
- The 20-source image directory, 40-track soundtrack catalog, and three saved sound selections are present. No image-pixel or audio analysis was performed; the existing recommendation system remains metadata-based. No new music system or duplicate catalog was created.
- Verified production-file registry, public media staging, guarded handoff log and performance log contain zero rows. Analytics is inactive. These are unfinished integration boundaries, not missing stories to reconstruct.

## Implemented and validated locally

Fixed-operation Buffer read client; paginated production inventory; snapshot relationship/readiness review; distinct lifecycle observations; n8n-compatible pure-JS guards; version/hash-bound private patch generator; conditional claim protocol against an existing package row; clearer Studio feedback; updated tests/docs.

`npm run check` and **47 tests** pass, with no failures/skips. SQL protocol tests prove one contender wins a conditional update and that uncertain claims cannot be reset automatically. They do **not** prove the remote n8n Cloud deployment's database semantics. Both reusable live audit commands succeeded read-only. Generated import/Studio patches pass syntax compilation, but no private live create test or production activation occurred.

See [approval and rollback](PRODUCTION_REVIEW.md), [Halloween review](HALLOWEEN_REVIEW.md), and [sprint checkpoint](SPRINT_STATUS.md). Raw snapshots, generated workflow JSON and private HTML remain under ignored `.local/` with private file permissions.
