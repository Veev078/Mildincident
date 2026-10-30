# MILDINCIDENT — Product Constitution & Operating Blueprint
**Version:** 1.0 — founder-approved strategic direction  
**Prepared:** October 30, 2026  
**Purpose:** Canonical direction for the brand, editorial product, intelligence engine, Studio, automation, data, design, governance and path to a mostly self-running operation.  
**Repository target:** `Veev078/Mildincident` → `docs/PRODUCT_CONSTITUTION.md`  
**Verified engineering baseline when drafted:** `development/photography-review-20261029`, HEAD `ffe40245ad9596fb28ccf1fcf9078a960d714194` (not a deployment).  
**Status of this document:** Canonical product intent, approved in the founder’s October 30, 2026 continuation request; **not** evidence that every described capability exists. Sections labeled *target* are architectural commitments awaiting implementation and verification.

---

## 0. The compact product thesis

**MILDINCIDENT is a visually led cultural publication with an increasingly autonomous research and editorial Studio.** Its subject is the curious, overlooked, aesthetically arresting and unexpectedly connected material found across culture: fashion, street style, film, music, photography, design, nightlife, the internet, subcultures, places, objects and history. Historical photographs are one ingredient, not the entire identity. The publication's intelligence should be capable of discovering its own promising directions; the founder should primarily judge, refine and approve the work.

The system must do more than organize an archive: it must *notice*, *investigate*, *connect*, *show*, *explain*, *learn* and *improve*. The output should feel like one recognizable magazine, not several competing AI agents or recycled internet posts.

**North-star product sentence:** *Open MILDINCIDENT, find several genuinely interesting new editorial proposals with inspectable photographs and supporting sources, decide what deserves attention, and develop the strongest into original publication-ready work through one coherent workspace.*

**Operating promise:** The founder spends their time as creative director, not as a search clerk, data-entry worker, n8n operator or prompt engineer. Human oversight remains essential for taste, factual sign-off, image context, rights and publication.

### Non-negotiable distinctions

- **Creative openness is not publishing permission.** Privately retain incomplete or rights-unknown image references; never infer permission to reuse from public accessibility.
- **A source lead is not a photograph; a photograph is not a story; a story is not a verified claim; a draft is not an approved post.** Make these distinctions legible in data and UI.
- **A passing automated test is not an editorial-quality demonstration.** Measure both engineering correctness and the actual usefulness of discovered material.
- **A historical result is not a freshly generated proposal.** Keep recovered, simulated, manually entered and AI-produced work visibly distinct.
- **Learning is not magic.** Feedback can affect ranking, prompts, retrieval and editorial context only through identifiable, testable mechanisms. Never claim a model has retrained itself without proof.
- **The founder's taste remains decisive.** No aesthetic score, follower count, popularity multiplier or preset formula has veto power over human editorial judgment.
- **n8n remains the existing production authority.** Studio is the editorial control plane. Buffer remains the established publishing provider; deeper integration is a later authorized phase.

## 1. Identity: who we are, and who we are not

### 1.1 Editorial identity

MILDINCIDENT should feel observant, visually literate, culturally curious, specific and a little unexpected. Its voice is composed, concise when possible, understated and confident only when the sources justify confidence. It notices the odd relationship, revealing object, peculiar detail, overlooked person, unexpected frame or cultural contrast. It presents evidence without sounding like an academic paper or a hype account.

The brand is **not**: a museum-archive-only feed; a nostalgia account; a repost farm; a stock-image library; a celebrity-fact generator; a daily news aggregator; a generic AI content factory; a metrics dashboard pretending to be a magazine; or a clone of any single admired account. It can borrow methods from all of these without inheriting their limitations.

### 1.2 Editorial territory: broad, coherent, not quota-driven

A living mix of contemporary and historical material:

- **People / characters:** revealing moments, unseen contexts, individual style, personalities, communities and unexpected details.
- **Fashion / street culture:** subcultures, real wardrobes, rare editorials, forgotten labels, contemporary designers, photographers, scenes and archives.
- **Music / film / nightlife:** performances, backstage worlds, venues, club culture, visual histories and current underground scenes.
- **Art / photography / graphic culture:** unusual projects, image-makers, publications, visual experiments, independent magazines and photo essays.
- **Places / design / objects:** strange architecture, street environments, interiors, material culture, objects with unexpectedly rich stories.
- **Internet / emerging youth culture:** digital artifacts, online micro-scenes, contemporary visual languages and new image-makers.
- **Wildcards:** intellectually defensible detours whose image and story are too good to ignore.

