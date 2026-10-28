import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { n8nReader } from './audit.js';
import { HandoffError, requireThat } from './errors.js';

export async function readAllPages(read, route, maxPages = 100) {
  const rows = [];
  const cursors = new Set();
  let cursor = null;
  for (let page = 0; page < maxPages; page++) {
    const resource = `${route}${route.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const result = await read(resource);
    requireThat(Array.isArray(result?.data), 'N8N_INVALID_PAGE', 'Expected a data array from the read-only catalog.');
    rows.push(...result.data);
    if (!result.nextCursor) return rows;
    requireThat(typeof result.nextCursor === 'string' && !cursors.has(result.nextCursor), 'N8N_PAGINATION_LOOP', 'Pagination did not advance; audit is incomplete.');
    cursor = result.nextCursor;
    cursors.add(cursor);
  }
  throw new HandoffError('N8N_PAGE_LIMIT', 'Catalog page limit reached; audit is incomplete.');
}

export function activeDependencies(workflow) {
  const nodes = (workflow.activeVersion || workflow).nodes || [];
  const tables = new Set();
  const workflows = new Set();
  for (const node of nodes) {
    const table = node.parameters?.dataTableId;
    const child = node.parameters?.workflowId;
    if (table) tables.add(typeof table === 'string' ? table : table.value);
    if (child) workflows.add(typeof child === 'string' ? child : child.value);
  }
  return { tables: [...tables].filter(Boolean), workflows: [...workflows].filter(Boolean) };
}

export async function auditProduction({ read, outputRoot = '.local/audits' }) {
  await fs.mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const directory = await fs.mkdtemp(path.join(outputRoot, 'production-'));
  const save = async (name, data) => fs.writeFile(path.join(directory, name), JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 });
  const summary = { observedAt: new Date().toISOString(), complete: false, remoteChanges: 0, workflows: [], tables: [] };
  const workflows = await readAllPages(read, '/api/v1/workflows');
  for (const info of workflows) {
    requireThat(/^[a-zA-Z0-9_-]+$/.test(info.id), 'N8N_INVALID_ID', 'Workflow ID is invalid.');
    const workflow = await read(`/api/v1/workflows/${info.id}`);
    requireThat(workflow.id === info.id, 'N8N_INVALID_RESPONSE', 'Workflow snapshot ID differs.');
    await save(`workflow-${info.id}.json`, workflow);
    const executions = await read(`/api/v1/executions?workflowId=${info.id}&limit=10&includeData=false`);
    requireThat(Array.isArray(executions.data), 'N8N_INVALID_RESPONSE', 'Execution listing is incomplete.');
    await save(`executions-${info.id}.json`, executions);
    summary.workflows.push({ id: workflow.id, name: workflow.name, active: workflow.active,
      savedVersionId: workflow.versionId, activeVersionId: workflow.activeVersionId,
      draftDiffers: Boolean(workflow.activeVersionId && workflow.versionId !== workflow.activeVersionId),
      dependencies: activeDependencies(workflow), recentExecutionCount: executions.data.length,
      recentErrorCount: executions.data.filter(e => e.status === 'error' || e.status === 'crashed').length });
  }
  const tables = await readAllPages(read, '/api/v1/data-tables');
  await save('table-schemas.json', tables);
  for (const table of tables) {
    requireThat(/^[a-zA-Z0-9_-]+$/.test(table.id), 'N8N_INVALID_ID', 'Table ID is invalid.');
    const rows = await readAllPages(read, `/api/v1/data-tables/${table.id}/rows`);
    await save(`rows-${table.id}.json`, rows);
    summary.tables.push({ id: table.id, name: table.name, rowCount: rows.length, columns: (table.columns || []).map(c => c.name) });
  }
  const errors = await readAllPages(read, '/api/v1/executions?status=error&includeData=false');
  await save('errors.json', errors);
  summary.recordedErrorCount = errors.length;
  summary.complete = true;
  await save('report.json', summary);
  return { ...summary, directory };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => console.log(JSON.stringify(await auditProduction({ read: n8nReader(process.env.N8N_API_KEY) }), null, 2)))()
    .catch(error => { console.error(error instanceof HandoffError ? `${error.code}: ${error.message}` : 'PRODUCTION_AUDIT_FAILED: details omitted.'); process.exitCode = 1; });
}
