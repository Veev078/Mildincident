import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { preparePackage, sha256, validateManifest, verifyPrepared } from '../src/package.js';
import { fixture } from './helpers/fixtures.js';

test('prepares ordered real JPGs, strips metadata, keeps captions and pending rights, and repeats without overwriting', async t => {
  const f = await fixture(t, { rights: 'pending' });
  const prepared = await preparePackage(f.manifest, f);
  assert.equal(prepared.storyId, f.manifest.storyId);
  assert.equal(prepared.caption, f.manifest.caption);
  assert.deepEqual(prepared.slides.map(s => s.assetId), ['synthetic-1', 'synthetic-2']);
  assert.deepEqual(prepared.slides.map(s => s.file), ['01.jpg', '02.jpg']);
  for (const slide of prepared.slides) {
    const file = path.join(prepared.directory, slide.file);
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1350);
    assert.equal(meta.exif, undefined);
    assert.equal(meta.icc, undefined);
    assert.equal(slide.rights.status, 'pending');
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  }
  assert.equal((await fs.stat(prepared.directory)).mode & 0o777, 0o700);
  assert.deepEqual(await preparePackage(f.manifest, f), prepared);
  assert.deepEqual(await verifyPrepared(prepared.directory), prepared);
  assert.equal((await fs.readdir(f.privateRoot)).length, 1);
});

test('refuses a changed source file', async t => {
  const f = await fixture(t);
  await fs.appendFile(path.join(f.inputRoot, f.manifest.slides[0].file), 'changed');
  await assert.rejects(preparePackage(f.manifest, f), { code: 'SOURCE_CHANGED' });
  assert.deepEqual(await fs.readdir(f.privateRoot), []);
});

test('refuses a PNG renamed to JPG', async t => {
  const f = await fixture(t);
  const bytes = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: 'red' } }).png().toBuffer();
  await fs.writeFile(path.join(f.inputRoot, '1.jpg'), bytes);
  f.manifest.slides[0].sha256 = sha256(bytes);
  await assert.rejects(preparePackage(f.manifest, f), { code: 'NOT_JPEG' });
});

test('refuses wrong dimensions rather than silently cropping', async t => {
  const f = await fixture(t);
  const bytes = await sharp({ create: { width: 800, height: 800, channels: 3, background: 'red' } }).jpeg().toBuffer();
  await fs.writeFile(path.join(f.inputRoot, '1.jpg'), bytes);
  f.manifest.slides[0].sha256 = sha256(bytes);
  await assert.rejects(preparePackage(f.manifest, f), { code: 'WRONG_DIMENSIONS' });
});

test('fully decodes and rejects truncated JPGs', async t => {
  const f = await fixture(t);
  const filename = path.join(f.inputRoot, '1.jpg');
  const original = await fs.readFile(filename);
  const truncated = original.subarray(0, Math.floor(original.length * 0.75));
  await fs.writeFile(filename, truncated);
  f.manifest.slides[0].sha256 = sha256(truncated);
  await assert.rejects(preparePackage(f.manifest, f), { code: 'INVALID_JPEG' });
});

test('rejects traversal, remote URLs, absolute paths, and symlink escapes without reading remote assets', async t => {
  const f = await fixture(t);
  for (const file of ['../outside.jpg', '/etc/passwd', 'https://example.org/a.jpg', '..\\outside.jpg']) {
    const input = structuredClone(f.manifest);
    input.slides[0].file = file;
    await assert.rejects(preparePackage(input, f), { code: 'UNSAFE_PATH' });
  }
  await fs.copyFile(path.join(f.inputRoot, '1.jpg'), path.join(f.root, 'outside.jpg'));
  await fs.symlink(path.join(f.root, 'outside.jpg'), path.join(f.inputRoot, 'escape.jpg'));
  f.manifest.slides[0].file = 'escape.jpg';
  await assert.rejects(preparePackage(f.manifest, f), { code: 'UNSAFE_PATH' });
});

test('detects tampered output and refuses to overwrite a damaged cached export', async t => {
  const f = await fixture(t);
  const prepared = await preparePackage(f.manifest, f);
  const filename = path.join(prepared.directory, '01.jpg');
  await fs.appendFile(filename, 'tampered');
  await assert.rejects(verifyPrepared(prepared.directory), { code: 'EXPORT_TAMPERED' });
  await assert.rejects(preparePackage(f.manifest, f), { code: 'EXPORT_TAMPERED' });
  assert.ok((await fs.readFile(filename, 'utf8')).endsWith('tampered'));
});

test('blocks internal-test markers, duplicate slides, unrecorded clearance, excessive slides, and scheduling fields', async t => {
  const f = await fixture(t);
  const mutations = [
    [m => { m.caption = '[INTERNAL CAROUSEL TEST — DO NOT PUBLISH]'; }, 'TEST_CONTENT'],
    [m => { m.slides.push(structuredClone(m.slides[0])); }, 'DUPLICATE_SLIDE'],
    [m => { m.slides[0].rights.evidence = []; }, 'RIGHTS_EVIDENCE_MISSING'],
    [m => { m.slides = Array(11).fill(m.slides[0]); }, 'INVALID_MANIFEST'],
    [m => { m.scheduleAt = '2026-10-31T09:00:00Z'; }, 'INVALID_MANIFEST'],
    [m => { m.caption = 'x'.repeat(2201); }, 'INVALID_MANIFEST'],
  ];
  for (const [mutate, code] of mutations) {
    const input = structuredClone(f.manifest);
    mutate(input);
    assert.throws(() => validateManifest(input), { code });
  }
});
