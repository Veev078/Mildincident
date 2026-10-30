# Open MILDINCIDENT on your computer

Use Node **24.17 or newer within Node 24**. Download the current `development/photography-review-20261029` branch from GitHub, unzip it, and open a terminal in the folder containing `package.json`.

```sh
npm ci
npm run studio:open
```

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

## Optional live connections

Existing server-side bindings are `N8N_API_KEY` and `BUFFER_ACCESS_TOKEN`; never put values in source code or Git. Desktop environment variables are separate from the cloud environment. The private cached workspace works without them. Live native inbox sync additionally uses the verified private connection metadata under `.local/engine-build/`, which is excluded from Git and ordinary workspace backups. No dispatch token is needed for read-only mode.

All production writes, publishing and scheduling remain disabled. A new paid model/search call needs separate approval. Publication feeds are source metadata, not generated proposals; see [source access and cost status](DISCOVERY_SOURCE_STRATEGY.md). Do not use a cloud localhost address as a public website link or expose the unauthenticated private server publicly.
