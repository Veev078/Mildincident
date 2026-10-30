# Private photographic research

Use the existing Studio **Discovery desk → Follow the photograph**. No new service or publishing queue is needed.

- Search saved n8n photographs by subject, photographer, series or source. Linked story context is searchable, but it does not prove who is depicted in an individual image.
- Follow a photographer, source, series or adjacent lead. Each submitted direction creates a new trail; earlier findings and decisions stay saved.
- **Research more** retrieves the next source page, including deeper saved-record matches. Sparse metadata and pages without usable previews do not automatically end a catalogue search. Successful pages are checkpointed and cached for 24 hours. A failure preserves prior findings; only an explicit resume tries that page again. Pages completed are not a count of network calls.
- **Next saved images** browses findings beyond the first 100. It does not trigger web research.
- **Inspect photograph**, **Mark for comparison** and **Compare marked frames** open larger previews. Unavailable previews remain unavailable; metadata cannot establish visual quality.
- **Keep / Maybe / Reject** records a reason for that specific photograph. Reconsidering it preserves earlier decisions. This feedback informs future local development-job context and does not blacklist a subject or update an active n8n worker.
- **Develop an editorial angle** prepares the existing creative brief with recorded source metadata, uncertainty and the latest frame-specific feedback. Edit and save it normally. This action makes no AI call and does not queue or execute a worker.

## When an archive cannot be reached

Open one of the catalogue searches in your own browser. Use **Save a source reference** for a promising original record. Only title and a public HTTPS source URL are required; preview, credit, photograph date and context are optional. Missing metadata and unknown rights are welcome. Metadata stays founder-supplied and unverified. The server fetches neither the page nor the image; an optional preview loads directly in the browser. References remain local research, not production assets or rights approvals.

Commons, LOC and Art Institute API adapters currently have fixture/schema tests. **This cloud environment blocked a LOC request at the outbound proxy (403); live coverage has not been verified.** LOC's general photographs endpoint is partial coverage, not all PPOC. No deprecated Met endpoint or imaginary archive integration is offered.

For a future reviewed network change, the implemented adapters use `commons.wikimedia.org`, `www.loc.gov` and `api.artic.edu`. Their normal preview hosts include `upload.wikimedia.org`, `tile.loc.gov` and `www.artic.edu`. Allowing these requires environment-owner authorization; this sprint did not change or publish network settings. Actual response schemas, source terms, pagination and image access still need read-only validation afterward. No API keys or paid provider calls are needed for these three adapters.

## Local state and recovery

Node **24.17+ and below 25**, `npm ci`, then `npm run workspace:local`; open `http://localhost:4174` **on the same computer**. This does not create a public cloud preview. Credentials are optional for private research. Existing native stories require a private cached snapshot or a read-only n8n/Buffer connection.

All trails, candidates, metadata observations and verdicts live in the existing ignored `.local/workspace/research.sqlite`. Uploaded-image fingerprints use the existing preview store. Nothing grants publication rights. Use `npm run workspace:backup` to make a verified private backup before moving machines; GitHub deliberately excludes this data and media. Restoring an older lost workspace requires its actual private backup; a newly created backup cannot recover absent revisions. See [local startup](LOCAL_START.md) and [private backup / restore](PRIVATE_BACKUP.md) for restoration precautions.