No rigid percentages for decades, celebrities, platforms or categories. Use diversity and repetition checks as advisory prompts, not forced quotas. Don't confuse *Gen Z relevant* with *chronologically new*: older work can have a contemporary echo; newer work can be worth covering for its own sake.

### 1.3 The editorial filter

Every strong proposal should offer a credible reason to **look**, **care** and **remember**:

1. **Look:** There is a truly interesting photograph, scene, composition, sequence or visual artifact—not merely a relevant thumbnail.
2. **Care:** Something culturally specific can be learned, questioned, compared, contextualized or revealed.
3. **Remember:** The treatment feels considered, original and distinctively MILDINCIDENT, not just an easy repost or trivia item.

The filter is a discussion framework, not a numeric mandatory threshold. Some beautiful image-led features need almost no caption; some extraordinary stories need two contrasting images and a fuller explanation.

### 1.4 Voice and formats

Preferred voice: observational, deadpan or lightly amused, grounded, visually led, unpretentious, culturally fluent. Avoid invented superlatives, generic AI adjectives, false certainty, clickbait phrases, forced hashtags or engagement bait. Verify names, dates, photographer credits and causal claims. Attribute carefully; an article byline does not prove image authorship.

Maintain a **living voice exemplar set**: founder-approved captions, unacceptable examples with reasons, and revised examples showing how to improve a weak draft. Do not automate a universal three-sentence rule. Allow short single-image notes, image sequences, revealing carousels, photographer/scene studies, object biographies, comparisons, a factual mini-file and experimental formats when appropriate.

**MILDINCIDENT originals:** A post should make an original editorial contribution through research, context, insightful selection, sequencing, comparisons, licensing/commissioned work, original reporting or other substantive authorship. Crediting a repost is necessary when applicable but not a substitute for permission or meaningful editorial treatment. Keep the current platform's originality policies under periodic verification; never hardcode an unverified legal/policy conclusion.

## 2. What our reference studies actually teach

### 2.1 Inspiration study — six-account sample (October 28, 2026)

Reference accounts: `@hidden.ny`, `@welcome.jpeg`, `@velvetcoke`, `@tonsil`, `@uniformdisplay`, `@attiresaint`. This is a directional, time-bounded sample—not proof of causality or a template to copy.

Patterns observed in the study: hidden connections and unexpected specificity; clear opening images; revelations across carousels; concise captions that serve the visuals; character and cultural framing more than product-spec framing; strong evergreen discoveries with occasional exceptional timely moments; the weakness of promotion-heavy and credit-only posts. Most sampled accounts were carousel-heavy; the exception shows that original visual footage can be its own artifact. Posting volume did not establish quality. The study's public metrics do **not** include competitor reach, saves, shares, demographics or private analytics. Raw likes should not be treated as a cross-account success model.

**Adopt the editorial *questions*:** Why would someone stop? What is the hidden connection? What does the image itself contribute? Is there a second-layer reveal? Would this feel like a discovery rather than a repost? **Do not adopt rigid structures:** all posts need not be carousels; all captions need not be three sentences; all content need not be nostalgia; there is no universal engagement score.

### 2.2 Editorial study (October 29, 2026)

Key themes: originality and transformative editorial treatment; the cover and second frame both matter; audience corrections make factual discipline important; contact-sheet decision UX beats complex research boards; source/claim memory and near-duplicate flags compound value; image-crop context needs verification; founder gate remains meaningful; performance metrics must be grounded in available data. Proposed brand framing of a "file" or editorial archive may inform naming and voice, but is an option, not mandatory branding. A source-driven, original image sequence can carry more weight than long captions.

Avoid treating social-media algorithm anecdotes as equations. Published recommendations, platform policies and measured behavior can change; keep dates and provenance on conclusions. The original report's external policy and ranking claims are **report findings as of October 2026**, not freshly revalidated here.

### 2.3 Muse's 67-page engineering blueprint (October 30, 2026)

Muse identified genuine gaps in the old workflow: restrictive photographic discovery, no real pixel-based visual understanding, shallow feedback loops, a difficult daily Studio, disconnected production handoff, weak semantic evaluation and unresolved operational proof. Useful proposals include decision history, optional dossier, photo hashing and advisory duplication flags, source-bound claims, research checkpoints, backups/restores, cost boundaries, source registry, golden-set evaluations and guarded production integration.

