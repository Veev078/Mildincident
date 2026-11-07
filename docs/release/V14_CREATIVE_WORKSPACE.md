# V14 creative workspace — local implementation, release pending

November 7, 2026. Continues `7ab3706509765392e12c5e55db52edb6a1572968` on `development/photography-review-20261029`. No deployment, live workflow/policy mutation, paid operation, credential change or Buffer action.

Implementation checkpoints: `8ef38ae1cbd92062555aec3bad1c764579e9a879` and `ad6631ff2adf092bbb83091a7035d5e55188fb1c` (both `[skip render]`). The following documentation checkpoint records the same verified code.

## Preservation and recovery

- Pushed annotated safety tag: `safety/pre-v14-20261107-7ab3706`, verified against the exact starting commit.
- Actual live Render code: `79d20fb4402cb9906ef71c092642782ab9110426`, deployment `dep-dbn47i61egvs73fs8kpg`, service `srv-dbih0du1egvs73er26kg`. Environment `evm-dbih0dqjnfac73ccuki0`; existing 10 GB disk `dsk-dbih0e61egvs73er27e0`, mounted at `/var/data`; automatic deployment remains off.
- Founder confirmed a fresh offsite private backup through Studio tools. The Desktop archive is inaccessible to this Cloud session and was not independently integrity-checked or restore-tested. The existing backup implementation uses SQLite's backup API, per-file checksums and immutable-media copying; databases are individually consistent, not one cross-database transaction. The archive covers the workspace, not the parent-directory authentication/session databases or private dispatch-policy configuration. Those remain untouched in their existing secure location; this sprint does not claim an independently recoverable offsite copy of every secret.
- Implementation and browser writes use isolated temporary stores. No hosted database or founder record was opened for writing. Read-only snapshots of the editorial, research, sourcing and existing Buffer workflows are retained under mode-0700 `.local/v14/`, with mode-0600 files. The source workflow's saved revision differs from its published revision; never install its pending saved graph as a rollback shortcut.
- Hosted code rollback remains the existing Render Dashboard code-only route to the retained deployment above, keeping the same service, disk, environment and data. No restore, reset or service recreation is part of this sprint. Development recovery is the pushed safety tag. Any future operational patch requires a fresh captured baseline, exact persisted verification and separate approval; this sprint needs no native rollback because it performs no native mutation.
- Final read-only comparisons confirm all four workflows' active/saved versions, active node/connection graphs, saved full-graph checksums and settings unchanged. The editorial worker remains active on `d12b183b`; this sprint never disables the recurring policy or its existing access.

## What can be used locally

**Photographic discovery.** Find more photos follows project-specific links recovered from retained evidence before a general catalogue. Fixed supported publisher/photographer hosts and exact story-recorded URLs are required for server page reads. One GET, no redirects or credentials, a 12-second timeout and 2 MB response bound; the existing extractor retains up to 40 references and reports its bounded scan coverage. There is no arbitrary URL/image proxy or new AI engine. Original image bytes are not inferred from a preview URL.

Catalogue selection is under Advanced Search. An original source without a supported reader leads to saved-page assistance with zero network calls, rather than an unrelated Commons search. Explicit archive selection, page continuation and existing native version-1 packets remain available. Source-page discovery uses the same private photo request/receipt ledger with an explicitly local version-2 packet; it cannot masquerade as a verified native archive receipt.

**Source-assisted recovery.** Supply the original public article/photographer URL and a saved HTML file. The existing inert source extractor recovers image-specific captions, credits, dates, links and references. Scripts never execute and no page assets are downloaded by the importer. Raw markup and its checksum stay private; browser responses expose only bounded reference metadata and capture provenance. The page's asserted origin, image identity and rights remain unverified. A copyright holder is not promoted to photographer. Older captures can recover exact named project links from a fetched or imported roundup. The next Find more photos request uses those links without rewriting native research, its source revision or founder edits. Recovering a link is not a new photograph.

**Directions and curation.** Best/project, rarer, candid, striking, backstage, surprise, context and custom directions affect exact archive queries, recorded-source priority where relevant and image-specific metadata ranking. Ranking uses correspondence, source descriptions, recorded dimensions and founder judgment; it is not aesthetic or pixel analysis. Duplicate URLs/files stay in receipts but out of new suggestions. Project, context and unconfirmed material remain separate. No caption, selected ID, order, approval or rights state is silently changed. Empty-image stories can use story-bound discovery/import without fabricating the frame anchor required by the native version-1 contract.

Duplicate clicks share a durable claim. Source failure never launches another source or automatic retry. Interrupted free searches require explicit closure before a fresh manual action; their history is retained. Changed story context quarantines returned results. Private uploads, shortlists, comparison, Arrange and immutable Prepare Approval retain the existing safeguards.

