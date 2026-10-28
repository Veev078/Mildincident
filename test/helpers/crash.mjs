import { writeFileSync, readFileSync } from 'node:fs';
import { DraftLedger } from '../../src/ledger.js';
import { prepareAndSend } from '../../src/handoff.js';
const [settingsFile] = process.argv.slice(2);
const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
const ledger = new DraftLedger(settings.ledgerFile);
await prepareAndSend({
  ...settings, ledger, readCurrentPackage: async () => settings.manifest,
  readExistingHandoffs: async () => ({
    complete: true, storyId: settings.manifest.storyId, channelId: settings.manifest.channelId,
    postIds: [], observedAt: new Date().toISOString(),
  }),
  adapter: {
    async createUnscheduledDraft() {
      writeFileSync(settings.remoteMarker, 'one synthetic remote create', { flag: 'wx' });
      process.exit(17); // Simulate death after creation but before a response/ID is recorded.
    },
    async readPost() { throw new Error('Not reachable in crash fixture'); },
  },
});
