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

test('n8n reader permits only the exact inventory, execution-detail and paginated row GET routes', async () => {
  const calls = [];
  const read = n8nReader('synthetic-test-key', async (url, options) => {
    calls.push({ url, options });
    return Response.json({ data: [] });
  });
  const resources = [
    '/api/v1/workflows?limit=100&cursor=a%2Fb%2Bc',
    '/api/v1/workflows/existing_workflow-1',
    '/api/v1/executions?workflowId=existing&limit=10&includeData=false',
    '/api/v1/executions?status=error&limit=100&cursor=next',
    '/api/v1/executions/2242?includeData=true',
    '/api/v1/data-tables?limit=100',
    '/api/v1/data-tables/table_1',
    '/api/v1/data-tables/table_1/rows?limit=100&cursor=next',
  ];
  for (const resource of resources) await read(resource);
  assert.equal(calls.length, resources.length);
  assert.ok(calls.every(call => call.options.method === 'GET' && call.url.origin === 'https://rickywelch.app.n8n.cloud'));
});

test('encoded traversal, webhook/execution actions, ambiguous parameters and arbitrary routes are rejected before auth is sent', async () => {
  let calls = 0;
  const read = n8nReader('synthetic-test-key', async () => { calls++; return Response.json({}); });
  const resources = [
    '/api/v1/workflows/%2e%2e/%2e%2e/webhook/send',
    '/api/v1/workflows/%252e%252e/webhook/send',
    '/api/v1/workflows/../../webhook/send',
    '/api/v1/workflows\\..\\..\\webhook\\send',
    '//example.org/api/v1/workflows',
    'https://example.org/api/v1/workflows',
    '/api/v1/webhook/send',
    '/api/v1/workflows/id/activate',
    '/api/v1/executions/42/retry',
    '/api/v1/credentials',
    '/api/v1/workflows?id=any',
    '/api/v1/workflows?limit=100&limit=1',
    '/api/v1/workflows?limit=1000',
    '/api/v1/workflows?cursor=next%00secret',
    '/api/v1/workflows#ignored-fragment',
    '/api/v1/workflows?token=must-not-log',
    '/api/v1/workflows/id?includeData=true',
    null, {},
  ];
  for (const resource of resources) {
    await assert.rejects(read(resource), error => error.code === 'INVALID_AUDIT_PATH' && !error.message.includes('must-not-log'));
  }
  assert.equal(calls, 0);
});

test('redirect/final-resource mismatches cannot be accepted even if an injected transport ignores redirect:error', async () => {
  for (const properties of [
    { redirected: true },
    { url: 'https://example.org/elsewhere' },
    { url: 'https://rickywelch.app.n8n.cloud/webhook/elsewhere' },
  ]) {
    const read = n8nReader('synthetic-test-key', async () => {
      const response = Response.json({ data: [] });
      for (const [key, value] of Object.entries(properties)) Object.defineProperty(response, key, { value });
      return response;
    });
    await assert.rejects(read('/api/v1/workflows'), { code: 'AUDIT_REDIRECT_DENIED' });
  }
});