**Adopt discipline, reject premature bureaucracy.** We will not impose mandatory dossiers before early ideation, pretend AI aesthetic scores measure taste, build a separate graph database or second publishing backend, require every photo to have fully populated metadata before private review, or force all work through rigid quotas. Muse was written against an earlier commit; **the current repository must override its old implementation-status claims**.

### 2.4 Evidence hierarchy for future research

Every institutional, account or market study gets a provenance label: `directly verified`, `observed sample`, `interpretation`, `hypothesis`, `proposal`, or `unverified`. Preserve sample date, source, denominator and caveats. Observed competitor public likes/comments are not impressions, saves or sends; no fabricated engagement multiplier. Distinguish editorial taste from distribution performance.

## 3. The complete machine: functional operating model (target)

```text
DISCOVER CULTURE / SOURCES
  ├─ broad search + image indexes + n8n Brave (approved budget)
  ├─ original publications / photographers / niche RSS / community leads
  ├─ founder prompts, submissions and cultural observations
  └─ appropriate institutional archives
              ↓
IDENTIFY & INVESTIGATE
  ├─ independently suggest fresh subjects and cultural connections
  ├─ find photographs, source pages, creators, series and alternatives
  ├─ preserve evidence, provenance, unknowns and research trails
  └─ distinguish pixels inspected from metadata-only
              ↓
ASSEMBLE EDITORIAL PROPOSALS
  ├─ actual hero/alternative images, original source links, image context
  ├─ concise reason to care, proposed story angle, claim support
  ├─ novelty / repetition / visual warnings and research gaps
  └─ proposal history and mode (new / recovered / fixture / manual)
              ↓
FOUNDER STUDIO — REVIEW
  ├─ KEEP / MAYBE / PASS / EXPLORE / DEVELOP, optional reasons
  ├─ large-image inspection / side-by-side / series deepening
  ├─ edit source-bound briefs, caption, sequence and music direction
  └─ approve editorial choices, NOT publication rights by implication
              ↓
PRODUCTION PREPARATION
  ├─ source-backed fact check and image-context check
  ├─ licensing/permissions and actual human rights decision
  ├─ versioned approvals, media package, proof and handoff
  └─ guarded, separately authorized n8n → Buffer path
              ↓
OBSERVE & IMPROVE
  ├─ editorial decisions and correction ledger
  ├─ source success, quality observations, cost and workflow failures
  ├─ later authorized Buffer / Instagram owned-performance observations
  └─ public account research with explicit data limits
              ↺ return learning signals to discovery / editing
```

This is **one operating system**, not one giant model. n8n does scheduled/bounded orchestration and authoritative production actions; repo modules perform retrieval, inspection, reasoning support and contracts; Studio handles the founder's visual decisions; Buffer handles provider publishing only after approved handoff.

## 4. Discovery engine: source strategy and retrieval behavior

### 4.1 Source portfolio — product priority, not platform snobbery

**Tier A: Broad discoverability** — established search/image services already connected or legitimately integrable; prioritize broad coverage, uncommon image hits, original URLs and quality-per-result. **Existing n8n Brave image search is historically observed**, but current entitlement, pricing and limits are unverified. A paid live call requires separate approval.

**Tier B: Original creator and editorial sources** — photographer portfolios, independent magazines, contemporary publications, niche blogs and zines, publisher feeds, authorized RSS/Atom, public creative projects and editorial photo essays. Start with real publisher feeds and source-page discovery, then verify photo credits/series rather than confusing a page author with an image creator.

**Tier C: Public photographic communities and inspiration signals** — Flickr where approved official API access is available; Instagram, Pinterest, Tumblr, Are.na and peers as research/inspiration when access is explicitly supported. No assumption of unrestricted search APIs, no automation that bypasses login, no brittle unauthorized scraping. Inspiration account references are leads to original work, not automatic publishing assets.

**Tier D: Historical/institutional sources** — libraries, archives, Commons and museums, selectively promoted when output is visually exceptional or particularly strong evidence. Retain existing adapters; do not make them the dominant default just because the APIs are convenient.

**Tier E: Founder/creator contributions** — founder-provided images, licensed originals, photographer submissions, collaborations or commissioned work. This can eventually be the strongest source of original material; build secure provenance and permission handling before scaling.

### 4.2 Capability registry

For each source store: canonical domain/API and endpoint, material types, discovery methods, actual automated accessibility, authentication, terms/robots constraints, rate limits, current cost estimate and approval status, preview delivery, original-credit quality, rights hints (never clearance), availability/latency, known limitations, last *live* validation and representative successfully inspected images. Statuses: `working_live`, `historically_observed`, `fixture_only`, `awaiting_approval`, `blocked`, `manual_reference`, `retired`. Do not show an adapter as live because a fixture passed.

