# Discovery and creative research desk

Open **Discovery desk** in Studio. This uses the existing n8n research pipeline; it does not introduce a second model/search backend.

- **Prepare a discovery run** saves a durable local ticket for the current n8n editorial preset. It does not start a paid call. Open the linked existing n8n form, sign in with an n8n account allowed to execute the workflow, and submit there.
- **Save brief for n8n** retains an on-demand creative direction and optional source link in local SQLite. The handoff URL uses the existing form fields `request` and `url`. Verify prefilled values before submission; authenticated field-prefill behavior could not be exercised in this session. Direction text appears in URL/browser history; do not include secrets.
- Existing endpoint GET checks returned401 without an n8n session. The n8n API key is not a browser login cookie. Use the explicit sign-in link before opening the research form.
- After n8n finishes, **Refresh source** imports its actual persisted story/research records. Use **Link existing story** on the ticket to associate the result explicitly. Link history is retained; no timing/subject similarity is treated as proof of execution attribution.

New research candidates and already-developing stories have separate slates, at most five each. Ordering uses recorded source coverage, not image quality, subjective taste or audience performance. Each card exposes source/claim/preview counts and gaps. The current refreshed source has18 stories but no new-review-stage candidates, so the new slate is empty; no mock ideas were inserted.

Requests/events live in ignored `.local/workspace/research.sqlite`; include the whole `.local` directory in Windows backups. Source stories still live in n8n. Local request writes have Host/Origin/intent checks, immutable input records and optimistic-versioned append-only events. They cannot generate stories, change production records or publish.

Verified: local request validation, restart persistence, concurrent-event conflict, invalid story links, source slate caps, render escaping and HTTP intent checks. Chromium covers request creation/reload, fixed authenticated-form targeting, linking an existing source story and discovery preparation. Live research generation/submission was not performed: it requires the user's n8n browser session. Existing prompt has ordinary research-call/tool limits; drafting adds cost, exact prices are unavailable. No new schedule or paid execution was enabled.

This is a working research handoff/review experience, **not** unattended discovery or verified automatic project creation from the app. Remaining integration: an authenticated, bounded execution API and execution-to-story correlation before those stronger claims can be made.
