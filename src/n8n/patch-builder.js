import { createHash } from 'node:crypto';
import { requireThat } from '../errors.js';
import { candidateBufferId, captionIsInternalTest, hasExistingStoryHandoff, unwrapBufferCreate, verifyDraftReadback } from './draft-guards.js';

const code = (...functions) => functions.map(fn => fn.toString()).join('\n');
const edge = name => ({ node: name, type: 'main', index: 0 });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Generate a private review artifact only. This module has no HTTP/update/activate function. */
export function prepareManualDraftPatch(workflow) {
  requireThat(workflow.id === 'BzMqQS8lfkwN7peQ' && workflow.activeVersion?.versionId === workflow.activeVersionId, 'PATCH_BASE_UNAVAILABLE', 'An actual active workflow snapshot is required.');
  const active = structuredClone(workflow.activeVersion);
  const node = name => {
    const found = active.nodes.filter(n => n.name === name);
    requireThat(found.length === 1, 'PATCH_NODE_DRIFT', `Expected exactly one node: ${name}`);
    return found[0];
  };
  const beforeHash = hash({ nodes: active.nodes, connections: active.connections });
  const validate = node('Validate Saved Manual Draft Package');
  const originalCheck = "previous.some(x=>x.import_key===request.import_key&&x.state!=='abandoned')";
  requireThat(validate.parameters.jsCode.includes(originalCheck), 'PATCH_CODE_DRIFT', 'Existing duplicate guard differs from the inspected source.');
  validate.parameters.jsCode = `${code(captionIsInternalTest, hasExistingStoryHandoff)}\n` + validate.parameters.jsCode
    .replace(originalCheck, 'hasExistingStoryHandoff(previous,request.concept_id)')
    .replace("if(!archive)problems.push", "if(captionIsInternalTest(caption))problems.push('Internal test captions cannot be transferred.');\nif(!archive)problems.push");
  requireThat(validate.parameters.jsCode.includes('if(captionIsInternalTest(caption))'), 'PATCH_CODE_DRIFT', 'Caption gate insertion failed.');

  const create = node('Create One Unscheduled Buffer Draft');
  const credentials = create.credentials?.httpBearerAuth;
  requireThat(credentials, 'PATCH_CREDENTIAL_MAPPING', 'The existing Buffer Bearer credential mapping must be inspected.');
  const verify = node('Verify Unscheduled Buffer Draft');
  verify.parameters.jsCode = `${code(verifyDraftReadback)}
const v=$('Prepare Verified Buffer Draft Payload').first().json||{};
const candidate=$('Capture Buffer Candidate ID').first().json||{};
let payload={};try{payload=JSON.parse(v.buffer_request_json||'{}')}catch{}
const proof=verifyDraftReadback({id:candidate.candidate_buffer_id,channelId:payload.channelId,caption:v.caption,urls:(v.assets||[]).map(a=>a.image?.url)},$input.first().json||{});
return [{json:{...proof,concept_id:v.concept_id,review_token:v.review_token,import_key:v.import_key,buffer_id:proof.candidate_buffer_id,state:proof.verified?'draft_created':'review_needed',photo_count:v.expected_count}}];`;

  const add = (name, type, parameters, extra = {}) => {
    requireThat(!active.nodes.some(n => n.name === name), 'PATCH_NODE_DRIFT', 'Patch nodes already exist. Do not apply twice.');
    const id = `mi-${hash(name).slice(0, 20)}`;
    const n = { id, name, type, typeVersion: type.endsWith('.httpRequest') ? 4.2 : type.endsWith('.dataTable') ? 1 : type.endsWith('.if') ? 2.2 : 2,
      position: [create.position[0] + 240, create.position[1] + active.nodes.length * 10], parameters, ...extra };
    active.nodes.push(n);
  };
  add('Capture Buffer Candidate ID', 'n8n-nodes-base.code', { jsCode: `${code(unwrapBufferCreate, candidateBufferId)}
const v=$('Prepare Verified Buffer Draft Payload').first().json||{};
return [{json:{...v,candidate_buffer_id:candidateBufferId($input.first().json||{})}}];` });
  add('Has Buffer Candidate ID?', 'n8n-nodes-base.if', { conditions: { options: { typeValidation: 'strict', version: 2 }, conditions: [
    { id: 'has-candidate', leftValue: '={{ Boolean($json.candidate_buffer_id) }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
  ], combinator: 'and' }, options: {} });
  const record = structuredClone(node('Record Created Buffer Draft').parameters);
  record.columns.value = {
    state: 'review_needed', buffer_id: '={{ $json.candidate_buffer_id }}',
    details: 'Buffer returned an ID. Independent read-back is pending; do not retry creation.',
  };
  add('Persist Buffer Candidate Before Readback', 'n8n-nodes-base.dataTable', record, { onError: 'stopWorkflow' });
  const query = 'query VerifyDraft($id:PostId!){post(input:{id:$id}){id channelId status text dueAt sentAt assets{source}}}';
  add('Read Back Buffer Draft', 'n8n-nodes-base.httpRequest', {
    method: 'POST', url: 'https://api.buffer.com', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth',
    sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify({query:${JSON.stringify(query)},variables:{id:$('Capture Buffer Candidate ID').first().json.candidate_buffer_id}}) }}`,
    options: { timeout: 20000, redirect: { redirect: { followRedirects: false } } },
  }, { credentials: { httpBearerAuth: structuredClone(credentials) }, onError: 'continueErrorOutput', retryOnFail: false });
  active.connections[create.name] = { main: [[edge('Capture Buffer Candidate ID')], [edge('Manual Draft Transfer Needs Reconciliation')]] };
  active.connections['Capture Buffer Candidate ID'] = { main: [[edge('Has Buffer Candidate ID?')]] };
  active.connections['Has Buffer Candidate ID?'] = { main: [[edge('Persist Buffer Candidate Before Readback')], [edge('Manual Draft Transfer Needs Reconciliation')]] };
  active.connections['Persist Buffer Candidate Before Readback'] = { main: [[edge('Read Back Buffer Draft')]] };
  active.connections['Read Back Buffer Draft'] = { main: [[edge(verify.name)], [edge('Manual Draft Transfer Needs Reconciliation')]] };

  return {
    workflowId: workflow.id, expectedActiveVersionId: workflow.activeVersionId, expectedGraphSha256: beforeHash,
    afterGraphSha256: hash({ nodes: active.nodes, connections: active.connections }),
    // These are explicit release blockers, not an exactly-once claim based on read-then-insert rows.
    deployable: false,
    blockers: ['CENTRAL_ATOMIC_CLAIM_NOT_VERIFIED', 'LIVE_CREDENTIAL_MAPPING_TEST_REQUIRED', 'FOUNDER_APPROVAL_REQUIRED'],
    update: { name: workflow.name, nodes: active.nodes, connections: active.connections, settings: workflow.settings },
  };
}

export function prepareStudioFeedbackPatch(workflow) {
  requireThat(workflow.id === 'ecWr4PeKU4vKLQ1m' && workflow.activeVersion?.versionId === workflow.activeVersionId, 'PATCH_BASE_UNAVAILABLE', 'An active Studio snapshot is required.');
  const oldSaved = 'Buffer draft created. Images and caption were transferred, but nothing was scheduled or published.';
  const oldUncertain = 'Buffer returned an uncertain response. Check for an existing draft before retrying.';
  const replacements = [
    [oldSaved, 'Buffer confirmed a draft when this transfer ran. Check its current Buffer status before scheduling or sending again.'],
    [oldUncertain, 'Transfer needs reconciliation. Do not send again. Review the recorded Buffer ID and current post status first.'],
  ];
  const node = workflow.activeVersion.nodes.find(n => n.name === 'Build Editorial Dashboard HTML');
  requireThat(node, 'PATCH_NODE_DRIFT', 'Studio HTML node is missing.');
  let jsCode = node.parameters.jsCode;
  for (const [before, after] of replacements) {
    requireThat(jsCode.split(before).length === 2, 'PATCH_CODE_DRIFT', 'Studio feedback text changed since inspection.');
    jsCode = jsCode.replace(before, after);
  }
  return { workflowId: workflow.id, expectedActiveVersionId: workflow.activeVersionId,
    expectedCodeSha256: hash(node.parameters.jsCode), nodeName: node.name, jsCode,
    deployable: false, blockers: ['FOUNDER_APPROVAL_REQUIRED'] };
}
