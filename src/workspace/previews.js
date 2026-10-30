import {fingerprint} from '../photography/fingerprint.js';
import { DatabaseSync } from 'node:sqlite';
import { constants, chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { safePhotoReference } from '../n8n/photo-url-guard.js';
import { HandoffError, requireThat } from '../errors.js';

export const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Private file input, never a downloader or a production asset registry. */
export class LocalPreviewStore {
  constructor(root) {
    this.root = path.resolve(root);
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    mkdirSync(path.join(this.root, 'blobs'), { recursive: true, mode: 0o700 });
    const filename = path.join(this.root, 'previews.sqlite');
    try { closeSync(openSync(filename, 'wx', 0o600)); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    chmodSync(filename, 0o600);
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS local_preview_fingerprints(hash TEXT PRIMARY KEY,data_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS local_image_previews(id INTEGER PRIMARY KEY, story_id TEXT NOT NULL,
      asset_id TEXT NOT NULL, original_sha256 TEXT NOT NULL, preview_sha256 TEXT NOT NULL,
      original_name TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, original_width INTEGER NOT NULL,
      original_height INTEGER NOT NULL, original_format TEXT NOT NULL, uploaded_at TEXT NOT NULL,
      UNIQUE(story_id,asset_id,original_sha256));
      CREATE TABLE IF NOT EXISTS local_image_review_events(story_id TEXT NOT NULL, asset_id TEXT NOT NULL,
      version INTEGER NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(story_id,asset_id,version));
      CREATE TABLE IF NOT EXISTS local_source_preview_evidence(story_id TEXT NOT NULL, asset_id TEXT NOT NULL,
      preview_sha256 TEXT NOT NULL, source_url TEXT NOT NULL, image_url TEXT NOT NULL, execution_id TEXT NOT NULL,
      inspected_at TEXT NOT NULL, PRIMARY KEY(story_id,asset_id,preview_sha256));`);
  }

  #public(row) {
    return row ? { fingerprint:JSON.parse(this.db.prepare('SELECT data_json FROM local_preview_fingerprints WHERE hash=?').get(row.preview_sha256)?.data_json||'null'),originalSha256: row.original_sha256, sha256: row.preview_sha256, originalName: row.original_name,
      width: row.width, height: row.height, originalWidth: row.original_width, originalHeight: row.original_height,
      originalFormat: row.original_format, uploadedAt: row.uploaded_at,
      sourceInspection: this.sourceInspection(row.story_id,row.asset_id,row.preview_sha256),
      localOnly: true, rightsGranted: false, identityVerified: false } : null;
  }

  get(storyId, assetId, hash) {
    const row = hash ? this.db.prepare('SELECT * FROM local_image_previews WHERE story_id=? AND asset_id=? AND preview_sha256=? ORDER BY id DESC LIMIT 1').get(storyId, assetId, hash) :
      this.db.prepare('SELECT * FROM local_image_previews WHERE story_id=? AND asset_id=? ORDER BY id DESC LIMIT 1').get(storyId, assetId);
    return this.#public(row);
  }

  all() {
    const rows = this.db.prepare(`SELECT p.* FROM local_image_previews p WHERE p.id=(SELECT MAX(q.id) FROM local_image_previews q WHERE q.story_id=p.story_id AND q.asset_id=p.asset_id)`).all();
    return new Map(rows.map(row => [JSON.stringify([row.story_id, row.asset_id]), this.#public(row)]));
  }

  async #writeBlob(hash, suffix, bytes) {
    const filename = path.join(this.root, 'blobs', `${hash}.${suffix}`);
    try { await fs.writeFile(filename, bytes, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = await this.#readBlob(hash, suffix);
      requireThat(sha256(existing) === hash, 'LOCAL_PREVIEW_CORRUPTED', 'A private preview blob changed. Keep the original files and investigate before reuse.');
    }
  }

  async #readBlob(hash, suffix) {
    requireThat(/^[a-f0-9]{64}$/.test(hash) && ['original', 'jpg'].includes(suffix), 'INVALID_PREVIEW_HASH', 'Invalid preview reference.');
    const filename = path.join(this.root, 'blobs', `${hash}.${suffix}`);
    const root = await fs.realpath(path.join(this.root, 'blobs'));
    const real = await fs.realpath(filename);
    const relative = path.relative(root, real);
    requireThat(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'LOCAL_PREVIEW_CORRUPTED', 'Private preview path changed.');
    const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      requireThat(stat.isFile() && stat.size <= MAX_PREVIEW_BYTES, 'LOCAL_PREVIEW_CORRUPTED', 'Private preview blob is not a valid bounded file.');
      const bytes = await handle.readFile();
      requireThat(sha256(bytes) === hash, 'LOCAL_PREVIEW_CORRUPTED', 'Private preview checksum changed.');
      return bytes;
    } finally { await handle.close(); }
  }

  async save({ storyId, assetId, bytes, contentType, originalName, declaration }) {
    requireThat(declaration === 'private_review_only', 'PREVIEW_DECLARATION_REQUIRED', 'Confirm that this upload is for private review and does not establish publication rights or provenance.');
    requireThat(typeof storyId === 'string' && storyId.length <= 150 && typeof assetId === 'string' && assetId.length > 0 && assetId.length <= 300, 'INVALID_PREVIEW_SCOPE', 'Invalid existing image reference.');
    requireThat(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_PREVIEW_BYTES, 'INVALID_PREVIEW_FILE', 'Choose a nonempty JPG, PNG or WebP of at most 25 MiB.');
    requireThat(Object.values(TYPES).includes(contentType), 'INVALID_PREVIEW_TYPE', 'Only still JPG, PNG and WebP files are supported.');
    requireThat(typeof originalName === 'string' && originalName.length <= 500 && !/[\u0000-\u001f\u007f]/.test(originalName), 'INVALID_PREVIEW_NAME', 'Use a file name without control characters.');
    const name = path.basename(originalName.replace(/\\/g, '/')).slice(0, 240) || 'private-review-image';
    let meta, preview, info;
    try {
      const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40_000_000 });
      meta = await image.metadata();
      requireThat(TYPES[meta.format] === contentType && (!meta.pages || meta.pages === 1), 'INVALID_PREVIEW_TYPE', 'The file must decode as one still image matching its declared type.');
      const encoded = await image.rotate().flatten({ background: '#f5f3ed' }).resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
      preview = encoded.data; info = encoded.info;
    } catch (error) {
      if (error instanceof HandoffError) throw error;
      throw new HandoffError('INVALID_PREVIEW_FILE', 'The local image could not be safely decoded. Originals and production data were not changed.');
    }
    const visualFingerprint=await fingerprint(preview);
    const originalHash = sha256(bytes);
    const previewHash = sha256(preview);
    this.db.prepare('INSERT OR IGNORE INTO local_preview_fingerprints VALUES(?,?)').run(previewHash,JSON.stringify(visualFingerprint));
    const previous = this.db.prepare('SELECT * FROM local_image_previews WHERE story_id=? AND asset_id=? AND original_sha256=?').get(storyId, assetId, originalHash);
    if (previous) {
      await this.#readBlob(previous.original_sha256, 'original');
      await this.#readBlob(previous.preview_sha256, 'jpg');
      return this.#public(previous);
    }
    await this.#writeBlob(originalHash, 'original', bytes);
    await this.#writeBlob(previewHash, 'jpg', preview);
    this.db.prepare(`INSERT OR IGNORE INTO local_image_previews
      (story_id,asset_id,original_sha256,preview_sha256,original_name,width,height,original_width,original_height,original_format,uploaded_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(storyId, assetId, originalHash, previewHash, name, info.width, info.height, meta.width, meta.height, meta.format, new Date().toISOString());
    return this.#public(this.db.prepare('SELECT * FROM local_image_previews WHERE story_id=? AND asset_id=? AND original_sha256=?').get(storyId, assetId, originalHash));
  }

  async readPreview(storyId, assetId, hash) {
    requireThat(hash === undefined || /^[a-f0-9]{64}$/.test(hash), 'INVALID_PREVIEW_HASH', 'Invalid preview reference.');
    const preview = this.get(storyId, assetId, hash);
    requireThat(preview, 'PREVIEW_NOT_FOUND', 'No private preview is attached to this image.');
    return { bytes: await this.#readBlob(preview.sha256, 'jpg'), preview };
  }

  sourceInspection(storyId,assetId,hash){const row=this.db.prepare('SELECT * FROM local_source_preview_evidence WHERE story_id=? AND asset_id=? AND preview_sha256=?').get(storyId,assetId,hash);return row?{sourceUrl:row.source_url,imageUrl:row.image_url,executionId:row.execution_id,inspectedAt:row.inspected_at,basis:'recorded_source_copy',identityVerified:false,rightsGranted:false}:null;}
  recordSourceInspection(storyId,assetId,hash,{sourceUrl,imageUrl,executionId}){
    requireThat(this.get(storyId,assetId,hash),'PREVIEW_NOT_FOUND','A decoded existing private preview is required.');
    requireThat(safePhotoReference(sourceUrl)&&safePhotoReference(imageUrl)&&/^[0-9]{1,30}$/.test(executionId),'INVALID_PREVIEW_SOURCE','Recorded public URLs and a native inspection execution are required.');
    this.db.prepare('INSERT OR IGNORE INTO local_source_preview_evidence VALUES(?,?,?,?,?,?,?)').run(storyId,assetId,hash,sourceUrl,imageUrl,executionId,new Date().toISOString());
    return this.get(storyId,assetId,hash);
  }

  review(storyId, assetId) {
    const rows = this.db.prepare('SELECT * FROM local_image_review_events WHERE story_id=? AND asset_id=? ORDER BY version DESC').all(storyId, assetId);
    const latest = rows[0];
    return latest ? { decision: latest.decision, reason: latest.reason, version: latest.version, updatedAt: latest.created_at,
      localOnly: true, rightsGranted: false, history: rows.slice(0, 50).map(r => ({version:r.version, decision:r.decision, reason:r.reason, updatedAt:r.created_at})) } : null;
  }

  allReviews() {
    const scopes = this.db.prepare('SELECT DISTINCT story_id,asset_id FROM local_image_review_events').all();
    return new Map(scopes.map(r => [JSON.stringify([r.story_id,r.asset_id]), this.review(r.story_id,r.asset_id)]));
  }

  saveReview(storyId, assetId, input) {
    requireThat(input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).every(k => ['expectedVersion','decision','reason'].includes(k)), 'INVALID_IMAGE_REVIEW', 'Use an editorial decision and reason only.');
    requireThat(['shortlist','reject','hold'].includes(input.decision) && typeof input.reason === 'string' && input.reason.trim().length >= 8 && input.reason.length <= 1500, 'INVALID_IMAGE_REVIEW', 'Choose a decision and give a reason between 8 and 1500 characters.');
    requireThat(Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0, 'INVALID_IMAGE_REVIEW', 'A review version is required.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.review(storyId,assetId);
      requireThat((previous?.version || 0) === input.expectedVersion, 'EDIT_CONFLICT', 'Another tab changed this image review. Reopen it before saving.');
      this.db.prepare('INSERT INTO local_image_review_events VALUES(?,?,?,?,?,?)').run(storyId,assetId,input.expectedVersion+1,input.decision,input.reason.trim(),new Date().toISOString());
      this.db.exec('COMMIT'); return this.review(storyId,assetId);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  close() { this.db.close(); }
}

export function attachLocalPreviews(workspace, previews) {
  if (!previews) return workspace;
  const attachments = previews.all();
  const reviews = previews.allReviews();
  for (const story of workspace.stories) for (const asset of story.media) {
    const preview = attachments.get(JSON.stringify([story.id, asset.id])) || null;
    if (!Object.hasOwn(asset, 'sourcePreviewUrl')) asset.sourcePreviewUrl = asset.previewUrl;
    asset.previewOrigin = preview ? (preview.sourceInspection ? 'source_cache' : 'local_upload') : 'source';
    asset.localPreview = preview;
    asset.localReview = reviews.get(JSON.stringify([story.id, asset.id])) || null;
    if (preview) asset.previewUrl = `/api/stories/${encodeURIComponent(story.id)}/assets/${encodeURIComponent(asset.id)}/preview?hash=${preview.sha256}`;
  }
  return workspace;
}
