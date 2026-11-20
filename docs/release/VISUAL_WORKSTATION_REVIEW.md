# Visual creative workstation — draft review

## Baseline audit

Extends existing draft PR #1, `ui/photo-desk-flow-20261108`, from `948f9d2`. Photo Intelligence `131d537` is already in that branch and remains intact. No live data or operational settings are edited.

Before changing UI code, ran the actual local app with isolated SQLite stores and nine decoded, clearly labelled generated test frames. Captured Today, Stories, Develop, Photographs, Arrange, Review, Library, Discover and Production at 1440, 768 and 390 pixels, plus inspector and comparison. Screens are `.local/workstation/before-*.png`; this is generated-image design evidence, not photographic retrieval or hosted acceptance.

Observed issues:

- Desktop Photographs shows three large selected-image cards before the candidate gallery, alongside a tall search panel. Candidates require substantial scrolling. Search occupies over 420 pixels of horizontal space despite being one control group.
- Mobile search setup fills almost the first screen; selected images and candidate results sit below it. The photo page also produces page overflow at 768 and 390 pixels.
- Selection, Compare, Shortlist and Set cover compete on image cards. The selected sequence is repeated as full cards rather than an accessible compact context panel.
- Comparison crops some aspect ratios and pushes provenance/actions beneath the useful modal area. The inspector has navigation and feedback but no direct sequence-selection or comparison action.
- Repeated story headings, sticky stages and a second Photographs heading weaken context. Focus scrolling can leave the project name offscreen. The writing surface receives an unintended large focus outline.
- Layout styling has accumulated repeated sidebar, photo, inspector and caption overrides across `styles.css` and imported feature sheets. Another appended override block would make future changes harder to reason about.

The existing PR's direction-before-search order is correct and is retained. Existing caption autosave, stage routes, progressive source controls, native permission checks, receipt filtering and manual publishing boundaries remain the implementation basis.

## Design and validation

The shared shell uses a neutral workspace, compact dark navigation, editorial serif headings, system UI controls, a restrained green accent, delicate borders and an 8px-based spacing scale. Component layout rules now have one owner in `web/workstation.css`; corresponding competing rules were removed from the legacy sheets. No framework, font service or application dependency was added.

Photographs now uses a gallery with grouped direction/search controls and a compact selected-sequence panel. The selected panel becomes a horizontal strip on mobile. Cards distinguish source-caption relevance from permission, with one clear selection action and quieter comparison/details/shortlist controls. Contextual and unconfirmed references, original-source import, archive search and request history remain accessible through disclosures. Failed sources expose their recovery tools rather than presenting successful retrieval.

The inspector prioritizes the full image and adds sequence selection, comparison and cover controls. Comparison keeps full frames visible, supports deliberate selection and retains up to three references through refresh in the same tab. Missing references are identified rather than silently discarded. Closing the inspector returns keyboard focus to its launcher. Changing the sequence preserves unsaved image feedback and requires an explicit context confirmation before saving a note written against an older working version.

Develop, Photographs and Review share the same navigation and spacing. Caption editing retains its autosave and version boundaries; Arrange retains drag/drop and accessible movement controls. Review retains factual, photographic, rights and approval requirements. No backend contract or `src/` implementation changed.

## Files and ownership

| Files | Purpose |
| --- | --- |
| `web/workstation.css`, `styles.css`, `workflow.css`, `develop.css`, `index.html` | Consolidated layout ownership, shared tokens and responsive layouts without another competing override layer. |
| `web/photo-desk.js`, `photo-requests.js`, `views.js` | Gallery, selected sequence, progressive search tools and comparison rendering; existing action contracts retained. |
| `web/inspector.js`, `app.js` | Inspector controls, comparison retention, predictable focus and safe synchronization with saves without replacing an open feedback form. |
| `test/browser-workstation.mjs`, `web/tests/photo-desk-layout.test.js` | Reproducible isolated visual review and interaction checks, selection order, stale editing and honest rights labels. |
| `test/browser-workspace.mjs`, `test/browser-editorial-ux.mjs` | Target explicit record identities after the layout change and current Discover controls rather than retired UI. |
| `package.json`, `web/README.md`, this document | Safe fixture launch, validation commands, component ownership and review evidence. |

