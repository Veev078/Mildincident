import {requireThat} from '../errors.js';import {safePhotoReference} from './photo-url-guard.js';
export const MEDIA_INSPECTION_PATH='mildincident-dev-recorded-media-v1';
export const MAX_SOURCE_IMAGE_BYTES=8*1024*1024;
export function resolveRecordedMedia(rows,scope,publicReference){
  if(rows.length!==1)throw new Error('AMBIGUOUS_RECORDED_CANDIDATE');let candidate;try{candidate=JSON.parse(rows[0].candidate_json);}catch{throw new Error('INVALID_RECORDED_CANDIDATE');}
  if(candidate.jobId!==scope.job_id)throw new Error('MEDIA_SCOPE_MISMATCH');
  const matches=(candidate.media||[]).filter(m=>m.asset_id===scope.asset_id);if(matches.length!==1)throw new Error('MEDIA_NOT_RECORDED');
  const m=matches[0];const url=publicReference(m.thumb_url);const source=publicReference(m.source_page_url);const host=s=>(s.match(/^https:\/\/([^/:?#]+)/i)||[])[1]?.replace(/^www\./,'').toLowerCase();
  if(!url||!source||host(url)!==host(source))throw new Error('SOURCE_IMAGE_HOST_NOT_VERIFIED');
  return {job_id:scope.job_id,asset_id:scope.asset_id,url,source_page_url:source};
}
export function validateImageHead(response,maximum){
 const headers=Object.fromEntries(Object.entries(response.headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));const type=(headers['content-type']||'').split(';')[0].trim().toLowerCase();const length=/^\d+$/.test(headers['content-length']||'')?Number(headers['content-length']):0;
 if(response.statusCode!==200||!['image/jpeg','image/png','image/webp'].includes(type)||!length||length>maximum)throw new Error('SOURCE_IMAGE_NOT_BOUNDED_STILL');return {contentType:type,expectedBytes:length};
}
export function buildRecordedMediaInspector({candidatesTableId,credentialId,credentialName}){
 requireThat([candidatesTableId,credentialId].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(x)),'DEV_CONNECTION_REQUIRED','Known development identities are required.');
 const code=(name,jsCode)=>({id:name.toLowerCase().replace(/\W+/g,'-'),name,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{jsCode}});
 const nodes=[{id:'recorded-media-webhook',name:'Recorded Media Inspection',type:'n8n-nodes-base.webhook',typeVersion:2,position:[0,0],webhookId:MEDIA_INSPECTION_PATH,parameters:{httpMethod:'POST',path:MEDIA_INSPECTION_PATH,authentication:'headerAuth',responseMode:'responseNode',options:{}},credentials:{httpHeaderAuth:{id:credentialId,name:credentialName}}},
  code('Validate Recorded Scope',`const body=$input.first().json.body;const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;if(!body||Object.keys(body).some(k=>!['job_id','asset_id'].includes(k))||!uuid.test(body.job_id)||typeof body.asset_id!=='string'||!/^[A-Za-z0-9_.:-]{1,300}$/.test(body.asset_id))throw new Error('INVALID_RECORDED_MEDIA_SCOPE');return [{json:body}];`),
  {id:'read-recorded-candidate',name:'Read Recorded Development Candidate',type:'n8n-nodes-base.dataTable',typeVersion:1,position:[0,0],alwaysOutputData:true,parameters:{resource:'row',operation:'get',dataTableId:{__rl:true,mode:'id',value:candidatesTableId},matchType:'allConditions',filters:{conditions:[{keyName:'job_id',condition:'eq',keyValue:"={{ $('Validate Recorded Scope').first().json.job_id }}"}]},limit:2}},
  code('Resolve Recorded Image',`const safe=${safePhotoReference.toString()};return [{json:(${resolveRecordedMedia.toString()})($input.all().map(i=>i.json).filter(j=>j.job_id),$('Validate Recorded Scope').first().json,safe)}];`),
  {id:'head-recorded-image',name:'Check Recorded Image Headers',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[0,0],parameters:{method:'HEAD',url:'={{ $json.url }}',authentication:'none',options:{timeout:10000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'text',outputPropertyName:'body'}}}}},
  code('Validate Bounded Image',`const measured=(${validateImageHead.toString()})($input.first().json,${MAX_SOURCE_IMAGE_BYTES});return [{json:{...$('Resolve Recorded Image').first().json,...measured}}];`),
  {id:'get-recorded-image',name:'Read One Recorded Image',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[0,0],parameters:{method:'GET',url:'={{ $json.url }}',authentication:'none',sendHeaders:true,headerParameters:{parameters:[{name:'Accept',value:'image/jpeg,image/png,image/webp'},{name:'User-Agent',value:'MILDINCIDENT-private-recorded-source-review/1.0'}]},options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'file',outputPropertyName:'data'}}}}},
  code('Return Bounded Source Bytes',`const scope=$('Validate Bounded Image').first().json;const bytes=await this.helpers.getBinaryDataBuffer(0,'data');if(bytes.length!==scope.expectedBytes||bytes.length>${MAX_SOURCE_IMAGE_BYTES})throw new Error('SOURCE_IMAGE_SIZE_CHANGED');return [{json:{scope:'private_source_review',jobId:scope.job_id,assetId:scope.asset_id,sourceUrl:scope.source_page_url,imageUrl:scope.url,contentType:scope.contentType,bytes:bytes.length,base64:bytes.toString('base64'),rightsGranted:false,identityVerified:false}}];`),
  {id:'return-recorded-image',name:'Recorded Image Response',type:'n8n-nodes-base.respondToWebhook',typeVersion:1.4,position:[0,0],parameters:{respondWith:'json',responseBody:'={{ $json }}',options:{}}}];
 const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};nodes.forEach((n,i)=>{n.position=[i*250,0];});
 return {name:'MILDINCIDENT DEV — recorded source image inspection',nodes,connections,settings:{executionOrder:'v1',executionTimeout:90}};
}
