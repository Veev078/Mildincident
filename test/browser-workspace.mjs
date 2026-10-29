import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
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
const source = new WorkspaceSource({ root, loadLive: async () => snapshot });
source.snapshot = snapshot;
const originalView = source.view.bind(source);
source.view = (...args) => { const model = originalView(...args); model.source.kind = 'test_fixture'; return model; };
const drafts = new LocalDraftStore(path.join(root, 'drafts.sqlite'));
const server = createWorkspaceServer({ source, drafts });
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

  await page.goto(`${origin}/#/story/${id}/music`);
  await page.getByRole('textbox', { name: 'Track', exact: true }).fill('Fixture track');
  await page.getByRole('textbox', { name: 'Artist', exact: true }).fill('Fixture artist');
  await page.getByRole('button', { name: 'Save local direction', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-save-status]')?.textContent.includes('Saved locally'));
  assert.equal(drafts.get(id).musicSelection.track, 'Fixture track');
  checks.push('manual soundtrack direction saves locally without availability claims');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('.story-header-actions a').click();
  const download = await downloadEvent;
  const downloaded = path.join(root, 'proposal.json');
  await download.saveAs(downloaded);
  const proposal = JSON.parse(await fs.readFile(downloaded, 'utf8'));
  assert.equal(proposal.productionApplied, false);
  assert.equal(proposal.changes.caption, caption);
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

  for (const width of [1440, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'pipeline', 'library', `story/${id}/carousel`, `story/${id}/caption`, 'publishing', 'archive', 'analytics']) {
      await page.goto(`${origin}/#/${route}`);
      await page.locator('h1').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Unexpected horizontal overflow at ${width}px on ${route}`);
    }
  }
  checks.push('eight views fit desktop, tablet, 390px and 375px without page overflow');
  await page.goto(`${origin}/#/home`);
  await page.screenshot({ path: path.join(artifactRoot, 'fixture-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/#/story/${id}/carousel`);
  await page.screenshot({ path: path.join(artifactRoot, 'fixture-carousel-desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = { passed: true, checks, fixtureOnly: true, productionWrites: 0, browserErrors: errors };
  await fs.writeFile(path.join(artifactRoot, 'report.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  drafts.close();
  await fs.rm(root, { recursive: true, force: true });
}
