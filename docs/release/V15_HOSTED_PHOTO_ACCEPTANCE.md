# V15 — real hosted photographic acceptance

## Released version and evidence

The controlled release deployed `2d47c21b4f3b648d2193721321c473255cc1a2a2` to the existing Render Studio, service `srv-dbih0du1egvs73er26kg`, deployment `dep-dbp4iqbbc2fs7394fs30`. Render confirmed live status, private hosted startup and the unchanged persistent disk/configuration. Code rollback target is `5f9ebcacd39bbb5d108ee28cc7010395896c0b51`, deployment `dep-dbp3tketlv9c73eef8s0`; no rollback was needed or performed.

The founder confirmed a fresh verified workspace backup downloaded and saved offsite before deployment. The archive was not independently accessible or restore-tested here. Workspace backups cover drafts, photo receipts, workspace authorization/history and private image stores; parent sign-in/session data, private policy/dispatch configuration, provider credentials and authoritative n8n/Buffer state are separate.

The results below are the founder's **real hosted acceptance**, not the earlier local replay or generated-image tests. The founder reports that the redesigned UI works well and should be preserved. Codex's hosted browser access remained blocked; no independent hosted screenshots, filesystem inspection or visual judgments are claimed.

## Actual founder results

| Story | New project references | Repeated references | Unrelated / unconfirmed excluded | Founder assessment |
| --- | ---: | ---: | ---: | --- |
| Jack Nicholson — Los Angeles, 1969 | 7 | 0 | 20 | Strong success. Visible photographs are highly relevant and form a compelling collection; dramatically better than earlier photography results. |
| Sophy Rickett — Pissing Women | 0 | 34 | 6 | Limited success. Existing relevant images display, but no useful additions. |

Jack establishes a strong founder-facing photographic result through the released Studio. The seven-count is the reported **project-reference** count, not a separately verified count of seven new full originals or seven privately decoded files. The founder's relevance/collection assessment is meaningful acceptance evidence; it does not establish image rights or model vision.

Sophy establishes zero useful additions from this search. Thirty-four repeated references do not mean thirty-four distinct photographs. This is evidence that the searched material yielded no additions, not proof that the entire project has no more imagery.

Do not ask the founder to repeat either acceptance search merely to reproduce these counts. Any receipt inspection should use the already completed searches without dispatching a new operation.

## Browser display versus private decoding

| Evidence layer | What this acceptance establishes | What remains unknown |
| --- | --- | --- |
| References | The exact new/repeated/excluded counts reported above. | Canonical-file and perceptual uniqueness of every new reference. |
| Browser display and founder curation | Actual relevant photographs are visible in hosted Studio; Jack's collection is compelling to the founder. | Whether each displayed image came from a direct browser hotlink, an older private preview, or a newly acquired private source copy. |
| Server acquisition and private storage | The deployed code supports receipt-bound acquisition, bounded decoding, private blobs and source/hash evidence. | Superseded by the read-only receipt evidence below: six Jack `decoded` and six Sophy `cached_existing` acquisitions, with all twelve original/preview file pairs present and hash-matching. Full-resolution originals, visual uniqueness against all earlier thumbnails and rights remain unverified. |
| AI visual assessment | No photo-vision operation was introduced or initiated for this acceptance. | No AI aesthetic, project-identity, composition or carousel assessment has been validated. |
| Rights / approval | Existing human review boundaries remain in force. | Display, decoding and the founder's editorial enthusiasm do not establish reproduction permission or publication approval. |

The successful LIFE and Dazed routes are now recorded below. The supplied receipts contain no failed page/image attempts; they provide no success or failure evidence for the artist, gallery, book-publisher or Squarespace routes. The Cloud development allowlist restriction must not be reported as a Render origin-access failure.

The founder confirmed UI operation; an exhaustive record-by-record comparison of every caption, earlier draft and selection was not separately reported. Do not silently promote that broader preservation check to independently verified.

## Read-only receipt follow-up — V16, 10 November 2026

The founder supplied the full JSON from the prepared **read-only Render Shell** command. It inspected the completed requests and existing files without rerunning either search. This is hosted evidence supplied by the founder, not independent Codex filesystem/browser access.

