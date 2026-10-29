import { createHash } from 'node:crypto';
import { preparePhotoGuardPatch } from './photo-url-guard.js';
import { requireThat } from '../errors.js';

/** Generated workflow contains supplied metadata: keep it private. No writes, downloads or paid calls. */
export function buildPhotoReviewSandbox({ workflow, story, media }) {
  requireThat(workflow.activeVersionId && workflow.activeVersion?.nodes && story?.concept_id && Array.isArray(media), 'SANDBOX_INPUT_REQUIRED', 'Capture the active workflow and one existing source story.');
  const active = { ...workflow, ...workflow.activeVersion, versionId: workflow.activeVersionId };
  const qualifier = active.nodes.find(n => n.name === 'Broaden — Qualify Cross-Source Preview Leads');
  requireThat(qualifier?.parameters?.jsCode, 'NODE_DRIFT', 'Active photo qualifier is missing.');
  const patched = preparePhotoGuardPatch(active, { expectedVersion: active.versionId, expectedCodeHash: createHash('sha256').update(qualifier.parameters.jsCode).digest('hex') });
  const leads = media.filter(m=>m.concept_id===story.concept_id && m.provider==='brave_image_reference').slice(0,7).map(m=>{
    const dims=String(m.notes||'').match(/Search-reported dimensions (\d+)x(\d+)/);
    return {url:m.source_page_url||'',thumbnail:{src:m.thumb_url||''},title:m.title||'',properties:{
      url:m.file_url||String(m.notes||'').match(/Image original reference: (https:\/\/\S+?)\. Original page:/)?.[1]||'',
      width:Number(m.width||dims?.[1]||0),height:Number(m.height||dims?.[2]||0)}};
  });
  const values=[['Get Concept',[{json:{concept_id:story.concept_id,title:story.title||'',subject:story.subject||''}}]],
    ['Broaden — Build Independent Image Query',[{json:{photo_focus:'striking'}}]],
    ['Broaden — Read Existing Story Photos',[{json:{}}]],['Bounded Existing References',[{json:{results:leads}}]]];
  const nodes=[{id:'manual',name:'Manual reference replay',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},
    ...values.map(([name,value],i)=>({id:`input-${i}`,name,type:'n8n-nodes-base.code',typeVersion:2,position:[(i+1)*250,0],parameters:{jsCode:`return ${JSON.stringify(value)};`}})),
    {id:'qualifier',name:qualifier.name,type:'n8n-nodes-base.code',typeVersion:2,position:[1250,0],parameters:{jsCode:patched.workflow.nodes.find(n=>n.name===qualifier.name).parameters.jsCode}}];
  const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
  return {workflow:{name:'MILDINCIDENT DEV — bounded photo reference replay',nodes,connections,settings:{executionOrder:'v1'}},review:{
    sourceActiveVersion:active.versionId,sourceSavedVersion:workflow.versionId,actualStoryId:story.concept_id,referenceCount:leads.length,
    productionWrites:0,paidCalls:0,downloads:0,publishingNodes:0,activationAllowed:false,note:'Metadata replay; no pixel, URL accessibility or rights verification.'}};
}
