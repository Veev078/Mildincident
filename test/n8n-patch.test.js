import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { candidateBufferId, hasExistingStoryHandoff, captionIsInternalTest, verifyDraftReadback } from '../src/n8n/draft-guards.js';
import { prepareManualDraftPatch, prepareStudioFeedbackPatch } from '../src/n8n/patch-builder.js';

const id = '0123456789abcdef01234567';
const expected = { id, channelId: 'channel', caption: 'Approved fixture caption', urls: ['https://example.org/01.jpg', 'https://example.org/02.jpg'] };
const response = () => ({ data: { post: { id, channelId: 'channel', text: expected.caption, status: 'draft', dueAt: null, sentAt: null, assets: expected.urls.map(source => ({ source })) } } });

test('candidate ID survives MCP/GraphQL wrappers independently of uncertain draft verification', () => {
  assert.equal(candidateBufferId({ content: [{ type: 'text', text: JSON.stringify({ post: { id, status: 'sent' } }) }] }), id);
  assert.equal(candidateBufferId({ data: { createPost: { post: { id } } } }), id);
  assert.equal(candidateBufferId({ content: [{ type: 'text', text: 'malformed' }] }), '');
});

test('cross-version story attempts and internal test captions block; only explicit abandoned claims can retry', () => {
  assert.equal(hasExistingStoryHandoff([{ concept_id: 'story', package_version: 1, state: 'draft_created' }], 'story'), true);
  assert.equal(hasExistingStoryHandoff([{ concept_id: 'story', state: 'reserved' }], 'story'), true);
  assert.equal(hasExistingStoryHandoff([{ concept_id: 'story', state: 'unexpected' }], 'story'), true);
  assert.equal(hasExistingStoryHandoff([{ concept_id: 'story', state: 'abandoned' }], 'story'), false);
  assert.equal(captionIsInternalTest('[INTERNAL CAROUSEL TEST — DO NOT PUBLISH]'), true);
  assert.equal(captionIsInternalTest('Actual historical caption'), false);
});

test('independent read-back verifies exact caption, channel, explicit null schedules and ordered source URLs', () => {
  assert.equal(verifyDraftReadback(expected, response()).verified, true);
  const mutations = [
    p => { p.status = 'sent'; }, p => { p.status = 'scheduled'; }, p => { delete p.dueAt; },
    p => { p.sentAt = ''; }, p => { p.text += ' changed'; }, p => { p.assets.reverse(); },
    p => { p.id = 'other'; }, p => { p.channelId = 'other'; },
  ];
  for (const mutate of mutations) {
    const data = response(); mutate(data.data.post);
    const result = verifyDraftReadback(expected, data);
    assert.equal(result.verified, false);
    assert.equal(result.candidate_buffer_id, id);
  }
  assert.equal(verifyDraftReadback(expected, { data: response().data, errors: [{ message: 'fixture' }] }).verified, false);
  assert.equal(verifyDraftReadback(expected, response().data.post).verified, false); // A create response is insufficient.
});

function snapshot() {
  const named = (name, parameters = {}) => ({ id: name, name, type: 'n8n-nodes-base.code', position: [0, 0], parameters });
  return { id: 'BzMqQS8lfkwN7peQ', name: 'Existing production import', activeVersionId: 'active-1', settings: {},
    activeVersion: { versionId: 'active-1', nodes: [
      named('Validate Saved Manual Draft Package', { jsCode: "if(previous.some(x=>x.import_key===request.import_key&&x.state!=='abandoned'))problems.push('existing');if(!archive)problems.push('missing');" }),
      { ...named('Create One Unscheduled Buffer Draft'), credentials: { httpBearerAuth: { id: 'existing-credential-reference', name: 'Existing Buffer' } } },
      named('Verify Unscheduled Buffer Draft'),
      named('Record Created Buffer Draft', { operation: 'update', filters: { conditions: [{ keyName: 'id', keyValue: '={{ $(\'Reserve Manual Buffer Draft Import\').first().json.id }}' }] }, columns: { mappingMode: 'defineBelow', value: {} } }),
    ], connections: {} } };
}

test('patch inserts durable candidate recording before read-back, retains existing credential, preserves error path and refuses a second application', () => {
  const original = snapshot();
  const patch = prepareManualDraftPatch(original);
  assert.equal(original.activeVersion.nodes.length, 4);
  assert.equal(patch.deployable, false);
  assert.ok(patch.blockers.includes('CENTRAL_ATOMIC_CLAIM_NOT_VERIFIED'));
  const connections = patch.update.connections;
  assert.equal(connections['Has Buffer Candidate ID?'].main[0][0].node, 'Persist Buffer Candidate Before Readback');
  assert.equal(connections['Persist Buffer Candidate Before Readback'].main[0][0].node, 'Read Back Buffer Draft');
  assert.equal(connections['Read Back Buffer Draft'].main[1][0].node, 'Manual Draft Transfer Needs Reconciliation');
  const read = patch.update.nodes.find(n => n.name === 'Read Back Buffer Draft');
  assert.equal(read.credentials.httpBearerAuth.id, 'existing-credential-reference');
  assert.equal(read.retryOnFail, false);
  assert.ok(read.parameters.jsonBody.includes('query VerifyDraft'));
  for (const n of patch.update.nodes) if (n.parameters.jsCode) new vm.Script(`(async()=>{${n.parameters.jsCode}})`);
  assert.throws(() => prepareManualDraftPatch({ ...original, activeVersion: { versionId: 'active-1', ...patch.update } }), { code: 'PATCH_CODE_DRIFT' });
});

test('Studio patch removes misleading timeless draft-success wording and requires exact active source', () => {
  const original = { id: 'ecWr4PeKU4vKLQ1m', activeVersionId: 'v1', activeVersion: { versionId: 'v1', nodes: [{ name: 'Build Editorial Dashboard HTML', parameters: { jsCode: "const a='Buffer draft created. Images and caption were transferred, but nothing was scheduled or published.'; const b='Buffer returned an uncertain response. Check for an existing draft before retrying.';" } }] } };
  const patch = prepareStudioFeedbackPatch(original);
  assert.match(patch.jsCode, /Check its current Buffer status/);
  assert.match(patch.jsCode, /Do not send again/);
  assert.equal(patch.deployable, false);
  assert.throws(() => prepareStudioFeedbackPatch({ ...original, activeVersionId: 'different' }), { code: 'PATCH_BASE_UNAVAILABLE' });
});
