import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixture } from './helpers/fixtures.js';

const exec = promisify(execFile);

test('documented private preflight and ledger commands work without creating a remote draft', async t => {
  const f = await fixture(t, { rights: 'pending' });
  const manifestFile = path.join(f.inputRoot, 'manifest.json');
  await fs.writeFile(manifestFile, JSON.stringify(f.manifest));
  const { stdout } = await exec(process.execPath, ['src/cli.js', 'prepare', manifestFile, f.privateRoot]);
  const result = JSON.parse(stdout);
  assert.equal(result.state, 'private_files_ready');
  assert.equal(result.slides, 2);
  assert.equal(result.remoteAction, 'none');
  assert.equal(result.rights[0].status, 'pending');
  assert.ok((await fs.readFile(path.join(result.directory, 'manifest.json'), 'utf8')).includes(f.manifest.storyId));
  const ledgerResult = await exec(process.execPath, ['src/cli.js', 'ledger', f.ledgerFile]);
  assert.deepEqual(JSON.parse(ledgerResult.stdout), []);
});
