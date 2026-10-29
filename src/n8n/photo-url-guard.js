import { createHash } from 'node:crypto';
import { requireThat } from '../errors.js';

/** Syntax screening for browser references, not DNS verification or a downloader. Self-contained for n8n Code. */
export function safePhotoReference(value) {
  const text = String(value || '').trim();
  if (!text || text.length >= 1400 || /[<>"'{}\s\\]/.test(text) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(text)) return '';
  const match = text.match(/^https:\/\/([a-z0-9.-]+)(?::443)?(?:[/?#]|$)/i);
  if (!match) return '';
  const host = match[1].toLowerCase();
  const labels = host.split('.');
  if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1)) || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return '';
  if (/(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host) || host.endsWith('.home.arpa')) return '';
  const query = text.split('#')[0].split('?')[1] || '';
  for (const pair of query.split('&')) {
    let key;
    try { key = decodeURIComponent(pair.split('=')[0]).toLowerCase().replace(/[^a-z0-9]/g, ''); } catch { return ''; }
    if (/token$|secret$|password$/.test(key) || /^(?:apikey|key|signature|sig|credential|authorization|auth|oauth|xamz|xgoog)/.test(key)) return '';
  }
  return text;
}

const NODE = 'Broaden — Qualify Cross-Source Preview Leads';
const hash = text => createHash('sha256').update(text).digest('hex');

/** Prepare only. Caller must keep full workflow private; no remote writes or activation. */
export function preparePhotoGuardPatch(workflow, { expectedVersion, expectedCodeHash }) {
  requireThat(workflow?.versionId === expectedVersion && typeof expectedVersion === 'string', 'WORKFLOW_DRIFT', 'Workflow version changed; capture and review the current workflow.');
  const nodes = workflow.nodes?.filter(node => node.name === NODE) || [];
  requireThat(nodes.length === 1, 'NODE_DRIFT', 'Expected one existing photo qualifier node.');
  const code = nodes[0].parameters?.jsCode;
  requireThat(typeof code === 'string' && hash(code) === expectedCodeHash, 'CODE_DRIFT', 'Photo qualifier code changed.');
  const declarations = code.match(/^const safe=s=>\{[^\n]+\};$/gm) || [];
  requireThat(declarations.length === 1, 'GUARD_DRIFT', 'Expected the reviewed one-line URL guard.');
  const output = structuredClone(workflow);
  output.nodes.find(node => node.name === NODE).parameters.jsCode = code.replace(declarations[0], `const safe = ${safePhotoReference.toString()};`);
  return { workflow: output, review: { node: NODE, expectedVersion, expectedCodeHash, patchedCodeHash: hash(output.nodes.find(node => node.name === NODE).parameters.jsCode),
    productionApplied: false, activationAllowed: false, limits: 'URL syntax only; not DNS, accessibility, rights or pixel verification. Existing shortlist and search caps unchanged.' } };
}
