import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferReader } from './buffer-reader.js';
import { HandoffError, requireThat } from './errors.js';

export async function auditBuffer({ reader, outputRoot = '.local/audits' }) {
  const account = await reader.account();
  const matches = [];
  for (const org of account.organizations) {
    const channels = await reader.channels(org.id);
    matches.push(...channels.filter(c => c.name === 'mildincident' && c.service === 'instagram').map(c => ({ ...c, organizationId: org.id })));
  }
  requireThat(matches.length === 1, 'BUFFER_CHANNEL_AMBIGUOUS', 'Expected one exact mildincident Instagram channel. No default account/channel is assumed.');
  const channel = matches[0];
  const audit = await reader.posts({ organizationId: channel.organizationId, channelId: channel.id });
  await fs.mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const directory = await fs.mkdtemp(path.join(outputRoot, 'buffer-'));
  await fs.writeFile(path.join(directory, 'posts.json'), JSON.stringify(audit, null, 2), { flag: 'wx', mode: 0o600 });
  const summary = { complete: audit.complete, observedAt: audit.observedAt, remoteChanges: 0,
    channel: { id: channel.id, name: channel.name, service: channel.service, isDisconnected: channel.isDisconnected, isLocked: channel.isLocked },
    counts: Object.fromEntries([...new Set(audit.posts.map(p => p.status))].map(status => [status, audit.posts.filter(p => p.status === status).length])),
    posts: audit.posts.map(p => ({ id: p.id, status: p.status, imageCount: p.assets?.length ?? null,
      dueAt: p.dueAt, sentAt: p.sentAt, reportedInstagramLink: p.externalLink, instagramVerified: false })), directory };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(summary, null, 2), { flag: 'wx', mode: 0o600 });
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  auditBuffer({ reader: new BufferReader({ token: process.env.BUFFER_ACCESS_TOKEN }) })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error instanceof HandoffError ? `${error.code}: ${error.message}` : 'BUFFER_AUDIT_FAILED: details omitted.'); process.exitCode = 1; });
}
