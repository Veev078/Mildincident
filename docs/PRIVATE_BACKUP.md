# Private workspace backup

Run `npm run workspace:backup`. It creates a new checksum-verified directory under ignored `.local/backups/`, with private permissions. It includes workspace SQLite snapshots, cached source data, drafts, request/decision history, preview records and private media. SQLite WAL contents are captured through the backup API. No network request or production write occurs.

Verify a copy with `npm run workspace:backup -- --verify .local/backups/<backup-name>`.

Each database snapshot is consistent. The databases and cached source file are not one global transaction; stop the app before backup when a fully quiescent copy is needed. Immutable media are copied after database snapshots. Failed copies remain available for investigation and do not replace earlier backups.

For recovery, stop the app, verify the chosen backup, and rename the current `.local/workspace` to a preserved sibling directory. Copy the verified backup contents into a new `.local/workspace`, then restart using `npm run workspace:local`. Keep the previous directory until the recovered drafts, decisions and previews have been inspected. The manifest may remain beside the restored files. Do not copy old WAL/SHM files into the restored workspace.

This backs up private local state, not production n8n or Buffer. Environment credentials and `.local/engine-build/development-connection.json` are separate and are not included. Keep that existing private configuration separately if moving machines; never put it or these backups in GitHub. No automatic restore or overwriting command is provided.
