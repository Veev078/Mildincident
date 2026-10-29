import { DatabaseSync } from 'node:sqlite';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { HandoffError, requireThat } from '../errors.js';
import { validateCreativeBrief } from '../editorial-direction.js';

export class LocalDraftStore {
  constructor(filename) {
    requireThat(filename !== ':memory:', 'DURABLE_STORE_REQUIRED', 'Local editing requires an on-disk private store.');
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    try { closeSync(openSync(filename, 'wx', 0o600)); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    chmodSync(filename, 0o600);
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS local_editorial_drafts (story_id TEXT PRIMARY KEY, base_revision TEXT NOT NULL,
      version INTEGER NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS local_editorial_draft_history (story_id TEXT NOT NULL, base_revision TEXT NOT NULL,
      version INTEGER NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL, event TEXT NOT NULL,
      PRIMARY KEY(story_id,version));
      INSERT OR IGNORE INTO local_editorial_draft_history SELECT story_id,base_revision,version,data_json,updated_at,'saved' FROM local_editorial_drafts;`);
  }

  get(storyId) {
    const row = this.db.prepare('SELECT * FROM local_editorial_drafts WHERE story_id=?').get(storyId);
    return row ? { ...JSON.parse(row.data_json), baseRevision: row.base_revision, version: row.version, updatedAt: row.updated_at } : null;
  }

  all() {
    return new Map(this.db.prepare('SELECT story_id FROM local_editorial_drafts').all().map(r => [r.story_id, this.get(r.story_id)]));
  }

  save(story, input) {
    const keys = ['baseRevision', 'expectedVersion', 'caption', 'selectedAssetIds', 'notes', 'musicSelection', 'creativeBrief'];
    requireThat(input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).every(k => keys.includes(k)), 'INVALID_LOCAL_EDIT', 'Unsupported local draft fields.');
    requireThat(input.baseRevision === story.revision, 'STALE_SOURCE', 'The n8n story has changed. Reload and compare the local draft before saving.');
    requireThat(Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0, 'INVALID_LOCAL_EDIT', 'expectedVersion is required.');
    if (input.caption !== undefined) requireThat(typeof input.caption === 'string' && [...input.caption].length <= 10_000, 'INVALID_LOCAL_EDIT', 'Caption draft must be text of at most 10,000 code points.');
    if (input.notes !== undefined) requireThat(typeof input.notes === 'string' && input.notes.length <= 20_000, 'INVALID_LOCAL_EDIT', 'Notes must be text of at most 20,000 characters.');
    if (input.selectedAssetIds !== undefined) {
      requireThat(Array.isArray(input.selectedAssetIds) && input.selectedAssetIds.length <= 20 && input.selectedAssetIds.every(id => typeof id === 'string') && new Set(input.selectedAssetIds).size === input.selectedAssetIds.length, 'INVALID_LOCAL_EDIT', 'Choose at most 20 distinct images.');
      const ids = new Set(story.media.map(m => m.id));
      requireThat(input.selectedAssetIds.every(id => ids.has(id)), 'FOREIGN_ASSET', 'Selected images must belong to this existing story.');
    }
    if (input.musicSelection !== undefined && input.musicSelection !== null) {
      requireThat(input.musicSelection && typeof input.musicSelection === 'object' && !Array.isArray(input.musicSelection) &&
        Object.keys(input.musicSelection).every(k => ['track', 'artist'].includes(k)) &&
        ['track', 'artist'].every(k => typeof input.musicSelection[k] === 'string' && input.musicSelection[k].length > 0 && input.musicSelection[k].length <= 300),
      'INVALID_LOCAL_EDIT', 'Music selection needs track and artist text.');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.get(story.id);
      requireThat(!previous || previous.baseRevision === story.revision, 'STALE_LOCAL_DRAFT', 'This local draft belongs to an earlier source revision. Preserve/export it and resolve differences first.');
      requireThat((previous?.version || 0) === input.expectedVersion, 'EDIT_CONFLICT', 'Another tab saved a newer draft. Reload before editing again.');
      const { baseRevision, expectedVersion, ...changes } = input;
      const { version, updatedAt, baseRevision: oldRevision, ...oldData } = previous || {};
      const data = { ...oldData, ...changes };
      if (data.creativeBrief !== undefined) data.creativeBrief = validateCreativeBrief(data.creativeBrief, { ...story, selectedAssetIds: data.selectedAssetIds || story.selectedAssetIds });
      const now = new Date().toISOString();
      this.db.prepare(`INSERT INTO local_editorial_drafts VALUES(?,?,?,?,?) ON CONFLICT(story_id) DO UPDATE SET
        base_revision=excluded.base_revision,version=excluded.version,data_json=excluded.data_json,updated_at=excluded.updated_at`)
        .run(story.id, baseRevision, expectedVersion + 1, JSON.stringify(data), now);
      this.db.prepare('INSERT INTO local_editorial_draft_history VALUES(?,?,?,?,?,?)').run(story.id, baseRevision, expectedVersion + 1, JSON.stringify(data), now, 'saved');
      this.db.exec('COMMIT');
      return this.get(story.id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  history(storyId) {
    return this.db.prepare('SELECT base_revision,version,data_json,updated_at,event FROM local_editorial_draft_history WHERE story_id=? ORDER BY version DESC').all(storyId)
      .map(r => ({ ...JSON.parse(r.data_json), baseRevision: r.base_revision, version: r.version, updatedAt: r.updated_at, event: r.event }));
  }

  rebase(story, input) {
    requireThat(input && typeof input === 'object' && !Array.isArray(input) &&
      Object.keys(input).every(k => ['expectedVersion', 'previousRevision', 'currentRevision', 'confirm', 'selectedAssetIds', 'creativeBrief'].includes(k)) &&
      Number.isSafeInteger(input.expectedVersion) && input.expectedVersion > 0 && input.currentRevision === story.revision &&
      input.confirm === 'keep_local_after_review', 'INVALID_REBASE', 'Compare current n8n content with the local draft and explicitly confirm keeping local edits.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.get(story.id);
      requireThat(previous && previous.version === input.expectedVersion && previous.baseRevision === input.previousRevision, 'EDIT_CONFLICT', 'The local draft changed. Reload before resolving.');
      requireThat(previous.baseRevision !== story.revision, 'REBASE_NOT_NEEDED', 'This draft already uses the current source revision.');
      const mediaIds = new Set(story.media.map(m => m.id));
      const selection = input.selectedAssetIds === undefined ? previous.selectedAssetIds : input.selectedAssetIds;
      requireThat(selection === undefined || (Array.isArray(selection) && selection.length <= 20 && new Set(selection).size === selection.length && selection.every(id => typeof id === 'string' && mediaIds.has(id))),
        'FOREIGN_ASSET', 'A selected image no longer exists in this story. Explicitly review a replacement sequence or export the preserved proposal.');
      const { baseRevision, version, updatedAt, ...data } = previous;
      if (input.selectedAssetIds !== undefined) data.selectedAssetIds = input.selectedAssetIds;
      if (input.creativeBrief !== undefined) data.creativeBrief = input.creativeBrief;
      if (data.creativeBrief !== undefined) data.creativeBrief = validateCreativeBrief(data.creativeBrief, { ...story, selectedAssetIds: data.selectedAssetIds || story.selectedAssetIds });
      const now = new Date().toISOString();
      const serialized = JSON.stringify(data);
      this.db.prepare('UPDATE local_editorial_drafts SET base_revision=?,version=?,data_json=?,updated_at=? WHERE story_id=?').run(story.revision, version + 1, serialized, now, story.id);
      this.db.prepare('INSERT INTO local_editorial_draft_history VALUES(?,?,?,?,?,?)').run(story.id, story.revision, version + 1, serialized, now, 'rebased_after_review');
      this.db.exec('COMMIT');
      return this.get(story.id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  proposal(story) {
    const draft = this.get(story.id);
    requireThat(draft, 'DRAFT_NOT_FOUND', 'Save a local edit before downloading a change proposal.');
    return { schemaVersion: 1, kind: 'mildincident_local_change_proposal', conceptId: story.id,
      packageVersion: story.packageVersion, baseRevision: draft.baseRevision, currentRevision: story.revision,
      stale: draft.baseRevision !== story.revision, localVersion: draft.version, updatedAt: draft.updatedAt,
      changes: Object.fromEntries(['caption', 'selectedAssetIds', 'notes', 'musicSelection', 'creativeBrief'].filter(k => Object.hasOwn(draft, k)).map(k => [k, draft[k]])),
      productionApplied: false, publicationApproved: false, rightsGranted: false,
      instructions: 'Review against current n8n records. This proposal is not an import command, rights clearance, scheduling or publication approval.' };
  }

  close() { this.db.close(); }
}
