import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HandoffError, requireThat } from './errors.js';

const ORIGIN = 'https://rickywelch.app.n8n.cloud';
export const workflowTargets = [
  { id: 'ecWr4PeKU4vKLQ1m', component: 'Founder Studio' },
  { id: 'Zouc5I3MQwRJhfXG', component: 'Media sourcing' },
  { id: 'YdW8V9Qxl2qn5mC8', component: 'Editorial production' },
  { id: 'SoTFBz46LCWVp5EO', component: 'Private clean export' },
  { id: 'BzMqQS8lfkwN7peQ', component: 'Buffer draft import' },
  { id: 'rgXDAUak4k46q9jG', component: 'Publishing preflight' },
  { id: '92oYJ5EcJnaY22QP', component: 'Analytics' },
  { id: 'f0LkxPxzvqh3zyUQ', component: 'Cloudinary staging' },
];

export function n8nReader(apiKey, fetchImpl = fetch) {
  requireThat(typeof apiKey === 'string' && apiKey.length > 0, 'CONNECTION_REQUIRED', 'Configure N8N_API_KEY securely in environment settings before running the read-only audit.');
  return async resource => {
    const url = auditReadUrl(resource);
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET', headers: { Accept: 'application/json', 'X-N8N-API-KEY': apiKey },
        redirect: 'error', signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new HandoffError('NETWORK_UNAVAILABLE', 'n8n could not be reached through the configured proxy. No remote changes were made.'); }
    requireThat(response.redirected !== true && (!response.url || response.url === url.href), 'AUDIT_REDIRECT_DENIED', 'n8n read redirected or returned a different resource. No redirect is permitted.');
    requireThat(response.ok, `N8N_HTTP_${response.status}`, `n8n read-only request returned HTTP ${response.status}. Response bodies and credentials are omitted.`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      requireThat(size <= 16 * 1024 * 1024, 'AUDIT_RESPONSE_TOO_LARGE', 'n8n response exceeded the 16 MiB audit limit.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HandoffError('INVALID_AUDIT_RESPONSE', 'n8n did not return valid JSON.'); }
  };
}

function auditReadUrl(resource) {
  const deny = () => { throw new HandoffError('INVALID_AUDIT_PATH', 'Only explicitly supported n8n read resources and query parameters are permitted.'); };
  if (typeof resource !== 'string' || resource.length > 4096 || /[\s\\#\u0000-\u001f\u007f]/u.test(resource)) deny();
  const question = resource.indexOf('?');
  const pathname = question < 0 ? resource : resource.slice(0, question);
  // Match BEFORE URL parsing: percent-encoded dot segments and backslashes must never
  // normalize an apparently safe API resource into a webhook or another route.
  if (!/^\/api\/v1\/(?:workflows(?:\/[A-Za-z0-9_-]{1,200})?|executions(?:\/[0-9]{1,30})?|data-tables(?:\/[A-Za-z0-9_-]{1,200}(?:\/rows)?)?)$/.test(pathname)) deny();
  const url = new URL(resource, ORIGIN);
  if (url.origin !== ORIGIN || url.pathname !== pathname || url.hash) deny();
  const catalog = /^\/api\/v1\/(?:workflows|executions|data-tables)$/.test(pathname) || pathname.endsWith('/rows');
  const executions = pathname === '/api/v1/executions';
  const executionDetail = /^\/api\/v1\/executions\/[0-9]+$/.test(pathname);
  const seen = new Set();
  for (const [name, value] of url.searchParams) {
    if (seen.has(name) || /[\u0000-\u001f\u007f]/u.test(value)) deny();
    seen.add(name);
    if (catalog && name === 'limit' && /^(?:[1-9][0-9]?|100)$/.test(value)) continue;
    if (catalog && name === 'cursor' && value.length > 0 && value.length <= 2048) continue;
    if ((executions || executionDetail) && name === 'includeData' && /^(?:true|false)$/.test(value)) continue;
    if (executions && name === 'workflowId' && /^[A-Za-z0-9_-]{1,200}$/.test(value)) continue;
    if (executions && name === 'status' && /^(?:new|running|success|error|canceled|crashed|waiting|unknown)$/.test(value)) continue;
    deny();
  }
  return url;
}

const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value) ? value : null;
const safeTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export async function auditN8n({ read, outputRoot = '.local/audits' } = {}) {
  requireThat(typeof read === 'function', 'CONNECTION_REQUIRED', 'A read-only n8n client is required.');
  await fs.mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const directory = await fs.mkdtemp(path.join(outputRoot, 'n8n-'));
  const report = { observedAt: new Date().toISOString(), complete: true, remoteChanges: 0, workflows: [] };
  for (const target of workflowTargets) {
    try {
      const workflow = await read(`/api/v1/workflows/${target.id}`);
      requireThat(workflow?.id === target.id, 'WORKFLOW_MISMATCH', 'n8n returned a different workflow ID.');
      // Workflows can contain embedded sensitive material. Keep raw snapshots private and ignored.
      await fs.writeFile(path.join(directory, `${target.id}.json`), `${JSON.stringify(workflow, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      const result = {
        ...target, active: typeof workflow.active === 'boolean' ? workflow.active : null,
        savedVersionId: safeId(workflow.versionId), activeVersionId: safeId(workflow.activeVersionId),
        updatedAt: safeTimestamp(workflow.updatedAt),
        recentExecutions: [],
      };
      report.workflows.push(result);
      const executions = await read(`/api/v1/executions?workflowId=${target.id}&limit=10&includeData=false`);
      requireThat(Array.isArray(executions?.data), 'EXECUTION_RESPONSE_UNKNOWN', 'Execution listing did not match the expected shape.');
      result.recentExecutions = executions.data.map(item => ({
        id: safeId(String(item.id)),
        status: ['new', 'running', 'success', 'error', 'canceled', 'crashed', 'waiting', 'unknown'].includes(item.status) ? item.status : 'unknown',
        startedAt: safeTimestamp(item.startedAt), stoppedAt: safeTimestamp(item.stoppedAt),
      }));
    } catch (error) {
      report.complete = false;
      report.workflows.push({ ...target, error: error instanceof HandoffError ? error.code : 'LOCAL_AUDIT_ERROR' });
      if (['N8N_HTTP_401', 'N8N_HTTP_403', 'NETWORK_UNAVAILABLE'].includes(error.code)) break;
    }
  }
  await fs.writeFile(path.join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { ...report, directory };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const report = await auditN8n({ read: n8nReader(process.env.N8N_API_KEY) });
    console.log(JSON.stringify(report, null, 2));
    if (!report.complete) process.exitCode = 1;
  })().catch(error => {
    console.error(error instanceof HandoffError ? `${error.code}: ${error.message}` : 'LOCAL_AUDIT_ERROR: Read-only audit did not complete.');
    process.exitCode = 1;
  });
}
