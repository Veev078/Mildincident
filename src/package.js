import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { HandoffError, requireThat } from './errors.js';

export const MAX_SLIDES = 10; // Conservative local limit, not a claim about Buffer's current API.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => sha256(canonical(value));

function object(value, keys, name) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_MANIFEST', `${name} must be an object.`);
  requireThat(Object.keys(value).every(key => keys.includes(key)), 'INVALID_MANIFEST', `${name} contains unsupported fields.`);
}

function text(value, name, max = 500) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'INVALID_MANIFEST', `${name} is required (maximum ${max} characters).`);
  requireThat(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), 'INVALID_MANIFEST', `${name} contains control characters.`);
  return value;
}

function https(value, name) {
  text(value, name, 4096);
  let url;
  try { url = new URL(value); } catch { throw new HandoffError('INVALID_MANIFEST', `${name} must be an HTTPS reference.`); }
  requireThat(url.protocol === 'https:' && !url.username && !url.password, 'INVALID_MANIFEST', `${name} must be an HTTPS reference without credentials.`);
  return value; // References only: never fetched.
}

export function validateManifest(input) {
  object(input, ['schemaVersion', 'storyId', 'packageVersion', 'sourceRevision', 'channelId', 'caption', 'slides'], 'Manifest');
  requireThat(input.schemaVersion === 1, 'INVALID_MANIFEST', 'Unsupported manifest schema.');
  text(input.storyId, 'storyId', 200);
  text(input.channelId, 'channelId', 200);
  text(input.sourceRevision, 'sourceRevision', 300);
  requireThat(Number.isSafeInteger(input.packageVersion) && input.packageVersion > 0, 'INVALID_MANIFEST', 'packageVersion must be a positive integer.');
  text(input.caption, 'caption', 10000);
  requireThat([...input.caption].length <= 2200, 'INVALID_MANIFEST', 'Caption exceeds the local Instagram limit of 2,200 code points.');
  requireThat(!/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(input.caption), 'TEST_CONTENT', 'Internal test / do-not-publish markers block handoff.');
  requireThat(Array.isArray(input.slides) && input.slides.length >= 1 && input.slides.length <= MAX_SLIDES, 'INVALID_MANIFEST', `Select 1–${MAX_SLIDES} ordered slides.`);
  const ids = new Set();
  const hashes = new Set();
  for (const [index, slide] of input.slides.entries()) {
    object(slide, ['assetId', 'file', 'sha256', 'source', 'rights'], `Slide ${index + 1}`);
    text(slide.assetId, 'assetId', 200);
    text(slide.file, 'file', 1024);
    requireThat(!path.isAbsolute(slide.file) && !slide.file.includes('\\') && !slide.file.includes(':') && !slide.file.split('/').includes('..'), 'UNSAFE_PATH', 'Asset files must be relative paths within the selected input directory.');
    requireThat(typeof slide.sha256 === 'string' && HASH.test(slide.sha256), 'INVALID_MANIFEST', 'Each source file needs its expected lowercase SHA-256.');
    requireThat(!ids.has(slide.assetId) && !hashes.has(slide.sha256), 'DUPLICATE_SLIDE', 'Repeated asset IDs or identical source files require an editorial correction.');
    ids.add(slide.assetId);
    hashes.add(slide.sha256);
    object(slide.source, ['url', 'creator'], 'Source');
    https(slide.source.url, 'source.url');
    text(slide.source.creator, 'source.creator');
    object(slide.rights, ['status', 'evidence', 'reviewedBy', 'reviewedAt', 'credit'], 'Rights');
    requireThat(['pending', 'cleared', 'restricted'].includes(slide.rights.status), 'INVALID_MANIFEST', 'Rights status must be pending, cleared, or restricted.');
    requireThat(Array.isArray(slide.rights.evidence) && slide.rights.evidence.length <= 20, 'INVALID_MANIFEST', 'rights.evidence must be a list of HTTPS references.');
    for (const evidence of slide.rights.evidence) https(evidence, 'rights.evidence');
    if (slide.rights.reviewedBy !== undefined) text(slide.rights.reviewedBy, 'rights.reviewedBy');
    if (slide.rights.reviewedAt !== undefined) {
      requireThat(typeof slide.rights.reviewedAt === 'string' && /^\d{4}-\d\d-\d\dT/.test(slide.rights.reviewedAt) && Number.isFinite(Date.parse(slide.rights.reviewedAt)), 'INVALID_MANIFEST', 'rights.reviewedAt must be an ISO timestamp.');
    }
    if (slide.rights.credit !== undefined) text(slide.rights.credit, 'rights.credit', 1000);
    if (slide.rights.status === 'cleared') {
      requireThat(slide.rights.evidence.length > 0 && slide.rights.reviewedBy && slide.rights.reviewedAt, 'RIGHTS_EVIDENCE_MISSING', 'Cleared rights need per-image evidence, a human reviewer, and a review timestamp.');
    }
  }
  return structuredClone(input);
}

export function sourceFingerprint(manifest) {
  const valid = validateManifest(manifest);
  return digest({ ...valid, slides: valid.slides.map(({ file, ...slide }) => slide) });
}

async function readWithin(root, relative) {
  const resolvedRoot = await fs.realpath(root);
  const resolved = await fs.realpath(path.resolve(resolvedRoot, relative));
  const remaining = path.relative(resolvedRoot, resolved);
  requireThat(remaining && !remaining.startsWith(`..${path.sep}`) && remaining !== '..' && !path.isAbsolute(remaining), 'UNSAFE_PATH', 'Asset resolves outside the selected private directory.');
  const handle = await fs.open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    requireThat(stat.isFile() && stat.size > 0 && stat.size <= MAX_FILE_BYTES, 'INVALID_ASSET', 'Asset must be a nonempty file of at most 25 MiB.');
    const bytes = await handle.readFile();
    requireThat(bytes.length <= MAX_FILE_BYTES, 'INVALID_ASSET', 'Asset exceeds 25 MiB.');
    return bytes;
  } finally { await handle.close(); }
}

