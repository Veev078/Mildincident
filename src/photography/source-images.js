import {createHash} from 'node:crypto';
import {MAX_SOURCE_IMAGE_BYTES} from '../n8n/recorded-media-inspector.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {requireThat} from '../errors.js';
import {PROJECT_PAGE_HOSTS,projectPageReferences} from './project-sources.js';
import {photoDigest} from './native-contract.js';
import {photoFileKeys} from './story-intelligence.js';

// Explicit publisher/CDN relationships, not an arbitrary image proxy. A mapping
// never authorizes a URL by itself: the exact URL must be in the retained page.
const CDN_HOSTS={
 'www.dazeddigital.com':['images-prod.dazeddigital.com'],
 'www.life.com':['static.life.com'],
 'life.com':['static.life.com'],
 'sophyrickett.com':['images.squarespace-cdn.com','static1.squarespace.com'],
 'www.sophyrickett.com':['images.squarespace-cdn.com','static1.squarespace.com'],
 'www.cheeriopublishing.com':['images.squarespace-cdn.com','static1.squarespace.com'],
 'www.climaxbooks.com':['cdn.shopify.com']
};
export function permittedSourceImage(sourceUrl,imageUrl){
 if(!safePhotoReference(sourceUrl)||!safePhotoReference(imageUrl))return false;
 const source=new URL(sourceUrl).hostname,image=new URL(imageUrl).hostname;
 return PROJECT_PAGE_HOSTS.includes(source)&&(source===image||(CDN_HOSTS[source]||[]).includes(image));
}

/** One transport attempt, bounded streaming and no redirects/authentication. */
export async function readSourceImage(url,{fetchImpl=fetch}={}){
 const response=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'image/jpeg,image/png,image/webp'},signal:AbortSignal.timeout(15000)});
 try{
  requireThat(response.status===200,'SOURCE_HTTP_'+response.status,'The source image was unavailable.');
  const contentType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(),declared=response.headers.get('content-length');
  requireThat(['image/jpeg','image/png','image/webp'].includes(contentType),'INVALID_PREVIEW_TYPE','The source did not return a supported still image.');
  requireThat(!declared||/^\d+$/.test(declared)&&Number(declared)>0&&Number(declared)<=MAX_SOURCE_IMAGE_BYTES,'SOURCE_IMAGE_TOO_LARGE','The source image exceeds the acquisition limit.');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;requireThat(size<=MAX_SOURCE_IMAGE_BYTES,'SOURCE_IMAGE_TOO_LARGE','The source image exceeded the streaming limit.');chunks.push(chunk);}
  requireThat(size>0&&(!declared||size===Number(declared)),'SOURCE_IMAGE_SIZE_CHANGED','The source image length changed.');
  return {bytes:Buffer.concat(chunks),contentType};
 }finally{await response.body?.cancel().catch(()=>{});}
}

/** Re-derive one candidate from its captured bytes before touching the network. */
export async function acquireReceiptImage({story,request,photo,store,existingAssetId=null,fetchImpl=fetch,assertCurrent=()=>{}}){
 const capture=request.sourceCaptures?.find(c=>c.url===photo.sourceUrl);
 requireThat(request.packet.payload.target.storyId===story.id&&photoDigest(request.packet.payload)===request.packet.digest&&request.receipt?.inputDigest===request.packet.digest&&capture?.networkFetched===true&&capture.basis==='fetched_project_page'&&createHash('sha256').update(capture.html).digest('hex')===capture.sha256,'INVALID_PREVIEW_SOURCE','Use an intact, network-captured page from this request.');
 const embedded=projectPageReferences(story,{url:capture.url,html:capture.html}).photos.find(p=>p.id===photo.id&&p.previewUrl===photo.previewUrl);
 const existing=existingAssetId&&story.media?.find(a=>a.id===existingAssetId&&photoFileKeys(a).some(k=>photoFileKeys(photo).includes(k)));
 requireThat(embedded&&(existing||request.displayPhotoIds.includes(photo.id))&&permittedSourceImage(capture.url,photo.previewUrl),'PHOTO_IMAGE_NOT_BOUND','The image must be embedded in this captured project page and use its supported image host.');
 const assetId=existing?existing.id:'photo:'+photoDigest({requestId:request.id,photoId:photo.id}).slice(0,32);
 requireThat(!store.get(story.id,assetId),'EDIT_CONFLICT','An existing private preview must not be replaced by automatic retrieval.');
 assertCurrent();const {bytes,contentType}=await readSourceImage(photo.previewUrl,{fetchImpl});assertCurrent();
 const preview=await store.save({storyId:story.id,assetId,bytes,contentType,originalName:'source-photo',declaration:'private_review_only',onlyIfAbsent:true});
 store.recordPhotoSourceAcquisition(story.id,assetId,preview.sha256,{sourceUrl:capture.url,imageUrl:photo.previewUrl,requestId:request.id,inputDigest:request.packet.digest,pageSha256:capture.sha256});
 return {assetId,preview,bytes:bytes.length,contentType,visualAnalysisPerformed:false,rightsGranted:false};
}
