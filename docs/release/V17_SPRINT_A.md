# V17 Sprint A — photographic source progression

Local implementation on top of `6645579`. No deployment, live n8n/credential/policy/grant change, paid operation or publishing. The accepted workstation and V16 native compatibility repair are preserved. PR #1 was not modified or merged.

## What works

- **Continue retained pages:** source extraction has stable 40-reference windows. A continuation cursor binds the exact HTML hash, source URL, parser version, story/revision, named project and direction. The next request processes the remainder rather than reading the page again. Invalid/forged ranges cannot skip references or manufacture completion. HTML/tag scan limits remain visible; completing known references does not establish a complete shoot.
- **Use older useful evidence:** unfinished scans and pending downloads remain reusable beyond the source freshness window and across restarts. Fully checked sources may become eligible for a fresh read later. Retained receipt JSON and original capture timestamps/hashes are unchanged; each new extraction records its own window and derivation.
- **Advance to legitimate sources:** exact artist, photographer, gallery, book-publisher and original-publication links are re-derived from intact legacy captures, even when the old receipt has no `projectTrails`. Source roles, originating page/hash and parser provenance accompany the leads. Script/comment decoys, unrelated roundup paragraphs and unsupported hosts cannot become automatic destinations. Explicitly supplied saved pages retain their existing unverified-lead behavior; they cannot authorize automatic image acquisition.
- **Finish files before repeating pages:** saved evidence supplies remaining image references and pending downloads before another source read. Previous failed, denied, interrupted or unsupported image attempts are not silently repeated. The founder can deliberately recheck through the existing Advanced source tools. Uncertain source outcomes stay recorded and are not automatically resubmitted.
- **Keep project photographs distinct:** image-specific source evidence separates covers, spreads, installations and design documentation from direct project suggestions. A photographer credit alone no longer promotes an unrelated project when no series title is available; the image needs subject correspondence too. This is source-metadata filtering, not AI visual judgment or identity/rights verification.
- **Prove each acquisition:** an image in a later extraction window must be re-derived from that exact hash-bound page/window before download. Exact file duplicates are withheld. Source URLs, original/preview hashes, request/page provenance, reference index and material basis remain available.
- **Explain outcomes:** receipt headlines/counts distinguish new privately decoded project files, private copies of existing references, references still without files, repeats, exact duplicates and supporting material. The inspector correctly distinguishes a browser preview, an uploaded image and a decoded source copy. Selection, caption, permissions and review controls are unchanged.

The same PhotographyService, source readers, private preview storage and guarded request ledger implement this. No second search engine, AI scorer, provider integration or new authorization mechanism was added.

## Acceptance evidence

| Story | Actual local result | Evidence boundary |
| --- | --- | --- |
| Sophy Rickett, Pissing Women | The retained roundup advances **40→52**, processing 12 remaining references with **zero page reads**: two repeats and ten exclusions, zero useful additions. A subsequent legacy-link traversal checks the recorded artist/book paths and saves two generated project-file fixtures while excluding a cover. | Roundup HTML is an actual retained local capture: 200,499 characters, SHA256 `dcbe854c9c8e56996fbd99a1a26dd36d7fe148d7dab08612834b5416b4179257`. It is not the exact 200,761-character hosted receipt capture. Fresh artist/book HTML, network responses and image pixels in this acceptance are explicitly simulated. The two test files are not new Sophy photographs. |
| Jack Nicholson, Los Angeles 1969 | The existing pending-seventh mechanism is preserved: one known reference gains a private generated image copy, **zero page rereads**, zero new-photograph claims. Earlier files remain unchanged. UI now reports that copy accurately. | This mechanism already worked in V16. Retained hosted evidence names six decoded URLs and reports seven new references, but the actual seventh URL/full LIFE page is unavailable locally. Its identity, usefulness and actual file acquisition have not been verified; no filename was guessed. The seven-frame continuation page/pixels are simulated. |
| Marcie Docherty | With no additional retained project lead, continuation returns an honest zero and does not reread the same source. No caption or selection changes. | Actual retained research/caption metadata and original gallery URL; no retained complete gallery HTML or alternate project-source page. Source transport/pixels in the positive fixtures are simulated. New contemporary photographic acquisition remains unproven. |

An additional isolated 52-reference project fixture verifies actual file acquisition from references after 40: the second request saves six decoded generated JPEGs from the 12-reference tail with the correct source-window hash and no page reread. A third explicit action continues pending copies; earlier receipt JSON, captions and selections remain byte-identical.

**Genuinely new hosted photographs obtained in this sprint: zero.** No Find More Photos action was run against hosted founder storage. Artist/gallery/publisher access, CDN responses and editorial quality still need a controlled hosted acceptance after an authorized release. Existing LIFE/Dazed success remains historical evidence, not proof of every new source adapter.

## Actual rendered UI

Six before and eight after screenshots were captured from running local Studio in Chromium, using retained story metadata and a visible replay/simulation banner. No HTML, code or test report is presented as a screenshot.

- Desktop: `.local/v17-a/before-sophy-1440.png` → `.local/v17-a/after-sophy-1440.png`.
- Mobile: `.local/v17-a/before-sophy-390.png` → `.local/v17-a/after-sophy-390.png`.
- Honest partial-scan completion: `.local/v17-a/after-sophy-continuation-390.png`.
- Jack private-copy receipt: `.local/v17-a/after-jack-390.png`.
- Marcie zero result: `.local/v17-a/after-marcie-1440.png`.

Actual visual inspection found no overflow/browser errors at desktop/mobile widths. The isolated Jack edit survives browser refresh and reopening storage. Search, comparison/selection and original ordered selection remain intact. Full reports and replay harness stay ignored under `.local/v17-a/`.

## Verification and next release

Targeted and full regressions cover partial-window decoding, source progression, exact provenance, material filtering, corrupt cursors, expired unfinished captures, duplicate confirmation, uncertain/denied retrieval, restart, explicit recheck and unchanged history/edits. **519/519** unit/regression tests, syntax checks and **40** existing browser groups pass against isolated data, alongside the retained-story desktop/mobile journey. There are no browser errors or automatic retries.

The next release can include both this source improvement and the preserved [V16 compatibility repair](V16_NATIVE_COMPATIBILITY_REPAIR.md). It needs separate deployment approval and the usual current backup/data/rollback checks. Keep the operating caption/story worker and recurring policy unchanged during the code release.

Then verify genuine hosted source/file outcomes before claiming new photography. The first AI visual acceptance remains a separately approved native graph installation, exact saved/execution checksums and version binding, fresh job/one-use grant, one bounded six-image call and restoration/version-pin reconciliation. Never reuse execution 2363's consumed grant or either failed launcher. No AI aesthetic assessment or automatic carousel recommendation is enabled by Sprint A.