async function inspectJpeg(bytes, { clean = false } = {}) {
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 50_000_000 });
    const meta = await image.metadata();
    requireThat(meta.format === 'jpeg', 'NOT_JPEG', 'Selected output must be an actual JPG, not a renamed PNG or web image.');
    requireThat(meta.width === 1080 && meta.height === 1350 && (!meta.orientation || meta.orientation === 1), 'WRONG_DIMENSIONS', 'Approve framing at 1080 × 1350 with normal orientation before preparation. No automatic cropping is applied.');
    if (clean) requireThat(!meta.exif && !meta.xmp && !meta.iptc && !meta.icc, 'METADATA_PRESENT', 'Prepared JPG contains embedded metadata.');
    await image.clone().raw().toBuffer(); // Fully decode; header inspection alone cannot detect truncated files.
    return image;
  } catch (error) {
    if (error instanceof HandoffError) throw error;
    throw new HandoffError('INVALID_JPEG', 'JPG could not be fully decoded.', { cause: error });
  }
}

function exportFingerprint(receipt) {
  const { fingerprint, ...contents } = receipt;
  return digest(contents);
}

export function assertDraftRights(prepared) {
  requireThat(prepared.slides.every(slide => slide.rights.status === 'cleared'), 'RIGHTS_NOT_CLEARED', 'Private files may be prepared while rights are pending. External draft handoff requires recorded per-image clearance under this local policy.');
}

export async function verifyPrepared(directory) {
  const receipt = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  object(receipt, ['schemaVersion', 'storyId', 'channelId', 'packageVersion', 'sourceRevision', 'sourceFingerprint', 'caption', 'slides', 'fingerprint'], 'Prepared manifest');
  requireThat(HASH.test(receipt.fingerprint) && receipt.fingerprint === exportFingerprint(receipt), 'EXPORT_TAMPERED', 'Prepared manifest fingerprint does not match.');
  requireThat(HASH.test(receipt.sourceFingerprint), 'EXPORT_TAMPERED', 'Prepared manifest is missing its source fingerprint.');
  requireThat(Array.isArray(receipt.slides), 'EXPORT_TAMPERED', 'Prepared manifest has no ordered slides.');
  for (const slide of receipt.slides) {
    object(slide, ['assetId', 'file', 'sha256', 'originalSha256', 'source', 'rights'], 'Prepared slide');
    requireThat(HASH.test(slide.originalSha256), 'EXPORT_TAMPERED', 'Original asset hash is missing.');
  }
  const originalManifest = {
    schemaVersion: receipt.schemaVersion, storyId: receipt.storyId, channelId: receipt.channelId,
    packageVersion: receipt.packageVersion, sourceRevision: receipt.sourceRevision, caption: receipt.caption,
    slides: receipt.slides.map(({ originalSha256, ...slide }) => ({ ...slide, sha256: originalSha256 })),
  };
  requireThat(sourceFingerprint(originalManifest) === receipt.sourceFingerprint, 'EXPORT_TAMPERED', 'Source selection no longer matches the receipt.');
  for (const slide of receipt.slides) {
    requireThat(HASH.test(slide.sha256), 'EXPORT_TAMPERED', 'Prepared asset hash is missing.');
    const bytes = await readWithin(directory, slide.file);
    requireThat(sha256(bytes) === slide.sha256, 'EXPORT_TAMPERED', 'Prepared JPG checksum changed.');
    await inspectJpeg(bytes, { clean: true });
  }
  return { ...receipt, directory: await fs.realpath(directory) };
}

export async function preparePackage(manifest, { inputRoot, privateRoot }) {
  const valid = validateManifest(manifest);
  await fs.mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const temporary = await fs.mkdtemp(path.join(privateRoot, '.preparing-'));
  let moved = false;
  try {
    const slides = [];
    for (const [index, slide] of valid.slides.entries()) {
      const bytes = await readWithin(inputRoot, slide.file);
      requireThat(sha256(bytes) === slide.sha256, 'SOURCE_CHANGED', 'Source file checksum differs from the approved selection.');
      const image = await inspectJpeg(bytes);
      // Strip embedded metadata without resizing, overlays, or editorial reframing.
      const clean = await image.rotate().jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
      const file = `${String(index + 1).padStart(2, '0')}.jpg`;
      await fs.writeFile(path.join(temporary, file), clean, { flag: 'wx', mode: 0o600 });
      slides.push({ ...slide, file, originalSha256: slide.sha256, sha256: sha256(clean) });
    }
    const receipt = { ...valid, sourceFingerprint: sourceFingerprint(valid), slides };
    receipt.fingerprint = exportFingerprint(receipt);
    await fs.writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    const destination = path.join(privateRoot, receipt.fingerprint);
    try {
      await fs.rename(temporary, destination);
      moved = true;
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      // A repeat/concurrent preparation can reuse identical immutable output, never overwrite it.
    }
    const result = await verifyPrepared(destination);
    requireThat(result.fingerprint === receipt.fingerprint, 'EXPORT_TAMPERED', 'Existing private export does not match the current package.');
    return result;
  } finally {
    if (!moved) await fs.rm(temporary, { recursive: true, force: true });
  }
}