**Editorial direction.** The [reference interpretation](../reference/artifaxing-editorial-principles-2026-11-07.md) supplies broad cultural range and five editable starting points. Surprise Me now uses the supported founder-brief path: the legacy native `discovery` path ignores `job.prompt`, whereas `brief` places the new direction in the actual research input. Separate UI idempotency keys preserve pending custom text and prevent double-click starts. An unpaid Studio entry marker preserves restart-safe deduplication of unstarted default saves; it is not sent to n8n and confers no authorization. Case details retain bounded claim references, reader-entry and why-now notes, available references versus decoded private files and explicit missing evidence. Current whole-story feedback is distinguished from stale or photograph-specific feedback; there is no automatic taste score. Existing native presets, historical requests, consumed authorizations and engine contracts are not rewritten.

**Writing desk.** Clearer directions explain five distinct writing operations: Sharper & simpler, Tell the story, Better opening, Different angle and A closer look. They retain the existing native identifiers and per-action review/confirmation flow. The working caption remains unchanged until explicit Apply. Stronger global writing recipes and register guidance are prepared separately below; new native caption quality has not been live-tested. The founder's selected cover remains authoritative even if its preview fails.

**Visible workspace.** A selected photograph sits beside the source-led search on desktop. Warmer neutral surfaces, larger image areas and secondary source/history controls keep the work central. Mobile navigation and repeated story metadata are condensed so the photo action is visible in the first screen. The same existing Edit, Improve, Compare, source evidence, ordering and review tools remain.

## Native proposal — not installed

Active worker `6CkqfYc4Pyd4k8vi`, saved/published version `d12b183b-a511-4f58-9726-5a565db61f6d`, remains on full graph:

`0e1777e5785f703bd9a77593af01912a820eed0cb9c30ea9c50721ee4bc91cf6`

Offline proposed graph:

`0b80ffc137bade7aa41b02a5cb3e72a66395190542762a301d89fad2cd58c661`

Only Build Research Prompt, Draft Editorial Concept, Guard Draft Input Budget and Finalize Development Candidate differ. They add founder-directed range, distinct source-bound writing recipes, minimal/story choice, conservative input accounting and a version marker. Same 47-node architecture, graph connections, credentials, persisted settings/order, GPT-5.4 models, 3,500/1,800 output limits, two research tool calls, no draft tools and disabled node retries. No policy, grant, model call or installation is performed by the preparer.

Separate approval must cover exact installation, persisted checksum verification and updating the standing policy's worker-version/checksum binding through existing maintenance. Keep starts disabled during that separately approved maintenance and stop on drift. Existing dedicated authentication can be retained; no new credential bootstrap is needed. A founder-confirmed paid caption acceptance is a separate action; hidden Cloud retry risk remains as previously disclosed.

## Verification and actual limits

- Syntax checks, 471 unit/integration/frontend regressions, 40 existing browser workflow groups and 11 private HTTPS fixture groups pass. HTTPS fixtures are not a Render browser test.
- Retained-Marcie joined journey: Discover, review/duplicate confirmation, simulated generation, retained-source caption improvement, Compare, deliberate Apply, source-first photos, synthetic-pixel inspection, explicit selection/Arrange, Review and exact Prepare Approval. Refresh/restart preserves drafts, evidence, image order, receipts and review packets. Later caption edits invalidate the current handoff without replacing its original. Failures, uncertain outcomes and durable Disable do not resubmit.
- Retained Sophy, generated Marcie and the existing contemporary Duolingo campaign are inspected on desktop/mobile. Sophy's four matching project references remain separated from the publisher roundup's other36. A simulated403 stops after one attempt. Importing the actual retained publisher HTML finds repeated references instead of fabricating fresh photographs. Synthetic new project/unrelated references test classification and actual browser decoding; they are visibly labelled as test material.
- All five proposed caption recipes render through n8n's expression parser using retained Marcie evidence: 26,049–26,087 input characters including instructions, within the 30,000-character guard. Six new default/lens briefs reach the actual existing native research template at 26,855–27,000 characters. This verifies input compatibility, not creative output quality or new paid execution.
- Zero new real photographic downloads or external photographic pixel inspections in this Cloud session. Dazed and its image CDN, The Photographers' Gallery, Booooooom, Josh Aronson and the archive APIs remain outside the configured network allowlist. No bypass or repeated denied probe is used. Hosted/founder-browser access is a separate network boundary and has not been assumed to work.

Private screenshots and complete reports are in `.local/v14/`: actual rendered before/after desktop/mobile views, source-assisted recovery, caption comparison, inspector, Arrange and Review. Code/HTML/logs are not screenshots. No private screenshot or captured source body is committed.

## Shortest next step

Separately authorize a code-only release of the verified development commit to the existing Render service, preserving the disk, data and operational recurring policy/worker. Check the current offsite backup if hosted work has changed. Then use hosted Find more photos on the actual original project page, or import a legitimately saved original page, and inspect the real frames. This free source-retrieval check does not require an AI model call. Approve the four-node writing patch and one supervised caption operation only when ready to judge its real output. Do not claim photographic quality, rights, publication readiness or new writing success from simulations.
