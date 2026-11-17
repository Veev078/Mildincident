import {createHash} from 'node:crypto';
import {MAX_SOURCE_IMAGE_BYTES} from '../n8n/recorded-media-inspector.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {requireThat} from '../errors.js';
import {PROJECT_PAGE_HOSTS,projectPageReferences} from './project-sources.js';
import {photoDigest} from './native-contract.js';
import {photoFileKeys} from './story-intelligence.js';
import {readPublicSource} from './public-source-transport.js';
import {inspectPhotoSourceWindow} from '../editorial-evidence.js';

// Explicit publisher/CDN relationships, not an arbitrary image proxy. A mapping
// never authorizes a URL by itself: the exact URL must be in the retained page.
const CDN_HOSTS={
 'www.dazeddigital.com':['images-prod.dazeddigital.com'],
 'www.life.com':['static.life.com'],
 'life.com':['static.life.com'],
 'sophyrickett.com':['images.squarespace-cdn.com','static1.squarespace.com'],
 'www.sophyrickett.com':['images.squarespace-cdn.com','static1.squarespace.com'],
 'www.cheeriopublishing.com':['images.squarespace-cdn.com','static1.squarespace.com'],
 'www.climaxbooks.com':['cdn.shopify.com'],
 // Relationships observed on the retained Hase article/artwork, not guessed URLs.
 'www.artsy.net':['d7hftxdivxxvm.cloudfront.net','d32dm0rphc51dk.cloudfront.net'],
 'www.windowseat.ph':['www.gelitin.net','c1.staticflickr.com'],
 'windowseat.ph':['www.gelitin.net','c1.staticflickr.com'],
 'www.itsnicethat.com':['m.itsnicethat.com']
};
export function permittedSourceImage(sourceUrl,imageUrl,capture=null){
 if(!safePhotoReference(sourceUrl)||!safePhotoReference(imageUrl))return false;
 if(capture){
  if(capture.url!==sourceUrl||capture.networkFetched!==true||capture.basis!=='fetched_project_page'||typeof capture.html!=='string'||createHash('sha256').update(capture.html).digest('hex')!==capture.sha256)return false;
  try{let offset=0;do{const parsed=inspectPhotoSourceWindow(capture.html,capture.transport?.finalUrl||sourceUrl,{}, {offset});if(parsed.images.some(p=>p.url===imageUrl||p.referenceVariants?.includes(imageUrl)))return true;offset=parsed.coverage.nextOffset;}while(offset!==null&&offset<=10000);return false;}catch{return false;}
 }
 const source=new URL(sourceUrl).hostname,image=new URL(imageUrl).hostname;
 return PROJECT_PAGE_HOSTS.includes(source)&&(source===image||(CDN_HOSTS[source]||[]).includes(image));
}

/** One transport attempt, bounded streaming and no redirects/authentication. */
export async function readSourceImage(url,{fetchImpl=fetch,allowedRedirectUrls=[],...transportOptions}={}){
 let result;try{result=await readPublicSource(url,{...transportOptions,fetchImpl,allowedRedirectUrls,sameHostRedirects:false,accept:'image/jpeg,image/png,image/webp',maxBytes:MAX_SOURCE_IMAGE_BYTES,timeoutMs:15000,maxRedirects:2});}catch(error){if(error.code==='SOURCE_TOO_LARGE')error.code='SOURCE_IMAGE_TOO_LARGE';if(error.code==='SOURCE_SIZE_CHANGED')error.code='SOURCE_IMAGE_SIZE_CHANGED';throw error;}
 requireThat(['image/jpeg','image/png','image/webp'].includes(result.contentType),'INVALID_PREVIEW_TYPE','The source did not return a supported still image.');return result;
}

/** Re-derive one candidate from its captured bytes before touching the network. */
export async function acquireReceiptImage({story,request,photo,store,existingAssetId=null,fetchImpl=fetch,assertCurrent=()=>{}}){
 const capture=request.sourceCaptures?.find(c=>c.url===photo.sourceUrl);
 requireThat(request.packet.payload.target.storyId===story.id&&photoDigest(request.packet.payload)===request.packet.digest&&request.receipt?.inputDigest===request.packet.digest&&capture?.networkFetched===true&&capture.basis==='fetched_project_page'&&createHash('sha256').update(capture.html).digest('hex')===capture.sha256,'INVALID_PREVIEW_SOURCE','Use an intact, network-captured page from this request.');
 const embedded=projectPageReferences(story,{url:capture.url,html:capture.html,direction:request.plan?.direction||'best',cursor:capture.extractionInputCursor||null,transport:capture.transport}).photos.find(p=>p.id===photo.id&&p.previewUrl===photo.previewUrl);
 const existing=existingAssetId&&story.media?.find(a=>a.id===existingAssetId&&photoFileKeys(a).some(k=>photoFileKeys(photo).includes(k)));
 const universal=request.packet.payload.sourceConnectionPolicy==='evidence_bound_public_v1';
 requireThat(embedded&&(existing||request.displayPhotoIds.includes(photo.id))&&(universal||permittedSourceImage(capture.url,photo.previewUrl)),'PHOTO_IMAGE_NOT_BOUND','The exact image must be embedded in this request’s intact network-captured project page.');
 const assetId=existing?existing.id:'photo:'+photoDigest({requestId:request.id,photoId:photo.id}).slice(0,32);
 requireThat(!store.get(story.id,assetId),'EDIT_CONFLICT','An existing private preview must not be replaced by automatic retrieval.');
 assertCurrent();const {bytes,contentType,transport}=await readSourceImage(photo.previewUrl,{fetchImpl,allowedRedirectUrls:embedded.referenceVariants||[photo.previewUrl]});assertCurrent();
 const preview=await store.save({storyId:story.id,assetId,bytes,contentType,originalName:'source-photo',declaration:'private_review_only',onlyIfAbsent:true});
 store.recordPhotoSourceAcquisition(story.id,assetId,preview.sha256,{sourceUrl:capture.url,imageUrl:photo.previewUrl,requestId:request.id,inputDigest:request.packet.digest,pageSha256:capture.sha256});
 return {assetId,preview,bytes:bytes.length,contentType,transport,visualAnalysisPerformed:false,rightsGranted:false};
}
