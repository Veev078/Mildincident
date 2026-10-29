import {requireThat} from '../errors.js';
export function validateDevelopmentDispatch() {
  const body=$input.first().json.body;
  if(!body || Object.keys(body).some(k=>!['job_id','request_hash','dispatch_id'].includes(k)))throw new Error('INVALID_DEVELOPMENT_DISPATCH');
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  if(!uuid.test(body.job_id)||!uuid.test(body.dispatch_id)||!/^[a-f0-9]{64}$/.test(body.request_hash))throw new Error('INVALID_DEVELOPMENT_DISPATCH');
  return [{json:{job_id:body.job_id,request_hash:body.request_hash,dispatch_id:body.dispatch_id}}];
}
export function buildLeaseNodes({tableId,credentialId,credentialName,path='mildincident-dev-lease-check-v1'}) {
  requireThat([tableId,credentialId].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(v)),'DEV_CONNECTION_REQUIRED','Known development table/credential identities are required.');
  requireThat(['mildincident-dev-lease-check-v1','mildincident-dev-editorial-job-v1'].includes(path),'INVALID_DEV_ENDPOINT','Unknown development endpoint.');
  return [
    {id:'development-job-webhook',name:'Development Job Request',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],webhookId:path,parameters:{httpMethod:'POST',path,authentication:'headerAuth',responseMode:'responseNode',options:{}},credentials:{httpHeaderAuth:{id:credentialId,name:credentialName}}},
    {id:'validate-development-job',name:'Validate Development Dispatch',type:'n8n-nodes-base.code',typeVersion:2,position:[250,0],parameters:{jsCode:`return (${validateDevelopmentDispatch.toString()})();`}},
    {id:'claim-development-job',name:'Claim Queued Development Job',type:'n8n-nodes-base.dataTable',typeVersion:1,position:[500,0],alwaysOutputData:true,parameters:{resource:'row',operation:'update',dataTableId:{__rl:true,mode:'id',value:tableId},matchType:'allConditions',filters:{conditions:[
      {keyName:'job_id',condition:'eq',keyValue:"={{ $('Validate Development Dispatch').first().json.job_id }}"},
      {keyName:'request_hash',condition:'eq',keyValue:"={{ $('Validate Development Dispatch').first().json.request_hash }}"},
      {keyName:'status',condition:'eq',keyValue:'queued'}]},columns:{mappingMode:'defineBelow',value:{status:'generating',lease_token:"={{ $('Validate Development Dispatch').first().json.dispatch_id }}",execution_id:'={{ $execution.id }}'}},options:{}}}
  ];
}
export function buildLeaseCheckRunner(input) {
  const nodes=buildLeaseNodes(input);nodes.push({id:'return-lease-result',name:'Return Lease Result',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[750,0],parameters:{respondWith:'json',responseBody:'={{ { scope: "development_only", claimed: $json.lease_token === $("Validate Development Dispatch").first().json.dispatch_id && $json.status === "generating", jobId: $("Validate Development Dispatch").first().json.job_id, executionId: $execution.id, paidCalls: 0 } }}',options:{}}});
  const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
  return {name:'MILDINCIDENT DEV — isolated job lease check',nodes,connections,settings:{executionOrder:'v1',executionTimeout:120}};
}