Each source should be evaluated for **yield of editorially usable original material**, not gross result count. Poor-yield sources can be deprioritized without deletion of their history.

### 4.3 Human-like automatic research

The machine should: choose an editorial territory without a founder seed; generate several dissimilar investigation routes; search across accessible sources; reformulate terms and follow credited photographers, publications, places, subcultures, series and related terms; examine original pages; preserve candidates despite sparse metadata; collect alternatives and series mates; detect near-duplicates as warnings; and stop or checkpoint according to explicit budget/safety rules. A failed or weak source should prompt a different *legitimate* approach, not silent abandonment or policy circumvention.

Support explicit exploration modes: autonomous fresh ideas; direct subject query; image-origin investigation; photographer/series deep dive; similar mood, different subject; publication/scene exploration; source-first catalog browsing; and continue past previous shortlist. The founder shouldn't be required to perform this research manually.

Autonomy must be **bounded**: declared allowed tools, source policy, maximum spend, research depth, timeouts, idempotency, checkpoints, retries and follow-up budgets. No uncontrolled website actions, credential exposure, scraping restrictions bypass or surprise provider costs.

### 4.4 An image is a first-class research object

Record original source URL, exact provider ID, retrieved URL, preview availability, visual asset checksum/fingerprint when actually accessed, photographer credit and its confidence, creation date and its confidence, publication date separately, shoot/series linkage, claimed subjects and verification state, license/right hints and human permission decision separately, editorial feedback and revision trail. A photo that cannot be visually inspected stays `metadata_only` rather than being counted as a compelling image.

### 4.5 Series and image intelligence

Prioritize **series discovery**, contact sheets and alternate frames. Compare crop, framing, subject prominence, story relevance and originality. Perceptual hashes (dHash/pHash) may flag near-duplicates; never automatically remove distinct frames, prove identity or confer rights. Only call a model's visual interpretation when approved and actually analyzing pixels; text metadata cannot substitute. Human creative direction has the last word.

## 5. Editorial intelligence: how it thinks

### 5.1 Two engines working together

**Opportunity engine:** generates genuinely new, diverse cultural leads from live sources, contextual patterns, controlled serendipity and the existing preset/territory system. It checks novelty and prior coverage, but doesn't eternally blacklist a subject because one image failed.

**Story engine:** develops a chosen lead into a source-grounded editorial case, actual image shortlist and optional alternative angles. It distinguishes what is directly supported, what is interpreted, what requires human fact check, and what should be cut. It compares angles rather than forcing a fixed hook; avoids using unrelated images as if they depict the subject.

Use appropriately scoped research/model calls, and explicit test records of cost and outcomes. Offline source-intake scaffolding alone is not autonomous ideation. No claim of intelligence improvement without real evaluation.

### 5.2 Editorial file contract (target)

Each proposal must be understandable without opening another application:

- A concise working title and **why it's interesting**.
- A real visual lead or honest `no_preview` indication; 1–3 promising alternatives when found.
- Subject/scene/photographer and time/place with separate confidence.
- The proposed connection/reveal/angle, including why the image and story belong together.
- Exact original source(s), selected evidence passages and unverified claims.
- What makes it distinct from already covered material; whether a creator collaboration/original content route is possible.
- Key editorial/rights uncertainty and the one best next investigation.
- Estimated research effort / allowed budget and present state.
- Provenance: manual, historical, feed lead, simulated, native AI proposal; timestamps and version IDs.

Do not require a full dossier to *save a promising idea*. Detailed fact checks and rights evidence become stricter only when a post advances toward publication.

### 5.3 Human editorial standards

Every published factual claim needs support from a source that actually says it, preferably an original/primary record for defining claims. Attribution mistakes and image/context mismatches are separate hazards. Check entire frames/crops when those change meaning; don't infer that a screenshot of a post is the original publication. Caption tone and length adapt to material. Provenance and a correction trail survive rewrites. Human checks of facts, rights and editorial fit remain explicit.

## 6. Founder taste and the improvement engine

### 6.1 Distinct review decisions

Founder actions: `keep`, `maybe`, `pass`, `explore_more`, `find_alternatives`, `develop` and, separately later, `approve_editorial_version` and `authorize_production_handoff`. All record exact proposal/image ID, version, context, timestamp, optional reason and any affected dimensions. A choice is reversible through a new logged decision, not deletion.

