# V15 — source acquisition and a simpler working path

## Current release and founder acceptance

The subsequent controlled release is live at `2d47c21b4f3b648d2193721321c473255cc1a2a2`, deployment `dep-dbp4iqbbc2fs7394fs30`. [Real hosted acceptance](V15_HOSTED_PHOTO_ACCEPTANCE.md) records Jack's strong result (7 new project references, 0 repeats, 20 excluded) and Sophy's limited result (0 new, 34 repeats, 6 excluded). Actual photographs are founder-visible; private decoded-file counts and exact successful source/CDN routes are not independently established. Preserve the UI. The implementation-stage observations below remain historical evidence and must not be read as a claim that V15 is still undeployed or that the hosted result was simulated.

## Verified implementation baseline and boundaries

Started from clean `5f9ebcacd39bbb5d108ee28cc7010395896c0b51` on `ui/photo-desk-flow-20261108`; that commit is the code recovery point. Existing draft PR #1 and the Photo Intelligence repairs remain intact. Render read-only inspection confirmed that exact commit live as manual deployment `dep-dbp3tketlv9c73eef8s0`, existing service `srv-dbih0du1egvs73er26kg`, original 10 GB disk `dsk-dbih0e61egvs73er27e0` mounted `/var/data`, automatic deployment off. No release occurs in this sprint.

Read-only inspection confirmed the recurring worker active at saved/published `d12b183b-a511-4f58-9726-5a565db61f6d`. Its private rollback/observation snapshot is ignored under `.local/v15/worker-baseline.json`. A final read-back matched the starting nodes, connections, settings, active version and saved version exactly. No native graph, authentication, policy, provider credential or Buffer setting is changed. No generation dispatch or paid call occurs.

The brief refers to two hosted screenshots; no screenshot files accompanied this upload. The founder's described failures were checked against retained records and the actual baseline UI rather than invented hosted observations.

## What was broken

- LIFE was not in `PROJECT_PAGE_HOSTS`. Jack's exact recorded `https://www.life.com/people/jack-nicholson-early-photos/` therefore produced `SOURCE_READER_UNAVAILABLE` with zero page attempts. His retained thumbnails are Brave search wrappers around LIFE images; these are not original-image acquisition authorities.
- Source discovery knew only research/project links, overlooking original source pages already recorded on story media.
- The first blocked page or second-page failure ended the entire search. Useful captured evidence could remain private but unavailable as suggestions.
- Photo receipts added metadata references, but never passed them through the existing private image decoder/store. The operator-only recorded-image helper does not accept photo-ledger receipts and does not support cross-domain Squarespace mappings.
- A failed search automatically expanded manual HTML import and repeated its lengthy explanation in a persistent toast. This made a technical workaround the apparent next task.

## Checkpoint 1 — existing ledger → source files

Backend checkpoint: `e36d500` (pushed with `[skip render]`), followed by the final founder-flow/concurrent-preview protection checkpoint on the same UI branch.

Newly prepared requests freeze `recorded_fallback_v2`, their exact source candidates, a two-page budget and at most six image requests into the existing request digest. Previously prepared requests retain their original packet/budget; old receipts and selected IDs are not rewritten.

The same durable claim now:

