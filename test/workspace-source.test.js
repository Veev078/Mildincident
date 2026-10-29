import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceSource } from '../src/workspace/data-source.js';
import { workspaceSnapshot } from './helpers/workspace-fixture.js';

test('read refreshes coalesce, persist atomically and failures preserve prior source observations', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-cache-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let calls = 0;
  let release;
  const snapshot = workspaceSnapshot();
  const source = new WorkspaceSource({ root, auditRoot: path.join(root, 'absent'), loadLive: async () => {
    calls++;
    await new Promise(resolve => { release = resolve; });
    return snapshot;
  } });
  await source.initialize();
  const first = source.refresh();
  const second = source.refresh();
  assert.equal(first, second);
  await Promise.resolve();
  release();
  await first;
  assert.equal(calls, 1);
  const restored = new WorkspaceSource({ root });
  await restored.initialize();
  assert.equal(restored.view().stories.length, 1);
  source.loadLive = async () => { throw new Error('synthetic sensitive provider detail'); };
  await assert.rejects(source.refresh(), { code: 'REFRESH_FAILED' });
  const old = source.view();
  assert.equal(old.stories.length, 1);
  assert.ok(!JSON.stringify(old).includes('synthetic sensitive provider detail'));
  assert.equal(source.view().source.warnings.length, old.source.warnings.length);
  assert.equal((await fs.stat(path.join(root, 'snapshot.json'))).mode & 0o777, 0o600);
});

test('synchronous source failures do not wedge future refresh attempts', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-cache-retry-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = new WorkspaceSource({ root, loadLive: () => { throw new Error('synthetic sync error'); } });
  await assert.rejects(source.refresh(), { code: 'REFRESH_FAILED' });
  assert.equal(source.inflight, null);
  source.loadLive = async () => workspaceSnapshot();
  await source.refresh();
  assert.equal(source.view().stories.length, 1);
});