| Completed request | Source route | Private file evidence | Limits / interpretation |
| --- | --- | --- | --- |
| Jack `f737c4e8-04c6-49e7-ab5c-d881720e6b13` | [LIFE project page](https://www.life.com/people/jack-nicholson-early-photos/) → `static.life.com/wp-content/uploads/migrated/2012/04/` | Six JPEG acquisitions with status `decoded`. Original and derivative files exist; all twelve SHA256 checks match. Two 660×1000 images and four 1024×671–676 images; original downloads total 799,668 bytes. | Seven new references, **six acquired files**, not seven full-resolution originals. The seventh reference is outside the six-image acquisition budget. Earlier Brave-wrapped thumbnails do not provide comparable original hashes. |
| Sophy `bc6efc1c-d6de-4cdf-8aa6-e00f4a09d202` | [Specific Dazed article](https://www.dazeddigital.com/art-photography/article/68611/1/pissing-women-sophy-rickett-art-activism-provocative-london-exhibition-book) and [September roundup](https://www.dazeddigital.com/art-photography/article/68819/1/most-loved-photo-stories-september-25-photographers-zines-series) → `images-prod.dazeddigital.com` | Six JPEG acquisitions with status `cached_existing`; all twelve original/derivative hashes match. One 640×426 image and five 640×427 images; original downloads total 367,846 bytes. | `cached_existing` means acquisition for an **existing reference**, not a new photograph or proof of previously cached bytes. Zero additional project references. |

All three saved-page hash checks also match. LIFE considered 66/66 image tags and retained 27/27 references. The specific Dazed article retained 19/19. The roundup considered 50/50 tags but retained only **40 of 52 references**: the retained-reference limit was reached. That is a bounded scan, never proof that the whole source/project is exhausted. No receipt claims a complete shoot or AI pixel assessment.

Jack's downloaded filenames end `150118-jack-nicholson-02.jpg`, `04-1024x676.jpg`, `05.jpg`, `07-1024x674.jpg`, `08-1024x671.jpg`, `09-1024x676.jpg`. Sophy's copies end `1422047.jpg`, `1422048.jpg`, `1422050.jpg`, `1422049.jpg`, `1421791.jpeg`, `1421792.jpeg`. These are observed web-sized source copies. No reproduction rights or independent aesthetic/identity verification follows from decoding.

A separate older Sophy receipt `2c604ee2-7dc7-455d-a698-27974958eeb7` records nine new/ten repeated references and **no** page captures or image attempts. Preserve it as historical reference-only evidence; do not combine it with the current V15 result.

The full supplied hash/dimension summary is retained privately under ignored `.local/v16/hosted-receipt-summary.json`. [V16 implementation and approval boundary](V16_PHOTO_INTELLIGENCE.md) build on these observations. No additional real photograph was obtained during V16 local development.

## Next focused work

Preserve the current UI. Extend the existing PhotographyService, captured-page evidence and request/receipt ledger rather than creating a second engine.

1. Inspect the completed Jack and Sophy receipts read-only: exact pages attempted, captures, extraction limits, duplicates, exclusions, image-host results and private decoding evidence. Use Jack to identify the successful general mechanism, not a hardcoded celebrity/source special case.
2. Recognize source exhaustion at the **story/source/capture/direction** level. A complete unchanged scan with no additions can deprioritize that source for the next explicitly requested search. A truncated or bounded scan means only no additions in the inspected portion. Access denial, unsupported hosts and uncertain requests must remain separate from exhaustion. Never mark an entire project exhausted from one page or automatically resume an uncertain action.
3. Advance to another legitimate project-specific source: photographer/artist, gallery, original publication, book publisher, exhibition documentation or reported outtakes. Prefer exact recorded/captured links; do not reuse a generic historical archive as the default. Keep book covers/spreads, installation views, process images, other artists and existing-frame variants distinct.
4. Measure repeatability across an editorial portrait collection like Jack, a specialized limited series like Sophy, and a contemporary maker/project. Success is useful additional imagery and preserved selection, not reference volume or passing test counts.
5. Add AI source investigation and image assessment only after separate reviewed authorization. Use the existing native worker's job/claim/result architecture, photo-specific permission and real hash-bound image inputs. Current caption/story grants do not authorize this operation. Do not change the live worker now.

For a future first visual-ranking acceptance, propose one founder-confirmed request using at most six **actual decoded** inputs and at most 1,200 output tokens, with no searches or drafting. Verify the byte handoff and rendered model input offline first. Expected standard GPT-5.4 exposure is provisionally about $0.03–$0.08, depending on image dimensions and text context; account pricing, output/reasoning and hidden retries can differ, so this is not a hard cap. A source-investigation/search stage is a separate paid scope to price and authorize if the receipts show that it is needed. No graph checksum or paid approval package is READY until actual inputs and the native patch are reviewed.

[GPT-5.4's documented image input](https://developers.openai.com/api/docs/models/gpt-5.4) and [Responses image blocks](https://developers.openai.com/api/docs/guides/images-vision) support the intended model format. The retained published n8n OpenAI v2 `formatInputMessages` helper converts binary image data into `input_image` data URLs. These are API/package capabilities, not proof that the current Studio-to-worker byte handoff exists or that the deployed path has processed images. The reviewed patch must transfer verified private bytes into genuine image inputs, bind their hashes and enforce a photo-specific authorization; text-only image references and existing caption/story grants are insufficient.

The detailed implementation history is in [V15 photographic operations](V15_PHOTOGRAPHIC_OPERATIONS.md); the current continuation is [Photo Intelligence next](PHOTO_INTELLIGENCE_NEXT.md).

## Boundaries for this record

This update records acceptance and narrows the next work. It makes no UI/application change, source request, model call, workflow/policy mutation, credential change, deployment, Buffer action or merge. Existing histories, private data and the live recurring AI system are untouched. PR #1 remains draft and unmerged.