Feedback reasons should distinguish: strong subject / weak photo; strong photo / weak story; generic or overexposed; wrong mood/composition; interesting but off-brand; weak provenance; misidentified subject; misleading crop; factual error; rights issue; too similar to earlier posts; too dated/too trend-chasing *for this candidate*; bad UI or retrieval failure; and personal preference. Allow free text. Never infer a broad ban from a frame-specific rejection.

### 6.2 How learning actually changes the engine

- **Immediate:** show what was just decided, persist it, prevent the identical result from repeatedly resurfacing, preserve rejected research for context.
- **Next discovery run:** supply *scoped* taste examples and error reasons, alter search/selection diversity and suggestion framing, use small stable preference context.
- **Periodic evaluation:** compare a version of the engine against fixed founder-judged examples and fresh held-out examples. Require evidence of improvement in candidate usefulness, not just fewer repeats.
- **Engineering cycle:** failures inform source adapters, visual inspection, prompts, UI or contracts. Track whether a correction came from a preference rule, model prompt, retrieval implementation or human exception.
- **Future performance:** incorporate measured owned-account outcomes through authorized Buffer/Meta reads. Keep outcomes separate from founder taste and do not optimize only for likes.

No autonomous self-modifying code or uncapped retraining. An engine can become *more helpful* through state and retrieval feedback without claiming a newly trained foundational model.

### 6.3 Evaluation set

Create versioned, founder-reviewable **golden cases** for factual support, photographer credit, visual novelty, story/image match, fresh cultural relevance, series discovery, duplicate warning, false-positive visual similarity, disliked framing, and beautiful-photo/weak-story disagreement. Existing historical cases remain regressions, never primary demonstrations. New evaluation cases must include real currently accessible source material and an honest `unverified` label when only fixtures exist.

## 7. The Studio: what it looks like and how it behaves

### 7.1 The founder's five questions

When opening the Studio, the UI should immediately answer:

1. **What's new and worth my attention?**
2. **Can I actually see the photographs?**
3. **Why is this interesting and where did it come from?**
4. **What is the simplest decision I can make?**
5. **What happened to my decision and what comes next?**

### 7.2 Product navigation (logical experience, not a forced rewrite)

Keep the existing app, progressively consolidate it behind five understandable tasks:

- **Today / Review:** fresh proposals first, then saved/explore, tasks needing a decision. Never fake fresh content by relabeling history.
- **Discover / Explore:** search or direct a research investigation, large images, image and source trails, shoot/series views, contact sheets, comparisons.
- **Develop:** story brief, evidence, selected images, sequence, cover, caption, music direction and editorial versions.
- **Production:** what is awaiting factual/rights review, approval, proof and the existing guarded native handoff. Clear development-vs-live boundaries.
- **Library / Learn:** preserved sources and photographs, founder feedback history, corrections, account inspiration, later owned performance observations.

This is an interaction model, not permission to replace working seven-view/eight-tab code with another parallel dashboard. Simplify routes carefully, maintain backward compatibility and migrate existing private revisions without loss.

### 7.3 Review-first screen

A visual and fast decision surface: large genuine preview, concise proposed title, why-this-matters, source/credit chips, new-versus-historical badge, visual availability, one clear next step, selected alternatives, and lightweight Keep / Pass / Explore / Develop actions. Reasons optional at first, except where factual/rights escalation requires explanation. Keyboard-friendly, accessible and usable on ordinary laptop screens. The next proposal should be easy to advance to; do not hide a beautiful image beneath tables or an impressive but unusable dashboard.

Separate **Editorial approval** from **Rights clearance** and **Publish authorization** in language, data and actions. A misleading 'Approve' button that seems to publish is unacceptable.

### 7.4 Visual design and interaction standards

Identity: **restrained blue-and-white editorial**, strong image hierarchy, white/quiet neutral canvas, purposeful blue accent, crisp dark typography, generous but efficient spacing, strong visual grid and elegant editorial typography, minimal chrome. Not a SaaS KPI dashboard or a Pinterest clone. Use high-quality empty/loading/error states; indicate missing preview as missing, not as a stock substitute. Build consistent card, image frame, evidence chip, status, compare, editable story and review patterns. Mobile-aware, primarily designed for the founder's desktop/laptop creative workflow.

Where Lovable contributes, it must implement against the same data, contract and design system—not start a second product or production backend. Use screenshot/review evidence for design changes. Interface polish and intelligence quality advance in parallel.

### 7.5 Daily use contract

