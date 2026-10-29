import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkspaceSource } from './data-source.js';
import { LocalDraftStore } from './store.js';
import { HandoffError, requireThat } from '../errors.js';

const WEB_ROOT = fileURLToPath(new URL('../../web/', import.meta.url));
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  requireThat(String(request.headers['content-type'] || '').split(';')[0] === 'application/json', 'JSON_REQUIRED', 'Use application/json for local edits.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    requireThat(size <= 128 * 1024, 'BODY_TOO_LARGE', 'Local edit exceeds 128 KiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HandoffError('INVALID_JSON', 'Request body is not valid JSON.'); }
}

export function createWorkspaceServer({ source, drafts, webRoot = WEB_ROOT }) {
  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'");
    try {
      // A loopback listener plus Host/Origin checks protects local draft APIs from DNS rebinding/CSRF.
      const expectedHost = `127.0.0.1:${request.socket.localPort}`;
      requireThat(request.headers.host === expectedHost || request.headers.host === `localhost:${request.socket.localPort}`, 'INVALID_HOST', 'This workspace accepts only its local origin.');
      const origin = `http://${request.headers.host}`;
      if (request.headers.origin) requireThat(request.headers.origin === origin, 'INVALID_ORIGIN', 'Cross-origin access is not permitted.');
      const url = new URL(request.url, origin);
      if (['POST', 'PATCH'].includes(request.method)) {
        requireThat(request.headers['x-mildincident-intent'] === 'local-edit', 'INTENT_REQUIRED', 'An explicit local-edit intent is required.');
      }
      if (url.pathname === '/api/health' && request.method === 'GET') {
        json(response, 200, { status: 'ok', mode: 'local_editorial_workspace', productionMutationsEnabled: false, sourceAvailable: Boolean(source.snapshot), refreshing: Boolean(source.inflight) }); return;
      }
      if (url.pathname === '/api/workspace' && request.method === 'GET') { json(response, 200, source.view(drafts.all())); return; }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        source.refresh().catch(() => {}); // Failure is exposed by next workspace read, never logged with secrets.
        json(response, 202, { refreshing: true, productionChanges: 0 }); return;
      }
      const match = url.pathname.match(/^\/api\/stories\/(CON-[A-Za-z0-9_-]{1,120})(?:\/(draft|proposal|draft\/history|draft\/rebase))?$/);
      if (match) {
        const [, id, operation] = match;
        const story = source.view(drafts.all()).stories.find(s => s.id === id);
        requireThat(story, 'STORY_NOT_FOUND', 'Existing story was not found in the source snapshot.');
        if (!operation && request.method === 'GET') { json(response, 200, story); return; }
        if (operation === 'draft' && request.method === 'PATCH') {
          const input = await body(request);
          const current = source.view(drafts.all()).stories.find(s => s.id === id);
          requireThat(current, 'STORY_NOT_FOUND', 'Story was removed from the source snapshot.');
          const draft = drafts.save(current, input);
          const updated = source.view(drafts.all()).stories.find(s => s.id === id);
          json(response, 200, { draft: { ...draft, stale: false }, intelligence: updated.intelligence, musicRecommendations: updated.musicRecommendations, editorialDirection: updated.editorialDirection, scope: 'local_only', productionApplied: false }); return;
        }
        if (operation === 'draft/history' && request.method === 'GET') { json(response, 200, { versions: drafts.history(id), scope: 'local_only' }); return; }
        if (operation === 'draft/rebase' && request.method === 'POST') {
          const input = await body(request);
          const current = source.view(drafts.all()).stories.find(s => s.id === id);
          requireThat(current, 'STORY_NOT_FOUND', 'Story was removed from the source snapshot.');
          const draft = drafts.rebase(current, input);
          const updated = source.view(drafts.all()).stories.find(s => s.id === id);
          json(response, 200, { draft: { ...draft, stale: false }, intelligence: updated.intelligence, musicRecommendations: updated.musicRecommendations, editorialDirection: updated.editorialDirection, scope: 'local_only', productionApplied: false }); return;
        }
        if (operation === 'proposal' && request.method === 'GET') {
          response.setHeader('Content-Disposition', `attachment; filename="${id}-local-proposal.json"`);
          json(response, 200, drafts.proposal(story)); return;
        }
      }
      if (url.pathname.startsWith('/api/')) { json(response, 404, { error: { code: 'API_NOT_FOUND', message: 'This action is not implemented. No production changes were made.' } }); return; }
      if (!['GET', 'HEAD'].includes(request.method)) { json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported operation.' } }); return; }
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      requireThat(!pathname.includes('..') && !pathname.includes('\\') && !pathname.includes('\0'), 'INVALID_PATH', 'Invalid static path.');
      const filename = path.join(webRoot, pathname);
      const ext = path.extname(filename);
      requireThat(Object.hasOwn(CONTENT_TYPES, ext), 'FILE_NOT_FOUND', 'Static file not found.');
      let data;
      try {
        const root = await fs.realpath(webRoot);
        const actual = await fs.realpath(filename);
        const relative = path.relative(root, actual);
        requireThat(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'FILE_NOT_FOUND', 'Static file not found.');
        data = await fs.readFile(actual);
      } catch { throw new HandoffError('FILE_NOT_FOUND', 'Static file not found.'); }
      response.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const code = error instanceof HandoffError ? error.code : 'LOCAL_ERROR';
      const message = error instanceof HandoffError ? error.message : 'The local operation did not complete. No production changes were made.';
      const status = ['INVALID_HOST', 'INVALID_ORIGIN', 'INTENT_REQUIRED'].includes(code) ? 403 :
        ['STALE_SOURCE', 'STALE_LOCAL_DRAFT', 'EDIT_CONFLICT'].includes(code) ? 409 :
          ['STORY_NOT_FOUND', 'DRAFT_NOT_FOUND', 'FILE_NOT_FOUND'].includes(code) ? 404 : code === 'SOURCE_UNAVAILABLE' ? 503 : 400;
      if (!response.headersSent) json(response, status, { error: { code, message } });
      else response.end();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = new WorkspaceSource();
  await source.initialize();
  const drafts = new LocalDraftStore('.local/workspace/drafts.sqlite');
  const server = createWorkspaceServer({ source, drafts });
  const port = Number(process.env.PORT || 4174);
  requireThat(Number.isSafeInteger(port) && port > 0 && port <= 65535, 'INVALID_PORT', 'PORT must be from 1 to 65535.');
  server.on('error', error => { console.error(`Workspace startup failed: ${error.code || 'LOCAL_ERROR'}`); process.exitCode = 1; drafts.close(); });
  server.listen(port, '127.0.0.1', () => console.log(`Editorial workspace listening on loopback port ${port}. Production writes are disabled.`));
  source.refresh().then(snapshot => console.log(`Read-only workspace refreshed: ${snapshot.records.stories.length} stories, ${snapshot.buffer.posts.length} Buffer records.`))
    .catch(error => console.error(`Read-only refresh unavailable: ${error.code}; existing cache preserved.`));
}
