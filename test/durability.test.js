import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixture, fakeAdapter, handoffOptions } from './helpers/fixtures.js';
import { preparePackage } from '../src/package.js';
import { prepareAndSend } from '../src/handoff.js';
import { scopeKey } from '../src/ledger.js';

const exec = promisify(execFile);

test('two independent processes contend for one durable story/channel intent', async t => {
  const f = await fixture(t);
  const prepared = await preparePackage(f.manifest, f);
  const args = ['test/helpers/claim.mjs', f.ledgerFile, JSON.stringify(prepared)];
  const results = await Promise.all([exec(process.execPath, args), exec(process.execPath, args)]);
  const outcomes = results.map(r => r.stdout.trim()).sort();
  assert.deepEqual(outcomes, ['RECONCILIATION_REQUIRED', 'claimed']);
  assert.equal(f.ledger.list().length, 1);
});

test('process death after possible remote create never causes an automatic second create', async t => {
  const f = await fixture(t);
  const remoteMarker = path.join(f.root, 'synthetic-remote-create');
  const settingsFile = path.join(f.root, 'crash-settings.json');
  await fs.writeFile(settingsFile, JSON.stringify({
    manifest: f.manifest, inputRoot: f.inputRoot, privateRoot: f.privateRoot,
    ledgerFile: f.ledgerFile, remoteMarker,
  }));
  await assert.rejects(exec(process.execPath, ['test/helpers/crash.mjs', settingsFile]), { code: 17 });
  assert.equal(await fs.readFile(remoteMarker, 'utf8'), 'one synthetic remote create');
  assert.equal(f.ledger.get(scopeKey(f.manifest)).state, 'sending');
  const adapter = fakeAdapter();
  await assert.rejects(prepareAndSend(handoffOptions(f, adapter)), { code: 'RECONCILIATION_REQUIRED' });
  assert.equal(adapter.creates, 0);
});