Founder can launch from their own computer without heroic setup; restore private state; see real existing work; review/decide in seconds; investigate an interesting image; edit a proposal; save safely; and know whether an action merely prepared research or actually invoked a development workflow. A first-run setup should state precisely which credentials and network permissions are needed and what works offline. Backups must be verifiable and restorable.

## 8. Architecture and authority — explicit boundaries

### 8.1 Existing system of record

- **Existing n8n Cloud:** current authoritative production tables, active sourcing/editorial/publishing workflows, native identity and release state.
- **Studio repository / Node 24 local application:** editorial control plane, local visual research, private source and feedback ledger, client interface, tested integration modules.
- **Private `.local/` SQLite/snapshots/media:** working editorial drafts, research branches, evidence, preview records and private decisions. Not pushed to public GitHub. Designed for verified backup, restore and eventual secure deployment.
- **Inactive n8n development workers / proof workflows:** safe testing of new discovery and integration logic, not a separate active production operation.
- **Buffer:** existing publishing provider and later measured outcomes, never an assumed current closed-loop source.
- **Lovable:** optional visual UI build/design exploration, tied to the canonical Studio contract.

**Do not build** a second production authority, duplicate release coordinator, a separate production queue, unnecessary persistent agent framework or new database service solely to store the same facts.

### 8.2 Minimal canonical data entities (conceptual mapping; adapt to existing schemas)

`Source`, `SourceObservation`, `Person/Creator`, `Photograph`, `Shoot/Series`, `CulturalLead`, `EditorialProposal`, `ClaimEvidence`, `FounderDecision`, `WorkingRevision`, `RightsReview`, `ProductionPackage`, `ProviderPost`, `PerformanceObservation`, `ExecutionReceipt`.

For each: canonical ID, source system, source URL/reference ID where relevant, local/global identity distinction, revision, timestamps, status and confidence/unknown dimensions, provenance and approved mutation owner. Map onto current n8n tables and existing local SQLite; do not invent new production tables as a default.

### 8.3 The orchestration contract

A bounded discovery job must record: unique request/job ID, instruction/territory/preset, founder context version, source budgets, model/tool budget and approval, execution stage, exact source identities, retrieved items, errors, zero-result vs failure distinction, checkpoint/resume identity, structured final proposal and receipt with source version. The Studio may *read* existing job outcomes; any new dispatch/write integration requires explicit authorization and verified idempotency. n8n's production job/row authority remains intact.

### 8.4 Production and rights lifecycle

`research_reference` → `editorial_proposal` → `founder_selected` → `working_draft` → `fact_review_pending/complete` → `rights_review_pending/complete` → `final_approval` → `native_package/authorized_handoff` → `Buffer draft/queued/sent` → `Instagram independently observed` → `performance observation`.

These are **logical milestones**, not a required new status field. Preserve actual native code/state names and map to a humane UI. Different axes must not collapse into one “ready” status. Identity ambiguity, stale evidence, incomplete per-image rights, approval mismatch, unknown handoff results, or unverified platform state must remain visible blockers. Do not turn a sent Buffer object into Instagram verification by assumption. No automatic delete/repost to repair ambiguous outcomes.

### 8.5 Security and cost

Minimal permissions, credentials server-side, local-host protections, safe URL handling/allowlists, untrusted retrieved pages never executable instructions, explicit source terms/rate limits, bounded retries and backoff, clear paid-call consent and budget ledger, code/prompt auditability, safe provenance and private backup. Separate explicit approvals for: paid models/search/hosting, network-policy change, n8n workflow activation or production mutations, schema migration, Buffer writes, public deployment and publication.

## 9. Account inspiration and learning from the outside world

Build an inspiration catalog of **research observations**, not a copy engine. Each account/reference includes URL, dated sample, format, subjects, visible style/story mechanics, known public metrics and their limitations, strongest/weakest illustrative examples, possible source trails and opportunities to differentiate. Distinguish observed patterns from causal performance claims. Avoid unauthorized scraping and unsupported private metrics. Start from the six-account study; add fresh visually adjacent accounts only when relevant and verifiably accessible.

Future-owned insights (only after authorized connection): canonical post ID/version, provider post ID, platform verification, observed date/window, media format, metric name, denominator/availability/source, and record of edits. Compare like with like; missing ≠ zero; a younger account should not be compared to a three-million-follower account by raw likes. Editorial excellence and audience response should inform each other without being conflated.

## 10. Reliability: make the machine boring where it should be boring

