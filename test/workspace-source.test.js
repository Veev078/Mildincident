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

test('n8n-only hosting caches real source records while disconnected Buffer observations remain explicitly unknown',async t=>{
 const {fetchWorkspaceSnapshot}=await import('../src/workspace/data-source.js'),{WORKSPACE_TABLES}=await import('../src/workspace/model.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-native-only-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const fixture=workspaceSnapshot(),byId=new Map(Object.entries(WORKSPACE_TABLES).map(([name,id])=>[id,fixture.records[name]]));
 const snapshot=await fetchWorkspaceSnapshot({read:async resource=>({data:byId.get(resource.split('/')[4])||[],nextCursor:null}),bufferReader:null});assert.equal(snapshot.records.stories.length,1);assert.equal(snapshot.buffer.complete,false);assert.equal(snapshot.buffer.observedAt,null);assert.equal(snapshot.coverage.buffer,'not_configured');assert.ok(snapshot.warnings.some(w=>w.includes('Provider status and performance are unknown')));const source=new WorkspaceSource({root,loadLive:async()=>snapshot});await source.refresh();const restarted=new WorkspaceSource({root});await restarted.initialize();assert.equal(restarted.view().stories.length,1);assert.equal(restarted.snapshot.buffer.complete,false);
});