1. Tries supported, exact recorded sources and project-named links. After a **known** 401/403/404/410, it can use a different recorded source within the same two-page budget. It never repeats the failed URL. Transport uncertainty stops further page requests. A useful first capture survives a known second-source denial.
2. Retains page markup, SHA-256, image-specific metadata and per-page outcomes privately. Exact source binding and revision checks remain mandatory. Generic archives are only used when already identified in the story; they are not a contemporary fallback.
3. Re-derives each eligible image URL from the intact captured page before requesting its bytes. Supported relationships are same reviewed publisher host, Dazed → `images-prod.dazeddigital.com`, LIFE → `static.life.com`, the retained Squarespace publishers → `images.squarespace-cdn.com` / `static1.squarespace.com`, and Climax → `cdn.shopify.com`. A mapping alone is never sufficient authority.
4. Uses one unauthenticated GET per image, redirects disabled, 15-second timeout, JPEG/PNG/WebP MIME checks and an 8 MiB streaming limit. Existing Sharp decoding enforces one still image and the existing pixel limit; previews and originals remain private, hashed and metadata-stripped for review. Requests are sequential, not parallel. Two page timeouts plus six image timeouts can take roughly 114 seconds; the UI remains pending during the operation.
5. Records request/input/page hashes and source/image URLs with the actual decoded preview. It reports decoding separately from visual/identity/rights verification. It does not mark thumbnail bytes as a verified full original.
6. Removes new **exact-byte** repeats from suggestions while preserving the receipt and source copies. Perceptual similarity remains advisory, using the existing decoded-pixel fingerprints; a similar-looking file is not automatically deleted.
7. Can attach evidence to an existing repeated reference without changing its ID or selection. It never automatically replaces an existing founder preview, including a preview saved concurrently during retrieval.
8. Persists page/image attempts before effects. A restart does not resume them. An explicit close/reconcile action may retain completed source results and close unfinished image work without refetching. Changed story versions quarantine the receipt.

Inert saved HTML remains network-free, including images. Source acquisition is unavailable if the private preview store is absent; metadata review continues honestly. There is no browser-supplied image URL downloader or new paid engine.

Image parsing also recognizes single-image WordPress caption containers and Squarespace `data-image`, without borrowing captions from multi-image containers. Relevance excludes incompatible recorded dates from direct project matches. Book covers, spreads, installation views and process/outtake references receive **source-description** classifications, never invented visual judgments.

## Checkpoint 2 — founder workflow

- Search outcomes distinguish new decoded files, metadata awaiting visual verification, no additional project photos and unavailable sources. Exact repeats, withheld references, attempted hosts and failure codes remain in **What was checked?**.
- The primary failure state offers the original link and **Keep editing the story**. Advanced source tools stay collapsed. A long technical toast no longer covers the photographs; inline status and an accessible announcement carry the outcome.
- Story metadata uses the shorter **Story details** label; version history remains inside it. Existing details/editorial-check sections were already collapsed at the baseline and remain so. No rights, approval, source or history control was removed.
- Writing retains stable native identifiers and the existing five distinct operations, with **Keep it simple** for concise rewriting. Edit, Improve, Compare and deliberate Apply are preserved. Free-text custom caption instructions and an independently different “punchier” native operation are not fabricated: those require a separately reviewed native contract change.
- Discover's ordinary explanation is shorter. Its actual founder-brief input now explicitly asks for the maker/project, original source and photographic availability, separates links from accessible images and rejects archive prestige as a substitute for visual interest. This is local guidance for future separately confirmed requests, not a live native prompt installation or a newly validated writing result.

## Source access and real-story results

| Case | Real retained evidence | What was executed here | Result / remaining limitation |
| --- | --- | --- | --- |
| Sophy Rickett — Pissing Women | Execution 2359 and retained Dazed roundup HTML; four project images seeded in isolated storage | Replay of the actual retained markup before/after, no online fetch; generated preview frames clearly labelled | Zero additional project images. Known images and order preserved; unrelated references withheld. This is not a new-photograph success or a recreation of the founder's exact ten-repeat hosted receipt. |
| Jack Nicholson — Los Angeles, 1969 | Existing story, LIFE URL, 21 retained references; four-image isolated selection | Baseline missing-reader reproduction, then injected LIFE denial through the new reader; caption refresh and approval preparation | The missing-reader defect is fixed locally. Actual LIFE access is still unverified. Four selected IDs, caption/evidence and guarded approval state remain intact. |
| Marcie Docherty — contemporary photography | Retained generated/researched story and caption | Injected source response and decoded **generated** image bytes through the receipt path | Source-first route, private preview delivery and duplicates exercised; no institutional archive fallback. No actual Marcie photograph was newly retrieved. |

