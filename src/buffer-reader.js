import { HandoffError, requireThat } from './errors.js';

// Deliberately fixed read operations. No generic GraphQL executor or mutation API is exposed.
const POST_FIELDS = 'id channelId status text dueAt sentAt externalLink assets { id source mimeType }';
export const BUFFER_READ_QUERIES = Object.freeze({
  account: 'query AuditAccount { account { id organizations { id name } } }',
  channels: 'query AuditChannels($org:OrganizationId!) { channels(input:{organizationId:$org}) { id name service isDisconnected isLocked timezone } }',
  post: `query AuditPost($id:PostId!) { post(input:{id:$id}) { ${POST_FIELDS} } }`,
  posts: `query AuditPosts($org:OrganizationId!,$channel:ChannelId!,$after:String) { posts(first:100,after:$after,input:{organizationId:$org,filter:{channelIds:[$channel]}}) { edges { node { ${POST_FIELDS} } } pageInfo { hasNextPage endCursor } } }`,
});

export class BufferReader {
  constructor({ token, fetchImpl = fetch }) {
    requireThat(typeof token === 'string' && token.length > 0, 'CONNECTION_REQUIRED', 'BUFFER_ACCESS_TOKEN is unavailable in this process.');
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async #read(operation, variables = {}) {
    let response;
    try {
      response = await this.fetchImpl('https://api.buffer.com', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ query: BUFFER_READ_QUERIES[operation], variables }),
      });
    } catch { throw new HandoffError('BUFFER_NETWORK_UNAVAILABLE', 'Buffer read failed before a usable response. No write was attempted.'); }
    requireThat(response.ok, 'BUFFER_HTTP_ERROR', `Buffer read returned HTTP ${response.status}; response body omitted.`);
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      requireThat(length <= 8 * 1024 * 1024, 'BUFFER_RESPONSE_TOO_LARGE', 'Buffer response exceeded 8 MiB.');
      chunks.push(chunk);
    }
    let result;
    try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HandoffError('BUFFER_INVALID_RESPONSE', 'Buffer response was not JSON.'); }
    requireThat(!result.errors?.length && result.data, 'BUFFER_QUERY_FAILED', 'Buffer query returned errors or no data; details omitted to protect credentials.');
    return result.data;
  }

  async account() {
    const data = await this.#read('account');
    requireThat(Array.isArray(data.account?.organizations), 'BUFFER_INVALID_RESPONSE', 'Buffer account response is incomplete.');
    return data.account;
  }

  async channels(organizationId) {
    const data = await this.#read('channels', { org: organizationId });
    requireThat(Array.isArray(data.channels), 'BUFFER_INVALID_RESPONSE', 'Buffer channels response is incomplete.');
    return data.channels;
  }

  async post(id) {
    const data = await this.#read('post', { id });
    requireThat(data.post?.id === id, 'BUFFER_INVALID_RESPONSE', 'Buffer returned a different or missing post.');
    return data.post;
  }

  async posts({ organizationId, channelId, maxPages = 100 }) {
    requireThat(Number.isInteger(maxPages) && maxPages > 0 && maxPages <= 100, 'INVALID_PAGE_LIMIT', 'Use a page limit from 1 to 100.');
    let after = null;
    const cursors = new Set();
    const ids = new Set();
    const posts = [];
    for (let page = 0; page < maxPages; page++) {
      const data = await this.#read('posts', { org: organizationId, channel: channelId, after });
      const result = data.posts;
      requireThat(Array.isArray(result?.edges) && typeof result.pageInfo?.hasNextPage === 'boolean', 'BUFFER_INVALID_RESPONSE', 'Buffer pagination evidence is incomplete.');
      for (const { node } of result.edges) {
        requireThat(node?.id && node.channelId === channelId && !ids.has(node.id), 'BUFFER_INCONSISTENT_PAGE', 'Buffer returned a duplicate, missing, or wrong-channel post. Audit is incomplete.');
        ids.add(node.id);
        posts.push(node);
      }
      if (!result.pageInfo.hasNextPage) return { complete: true, posts, pages: page + 1, observedAt: new Date().toISOString() };
      after = result.pageInfo.endCursor;
      requireThat(typeof after === 'string' && after.length > 0 && !cursors.has(after), 'BUFFER_PAGINATION_LOOP', 'Buffer pagination did not advance. Audit is incomplete.');
      cursors.add(after);
    }
    throw new HandoffError('BUFFER_PAGE_LIMIT', 'Buffer page limit reached; do not infer that no previous handoff exists.');
  }
}
