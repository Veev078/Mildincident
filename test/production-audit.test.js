import test from 'node:test';
import assert from 'node:assert/strict';
import { activeDependencies, readAllPages } from '../src/production-audit.js';

test('n8n catalog reads every page with encoded cursors and fails on loops or truncation', async () => {
  const calls = [];
  const rows = await readAllPages(async url => { calls.push(url); return calls.length === 1 ? { data: [1], nextCursor: 'a/b+c' } : { data: [2], nextCursor: null }; }, '/api/v1/workflows');
  assert.deepEqual(rows, [1, 2]);
  assert.match(calls[1], /cursor=a%2Fb%2Bc/);
  await assert.rejects(readAllPages(async () => ({ data: [], nextCursor: 'same' }), '/api/v1/workflows'), { code: 'N8N_PAGINATION_LOOP' });
  await assert.rejects(readAllPages(async () => ({ data: [], nextCursor: 'same' }), '/api/v1/workflows', 1), { code: 'N8N_PAGE_LIMIT' });
});

test('dependency map uses active graph rather than unpublished draft nodes', () => {
  const result = activeDependencies({ nodes: [{ parameters: { dataTableId: 'draft-table' } }], activeVersion: { nodes: [
    { parameters: { dataTableId: { value: 'production-table' } } }, { parameters: { workflowId: { value: 'child-workflow' } } },
  ] } });
  assert.deepEqual(result, { tables: ['production-table'], workflows: ['child-workflow'] });
});
