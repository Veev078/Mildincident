import {requireThat} from '../errors.js';
import {graphProjection,publishingGraphSha} from './buffer-handoff-security.js';

/** Strengthen the existing media staging route: verify actual public bytes,
 * rather than treating a successful HEAD as delivery of the approved JPEG. */
export function prepareVerifiedBufferStaging(workflow){
 requireThat(workflow.id==='f0LkxPxzvqh3zyUQ'&&workflow.active&&workflow.versionId===workflow.activeVersionId,'PUBLISHING_BASE_CHANGED','Capture matching active media-staging versions.');
 const w=structuredClone(graphProjection(workflow)),head=w.nodes.find(n=>n.name==='Stage Verify Cloudinary Public HEAD'),record=w.nodes.find(n=>n.name==='Stage Prepare Verified Public Record');
 requireThat(head?.parameters.method==='HEAD'&&record&&w.connections[head.name]?.main?.[0]?.[0]?.node===record.name,'STAGING_PATH_CHANGED','The existing staging delivery path changed.');
 head.parameters={...head.parameters,method:'GET',options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,responseFormat:'file',outputPropertyName:'data'}}}};
 const hash={id:'mi-staging-public-byte-hash',name:'Hash Actual Public Buffer JPEG',type:'n8n-nodes-base.crypto',typeVersion:1,position:[head.position[0]+200,head.position[1]],retryOnFail:false,parameters:{action:'hash',type:'SHA256',binaryData:true,binaryPropertyName:'data',dataPropertyName:'public_sha256',encoding:'hex'}};
 w.nodes.push(hash);w.connections[head.name]={main:[[{node:hash.name,type:'main',index:0}]]};w.connections[hash.name]={main:[[{node:record.name,type:'main',index:0}]]};
 record.parameters.jsCode="const hash=$input.first().json.public_sha256,r=$('Stage Verify Cloudinary Public HEAD').item.json||{},f=$('Stage Validate Cloudinary Upload').item.json||{};if(Number(r.statusCode)!==200||!String(r.headers?.['content-type']||'').startsWith('image/jpeg')||hash!==f.expected_sha256||Number(r.headers?.['content-length']||0)!==Number(f.expected_bytes))throw Error('STAGING_BLOCKED: public JPEG bytes differ from the approved private file');return [{json:{concept_id:f.concept_id,package_version:f.package_version,render_batch_id:f.render_batch_id,slide_number:f.slide_number,file_record_id:f.file_record_id,checksum_sha256:hash,public_image_url:f.public_image_url,verification_status:'public_file_verified',verified_date:new Date().toISOString()}}];";
 return {workflowId:workflow.id,expectedVersion:workflow.versionId,expectedSha256:publishingGraphSha(workflow),update:w,review:{graphSha256:publishingGraphSha(w),changedNodes:[head.name,hash.name,record.name],providerCredentialsChanged:false,liveApplied:false}};
}
