import sharp from 'sharp';
import {sha256} from '../package.js';

// File/permission evidence only. A URL, upload or license-like title never grants rights.
export async function finishPhotoEvidence(story,previews){
 const ids=story.localDraft?.selectedAssetIds??story.selectedAssetIds??[],issues=[],verified=[];
 for(const [index,id]of ids.entries()){
  const matches=(story.media||[]).filter(a=>a.id===id),a=matches[0],slide=index+1;
  const add=(code,message)=>issues.push({code,assetId:id,slide,message,action:'replace_photo'});
  if(matches.length!==1){add('PHOTO_IDENTITY_REQUIRED',`Slide ${slide} no longer has one matching photograph. Choose a replacement.`);continue;}
  if(a.nativeRightsReview?.reviewed!==true||!a.nativeRightsReview.evidenceUrl){add('PHOTO_USAGE_REQUIRED',`Slide ${slide} has no verified usage basis. Choose a cleared replacement or supply valid usage evidence with its source.`);continue;}
  if(!(a.attribution||a.sourceCredit)?.trim()||!a.sourceUrl){add('PHOTO_CREDIT_REQUIRED',`Slide ${slide} needs its original source and required credit before delivery.`);continue;}
  try{
   const p=previews?.get(story.id,id);if(!p)throw Error('original unavailable');
   const source=p.sourceInspection;if(!source||source.sourceUrl!==a.sourceUrl||![a.fileUrl,a.sourceImageUrl].filter(Boolean).includes(source.imageUrl))throw Error('original source binding unavailable');
   const {bytes}=await previews.readOriginal(story.id,id,p.sha256),m=await sharp(bytes,{failOn:'warning',limitInputPixels:40_000_000}).metadata();
   await sharp(bytes,{failOn:'warning',limitInputPixels:40_000_000}).raw().toBuffer();
   if(sha256(bytes)!==p.originalSha256||m.width!==p.originalWidth||m.height!==p.originalHeight)throw Error('original changed');
   if(Math.min(1080/m.width,1350/m.height)>1){add('PHOTO_RESOLUTION_REQUIRED',`Slide ${slide} would need enlarging from ${m.width} × ${m.height}. Add a larger source original or choose a replacement.`);continue;}
   // Acquisition provenance is retained separately; decoding alone proves neither rights nor resolution adequacy.
   verified.push({assetId:id,sha256:p.originalSha256,width:m.width,height:m.height});
  }catch{add('PHOTO_ORIGINAL_REQUIRED',`Slide ${slide} has no intact, decoded original in private storage. Add the source original or choose a saved replacement.`);}
 }
 return {issues,verified};
}
