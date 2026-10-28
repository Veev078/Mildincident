import fs from 'node:fs/promises';
import path from 'node:path';
import { TABLE_IDS, reviewRecords } from '../src/record-review.js';

const [n8nDirectory, bufferFile, outputFile] = process.argv.slice(2);
if (!n8nDirectory || !bufferFile || !outputFile) throw new Error('Usage: node scripts/review-production-snapshot.mjs .local/audits/production-RUN .local/audits/buffer-RUN/posts.json .local/review.json');
const records = {};
for (const [name, id] of Object.entries(TABLE_IDS)) {
  const raw = JSON.parse(await fs.readFile(path.join(n8nDirectory, `rows-${id}.json`), 'utf8'));
  records[name] = Array.isArray(raw) ? raw : raw.data;
  if (!Array.isArray(records[name])) throw new Error('Snapshot table is incomplete.');
}
const report = reviewRecords(records, JSON.parse(await fs.readFile(bufferFile, 'utf8')));
const relative = path.relative(path.resolve('.local'), path.resolve(outputFile));
if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Save reports under ignored .local/.');
await fs.writeFile(outputFile, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ checks: report.checks, halloween: report.halloween, unmappedBufferPosts: report.unmappedBufferPosts }, null, 2));