Keep clear recoverable job states, idempotent imports, bounded pagination, caching and per-source failure status. Preserve append-only founder/evidence/revision history. Provide a private backup/restore that is actually verified, plus restore instructions that a Windows founder can follow. Status text must distinguish `not attempted`, `blocked`, `historically observed`, `fixture tested`, `executed`, `human reviewed`, `live deployed` and `verified result`. Track compact symptoms: broken retrievals, duplicate/same-source loops, new-vs-old queue confusion, missing previews, unverified model/source use, unhandled handoffs, stale credentials, lost private state and production-source version drift. Do not drown the founder in logs.

## 11. What “complete” means: five acceptance gates

### Gate A — Founder can use it

- Founder launches a private Studio on their computer or a separately approved secure host without developer help.
- Current stories, research and private edits are present or clearly absent for a justified reason.
- Can review, compare, decide, develop and safely recover after restart.
- Can explain in one sentence what every major primary action does.

### Gate B — New editorial research actually works

- Engine independently proposes *new* cultural leads beyond historical regression fixtures.
- At least one authorized real source-search path works at the time of testing; real source pages and actual image previews can be inspected.
- Different subjects, decades and contemporary territories show actual meaningful variety and originality, not a superficial category label.
- Research follows a promising photographer/series lead and transparently handles failure and uncertain credit.

### Gate C — The intelligence genuinely improves

- Founder decisions affect future *documented* candidate selection or search in a testable way.
- New evaluation cases demonstrate reduced repetition, stronger image-story connection, fewer attribution mistakes and lower founder effort.
- No fabricated claims of taste, visual inspection, performance impact or autonomous AI output.

### Gate D — Native workflow bridge is reliable

- Research outcomes arrive automatically in Studio from authorized n8n development job paths, correlated and idempotent.
- Production authority remains in n8n; no duplicate releases; approval/version/rights gates work.
- Safe production handoff has been separately reviewed and approved before any live writer/activation.

### Gate E — Steady-state operational maturity

- Scheduled, budgeted discovery produces reliable reviewable candidates at an approved cadence.
- Exceptions are visible, resumable and explainable; private data is securely backed up/restorable.
- Founder can operate a repeatable daily/weekly workflow with mostly editorial choices and occasional maintenance.
- Future measurement links owned outcomes once approved; the system updates its evidence without inventing causality.

A gate is complete only with **founder-visible proof**. Passing tests alone does not satisfy an image-quality gate. The aspiration of only minor future tweaks is reasonable for stable infrastructure, but changing websites, rights, policies, costs and audience tastes will continue to require occasional substantive maintenance.

## 12. Execution sequence — usability and intelligence together

**Phase 0 — Consolidate & protect (small scope):** check live remote, preserve clean branch and private `.local` state, reconcile this constitution with current code/docs, remove contradictory instructions and route all further work through one roadmap. Do not repeat giant audits.

**Phase 1 — Founder-on-device:** finish current private workspace backup/export/restore and reliable Windows launch; provide a clearly populated Studio (existing/read-only source or restored state) and a five-minute founder walkthrough. Simplify confusing queue/status language; make the image-led Review screen pleasant. No unapproved paid calls.

**Phase 2 — First real independent discovery:** verify real broad image-search access and exact cost; propose a tiny paid test only if truly necessary. Approve legitimate contemporary-source/feeds access by specific host, not blanket uncontrolled internet. Generate genuinely new, varied editorial directions and fetch actual images, with honest metadata/pixel boundaries. Show founder a few real candidates and alternatives; record verdicts and failure reasons.

**Phase 3 — Continuously improving engine:** make the approved n8n-to-Studio discovery loop reliable and appropriately automated; remove avoidable manual JSON transfers; integrate scoped taste memory; improve source yield and series exploration; build repeatable real-image evals; aggressively use founder feedback to correct retrieval, voice, UI and orchestration. Keep the Studio usable throughout, not after the automation is finished.

**Phase 4 — Guarded production integration:** approve specific native handoff/rights/claim semantics and deployment changes only after contract and concurrency proof; no automatic approval or publish. Buffer's existing manual/native path remains the fallback.

**Phase 5 — Later measurement, publishing efficiency and expansion:** separately authorize Buffer/Meta readback, independently verify platform outcomes, observe performance and competitor public references ethically, and refine the creative system. Consider a searchable owned web index, collaborations, submissions and richer media only when the core loop has earned them.

Do not demand that all phases be complete before the founder uses Phase 1 and 2. These are overlapping increments with visible proof, not a long sequential procurement exercise.

