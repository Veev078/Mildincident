# Open MILDINCIDENT on your computer

Use Node **24.17 or newer within Node 24**. Open [the development branch on GitHub](https://github.com/Veev078/Mildincident/tree/development/photography-review-20261029), select **Code → Download ZIP**, unzip it, and open a terminal in the folder containing `package.json`. On Windows, right-click that folder and choose **Open in Terminal**. Run `node --version` to check Node first.

```sh
npm ci
npm run studio:open
```

In Windows PowerShell, use `npm.cmd` in place of `npm` if it blocks the npm PowerShell script; no execution-policy change is needed.

The launcher uses the verified `workspace:local` command, waits for the private Studio health check and opens your browser at **http://localhost:4174/**. Keep the terminal open. Ctrl+C stops it. On a computer without a desktop browser it prints the address instead; `npm run studio:open -- --no-open` skips browser opening. `npm run workspace:local` remains supported.

The address works on the computer running the command. It is not an externally accessible Codex cloud preview. No public hosting was deployed.

## See the existing work, without credentials

GitHub deliberately excludes private data. A fresh checkout can therefore be empty. To see the current native stories, recovered development history and saved editorial state, extract your **private workspace backup**, stop Studio, then run:

```sh
npm run workspace:restore -- "path/to/extracted/MILDINCIDENT-private-workspace"
npm run studio:open
```

Choose the folder containing `backup-manifest.json`. Restore verifies hashes and SQLite integrity before swapping folders, preserves the entire previous workspace under `.local/workspace-preserved-*`, and refuses potentially open/unrecovered SQLite journals. It does not delete unfinished work. Never extract a backup over an open workspace. [Backup/recovery details](PRIVATE_BACKUP.md).

Cached stories, local drafts, photographs already stored privately, research history and founder review work without n8n credentials. Uncached external previews may fail or require source access. No live source refresh, native sync or AI generation is implied by an offline backup. Missing old working revisions/media cannot be recovered from a backup that never contained them.

## The daily workflow

Home opens the founder review queue. **New proposals** contains actual newly observed native development results. **Existing stories** and **Recovered history** expose older material separately. No example stories are substituted.

**Develop** opens the existing editor. **Save / Pass / Explore / Find alternatives** save private preferences; a reason is optional. Research/alternatives actions prepare a brief, not a model run. **Sync research results** reads the configured native inbox without JSON transfer. In the cloud checkpoint that connection is explicitly read-only: queueing, dispatch and generation are disabled.

## Five-minute first review

1. On Home choose **Existing stories** to see the18cached native stories, or **Recovered history** for the2older native development results. An empty **New proposals** view is expected until an authorized new generation actually arrives.
2. Open a story’s **Images** tab. Inspect its source links and credits. If a preview fails, use the original source or save an authorized private preview file; missing images are not replaced with fake photographs.
3. Use **Carousel**, **Caption** and **Direction** to inspect/edit working material. “Saved locally” means a private revision, not an n8n/Buffer change. Reload to see the saved version.
4. Return Home to Save, Pass, Explore or Develop. Under optional context, distinguish a particular photograph from the subject. “Find alternatives” prepares a private brief; it does not run AI.
5. Keep backups with `npm run workspace:backup`. **Publishing** is inspection/preparation only; approval and rights remain separate.

Verified here: the actual server opens all8story tabs from a restored20-story cached workspace with API keys absent. Preview URLs still need source access. Windows-device acceptance and fresh live photographic discovery remain unverified.

## Optional live connections

Existing server-side bindings are `N8N_API_KEY` and `BUFFER_ACCESS_TOKEN`; never put values in source code or Git. Desktop environment variables are separate from the cloud environment. The private cached workspace works without them. Live native inbox sync additionally uses the verified private connection metadata under `.local/engine-build/`, which is excluded from Git and ordinary workspace backups. No dispatch token is needed for read-only mode.

All production writes, publishing and scheduling remain disabled. A new paid model/search call needs separate approval. Publication feeds are source metadata, not generated proposals; see [source access and cost status](DISCOVERY_SOURCE_STRATEGY.md). Do not use a cloud localhost address as a public website link or expose the unauthenticated private server publicly.
