import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : /\.(js|mjs)$/.test(filename) ? [filename] : [];
  });
}

for (const filename of [...files('src'), ...files('test'), ...files('scripts')]) {
  const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('JavaScript syntax checks passed.');
