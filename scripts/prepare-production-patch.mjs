import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { prepareManualDraftPatch, prepareStudioFeedbackPatch } from '../src/n8n/patch-builder.js';

const [snapshotFile, privateDirectory] = process.argv.slice(2);
if (!snapshotFile || !privateDirectory) throw new Error('Usage: node scripts/prepare-production-patch.mjs /private/workflow-snapshot.json .local/patches');
const directory = path.resolve(privateDirectory);
const relative = path.relative(path.resolve('.local'), directory);
if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Generated live workflow patches must stay under ignored .local/.');
const snapshot = JSON.parse(await fs.readFile(snapshotFile, 'utf8'));
const patch = snapshot.id === 'ecWr4PeKU4vKLQ1m' ? prepareStudioFeedbackPatch(snapshot) : prepareManualDraftPatch(snapshot);
const nodes = patch.update?.nodes || [{ parameters: { jsCode: patch.jsCode } }];
for (const node of nodes) if (node.parameters.jsCode) new vm.Script(`(async function(){${node.parameters.jsCode}\n})`);
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
const filename = path.join(directory, `${snapshot.id}-${patch.expectedActiveVersionId}.json`);
await fs.writeFile(filename, JSON.stringify(patch, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ workflowId: patch.workflowId, expectedActiveVersionId: patch.expectedActiveVersionId, syntaxValidated: true, deployable: patch.deployable, blockers: patch.blockers, filename }, null, 2));
