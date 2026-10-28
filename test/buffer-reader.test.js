import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferReader } from '../src/buffer-reader.js';

test('Buffer reader authenticates only fixed queries, discovers channels, reads a post, and follows every page', async () => {
  const requests = [];
  const reader = new BufferReader({ token: 'synthetic-test-only', fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, options, body });
    if (body.query.includes('AuditAccount')) return Response.json({ data: { account: { id: 'a', organizations: [{ id: 'org' }] } } });
    if (body.query.includes('AuditChannels')) return Response.json({ data: { channels: [{ id: 'channel', name: 'mildincident', service: 'instagram' }] } });
    if (body.query.includes('AuditPost(')) return Response.json({ data: { post: { id: body.variables.id } } });
    const more = !body.variables.after;
    return Response.json({ data: { posts: { edges: [{ node: { id: more ? 'first' : 'second', channelId: 'channel', status: 'draft' } }], pageInfo: { hasNextPage: more, endCursor: more ? 'page-2' : null } } } });
  } });
  assert.equal((await reader.account()).organizations[0].id, 'org');
  assert.equal(JSON.stringify(reader), '{}'); // Accidental object logging cannot serialize the token.
  assert.equal((await reader.channels('org'))[0].id, 'channel');
  assert.equal((await reader.post('existing')).id, 'existing');
  const result = await reader.posts({ organizationId: 'org', channelId: 'channel' });
  assert.equal(result.complete, true);
  assert.deepEqual(result.posts.map(p => p.id), ['first', 'second']);
  assert.equal(result.pages, 2);
  for (const { url, options, body } of requests) {
    assert.equal(url, 'https://api.buffer.com');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-only');
    assert.match(body.query, /^query /);
    assert.doesNotMatch(body.query, /\bmutation\b/);
  }
});

test('Buffer reader fails closed on GraphQL errors without exposing provider messages', async () => {
  const reader = new BufferReader({ token: 'synthetic', fetchImpl: async () => Response.json({ data: {}, errors: [{ message: 'sensitive-provider-content' }] }) });
  await assert.rejects(reader.account(), error => error.code === 'BUFFER_QUERY_FAILED' && !error.message.includes('sensitive-provider-content'));
});

test('Buffer pagination rejects loops, incomplete evidence, wrong-channel rows and page exhaustion', async () => {
  const cases = [
    [{ edges: [], pageInfo: { hasNextPage: true, endCursor: 'same' } }, 'BUFFER_PAGINATION_LOOP', 3],
    [{ edges: [], pageInfo: {} }, 'BUFFER_INVALID_RESPONSE', 3],
    [{ edges: [{ node: { id: 'x', channelId: 'other' } }], pageInfo: { hasNextPage: false } }, 'BUFFER_INCONSISTENT_PAGE', 3],
    [{ edges: [], pageInfo: { hasNextPage: true, endCursor: 'next' } }, 'BUFFER_PAGE_LIMIT', 1],
  ];
  for (const [page, code, maxPages] of cases) {
    const reader = new BufferReader({ token: 'synthetic', fetchImpl: async () => Response.json({ data: { posts: page } }) });
    await assert.rejects(reader.posts({ organizationId: 'org', channelId: 'channel', maxPages }), { code });
  }
});