## 13. Success measurement — quality, not vanity

Prioritize observations that change decisions:

- **Founder usefulness:** percentage of *new* proposals kept/developed, reasons for passes, time from proposal to decision, time from opening Studio to a usable draft.
- **Visual discovery:** percentage of proposals with truly inspectable images, viable hero options, distinctive sources, novel frames/series mates, photographer attribution confidence, repeated/stock/generic rate.
- **Editorial quality:** claim/link support, image-story fit, corrections, originality of research treatment, revisions per accepted post.
- **System reliability:** completed/resumable jobs, source errors, stale/unverified statuses, accidental duplication, local state backup/restore checks, n8n receipts.
- **Budget:** actual cost per reviewed proposal and per approved editorial draft once real authorized usage begins.
- **Later performance:** owned post results by comparable format/time/window and public competitor observations with known limitations. Engagement is a signal, not the editorial constitution.

Create a weekly founder review with **three questions only**: What was excellent? What was wrong or tedious? What should change in the engine next? Log decisions and test that the proposed fix works. Do not build an entire analytics surface before collecting reliable observations.

## 14. Governance — what is fixed, adjustable or experimental

**Foundational (change only by intentional founder decision):** publication identity; editorial integrity; authentic image context; documented provenance; founder-controlled rights and publication approvals; existing n8n production authority; one coherent Studio; no silent paid actions; no invented performance claims.

**Configurable / should improve often:** sources and search order, creative territories, prompt examples, taste memory, candidate depth, research budgets, contact-sheet presentation, review reasons, formats, contemporary/historical balance, caption style examples, UI patterns and ranking experiments.

**Experiments, not guarantees:** vision-assisted pairings, embeddings, graph exploration, self-directed research branching, broader trend sensing, competitor performance models, creator submissions, creator collaborations, owned web index and automation cadence. Each needs a hypothesis, permission check, cost, evaluation and rollback plan.

Changes must produce a **decision record**: context; founder intent; evidence; options; decision; owner; date; impacted modules/workflows; tests; effects; approval boundary. Avoid duplicating long speculative project plans; keep one live status and append decisions. Older strategy reports remain historical input, not equal-priority instructions.

## 15. Source documents and conflict precedence

This constitution synthesizes:

1. **Founder decisions in the MILDINCIDENT project conversations**, especially creative openness, autonomous idea generation, contemporary sources, n8n as backbone, Studio usability soon, founder feedback and later Buffer learning.
2. **`MILDINCIDENT_2_0_FINAL_MASTER_CODEX_PROMPT.txt`** — initial 2.0 sprint technical instructions and boundaries, now supplemented by this more current direction.
3. **`mildincident-2.0-blueprint-2026-10-30.pdf`** — Muse deep engineering/creative transformation research (against earlier commit `16cd1f5`).
4. **`mildincident-editorial-research-report-2026-10-29.pdf`** — editorial, photography, brand, original-content and product research with evidence grading.
5. **`deep-dive-inspo-accounts-2026-10-28.pdf`** — dated six-account sample and comparative creative patterns.
6. **Current source of truth:** existing n8n/Buffer readback for production, current GitHub code and tests for implementation, live legally accessible sources for claims about provider availability, and founder judgment for taste.

**Precedence:** current founder decisions and safety approvals → live implementation truth for what is built → this constitution for target outcomes → detailed master prompt/older research as supporting material. If an older research report recommends rigid numeric thresholds, mandatory caption structures, broad automated taste scores, archive-first sourcing or production activation in conflict with current direction, follow current direction and record the difference.

## 16. Immediate instruction to the engineering agent

Treat this as the **canonical north star**, not as a reason to stop coding and rewrite every file. First finish the interrupted launcher/private state restore. Then bring a real founder-reviewable Studio experience online locally, with existing legitimate data and honest states. Next prove genuine new photographic discovery from approved and accessible sources, then improve it with founder feedback and n8n integration. Apply the architecture incrementally and document what is implemented vs target. Respect cost, production and external-host permissions. This is a system meant to be used while becoming great, not a perfect design left on paper.

---

**Founder approval of v1:** Approved as strategic direction in the October 30, 2026 canonical-foundation request. This supersedes the attachment’s pending-review label. Approval does not grant paid execution, network changes, production access, workflow activation, rights clearance, publication or deployment. Implementation evidence and remaining acceptance gates live in [PRODUCT_MAP.md](PRODUCT_MAP.md) and [SPRINT_STATUS.md](SPRINT_STATUS.md).
