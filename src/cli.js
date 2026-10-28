import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DraftLedger } from './ledger.js';
import { preparePackage } from './package.js';

export async function main(args) {
  const [command, manifestFile, outputRoot] = args;
  if (command === 'prepare' && manifestFile) {
    const manifestPath = path.resolve(manifestFile);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    const prepared = await preparePackage(manifest, {
      inputRoot: path.dirname(manifestPath),
      privateRoot: path.resolve(outputRoot || '.local/exports'),
    });
    console.log(JSON.stringify({
      state: 'private_files_ready', storyId: prepared.storyId, packageVersion: prepared.packageVersion,
      slides: prepared.slides.length, fingerprint: prepared.fingerprint, directory: prepared.directory,
      rights: prepared.slides.map(slide => ({ assetId: slide.assetId, status: slide.rights.status })),
      remoteAction: 'none',
    }, null, 2));
    return;
  }
  if (command === 'ledger') {
    const ledger = new DraftLedger(path.resolve(manifestFile || '.local/draft-ledger.sqlite'));
    try { console.log(JSON.stringify(ledger.list(), null, 2)); } finally { ledger.close(); }
    return;
  }
  throw new Error('Usage: npm run preflight -- /private/manifest.json [private-output-directory]\n       npm run ledger -- [ledger-file]\nThere is no live send/publish command until the provider adapter has been audited.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    // Provider errors are not rendered here; this CLI has no network adapter.
    console.error(`${error.code || 'LOCAL_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  });
}
