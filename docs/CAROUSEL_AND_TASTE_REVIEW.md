# Carousel rehearsal and editorial image feedback

Open a story's Carousel tab → **Rehearse carousel**. Review one image at a time with Previous/Next or arrow/Home/End keys. Choose a4:5 containing frame or full-image proportions. Source attribution, recorded/derivative dimensions, caption, music and assigned narrative role stay available. These are display modes only; no crop, export, source image or slide order is changed.

In an image's provenance dialog, choose **Hold**, **Shortlist** or **Reject for this story** and record why. This is human taste feedback, not licensing or measured performance. Decisions persist in `.local/workspace/previews/previews.sqlite` with append-only history and expected-version conflict protection. An existing image's source rights/status/revision remain unchanged. Rejection does not silently remove a slide; selected rejected images have an explicit warning in the dialog and discovery-readiness gaps. Cards show the latest local decision.

No AI taste model or learned ranking was introduced. Feedback is now durable evidence that can inform later recommendations, with reasons and earlier reversals retained. Only the most recent50 review events are returned in a dialog; all remain in SQLite.

Validated:113 automated tests and22 fixture-based browser workflows; syntax passed. Ten pages fit desktop/tablet/390/375 widths. Rehearsal sequence immutability, controls, framing and stored image-review reload are tested. Actual18-story cached-source smoke opened Discovery, created a temporary brief, rehearsed a5-slide actual sequence and saved one temporary image review; no JS errors, production writes or actual user-draft edits. Private evidence: `.local/engine-build/actual-product-smoke.json` and screenshots. This is not evidence of successful CDN loads or actual n8n research execution.

Windows update steps remain in PHOTOGRAPHY_REVIEW.md: stop the app; back up/copy the entire `.local` and `.env.local` into the newly extracted branch; install dependencies; run `npm run workspace:local`. New private SQLite tables are created without deleting prior preview/draft data.

The image library and per-story image view now filter by human shortlist/reject/hold/not-reviewed decisions independently of rights clearance. Empty filtered views do not delete or hide the underlying source records permanently. The browser regression checks show saved rejection only, empty shortlist, then restoration of all source candidates. Rehearsal navigation counts available images, including when a stale selection references a removed asset.
