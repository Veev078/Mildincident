import {randomUUID} from 'node:crypto';
import {resolveRecordedMedia,MAX_SOURCE_IMAGE_BYTES} from '../n8n/recorded-media-inspector.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {requireThat,HandoffError} from '../errors.js';

/** Operator-only acquisition of one recorded same-host asset; never a browser URL proxy. */
export async function cacheRecordedImage({rows,scope,sourceExecutionId,policy,store,fetchImpl=fetch}){
 const recorded=resolveRecordedMedia(rows,scope,safePhotoReference,true),host=new URL(recorded.url).hostname,sourceHost=new URL(recorded.source_page_url).hostname;
 requireThat(/^\d{1,30}$/.test(sourceExecutionId),'INVALID_PREVIEW_SOURCE','Original execution identity is required.');
 const network=policy?.http_network_policy;
 requireThat(policy?.version===1&&(network?.type==='unrestricted'||network?.type==='restricted'&&[host,sourceHost].every(h=>network.egress_rules?.some(r=>r.host===h))),'SOURCE_HOST_NOT_ALLOWED','The recorded image or source-page host is absent from the supported network policy. No request was sent.');
 let response;try{response=await fetchImpl(recorded.url,{method:'GET',headers:{Accept:'image/jpeg,image/png,image/webp'},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new HandoffError('SOURCE_CONNECTION_FAILED','The recorded source could not be reached; no retry or alternative proxy was used.');}
 const check=async(condition,code,message)=>{if(!condition){await response.body?.cancel().catch(()=>{});throw new HandoffError(code,message);}};
 await check(response.status===200,'SOURCE_HTTP_'+response.status,'Recorded image returned HTTP '+response.status+'.');
 const contentType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(),declared=response.headers.get('content-length');
 await check(['image/jpeg','image/png','image/webp'].includes(contentType),'INVALID_PREVIEW_TYPE','Source did not return a supported still image.');
 await check(!declared||/^\d+$/.test(declared)&&Number(declared)>0&&Number(declared)<=MAX_SOURCE_IMAGE_BYTES,'SOURCE_IMAGE_TOO_LARGE','Recorded image exceeds the bounded acquisition limit.');
 const reader=response.body?.getReader();requireThat(reader,'SOURCE_IMAGE_EMPTY','No image body was returned.');const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;requireThat(size<=MAX_SOURCE_IMAGE_BYTES,'SOURCE_IMAGE_TOO_LARGE','Recorded image exceeded the streaming limit.');chunks.push(Buffer.from(value));}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 requireThat(size>0&&(!declared||size===Number(declared)),'SOURCE_IMAGE_SIZE_CHANGED','Recorded image length differs from its declaration.');
 const storyId='CON-DEV-'+scope.job_id,preview=await store.save({storyId,assetId:scope.asset_id,bytes:Buffer.concat(chunks),contentType,originalName:'recorded-source-image',declaration:'private_review_only'}),receiptId=randomUUID();
 const saved=store.recordSourceAcquisition(storyId,scope.asset_id,preview.sha256,{sourceUrl:recorded.source_page_url,imageUrl:recorded.url,sourceExecutionId,receiptId});
 return {status:'decoded_source_copy',storyId,assetId:scope.asset_id,receiptId,retrievedAt:new Date().toISOString(),sourceExecutionId,sourceUrl:recorded.source_page_url,imageUrl:recorded.url,bytes:size,contentType,preview:saved,visualInspectionPerformed:false,identityVerified:false,rightsGranted:false};
}