## Executed validation

- `npm run check`: JavaScript syntax checks pass.
- `npm test`: 484 tests pass, zero failures.
- `npm run test:browser`: 40 isolated workflow groups pass, including preview-failure recovery, selection/order, drafts, revision conflicts, evidence, feedback and approval boundaries.
- `npm run test:ux`: 8 checks pass, including navigation aliases, saved caption persistence, retained publication leads and no unintended dispatch.
- `npm run test:hosted`: 11 **isolated HTTPS fixture** checks pass, including sign-in, private access, backup, cold restart, saved captions and feedback. This is not the live Render service.
- `npm run test:workstation`: nine screens fit 1440, 1280, 1024, 768, 390 and 320 pixels with no page overflow. Nine interaction groups pass: keyboard selection, refresh retention, explicit removal/order, inspector navigation/focus, three-image comparison, caption autosave, unsaved feedback/context confirmation and source-failure recovery. No browser JavaScript errors, paid calls or production writes.
- Manual rendered-image review found and corrected a narrow writing-column overflow, invalid nested thumbnail controls, hidden failed-preview recovery and a delayed inspector context update. `git diff --check` passes.

## Actual rendered screenshots

The same isolated story and initial three-image order were used before and after. The baseline was captured **before edits** at `948f9d2`; the new screenshots render this PR's implementation in Chromium. The image frames are decoded, labelled generated fixtures. They establish UI appearance and interaction only.

Artifacts remain ignored under `.local/workstation/`; they are not private-data uploads or committed image assets:

- `before-photos-1440.png` / `after-photos-1440.png`
- `before-photos-390.png` / `after-photos-390.png`
- `before-inspector-1440.png` / `after-inspector-1440.png`
- `before-compare-1440.png` / `after-compare-1440.png`
- Today, Stories, Develop, Arrange, Review, Library, Discover and Production: `before-<screen>-<width>.png` / `after-<screen>-<width>.png` at 1440, 768 and 390.
- Reports/logs: `before-report.json`, `after-report.json`, `unit.log`, `browser-regression.log`, `ux/report.json`, `hosted-fixture.log`.

Screenshots have a visible fixture banner. External photographic hosts are unavailable under this session's network policy; no real source image was newly acquired or aesthetically inspected. This redesign does not resolve intelligent photographic discovery. No hosted visual acceptance, paid AI execution, live n8n change, policy installation, Buffer action, merge or deployment occurred.

## Local founder acceptance

1. On this branch, use Node 24 and install existing dependencies with `npm ci` if needed.
2. Run `npm run workspace:design-review`. Open the printed loopback URL. It serves disposable SQLite stores and generated test images, with no live API reads, paid operations or publishing.
3. In Photographs, choose a direction, inspect a full frame, select/remove it, compare two or three frames, and change the cover. Confirm the saved sequence is unchanged by a failed source search. Expand **Sources & search tools** to find imports, archives and history.
4. Open Arrange and use keyboard movement controls. Edit a caption in Develop, wait for its save and refresh. Review the retained sources, rights and approval requirements without granting clearance or publishing.
5. Repeat at desktop, tablet and mobile widths. Close the fixture with Ctrl+C; its disposable data is deleted. Run `npm run test:workstation` to regenerate the after screenshots and interaction report. Do not regenerate the preserved before screenshots against the changed UI.

Keep PR #1 in draft review; do not merge or deploy. Source acquisition, actual photographic pixel research and native paid operations are separate work described in [the Photo Intelligence plan](PHOTO_INTELLIGENCE_NEXT.md).
