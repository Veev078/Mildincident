# V19 — Studio product reset

Built locally on `4dc7cae`. No deployment, live n8n/policy/credential change, paid model call, publishing or destructive migration occurred. V18 founder acceptance is retained evidence: relevant Miami photographs with 22 references, saved Hase images and preserved Jack selections. References are not counted as privately decoded files.

The founder journey is **Discover → Build → Refine → Approve / Buffer**. Old story IDs and bookmarks remain valid; image/arrange links open Build, caption links open Refine and publishing links open Approve. Research, music, direction, history and exports remain under story tools. Library and the earlier desk remain accessible through Studio tools.

## What changed

- Build is a photograph-first canvas. Saved project images precede source-only references and other material. Cards use consistently cropped display thumbnails, short labels and quick selection/comparison/cover controls. Full source captions, provenance, rights and file evidence remain in the inspector. Original files are never cropped or replaced.
- One photo-discovery action, a compact progress/outcome line and optional search/history details replace the large search panel. Existing source budgets, acquisition, exhaustion, deduplication and error classifications are unchanged. Galleries render at most 18 items initially; more are explicit. Unselected frames do not disappear when chosen.
- Selected frames can be ordered and made the cover directly on Build. Desktop keeps the post beside the gallery; mobile prioritizes pictures, with a selected-count jump to the same sequence controls. The caption preview leads into Refine.
- Curation is optional and opens separately from the gallery. Unavailable AI shows one explanation, with no misleading confirmation button. An available approved operation still reviews the actual inputs, cost estimate and image sharing before explicit confirmation. Existing compact vision/policy/usage/failure safeguards remain unchanged. A verified result can show an opening, up to two supported alternatives and a proposed sequence; Apply is separate and preserves history. Source-only suggestions are not called visual judgments.
- Refine keeps one writing editor, Improve with AI and Compare, with selected photographs alongside it. Research, photo-led writing notes, origin/usage and detailed checks are secondary disclosures. The comparison tray no longer follows the founder into final review.
- Approve presents the complete caption and ordered images, then factual, permission and exact-content approval requirements. Prepare for approval uses the existing immutable handoff. The existing native workflow remains responsible for approval and Buffer; this release adds no direct Buffer send or automatic transfer.

## Loading and architecture

Measured causes were whole-workspace derivation for each image request, large repeated curation payloads, full display-size images in small cards and image nodes being replaced when controls changed. Conflicting inherited mobile gallery rules also obscured the selected-sequence controls.

Private image/detail reads now scope the existing allowlisted model to one story. `/api/workspace?summary=1` omits expensive detailed curation; the active story hydrates through the existing authenticated detail endpoint. The original full API remains compatible. Failed detail reads have a truthful retry state instead of leaving the whole desk stuck; pending edits retain their original revision protections.

Display-only 320/640 px JPEG derivatives are generated from hash-checked private previews, coalesced and cached in bounded 8 MiB memory. Original bytes/hashes/provenance and session/origin checks remain. No new database table, persistent derivative migration, URL proxy or research engine was introduced. The inspector requests the full existing preview. Native lazy loading and keyed image-node reuse avoid restarting decoded gallery images on selection and comparison changes. The new Build layout owns its classes rather than inheriting the old gallery's responsive rules.

Local retained-data measurements: workspace response **620,629 → 310,449 bytes** (50% smaller); six real Jack display reads **103,161 → 71,876 bytes**, median **0.75 s → 0.08 s** in a sequential five-run-per-version loopback comparison. These are local measurements, not hosted latency guarantees. A generated high-resolution JPEG fixture separately verifies substantial thumbnail reduction, full decoding, duplicate-work coalescing and untouched originals; generated pixels are not editorial acquisition evidence.

## Actual acceptance evidence

- Local Chromium desktop/mobile journeys open retained Jack, Hase, Miami, Sophy, Lost & Found, Dog Pound Days and Marcie metadata. Six real retained Jack JPEGs render. Source/network limitations are labelled; no new photographs or hosted retrieval are claimed.
- The founder journey explicitly selects images, changes cover/order on Build, compares/inspects, edits on Refine, prepares an exact approval handoff and reloads. Caption/order/history/approval and private image hashes are preserved. Existing source selections are never silently replaced.
- Injected unfamiliar-source HTTP 403 remains bounded and explicit; duplicate clicks and timers do not repeat it. An injected story-detail network failure can be retried without losing the desk or saved work. No global fallback stories are inserted.
- Optional curation is tested separately with **simulated** judgments and real retained image inputs: one confirmation/dispatch, visible estimate, opening/two alternatives, no automatic edit and explicit Apply. It is not proof of real AI taste or a completed paid assessment.
- Required syntax checks and 595 regression tests pass, including immutable thumbnails, scoped model reads, original-file corruption and legacy/backend contracts. Existing UI assertions were updated for the approved journey, preserving stale-edit, rights, history and publication checks.
- Actual rendered BEFORE/AFTER screenshots and reports remain private in `.local/v19/`, including `before-images-*`, `after-build-*`, `journey-build-*`, `journey-refine-*`, `journey-approve-*` and `curation-*`. They are running UI captures, not HTML/log screenshots or hosted acceptance.

## Next coordinated release

Approve one code-only deployment of the final V19 commit after current backup/rollback checks. Preserve the existing disk, policies and active caption/story worker. Then measure the hosted experience with the founder's actual Miami/Hase images, Jack order, Dog caption, Sophy zero-result behavior and one unfamiliar subject: first useful image, usable post, editing effort and handoff accuracy. Actual hosted latency, usefulness across unfamiliar sources, complete real Vision quality and any future direct Studio-to-Buffer integration remain unproven or separately gated. Do not bundle worker activation, paid Vision or publishing into the code release.
