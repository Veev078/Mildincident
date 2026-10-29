import {requireThat} from '../errors.js';
/** No AI or writable nodes. Same read chain as the development worker, one query per context table. */
export function buildContextReadCheck({worker,credentialId,credentialName}) {
  requireThat(worker?.name==='MILDINCIDENT DEV — bounded editorial generation'&&worker.active===false,'NOT_DEVELOPMENT_SANDBOX','Use the inactive development worker.');
  const readers=structuredClone(worker.nodes.filter(n=>n.type==='n8n-nodes-base.dataTable'&&n.parameters.operation==='get'));
  requireThat(readers.length===9&&readers.every(n=>n.executeOnce===true),'CONTEXT_READER_DRIFT','Nine execute-once readers are required.');
  const nodes=[{id:'context-check',name:'Authenticated Context Check',type:'n8n-nodes-base.webhook',typeVersion:2,webhookId:'mildincident-dev-context-read-v1',position:[0,0],parameters:{httpMethod:'POST',path:'mildincident-dev-context-read-v1',authentication:'headerAuth',responseMode:'responseNode',options:{}},credentials:{httpHeaderAuth:{id:credentialId,name:credentialName}}},...readers,
    {id:'context-summary',name:'Context Counts',type:'n8n-nodes-base.code',typeVersion:2,position:[2500,0],parameters:{jsCode:`return [{json:{scope:'development_read_check',paidCalls:0,counts:${JSON.stringify(readers.map(n=>n.name))}.map(name=>({name,items:$(name).all().length}))}}];`}},
    {id:'context-response',name:'Return Context Counts',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[2750,0],parameters:{respondWith:'json',responseBody:'={{ $json }}',options:{}}}];
  const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
  return {name:'MILDINCIDENT DEV — context read verification',nodes,connections,settings:{executionOrder:'v1',executionTimeout:120}};
}
