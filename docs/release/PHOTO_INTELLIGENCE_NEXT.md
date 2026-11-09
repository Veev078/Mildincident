# Photographic intelligence — focused continuation after V14 acceptance

## Verified starting point

Hosted V14 is `108a7e88ce3f61844f4a3c45ec3530c604738448`, deployment `dep-dbof01jl550s739hilpg`. The founder completed acceptance: the interface and previews work; Find More Photos reported nine new references and ten repeats, but several results were unrelated and the selection was not compelling. No AI visual research took place. Do not repeat this acceptance or redeploy that commit.

The source of those exact nineteen hosted references is not independently available to this Cloud session. The retained Sophy Rickett research provides a reproducible diagnosis: its Dazed roundup contains forty extracted references, four matching Pissing Women and thirty-six other/unconfirmed. Existing receipt code adds every nonduplicate to story media. Ranking and grouping do not prevent irrelevant results from entering the story. It reads one recorded page, without open-web investigation or image-pixel analysis.

## Source and image-access findings

- [The specific Dazed project article](https://www.dazeddigital.com/art-photography/article/68611/1/pissing-women-sophy-rickett-art-activism-provocative-london-exhibition-book) has a four-image gallery. Following it improves relevance, but is not evidence of additional photographs beyond the existing four references.
- [Rickett's own exhibition page](https://sophyrickett.com/exhibition-cob-gallery/) describes an unreleased Vauxhall Bridge photograph and links six full-size Squarespace-CDN files. It also discusses Rut Blees Luxemburg's different work. Page membership alone must not establish which photographer/project an image depicts.
- [Climax's project page](https://www.climaxbooks.com/products/sophy-rickett-pissing-women) has a fifteen-item book gallery. The artist's [news page](https://sophyrickett.com/blog) describes outtakes and behind-the-scenes documentation in this edition. These are promising source leads, not fifteen proven new photographs: book covers, spreads, repeated frames and installation images need separate treatment.
- [Cheerio's project page](https://www.cheeriopublishing.com/pissingwomen) provides a direct publication source with Squarespace-CDN image links. These, too, require image-specific classification.
- Public research tools could read those source pages and resolve image links. They did not provide inspectable pixel data to this agent. No new photograph has been decoded and visually assessed in this continuation.
- The current Cloud allowlist permits n8n/Buffer and package hosts, excluding these photographic pages/CDNs. This is a Cloud development restriction, not proof of a hosted publisher denial. Founder acceptance demonstrates some hosted page retrieval and browser previews work; exact hosted source/CDN paths still need instrumented per-attempt evidence.
- The existing recorded-image inspector binds `candidate.media` in the native candidate table and defaults to same-host images. Its local operator helper also permits publisher subdomains, such as Dazed's image CDN. It does not support cross-domain pairs such as `sophyrickett.com` → `images.squarespace-cdn.com`, or newly discovered photo-ledger candidates. Browser hotlinks are not durable decoded source copies. Extend that existing mechanism; do not remove its source binding or add an arbitrary URL proxy.

## Checkpoint 1 — safe local repair

Implemented using the existing PhotographyService and request/receipt ledger:

1. Default new source-first requests keep only image-caption project matches in suggestions. Other references stay in the original receipt with an excluded count. Explicit broader-context exploration remains available. Previous receipts, selected photographs, captions and history are not rewritten.
2. A source-first network request can read the recorded page and follow at most one supported link whose anchor names the exact photographer and project. Both attempts share the same durable claim and bounded two-page budget. Each page remains limited to 2 MB/12 seconds, with no credentials, redirects, retries or fallback after failure. Saved-page import remains network-free. Older prepared one-page packets keep their original budget.
3. Both captured pages and their provenance remain private. Restart/duplicate clicks do not repeat requests. A failed second page retains the first capture and records failure instead of presenting unrelated material as fallback success.
4. Reader hosts now include the independently researched artist/gallery/publishers above. Every URL still needs exact recorded-story/link binding; adding a reader host does not change Cloud network settings or discover that host automatically.
5. Responsive-size/format URL variants are deduplicated while preserving distinct record IDs. This is reference deduplication, not perceptual proof of identical images.

This checkpoint is metadata/source traversal, not AI photographic intelligence or a successful new-photograph acceptance. No main-page redesign is included.

Validation: syntax checks, 478 unit/integration/frontend tests, the existing 40 browser groups, and an isolated desktop/mobile retained-source replay. In that explicitly isolated replay, four known project references were seeded before importing the actual retained roundup: the old code suggested thirty-six unrelated/unconfirmed references; the repaired code suggested zero, retained those thirty-six in history and preserved the four selected images and caption across refresh. This is not a repetition or reconstruction of the founder's nineteen-reference hosted acceptance. External image requests were blocked; no new photographic pixels or paid outputs were used. Before/after screenshots of the actual running local interface are under ignored `.local/photo-intelligence/{before,after}-{desktop,mobile}.png`, visibly labelled as a local retained-source replay.

## Checkpoint 2 — legitimate source acquisition and real image inspection

Extend the existing source-bound acquisition and LocalPreviewStore path to photo-request receipts. Bind story/source revision, request/receipt digest, exact source page and the image URL actually embedded there. Review explicit publisher-to-CDN mappings, including Squarespace and Climax's observed image hosts; never infer trust from an arbitrary public URL. Preserve redirect, credential, MIME, byte, timeout and private-file limits. Store actual decoded copies and hashes using the existing preview store, and compare existing file/perceptual fingerprints.

Instrument source-page and image attempts separately: destination host, status/failure, bytes, decoding and provenance. No secret headers/bodies in browser diagnostics. Stop on denied access; do not use authenticated sessions, anti-bot workarounds, proxies or a silent fallback to generic archives. Establish a legitimate permitted source route where needed.

Start with the artist, gallery and original publishers for Sophy; distinguish original frames, outtakes, book/spread photographs, installation views and another artist's work. Use a second retained contemporary photographer/project to avoid a one-story special case.

## Checkpoint 3 — bounded native AI investigation and visual review

Use the existing native development worker, guarded jobs, request hashes, single-use per-action claims, result delivery and photo receipt ledger. The current active caption/story policy does **not** authorize photo research. Do not route it through story generation or caption grants, install the old V14 writing patch, or create another engine.

Prepare one separately reviewed photo-operation branch: an exact artist/project research input with known images and sources; bounded legitimate source discovery; verified page/image acquisition; then visual assessment of decoded images. Proposed pilot ceiling for review: one research operation with at most two search-tool calls, and one assessment of at most six acquired images. Select actual output/input limits and estimated exposure only after the rendered payload and supported model inputs are verified. No paid calls are authorized by this plan.

The assessment must bind each response to the captured image hash and source, reject other projects, identify weak/uncertain matches and explain editorial potential using visible details. Metadata-only matches must remain distinct from pixel-inspected results. Do not fabricate URLs, author identity, permission or an aesthetic guarantee. Preserve manual selection and existing caption/photo approvals. No automatic resubmission after failure or uncertain completion.

Before any installation/execution, present the precise graph diff/checksum, policy extension, founder confirmation, per-operation limits, estimated cost with residual retry/tool risks, maintenance/rollback steps and a one-operation acceptance proposal. Keep the live recurring caption/story system operational and unchanged until that separate approval.

## Success and release gate

Success means at least one genuinely useful, relevant new photograph beyond the existing story's images: actual pixels inspected, original-source evidence checked, repeats/other projects excluded, with a concrete reason it improves the editorial selection. A larger reference count, imported HTML, successful tests or the presence of a preview URL is insufficient. Record a zero-useful-image result honestly.

Validate the complete request → acquisition → assessment → founder selection in isolated storage first. Compare actual before/after running UI screenshots when a visible change is implemented; fixture imagery must remain labelled. Then obtain separate deployment/native-policy/paid acceptance authorization. This continuation performs no deployment, live workflow/policy mutation, provider credential change, paid generation or publishing.
