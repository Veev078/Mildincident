import {createHash} from 'node:crypto';
import {requireThat} from '../errors.js';

export const GUARDED_BUFFER_ID='Q02tRHMtZ90Kib18';
export const graphProjection=w=>Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,w[k]]));
export const publishingGraphSha=w=>createHash('sha256').update(JSON.stringify(graphProjection(w))).digest('hex');
export function bindPublishingCredential(reviewed,credentialId,expectedSha256){
 requireThat(publishingGraphSha(reviewed)===expectedSha256,'PUBLISHING_BASE_CHANGED','The reviewed credential-binding template differs.');
 requireThat(typeof credentialId==='string'&&/^[A-Za-z0-9_-]{5,100}$/.test(credentialId)&&!credentialId.startsWith('__'),'INVALID_PUBLISHING_CREDENTIAL','Bind only the separately approved new native credential ID.');
 const update=structuredClone(reviewed),nodes=update.nodes.filter(n=>n.credentials?.jwtAuth?.id==='__APPROVED_PUBLISHING_JWT_CREDENTIAL__');
 requireThat(nodes.length===1,'PUBLISHING_CREDENTIAL_BINDING_CHANGED','Exactly one reviewed JWT credential reference is required.');
 nodes[0].credentials.jwtAuth.id=credentialId;
 const restored=structuredClone(update);restored.nodes.find(n=>n.name===nodes[0].name).credentials.jwtAuth.id='__APPROVED_PUBLISHING_JWT_CREDENTIAL__';
 requireThat(publishingGraphSha(restored)===publishingGraphSha(reviewed),'PUBLISHING_CREDENTIAL_BINDING_CHANGED','No logic, settings or provider credential change is allowed.');
 return {update,graphSha256:publishingGraphSha(update),changedPath:'nodes['+nodes[0].name+'].credentials.jwtAuth.id'};
}
function currentSecret(workflow){
 const node=workflow.nodes?.find(n=>n.name==='Buffer Normalize Handoff');
 const values=[...(node?.parameters?.jsCode||'').matchAll(/['"]([a-f0-9]{64})['"]/g)].map(m=>m[1]);
 requireThat(workflow.id===GUARDED_BUFFER_ID&&values.length===1,'HANDOFF_SECRET_SCOPE_CHANGED','The private handoff authentication must be inspected again; no value is reported.');
 return values[0];
}

/** Reports locations only. Never returns a credential or its fingerprint. */
export function internalHandoffExposure(workflows){
 const target=workflows.find(w=>w.id===GUARDED_BUFFER_ID),secret=currentSecret(target||{}),references=[];
 for(const w of workflows)for(const [scope,graph]of [['saved',w],['active',w.activeVersion||w]])for(const n of graph.nodes||[])if(JSON.stringify(n.parameters||{}).includes(secret))references.push({workflowId:w.id,scope,node:n.name});
 return {workflowCount:workflows.length,references,affectedWorkflowIds:[...new Set(references.map(r=>r.workflowId))],secretDisclosed:false};
}

/** Preferred coordinated repair: revoke the exposed static value entirely.
 * The existing coordinator still calls the same internal trigger. Public callers
 * cannot imitate that trigger by copying an old token or an input flag. */
export function prepareInternalHandoffRetirement(workflow){
 const old=currentSecret(workflow),update=structuredClone(graphProjection(workflow));
 requireThat(workflow.active&&workflow.versionId===workflow.activeVersionId,'PUBLISHING_BASE_CHANGED','Capture matching saved/active versions.');
 const normalize=update.nodes.find(n=>n.name==='Buffer Normalize Handoff'),validate=update.nodes.find(n=>n.name==='Buffer Validate Approved Package');
 const mark="if(raw.request_kind==='mildincident_finalize_v1'){";
 requireThat(normalize.parameters.jsCode.split(mark).length===2&&normalize.parameters.jsCode.includes("handoff_token:'"+old+"'"),'HANDOFF_SECRET_SCOPE_CHANGED','The existing internal authentication format changed.');
 normalize.parameters.jsCode=normalize.parameters.jsCode.replace(mark,mark+"let trusted=false;try{trusted=$('Internal Buffer Release Handoff').isExecuted===true;}catch{}if(!trusted)throw Error('BUFFER_INTERNAL_TRIGGER_REQUIRED');").replace(",handoff_token:'"+old+"'",'');
 const block="const expected='"+old+"',supplied=String(body.handoff_token||'');\nlet bad=expected.length===supplied.length?0:1;\nif(!bad)for(let i=0;i<expected.length;i++)bad|=expected.charCodeAt(i)^supplied.charCodeAt(i);\nif(bad||body.confirm!=='CREATE_BUFFER_DRAFT')errors.push('Invalid founder confirmation');";
 requireThat(validate.parameters.jsCode.split(block).length===2,'HANDOFF_SECRET_SCOPE_CHANGED','The existing private authentication check changed.');
 validate.parameters.jsCode=validate.parameters.jsCode.replace(block,"let trustedInternal=false;try{trustedInternal=$('Internal Buffer Release Handoff').isExecuted===true;}catch{}if(!trustedInternal||req.internal_handoff!==true||body.confirm!=='CREATE_BUFFER_DRAFT')errors.push('Invalid founder confirmation');");
 requireThat(!JSON.stringify(update).includes(old),'HANDOFF_SECRET_SCOPE_CHANGED','A private authentication dependency was not retired.');
 return {workflowId:workflow.id,expectedVersion:workflow.versionId,expectedSha256:publishingGraphSha(workflow),update,review:{graphSha256:publishingGraphSha(update),changedNodes:[normalize.name,validate.name],exposedValueRevoked:true,existingInternalCoordinatorPreserved:true,providerCredentialsChanged:false,liveApplied:false}};
}
