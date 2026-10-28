import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { halloweenStories, snapshotDate, studioUrl } from './launch-brief.js';

const styles = new URL('../public/studio.css', import.meta.url);
export const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function renderStudio() {
  const cards = halloweenStories.map((story, i) => `<article class="story">
    <div class="date"><span>${escapeHtml(story.date)}</span><small>0${i + 1} / 04</small></div>
    <div class="story-body"><p class="eyebrow">${escapeHtml(story.context)}</p>
    <h2>${escapeHtml(story.title)}</h2>
    <p class="stage">${escapeHtml(story.snapshot)}</p>
    <p>${escapeHtml(story.next)}</p>
    <a href="${escapeHtml(story.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(story.sourceLabel)} ↗</a>
    <details><summary>Existing story reference</summary><p>${escapeHtml(story.storyId)} · package v${story.packageVersion}</p>${story.bufferDraftId ? `<p>Draft reference: ${escapeHtml(story.bufferDraftId)}</p>` : ''}</details>
    </div>
  </article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MILDINCIDENT — Halloween launch brief</title><link rel="stylesheet" href="/studio.css"></head>
  <body><header><a class="masthead" href="/">MILDINCIDENT<span>Independent archival publication</span></a><a class="studio-link" href="${studioUrl}" target="_blank" rel="noopener noreferrer">Open Founder Studio ↗</a></header>
  <main><section class="intro"><p class="eyebrow">Editorial desk · October 28–31, 2026 · New York</p><h1>Four nights.<br><em>Stranger histories.</em></h1><p class="deck">The Halloween launch brief. Continue the existing stories, with every photograph, caption, and final decision in view.</p></section>
  <aside class="connection"><strong>Historical brief · ${snapshotDate}</strong><p>Live n8n, Buffer, and Instagram status has not been verified in this session. Story references below come from the handoff. Source links support research; image permissions still require review.</p></aside>
  <section aria-labelledby="launch"><div class="section-title"><h2 id="launch">The Halloween sequence</h2><span>Four existing stories · no scheduled times</span></div>${cards}</section>
  <section class="review" aria-labelledby="review"><p class="eyebrow">Before another handoff</p><h2 id="review">Resolve the Tippi send history.</h2><p>The handoff reports three Tippi items and an internal test marked “sent” in Buffer. That does not establish what appeared on Instagram. Compare the actual posts and provider history before creating more drafts. Preserve everything during the review.</p></section>
  <section aria-labelledby="steps"><div class="section-title"><h2 id="steps">From edit to publication</h2></div><ol class="steps"><li><strong>Review the story</strong><span>Current caption, dossier, selected images, and package version.</span></li><li><strong>Prepare private files</strong><span>Ordered 1080 × 1350 JPGs and verified checksums.</span></li><li><strong>Review each image’s rights</strong><span>Keep source, creator, evidence, and the human decision together.</span></li><li><strong>Confirm one Buffer draft</strong><span>Connection required. No live send action is enabled here.</span></li><li><strong>Schedule after approval</strong><span>A separate decision. Verify the eventual Instagram post.</span></li></ol></section>
  </main><footer>MILDINCIDENT · Private editorial preparation · No scheduling or publication actions</footer></body></html>`;
}

export function createStudioServer() {
  return http.createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const pathname = request.url?.split('?')[0];
    if (pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : renderStudio());
      return;
    }
    if (pathname === '/studio.css') {
      try {
        const css = await fs.readFile(styles);
        response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : css);
      } catch { response.writeHead(500).end('Styles unavailable'); }
      return;
    }
    response.writeHead(404).end('Not found');
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const server = createStudioServer();
  server.on('error', error => { console.error(`Studio failed: ${error.code || 'STARTUP_ERROR'}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Read-only launch brief listening on loopback port ${port}. Live connections remain unavailable.`));
}
