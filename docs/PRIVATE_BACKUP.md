# Private workspace backup

Run `npm run workspace:backup`. It creates a new checksum-verified directory under ignored `.local/backups/`, with private permissions. It includes workspace SQLite snapshots, cached source data, drafts, request/decision history, preview records and private media. SQLite WAL contents are captured through the backup API. No network request or production write occurs.

Verify a copy with `npm run workspace:backup -- --verify .local/backups/<backup-name>`.

Each database snapshot is consistent. The databases and cached source file are not one global transaction; stop the app before backup when a fully quiescent copy is needed. Immutable media are copied after database snapshots. Failed copies remain available for investigation and do not replace earlier backups.

This backs up private local state, not production n8n or Buffer. Environment credentials and `.local/engine-build/development-connection.json` are separate and are not included. Keep that existing private configuration separately if moving machines; never put it or these backups in GitHub. Backups can contain sensitive source references and must remain private.

## Verified restore command

Stop all Studio processes, extract a private backup to a separate folder, then run `npm run workspace:restore -- "path/to/backup-folder"`. The folder must contain `backup-manifest.json`. The command verifies the inventory/hashes, copies to private staging, checks SQLite integrity on disposable copies (avoiding WAL changes to verified bytes), and verifies staging again. Existing work is renamed to a preserved sibling directory before the verified copy takes its place. No old workspace is automatically deleted.

Possibly open/unrecovered WAL/SHM files block restore; a source backup inside the destination workspace is rejected. Each database is consistent, but the complete workspace is not a cross-database transaction. Backups of restored work exclude the old manifest so it cannot accidentally include/checksum itself. Keep private bundles and source data out of GitHub.
