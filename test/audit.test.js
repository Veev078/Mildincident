import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { auditN8n, n8nReader, workflowTargets } from '../src/audit.js';

test('n8n audit only issues authenticated GETs, disables redirects, and records active vs saved version separately', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-audit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const requests = [];
  const read = n8nReader('synthetic-test-key', async (url, options) => {
    requests.push({ url, options });
    if (url.pathname.includes('/executions')) return Response.json({ data: [{ id: '42', status: 'success', startedAt: '2026-10-28T12:00:00Z' }] });
    return Response.json({
      id: url.pathname.split('/').at(-1), active: true,
      versionId: 'saved-v2', activeVersionId: 'active-v1',
      nodes: [{ parameters: { privateFixture: 'sensitive-fixture-not-for-report' } }],
    });
  });
  const report = await auditN8n({ read, outputRoot: root });
  assert.equal(report.complete, true);
  assert.equal(report.remoteChanges, 0);
  assert.equal(report.workflows.length, workflowTargets.length);
  assert.equal(requests.length, workflowTargets.length * 2);
  assert.equal(report.workflows[0].savedVersionId, 'saved-v2');
  assert.equal(report.workflows[0].activeVersionId, 'active-v1');
  assert.equal(report.workflows[0].recentExecutions[0].status, 'success');
  for (const { url, options } of requests) {
    assert.equal(url.origin, 'https://rickywelch.app.n8n.cloud');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['X-N8N-API-KEY'], 'synthetic-test-key');
  }
  const summary = JSON.stringify(report);
  assert.ok(!summary.includes('synthetic-test-key'));
  assert.ok(!summary.includes('sensitive-fixture-not-for-report'));
  const snapshot = path.join(report.directory, `${workflowTargets[0].id}.json`);
  assert.equal((await fs.stat(snapshot)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(report.directory)).mode & 0o777, 0o700);
  assert.ok((await fs.readFile(snapshot, 'utf8')).includes('sensitive-fixture-not-for-report'));
});

test('n8n audit requires a secure binding and does not print remote error bodies', async t => {
  assert.throws(() => n8nReader(undefined), { code: 'CONNECTION_REQUIRED' });
  const read = n8nReader('synthetic-test-key', async () => new Response('sensitive remote error body', { status: 401 }));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-audit-fail-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const report = await auditN8n({ read, outputRoot: root });
  assert.equal(report.complete, false);
  assert.equal(report.workflows.length, 1);
  assert.equal(report.workflows[0].error, 'N8N_HTTP_401');
  assert.ok(!JSON.stringify(report).includes('sensitive remote error body'));
});
