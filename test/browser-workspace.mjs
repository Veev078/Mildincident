import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { LocalPreviewStore } from '../src/workspace/previews.js';
import { chromium } from 'playwright';
import { createWorkspaceServer } from '../src/workspace/server.js';
import { WorkspaceSource } from '../src/workspace/data-source.js';
import { LocalDraftStore } from '../src/workspace/store.js';
import { workspaceSnapshot } from './helpers/workspace-fixture.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-browser-'));
const artifactRoot = path.resolve('.local/browser-tests');
await fs.mkdir(artifactRoot, { recursive: true, mode: 0o700 });
const snapshot = workspaceSnapshot();
snapshot.observedAt = new Date().toISOString();
snapshot.records.stories[0].title = 'Synthetic UI regression fixture — no editorial content';
snapshot.records.packages[0].founder_notes = 'Existing n8n notes from a synthetic test fixture';
const source = new WorkspaceSource({ root, loadLive: async () => snapshot });
source.snapshot = snapshot;
const originalView = source.view.bind(source);
source.view = (...args) => { const model = originalView(...args); model.source.kind = 'test_fixture'; return model; };
const drafts = new LocalDraftStore(path.join(root, 'drafts.sqlite'));
const previews = new LocalPreviewStore(path.join(root, 'previews'));
const server = createWorkspaceServer({ source, drafts, previews });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const checks = [];
const errors = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('https://example.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#e1dfd2"/><text x="70" y="600" font-size="64" fill="#42463b">SYNTHETIC UI TEST</text><text x="70" y="700" font-size="40" fill="#42463b">No archival photograph</text></svg>' }));
  await page.goto(origin);
  await page.locator('.stats-row').waitFor();
  assert.ok((await page.locator('.source-bar').textContent()).includes('Test fixture'));
  checks.push('frontend loads from actual local API with explicitly labeled test fixtures');

  for (const view of ['home', 'pipeline', 'library', 'publishing', 'archive', 'analytics']) {
    await page.goto(`${origin}/#/${view}`);
    await page.locator('h1').waitFor();
    assert.ok((await page.locator('h1').innerText()).length > 0);
  }
  checks.push('six product-wide views render without JavaScript errors');
  await page.goto(`${origin}/#/pipeline`);
  await page.getByRole('searchbox', { name: 'Find a story', exact: true }).fill('nothing-matches-this');
  await page.waitForFunction(() => document.querySelectorAll('.pipeline-row').length === 0);
  assert.ok((await page.locator('#main-content').textContent()).includes('No stories in this view'));
  await page.getByRole('searchbox', { name: 'Find a story', exact: true }).fill('');
  await page.waitForFunction(() => document.querySelectorAll('.pipeline-row').length === 1);
  checks.push('global search filters existing story rows and has an honest empty state');

  const id = snapshot.records.stories[0].concept_id;
  await page.goto(`${origin}/#/story/${id}/overview`);
  await page.getByRole('heading', { name: 'Existing n8n notes', exact: true }).waitFor();
  assert.ok((await page.locator('.existing-source-notes').textContent()).includes('synthetic test fixture'));
  checks.push('existing n8n editorial notes stay visible and separate from local edits');
  await page.goto(`${origin}/#/story/${id}/caption`);
  const caption = 'Locally edited through Chromium. Source and rights still need review.';
  await page.getByLabel('Local caption draft').fill(caption);
  await page.waitForFunction(() => document.querySelector('[data-save-status]')?.textContent.includes('Saved locally'));
  assert.equal(drafts.get(id).caption, caption);
  await page.reload();
  await page.getByLabel('Local caption draft').waitFor();
  assert.equal(await page.getByLabel('Local caption draft').inputValue(), caption);
  checks.push('caption autosave survives browser reload without modifying source');

  await page.goto(`${origin}/#/story/${id}/carousel`);
  await page.getByRole('button', { name: 'Move slide 1 later', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-save-status]')?.textContent.includes('Saved locally'));
  assert.deepEqual(drafts.get(id).selectedAssetIds, ['asset-2', 'asset-1']);
  checks.push('accessible carousel move controls persist ordered local sequence');
  await page.goto(`${origin}/#/story/${id}/images`);
  await page.locator('[data-action="compare-asset"]').nth(0).click();
  await page.locator('[data-action="compare-asset"]').nth(1).click();
  await page.getByRole('button', { name: 'Compare images →', exact: true }).click();
  assert.ok((await page.getByRole('dialog').textContent()).includes('Compare the evidence.'));
  await page.getByRole('button', { name: 'Close image comparison' }).click();
  checks.push('image comparison opens provenance-aware accessible dialog');
  await page.locator('[data-action="inspect"]').first().click();
  const upload = page.locator('[data-preview-upload]');
  const bytes = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#2451a4' } }).jpeg().toBuffer();
  await upload.getByLabel('Private preview file').setInputFiles({ name: 'synthetic-private.jpg', mimeType: 'image/jpeg', buffer: bytes });
  await upload.getByRole('checkbox').check();
  await upload.getByRole('button', { name: 'Save private preview' }).click();
  await page.getByRole('dialog').getByText(/Private local preview ·/).waitFor();
  await page.waitForFunction(() => { const img = document.querySelector('#asset-dialog img'); return img?.complete && img.naturalWidth === 900; });
  assert.equal(source.snapshot.records.media[0].rights_status, 'preview_unreviewed');
  await page.reload();
  await page.locator('[data-action="inspect"]').first().click();
  await page.getByRole('dialog').getByText(/Private local preview ·/).waitFor();
  await page.waitForFunction(() => { const img = document.querySelector('#asset-dialog img'); return img?.complete && img.naturalWidth === 900; });
  await page.getByRole('button', { name: 'Close image details' }).click();
  checks.push('private preview upload renders actual decoded bytes, persists on reload and preserves source rights');
  await page.route('https://example.org/thumb/**', route => route.abort());
  await page.reload();
  await page.locator('.preview-retry:visible').first().waitFor();
  await page.locator('.preview-retry:visible').first().click();
  await page.locator('.preview-retry:visible').first().waitFor();
  await page.unroute('https://example.org/thumb/**');
  checks.push('failed external previews expose an explicit retry without inferring global source failure');


  await page.goto(`${origin}/#/story/${id}/music`);
  await page.getByRole('textbox', { name: 'Track', exact: true }).fill('Fixture track');
  await page.getByRole('textbox', { name: 'Artist', exact: true }).fill('Fixture artist');
  await page.getByRole('button', { name: 'Save local direction', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-save-status]')?.textContent.includes('Saved locally'));
  assert.equal(drafts.get(id).musicSelection.track, 'Fixture track');
  checks.push('manual soundtrack direction saves locally without availability claims');

  await page.goto(`${origin}/#/story/${id}/direction`);
  await page.locator('#direction-angle').waitFor();
  assert.equal(await page.locator('#direction-angle').getAttribute('maxlength'), '700');
  await page.locator('#direction-hook-hidden_connection').check();
  await page.locator('#direction-angle').fill('Investigate the documented connection rather than inventing a surprising claim.');
  await page.locator('#direction-visual').fill('Compare the opening image and the evidence in their original context.');
  await page.locator('#direction-caption-approach').selectOption('lowercase');
  await page.locator('#direction-role-0').selectOption('question');
  await page.locator('#direction-role-note-0').fill('Check the first image with the original source.');
  await page.locator('[data-brief-lane="photographer_portfolios"]').check();
  await page.locator('[data-brief-lane="independent_magazines"]').check();
  await page.locator('#direction-rating-hook').selectOption('4');
  await page.locator('#direction-rating-visual').selectOption('4');
  await page.locator('#direction-rating-shareability').selectOption('5');
  assert.ok((await page.locator('[data-direction-review]').textContent()).includes('3'));
  await page.locator('#direction-rating-timelessness').selectOption('4');
  await page.waitForFunction(() => document.querySelector('[data-save-status]')?.textContent.includes('Saved locally'));
  assert.ok((await page.locator('[data-direction-review]').textContent()).includes('4.25'));
  assert.equal(drafts.get(id).creativeBrief.hookType, 'hidden_connection');
  assert.equal(drafts.get(id).creativeBrief.captionApproach, 'lowercase');
  assert.equal(drafts.get(id).caption, caption);
  assert.ok(drafts.get(id).creativeBrief.sourceLaneIds.includes('independent_magazines'));
  assert.equal(drafts.get(id).creativeBrief.sequenceRoles[0].role, 'question');
  assert.equal(await page.locator('.direction-source-grid a[href^="https://search.brave.com/"]').count(), 7);
  await page.reload(); await page.locator('#direction-angle').waitFor();
  assert.ok((await page.locator('#direction-angle').inputValue()).includes('documented connection'));
  checks.push('editorial direction autosaves hook/visual/roles/source lanes and manual ratings without rewriting source captions');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('.story-header-actions a').click();
  const download = await downloadEvent;
  const downloaded = path.join(root, 'proposal.json');
  await download.saveAs(downloaded);
  const proposal = JSON.parse(await fs.readFile(downloaded, 'utf8'));
  assert.equal(proposal.productionApplied, false);
  assert.equal(proposal.changes.caption, caption);
  assert.equal(proposal.changes.creativeBrief.hookType, 'hidden_connection');
  checks.push('downloadable review proposal contains actual edits and no production approval');

  snapshot.records.packages[0].caption_draft = 'A source edit made separately during the regression test';
  await page.reload();
  await page.getByRole('button', { name: 'Compare source and local draft →', exact: true }).click();
  assert.ok((await page.getByRole('dialog').textContent()).includes(caption));
  await page.getByRole('button', { name: 'Keep local edits after review', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  assert.ok(!drafts.proposal(originalView().stories[0]).stale);
  assert.ok(drafts.history(id).length >= 4);
  checks.push('stale source comparison and explicit local rebase preserve history');
  await page.getByRole('button', { name: 'Local version history', exact: true }).click();
  assert.ok((await page.getByRole('dialog').textContent()).includes('Local version history.'));
  await page.getByRole('button', { name: 'Close local version history' }).click();
  checks.push('saved local version history is inspectable');

  source.loadLive = () => { throw new Error('synthetic refresh failure'); };
  await page.getByRole('button', { name: 'Refresh source ↻', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('previous source snapshot is preserved'));
  assert.equal(drafts.get(id).caption, caption);
  assert.ok(await page.getByRole('button', { name: 'Refresh source ↻', exact: true }).isEnabled());
  source.loadLive = async () => snapshot;
  checks.push('failed read refresh reports failure, preserves edits/cache and remains retryable');

  await page.goto(`${origin}/#/home`);
  await page.keyboard.press('/');
  assert.equal(await page.locator('#global-search').evaluate(node => node === document.activeElement), true);
  await page.locator('#global-search').blur();
  await page.keyboard.press('g'); await page.keyboard.press('p');
  await page.waitForURL('**/#/pipeline');
  checks.push('keyboard shortcuts focus search and navigate without fake actions');

  const failurePage = await browser.newPage();
  failurePage.on('pageerror', error => errors.push(error.message));
  await failurePage.route('**/api/workspace', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_SOURCE_UNAVAILABLE', message: 'Synthetic read-only source outage' } }) }));
  await failurePage.goto(origin);
  await failurePage.getByRole('heading', { name: 'The desk could not be loaded.', exact: true }).waitFor();
  assert.equal(await failurePage.locator('.story-card').count(), 0);
  await failurePage.close();
  checks.push('source outage shows an actionable error without inventing sample stories');

  for (const width of [1440, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'pipeline', 'library', `story/${id}/carousel`, `story/${id}/caption`, `story/${id}/direction`, 'publishing', 'archive', 'analytics']) {
      await page.goto(`${origin}/#/${route}`);
      await page.locator('h1').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Unexpected horizontal overflow at ${width}px on ${route}`);
    }
  }
  checks.push('nine views fit desktop, tablet, 390px and 375px without page overflow');
  await page.goto(`${origin}/#/home`);
  await page.screenshot({ path: path.join(artifactRoot, 'fixture-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/#/story/${id}/carousel`);
  await page.screenshot({ path: path.join(artifactRoot, 'fixture-carousel-desktop.png'), fullPage: true });
  await page.goto(`${origin}/#/story/${id}/direction`);
  await page.screenshot({ path: path.join(artifactRoot, 'fixture-direction-desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = { passed: true, checks, fixtureOnly: true, productionWrites: 0, browserErrors: errors };
  await fs.writeFile(path.join(artifactRoot, 'report.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  drafts.close();
  previews.close();
  await fs.rm(root, { recursive: true, force: true });
}
