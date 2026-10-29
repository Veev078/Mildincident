import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { n8nReader } from '../audit.js';
import { BufferReader } from '../buffer-reader.js';
import { readAllPages } from '../production-audit.js';
import { WORKSPACE_TABLES, buildWorkspace } from './model.js';
import { HandoffError, requireThat } from '../errors.js';

async function atomicJson(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, filename);
  } finally { await fs.rm(temporary, { force: true }); }
}

function validateSnapshot(snapshot) {
  requireThat(snapshot && Number.isFinite(Date.parse(snapshot.observedAt)) && snapshot.buffer?.complete === true && Array.isArray(snapshot.buffer.posts), 'INVALID_SNAPSHOT', 'The snapshot is incomplete.');
  for (const name of Object.keys(WORKSPACE_TABLES)) requireThat(Array.isArray(snapshot.records?.[name]), 'INVALID_SNAPSHOT', 'A required n8n table is missing.');
  return snapshot;
}

/** Cached reads only. An editor request can update its private cache, never n8n/Buffer data. */
export class WorkspaceSource {
  constructor({ root = '.local/workspace', auditRoot = '.local/audits', loadLive = fetchWorkspaceSnapshot, now = () => Date.now() } = {}) {
    this.root = path.resolve(root);
    this.auditRoot = path.resolve(auditRoot);
    this.loadLive = loadLive;
    this.now = now;
    this.snapshot = null;
    this.inflight = null;
    this.lastError = null;
  }

  async initialize() {
    try { this.snapshot = validateSnapshot(JSON.parse(await fs.readFile(path.join(this.root, 'snapshot.json'), 'utf8'))); return; }
    catch { /* A corrupt cache is not evidence of an empty production system. Fall back to audited snapshots. */ }
    try {
      const dirs = await fs.readdir(this.auditRoot, { withFileTypes: true });
      const findLatest = async prefix => {
        const candidates = [];
        for (const d of dirs.filter(d => d.isDirectory() && d.name.startsWith(prefix))) {
          try {
            const directory = path.join(this.auditRoot, d.name);
            const report = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8'));
            if (report.complete === true && Number.isFinite(Date.parse(report.observedAt))) candidates.push({ directory, report });
          } catch { /* Ignore incomplete prior runs. */ }
        }
        return candidates.sort((a, b) => Date.parse(b.report.observedAt) - Date.parse(a.report.observedAt))[0];
      };
      const production = await findLatest('production-');
      const bufferRun = await findLatest('buffer-');
      if (!production || !bufferRun) return;
      const records = {};
      for (const [name, id] of Object.entries(WORKSPACE_TABLES)) records[name] = JSON.parse(await fs.readFile(path.join(production.directory, `rows-${id}.json`), 'utf8'));
      const buffer = JSON.parse(await fs.readFile(path.join(bufferRun.directory, 'posts.json'), 'utf8'));
      const observedAt = new Date(Math.min(Date.parse(production.report.observedAt), Date.parse(buffer.observedAt))).toISOString();
      this.snapshot = validateSnapshot({ records, buffer, observedAt, warnings: ['Restored from completed production audit snapshots; refresh for current observations.'] });
    } catch { this.lastError = { code: 'CACHE_UNAVAILABLE', message: 'No complete source snapshot is available. Refresh the read-only connections.' }; }
  }

  view(drafts = new Map()) {
    requireThat(this.snapshot, 'SOURCE_UNAVAILABLE', 'The editorial snapshot is not available yet. Refresh the read-only connections.');
    const result = buildWorkspace(this.snapshot, drafts);
    result.source.refreshing = Boolean(this.inflight);
    result.source.refreshError = this.lastError ? { ...this.lastError } : null;
    result.source.stale = this.now() - Date.parse(this.snapshot.observedAt) > 15 * 60_000;
    if (this.lastError) result.source.warnings.push(`${this.lastError.code}: ${this.lastError.message}`);
    return result;
  }

  refresh() {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const snapshot = validateSnapshot(await Promise.resolve().then(() => this.loadLive()));
        await atomicJson(path.join(this.root, 'snapshot.json'), snapshot);
        this.snapshot = snapshot;
        this.lastError = null;
        return snapshot;
      } catch (error) {
        this.lastError = { code: error instanceof HandoffError ? error.code : 'REFRESH_FAILED', message: 'Read-only refresh did not complete. Previous observations and local edits are preserved.' };
        throw new HandoffError(this.lastError.code, this.lastError.message);
      } finally { this.inflight = null; }
    })();
    return this.inflight;
  }
}

export async function fetchWorkspaceSnapshot({ read = n8nReader(process.env.N8N_API_KEY), bufferReader = new BufferReader({ token: process.env.BUFFER_ACCESS_TOKEN }) } = {}) {
  const records = {};
  // A small fixed concurrency avoids flooding the existing n8n API.
  const tables = Object.entries(WORKSPACE_TABLES);
  for (let offset = 0; offset < tables.length; offset += 3) {
    await Promise.all(tables.slice(offset, offset + 3).map(async ([name, id]) => {
      records[name] = await readAllPages(read, `/api/v1/data-tables/${id}/rows`);
    }));
  }
  const account = await bufferReader.account();
  const channels = [];
  for (const org of account.organizations) channels.push(...(await bufferReader.channels(org.id))
    .filter(c => c.name === 'mildincident' && c.service === 'instagram').map(c => ({ ...c, organizationId: org.id })));
  requireThat(channels.length === 1, 'BUFFER_CHANNEL_AMBIGUOUS', 'Expected exactly one existing mildincident Instagram channel.');
  const channel = channels[0];
  const buffer = await bufferReader.posts({ organizationId: channel.organizationId, channelId: channel.id });
  const warnings = [];
  let metricsFailures = 0;
  const sent = buffer.posts.filter(p => p.status === 'sent');
  for (let offset = 0; offset < sent.length; offset += 2) {
    await Promise.all(sent.slice(offset, offset + 2).map(async post => {
      try {
        const evidence = await bufferReader.metrics(post.id);
        post.metrics = evidence.metrics;
        post.metricsUpdatedAt = evidence.metricsUpdatedAt || null;
      } catch { metricsFailures++; }
    }));
  }
  if (metricsFailures) warnings.push(`Performance metrics were unavailable for ${metricsFailures} sent records. Missing measurements are not reported as zero.`);
  return { records, buffer, observedAt: new Date().toISOString(), warnings };
}
