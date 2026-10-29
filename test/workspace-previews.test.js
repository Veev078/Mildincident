import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { LocalPreviewStore, attachLocalPreviews } from '../src/workspace/previews.js';
import { buildWorkspace } from '../src/workspace/model.js';
import { workspaceSnapshot } from './helpers/workspace-fixture.js';
import { createWorkspaceServer } from '../src/workspace/server.js';
import { LocalDraftStore } from '../src/workspace/store.js';
import { WorkspaceSource } from '../src/workspace/data-source.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-preview-'));
  const store = new LocalPreviewStore(root);
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  const bytes = await sharp({ create: { width: 1800, height: 2400, channels: 3, background: '#747e6b' } }).withMetadata().jpeg().toBuffer();
  return { root, store, bytes, input: { storyId: 'CON-EXISTING-01', assetId: 'asset-1', bytes,
    contentType: 'image/jpeg', originalName: '../../private-original.jpg', declaration: 'private_review_only' } };
}

test('private uploaded preview decodes, strips metadata, retains originals and never grants rights/source identity', async t => {
  const { root, store, input, bytes } = await fixture(t);
  const preview = await store.save(input);
  assert.equal(preview.originalName, 'private-original.jpg');
  assert.equal(preview.rightsGranted, false);
  assert.equal(preview.identityVerified, false);
  assert.equal(preview.localOnly, true);
  assert.equal(preview.originalWidth, 1800);
  const output = await store.readPreview(input.storyId, input.assetId, preview.sha256);
  const meta = await sharp(output.bytes).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(meta.width <= 1600 && meta.height <= 2000);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.icc, undefined);
  assert.deepEqual(await fs.readFile(path.join(root, 'blobs', `${preview.originalSha256}.original`)), bytes);
  assert.equal((await fs.stat(path.join(root, 'blobs', `${preview.originalSha256}.original`))).mode & 0o777, 0o600);
  assert.deepEqual(await store.save(input), preview);
  const reopened = new LocalPreviewStore(root);
  try { assert.deepEqual(reopened.get(input.storyId, input.assetId), preview); } finally { reopened.close(); }
});

test('preview upload rejects missing declaration, fake JPGs, MIME mismatches, SVG and bad filename controls', async t => {
  const { store, input } = await fixture(t);
  await assert.rejects(store.save({ ...input, declaration: '' }), { code: 'PREVIEW_DECLARATION_REQUIRED' });
  await assert.rejects(store.save({ ...input, bytes: Buffer.from('not an image') }), { code: 'INVALID_PREVIEW_FILE' });
  await assert.rejects(store.save({ ...input, contentType: 'image/png' }), { code: 'INVALID_PREVIEW_TYPE' });
  await assert.rejects(store.save({ ...input, contentType: 'image/svg+xml', bytes: Buffer.from('<svg/>') }), { code: 'INVALID_PREVIEW_TYPE' });
  await assert.rejects(store.save({ ...input, originalName: 'bad\nname.jpg' }), { code: 'INVALID_PREVIEW_NAME' });
  assert.equal(store.all().size, 0);
});

test('preview overlay keeps existing source revision, source URL and rights state untouched', async t => {
  const { store, input } = await fixture(t);
  await store.save(input);
  const source = buildWorkspace(workspaceSnapshot());
  const revision = source.stories[0].revision;
  const originalUrl = source.stories[0].media[0].previewUrl;
  attachLocalPreviews(source, store);
  const asset = source.stories[0].media[0];
  assert.equal(source.stories[0].revision, revision);
  assert.equal(asset.sourcePreviewUrl, originalUrl);
  assert.equal(asset.rightsStatus, 'preview_unreviewed');
  assert.equal(asset.previewOrigin, 'local_upload');
  assert.match(asset.previewUrl, /^\/api\/stories\//);
  attachLocalPreviews(source, store);
  assert.equal(asset.sourcePreviewUrl, originalUrl);
  await assert.rejects(store.readPreview('CON-OTHER', input.assetId, asset.localPreview.sha256), { code: 'PREVIEW_NOT_FOUND' });
});

test('tampered cached preview bytes are detected rather than silently served/replaced', async t => {
  const { root, store, input } = await fixture(t);
  const preview = await store.save(input);
  await fs.appendFile(path.join(root, 'blobs', `${preview.sha256}.jpg`), 'tampered');
  await assert.rejects(store.readPreview(input.storyId, input.assetId, preview.sha256), { code: 'LOCAL_PREVIEW_CORRUPTED' });
  await assert.rejects(store.save(input), { code: 'LOCAL_PREVIEW_CORRUPTED' });
});

test('HTTP preview upload requires existing scoped asset, intent and declaration; derivative stays private and proposals remain unapproved', async t => {
  const { root, store, input } = await fixture(t);
  const drafts = new LocalDraftStore(path.join(root, 'drafts.sqlite'));
  const source = new WorkspaceSource({ root, loadLive: async () => workspaceSnapshot() });
  source.snapshot = workspaceSnapshot();
  const server = createWorkspaceServer({ source, drafts, previews: store });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); drafts.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/api/stories/${input.storyId}/assets/${input.assetId}/preview`;
  const headers = { 'Content-Type': 'image/jpeg', 'X-Mildincident-Intent': 'local-edit', 'X-Mildincident-Filename': encodeURIComponent('synthetic-test.jpg') };
  assert.equal((await fetch(url, { method: 'POST', headers, body: input.bytes })).status, 400);
  headers['X-Mildincident-Preview-Declaration'] = 'private_review_only';
  assert.equal((await fetch(url.replace('/asset-1/', '/unknown/'), { method: 'POST', headers, body: input.bytes })).status, 404);
  const before = await (await fetch(`${origin}/api/workspace`)).json();
  const response = await fetch(url, { method: 'POST', headers, body: input.bytes });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.productionApplied, false);
  const after = await (await fetch(`${origin}/api/workspace`)).json();
  assert.equal(before.stories[0].revision, after.stories[0].revision);
  const image = await fetch(`${origin}${after.stories[0].media[0].previewUrl}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/jpeg/);
  assert.match(image.headers.get('cache-control'), /private/);
  assert.equal(image.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal((await fetch(url + '?hash=../../private')).status, 400);
  assert.equal((await fetch(`${origin}/.local/previews.sqlite`)).status, 404);
});
