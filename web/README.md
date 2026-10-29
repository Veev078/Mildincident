# Editorial workspace frontend

Vanilla browser ES modules, reusable rendering helpers and views, no build step or external fonts. `app.js` manages routing, data access, local-save queues and interactions; `components.js` provides escaped reusable components; `views.js` contains the editorial screens; `styles.css` supplies the responsive design system.

## Working interactions

- Editorial home: existing story spotlight, preparation counts, next actions, recent source activity and handoff-review queue.
- Pipeline: global title/subject/ID search and stage filters; each row links to a concrete next story action.
- Story workspace: source dossier and claims, image candidates/provenance, ordered carousel, caption, working notes, music direction and publishing evidence under one source identity.
- Image library: candidate/creator/story search, rights filtering, source directory, provenance dialogs and side-by-side comparison of up to three actual previews.
- Carousel: accessible earlier/later controls, removal/addition and drag/drop ordering. Changes are saved only to a local proposal.
- Caption/notes: debounced local autosave, visible confirmation/error, retry, character count, internal-test marker check, retained source caption and a reusable research checklist.
- Existing founder, production and source-review notes from n8n remain visible read-only beside local working notes. They are never replaced by an empty local editor.
- Music: choose a supplied recommendation or record another local track/artist. No playback, audio analysis or Instagram availability is implied.
- Publishing/archive: mapped provider IDs, reported Instagram links, multiple-handoff warnings, distinct manual/provider/verified statuses, and local proposal download. No create, schedule, publish, delete or production-update action exists here.
- Publishing also exposes unmapped provider records so incomplete source-ledger associations cannot hide sent/test/duplicate candidates. It does not assign them to stories automatically.
- Analytics: supplied metrics with coverage/sample sizes, actual dated send history and bottleneck counts. Missing audience data is shown as unavailable.
- Refresh: requests a read-only source refresh and polls the local cache while preserving pending edits.
- Keyboard: `/` focuses story search; `G H`, `G P`, `G L`, `G B`, `G A` navigate; Ctrl/Cmd+S flushes the current story's local save. Shortcuts avoid typing fields. Dialogs use native modal focus/escape handling; route changes focus the main workspace.

## Data and persistence boundaries

The frontend requires `GET /api/workspace`. It does not substitute sample stories when unavailable. The header identifies a timestamped source snapshot, staleness, refresh state and warnings.

`PATCH /api/stories/:id/draft` sends `baseRevision`, `expectedVersion` and changed local fields with `X-Mildincident-Intent: local-edit`. A per-story save queue avoids submitting two versions concurrently from one browser. Version conflicts and save failures remain visible, with pending changes held in memory and an explicit retry. Refreshed intelligence/music context is retained without rerendering the active textarea or losing its caret. A pending-save unload prompt prevents silently losing unsaved work.

Stale drafts pause editing and offer side-by-side current-source/local comparison. The explicit keep-local action calls the rebase API with expected version and both source revisions; missing image references require a separate removal confirmation. Earlier versions remain in local history. A previously unsaved browser draft can only move to a new source revision after explicit comparison/confirmation. The history dialog shows saved captions/notes/sequences; using an earlier version creates a new local save rather than deleting history.

`POST /api/refresh` changes only the local read cache. The UI first flushes pending/in-flight saves and aborts a refresh on save failure. Incoming source snapshots preserve a pending draft's original base revision and mark it stale rather than silently rebasing it. `GET /api/stories/:id/proposal` downloads the existing source identity plus local edits for review; unavailable proposals are disabled with a hint until an edit exists. An unsaved browser proposal can be rescued as clearly labeled JSON. n8n stays authoritative; the UI repeatedly labels local saves as unsynced. It does not claim a proposal is an export-ready JPG package.

HTTPS image previews load directly in the browser with `referrerpolicy=no-referrer`, lazy loading and graceful unavailable-image states. All content is HTML-escaped; source links permit HTTPS only and use `noopener noreferrer`. No arbitrary server-side image downloader, external script, embedded secret or mock publishing success is introduced.

Responsive layouts cover wide screens through small mobile. Contrast, keyboard focus, skip navigation, accessible input labels, reduced motion and touch-size controls are included. Actual browser/API integration checks are performed by the root sprint against the local server.
