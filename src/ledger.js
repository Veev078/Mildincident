import { DatabaseSync } from 'node:sqlite';
import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { canonical, sha256 } from './package.js';
import { requireThat } from './errors.js';

export const scopeKey = ({ storyId, channelId }) => sha256(canonical([storyId, channelId]));

export class DraftLedger {
  constructor(filename) {
    requireThat(filename !== ':memory:', 'VOLATILE_LEDGER', 'A durable on-disk ledger is required for draft creation.');
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    try { closeSync(openSync(filename, 'wx', 0o600)); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    this.db = new DatabaseSync(filename);
    chmodSync(filename, 0o600);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS draft_attempts (
        scope_key TEXT PRIMARY KEY,
        request_key TEXT NOT NULL UNIQUE,
        story_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        expected_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('sending', 'needs_reconciliation', 'confirmed_draft')),
        remote_id TEXT UNIQUE,
        observed_status TEXT,
        failure_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        verified_at TEXT
      );
      CREATE TABLE IF NOT EXISTS draft_events (
        id INTEGER PRIMARY KEY,
        scope_key TEXT NOT NULL REFERENCES draft_attempts(scope_key),
        event TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
    `);
  }

  #event(key, event, now) {
    this.db.prepare('INSERT INTO draft_events (scope_key, event, recorded_at) VALUES (?, ?, ?)').run(key, event, now);
  }

  #transaction(operation) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  get(key) {
    const row = this.db.prepare('SELECT * FROM draft_attempts WHERE scope_key = ?').get(key);
    if (!row) return null;
    const { expected_json, ...rest } = row;
    return { ...rest, expected: JSON.parse(expected_json) };
  }

  claim(prepared) {
    const key = scopeKey(prepared);
    return this.#transaction(() => {
      const previous = this.get(key);
      if (previous) {
        requireThat(previous.fingerprint === prepared.fingerprint, 'PACKAGE_CONFLICT', 'This story/channel already has a draft attempt for different content or a different revision. Review the existing attempt; changing content cannot create another draft automatically.');
        requireThat(previous.state === 'confirmed_draft', 'RECONCILIATION_REQUIRED', 'A send is in progress or its result is uncertain. Reconcile the existing attempt before any further action.');
        return { attempt: previous, reused: true };
      }
      const now = new Date().toISOString();
      const requestKey = `mi-draft-v1:${key}`;
      const expected = {
        caption: prepared.caption,
        assetHashes: prepared.slides.map(slide => slide.sha256),
        sourceFingerprint: prepared.sourceFingerprint,
        sourceRevision: prepared.sourceRevision,
        packageVersion: prepared.packageVersion,
      };
      this.db.prepare(`INSERT INTO draft_attempts
        (scope_key, request_key, story_id, channel_id, fingerprint, expected_json, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'sending', ?, ?)`)
        .run(key, requestKey, prepared.storyId, prepared.channelId, prepared.fingerprint, JSON.stringify(expected), now, now);
      this.#event(key, 'intent_committed', now);
      return { attempt: this.get(key), reused: false };
    });
  }

  recordRemoteId(key, remoteId) {
    this.#transaction(() => {
      const previous = this.get(key);
      requireThat(previous && previous.state === 'sending' && !previous.remote_id, 'LEDGER_CONFLICT', 'Cannot replace the remote ID of an existing attempt.');
      const now = new Date().toISOString();
      this.db.prepare('UPDATE draft_attempts SET remote_id = ?, updated_at = ? WHERE scope_key = ?').run(remoteId, now, key);
      this.#event(key, 'remote_id_recorded', now);
    });
  }

  confirm(key) {
    this.#transaction(() => {
      const previous = this.get(key);
      requireThat(previous?.remote_id, 'LEDGER_CONFLICT', 'A remote ID is required before confirming a draft.');
      const now = new Date().toISOString();
      this.db.prepare(`UPDATE draft_attempts SET state = 'confirmed_draft', observed_status = 'draft',
        failure_code = NULL, updated_at = ?, verified_at = ? WHERE scope_key = ?`).run(now, now, key);
      this.#event(key, 'draft_readback_verified', now);
    });
    return this.get(key);
  }

  markUncertain(key, code, observedStatus = null) {
    this.#transaction(() => {
      const now = new Date().toISOString();
      this.db.prepare(`UPDATE draft_attempts SET state = 'needs_reconciliation', failure_code = ?,
        observed_status = ?, updated_at = ? WHERE scope_key = ?`).run(code, observedStatus, now, key);
      this.#event(key, 'reconciliation_required', now);
    });
  }

  list() {
    return this.db.prepare(`SELECT scope_key, story_id, channel_id, state, remote_id,
      observed_status, failure_code, verified_at,
      json_extract(expected_json, '$.packageVersion') AS package_version
      FROM draft_attempts ORDER BY created_at DESC`).all();
  }

  events(key) {
    return this.db.prepare('SELECT event, recorded_at FROM draft_events WHERE scope_key = ? ORDER BY id').all(key);
  }

  close() { this.db.close(); }
}
