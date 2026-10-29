import {requireThat} from '../errors.js';
export const PHOTO_RUNNER_PATH='mildincident-dev-photo-replay-v1';

/** Authenticated development-only bridge; no schedules or browser credentials. */
export function buildDevelopmentRunner({sandboxId,credentialId,credentialName,sandbox}) {
  requireThat([sandboxId,credentialId].every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(id)), 'DEV_CONNECTION_REQUIRED','Provide the known sandbox and development header credential identities.');
  requireThat(sandbox?.id===sandboxId && sandbox.active===false && sandbox.name==='MILDINCIDENT DEV — bounded photo reference replay', 'NOT_DEVELOPMENT_SANDBOX', 'Use the captured inactive development sandbox.');
  const codeNodes=structuredClone(sandbox.nodes.filter(n=>n.type==='n8n-nodes-base.code'));
  requireThat(codeNodes.length===5 && codeNodes.every(n=>!n.credentials), 'UNSAFE_SANDBOX', 'Expected five credential-free replay Code nodes.');
  const nodes=[{id:'authenticated-request',name:'Authenticated development request',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],webhookId:PHOTO_RUNNER_PATH,parameters:{httpMethod:'POST',path:PHOTO_RUNNER_PATH,authentication:'headerAuth',responseMode:'responseNode',options:{}},credentials:{httpHeaderAuth:{id:credentialId,name:credentialName}}},
    ...codeNodes,
    {id:'return-review',name:'Return development replay',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[1600,0],parameters:{respondWith:'json',responseBody:'={{ { scope: "development_only", productionApplied: false, publishingEnabled: false, references: $input.all().map(i => i.json) } }}',options:{}}}];
  const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
  return {name:'MILDINCIDENT DEV — authenticated photo replay runner',nodes,connections,settings:{executionOrder:'v1',executionTimeout:120}};
}

/** Add subworkflow entry to a development artifact only. Preserve the inactive manual replay. */
export function enableSandboxSubworkflowEntry(workflow) {
  requireThat(workflow?.active===false&&workflow.name==='MILDINCIDENT DEV — bounded photo reference replay','NOT_DEVELOPMENT_SANDBOX','Only the known inactive development sandbox can be adapted.');
  const output=structuredClone(workflow);
  requireThat(output.nodes.every(n=>['n8n-nodes-base.manualTrigger','n8n-nodes-base.code','n8n-nodes-base.executeWorkflowTrigger'].includes(n.type)),'UNSAFE_SANDBOX','Unexpected node in the development sandbox.');
  if(!output.nodes.some(n=>n.name==='Development subworkflow entry')) {
    output.nodes.push({id:'development-subworkflow-entry',name:'Development subworkflow entry',type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,position:[0,200],parameters:{inputSource:'passthrough'}});
    output.connections['Development subworkflow entry']={main:[[{node:'Get Concept',type:'main',index:0}]]};
  }
  return {name:output.name,nodes:output.nodes,connections:output.connections,settings:{executionOrder:'v1',executionTimeout:120}};
}
