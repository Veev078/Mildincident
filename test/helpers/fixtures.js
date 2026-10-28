import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { sha256 } from '../../src/package.js';
import { DraftLedger } from '../../src/ledger.js';

export async function fixture(t, { rights = 'cleared', count = 2 } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mildincident-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const inputRoot = path.join(root, 'inputs');
  const privateRoot = path.join(root, 'exports');
  await fs.mkdir(inputRoot, { mode: 0o700 });
  const slides = [];
  for (let i = 0; i < count; i++) {
    const bytes = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: { r: 40 + i * 70, g: 90, b: 130 } } })
      .withMetadata().jpeg().toBuffer();
    const file = `${i + 1}.jpg`;
    await fs.writeFile(path.join(inputRoot, file), bytes);
    slides.push({
      assetId: `synthetic-${i + 1}`, file, sha256: sha256(bytes),
      source: { url: 'https://example.org/synthetic-test-fixture', creator: 'Test fixture generator' },
      rights: {
        status: rights, evidence: rights === 'cleared' ? ['https://example.org/test-evidence'] : [],
        ...(rights === 'cleared' ? { reviewedBy: 'Automated test fixture (not editorial clearance)', reviewedAt: '2026-10-28T12:00:00Z' } : {}),
      },
    });
  }
  const manifest = {
    schemaVersion: 1, storyId: 'FIXTURE-STORY-NOT-A-REAL-CONCEPT', packageVersion: 1,
    sourceRevision: 'synthetic-revision-1', channelId: 'fixture-channel',
    caption: 'Synthetic local fixture. Never sent to a real service.', slides,
  };
  const ledgerFile = path.join(root, 'ledger.sqlite');
  const ledger = new DraftLedger(ledgerFile);
  t.after(() => ledger.close());
  return { root, inputRoot, privateRoot, manifest, ledger, ledgerFile };
}

export function fakeAdapter() {
  const posts = new Map();
  let creates = 0;
  let reads = 0;
  return {
    posts,
    get creates() { return creates; },
    get reads() { return reads; },
    async createUnscheduledDraft(request) {
      creates++;
      const id = `fake-draft-${creates}`;
      posts.set(id, {
        id, channelId: request.channelId, caption: request.caption,
        status: 'draft', scheduledAt: null,
        assetHashes: request.assets.map(asset => asset.sha256),
      });
      return { id };
    },
    async readPost(id) {
      reads++;
      return structuredClone(posts.get(id));
    },
  };
}

export function handoffOptions(f, adapter) {
  return {
    ...f, adapter, readCurrentPackage: async () => structuredClone(f.manifest),
    readExistingHandoffs: async () => ({
      complete: true, storyId: f.manifest.storyId, channelId: f.manifest.channelId,
      postIds: [], observedAt: new Date().toISOString(),
    }),
  };
}