Fresh probes to LIFE and `sophyrickett.com` failed at the enforced Cloud proxy with `CONNECT tunnel failed, response 403`, before an origin response. The current Cloud allowlist excludes these hosts, their CDNs and the Render service. This establishes a development access restriction, **not** a LIFE/artist-hosted denial or evidence about Render egress. No alternative proxy, authenticated scraping or restriction bypass was attempted.

Artist/gallery/book source leads identified in `PHOTO_INTELLIGENCE_NEXT.md` remain promising but not newly fetched, decoded or aesthetically inspected. Publisher-to-CDN mappings have safe offline contract coverage, not fresh live-access proof.

## Validation and visual evidence

Passed `npm run check`, `npm test` (494 tests), `npm run test:browser` (40 workflow groups), `npm run test:ux` (8 checks), `npm run test:hosted` (11 isolated HTTPS groups) and `npm run test:workstation` (9 interaction groups; nine screens at 1440/1280/1024/768/390/320 pixels, no overflow or browser errors). Focused acquisition tests also passed after refining no-follow redirect diagnostics. Current results and private logs are in `.local/v15/`; no hosted browser test is claimed.

Actual rendered before/after screenshots use baseline `5f9ebca` and this implementation, the same retained story records and initial selections. Screenshots visibly state **RETAINED STORY REPLAY · SOURCE TRANSPORT SIMULATED · GENERATED IMAGES**. Desktop/mobile artifacts:

- `.local/v15/{before,after}-jack-{1440,390}.png`: required import form versus optional source assistance and visible saved selection.
- `.local/v15/{before,after}-sophy-{1440,390}.png`: honest zero-new-project outcome.
- `.local/v15/{before,after}-contemporary-{1440,390}.png`: retained contemporary story and simulated image-delivery path.
- Corresponding `*-writing-*` frames and `after-jack-review-*`: working caption and guarded handoff.
- `.local/v15/journey-report.json`: actual replay assertions, zero real-photo/model/production operations.

The replay uses isolated SQLite and synthetic decoded images, never the founder's live draft store. Existing HTTPS regression tests cover cold restart/session/private data persistence; source-specific tests cover receipt restart, duplicate dispatch, corrupt capture, unsupported hosts, invalid MIME/size/redirect, failed decoding, concurrent preview protection and revision changes. Later edits continue invalidating exact-content handoffs through the existing packet contract.

## Shortest safe release and real acceptance

1. Review the two checkpoints on draft PR #1. Obtain a fresh offsite backup and separate approval for a code-only release of the final exact SHA; preserve disk and all authorization/history stores. Code rollback is to `5f9ebca`; never restore an older data archive over newer founder edits. The additive preview evidence uses the existing backup-covered previews SQLite/blob directories, not a new unbacked store.
2. After that authorized release, click Find more photos once for Jack and Sophy. Read per-source/image outcomes in **What was checked?**. Inspect each actual decoded frame; compare it against existing images and verify project/credit relevance. Count useful new photographs, not references. Preserve selections unless deliberately changed.
3. If Render can access the source/CDN, the new path can retain those pixels without another workflow installation. If it cannot, use the exact recorded origin and failure to arrange legitimate source access or obtain files directly from the artist/publisher. Cloud development verification separately needs those exact hosts in its supported network policy.
4. AI visual investigation remains a **separate approval gate**, not part of the active caption/story policy. A minimal future operation would bind the photo request, source revision, captured page hashes and at most six decoded image hashes; reuse the native worker's claim/result architecture with a photo-specific validator/policy. It must exclude source text from instruction authority and preserve founder selection/rights gates. Research/search and vision input/output limits, exact graph checksum, rendered image payload and cost exposure must be reviewed together before installation. No exact paid proposal is READY while legitimate image access and actual model payload are unverified; no dollar cap or success is claimed here.

No deployment, paid operation, policy installation, live workflow mutation, credential change or publishing is authorized by this document.
