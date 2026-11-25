/** Serializable native helpers. Keep imports, secrets, I/O and provider effects out. */
export {nativePackageDigestMaterial} from '../native-package-identity.js';
export function stableNative(value){
 if(Array.isArray(value))return '['+value.map(stableNative).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableNative(value[k]??null)).join(',')+'}';
 return JSON.stringify(value??null);
}
export function priorBufferHandoff(rows,conceptId){
 return rows.some(r=>r.concept_id===conceptId&&(r.buffer_id||r.buffer_post_id||String(r.state??r.status??'unknown')!=='abandoned'));
}
export function sharedBufferMaterial(p,media){
 const fields=['id','concept_id','package_id','production_version','editorial_handoff_version','format','caption_draft','slide_sequence_asset_ids','final_caption','final_asset_urls','final_assets_verified','final_approval_status','rights_review_status','source_claims_reviewed','source_claims_review_notes','render_batch_id','render_revision'];
 let ids;try{ids=JSON.parse(p.slide_sequence_asset_ids||'[]');}catch{throw Error('NATIVE_SEQUENCE_INVALID');}
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('NATIVE_SEQUENCE_INVALID');
 const selected=ids.map(id=>{const matches=media.filter(m=>m.concept_id===p.concept_id&&m.asset_id===id);if(matches.length!==1)throw Error('NATIVE_MEDIA_IDENTITY_AMBIGUOUS');const m=matches[0];return Object.fromEntries(['id','asset_id','file_url','source_page_url','creator','attribution_text','license','rights_status','notes','width','height'].map(k=>[k,m[k]??null]));});
 return {package:Object.fromEntries(fields.map(k=>[k,p[k]??null])),media:selected};
}
export function assertSharedBufferClaim(rows,claim,state){
 if(rows.length!==1)throw Error('SHARED_BUFFER_CLAIM_NOT_ACQUIRED');const r=rows[0];
 if(r.id!==claim.packageRowId||r.concept_id!==claim.conceptId||r.production_version!==claim.packageVersion||r.buffer_claim_state!==state||r.buffer_claim_owner!==claim.owner||r.buffer_claim_digest!==claim.digest)throw Error('SHARED_BUFFER_CLAIM_NOT_ACQUIRED');
 return r;
}
export function validateNativePostTransfer(packet,{story,packages,media,manual,guarded,packageDigest}){
 const bad=code=>{throw Error(code);},keys=['version','kind','requestId','contentDigest','expected','post','images'];
 if(!packet||Object.keys(packet).some(k=>!keys.includes(k))||packet.version!==1||packet.kind!=='mildincident_studio_post_review'||!/^[-a-f0-9]{36}$/.test(packet.requestId||'')||!/^[a-f0-9]{64}$/.test(packet.contentDigest||''))bad('STUDIO_TRANSFER_INVALID');
 const e=packet.expected,p=packages.length===1?packages[0]:null,post=packet.post;
 if(!p||!story||story.concept_id!==e?.storyId||p.concept_id!==e.storyId||p.id!==e.packageRowId||p.package_id!==e.packageId||p.production_version!==e.packageVersion||packageDigest!==e.packageDigest)bad('STUDIO_TRANSFER_SOURCE_CHANGED');
 if(!e.storyState||Object.keys(e.storyState).length!==5||['title','hook','format','stage','approval_status'].some(k=>typeof e.storyState[k]!=='string'||e.storyState[k]!==String(story[k]||'')))bad('STUDIO_TRANSFER_STORY_CHANGED');
 if(!['approved','concept_approved'].includes(story.approval_status)||story.published_url)bad('STUDIO_TRANSFER_CONCEPT_APPROVAL_REQUIRED');
 if(priorBufferHandoff([...manual,...guarded],e.storyId)||!['idle'].includes(p.buffer_claim_state))bad('STUDIO_TRANSFER_PRIOR_HANDOFF');
 if(!post||Object.keys(post).some(k=>!['caption','selectedAssetIds','format','title','hook','sourceRevision','workingVersion'].includes(k))||typeof post.caption!=='string'||post.caption.trim().length<25||[...post.caption].length>2200||/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH|verified_fact|hypothesis:/i.test(post.caption))bad('STUDIO_TRANSFER_CAPTION_INVALID');
 if(post.caption!==post.caption.trim())bad('STUDIO_TRANSFER_OUTER_CAPTION_WHITESPACE');
 if(!['carousel','single_image'].includes(post.format)||post.format!==story.format||post.format!==p.format)bad('STUDIO_TRANSFER_FORMAT_REVIEW_REQUIRED');
 const ids=post.selectedAssetIds,min=post.format==='single_image'?1:3,max=post.format==='single_image'?1:10;
 if(!Array.isArray(ids)||ids.length<min||ids.length>max||new Set(ids).size!==ids.length||!Array.isArray(packet.images)||packet.images.length!==ids.length)bad('STUDIO_TRANSFER_SEQUENCE_INVALID');
 const newMedia=[];
 for(const [i,id]of ids.entries()){
  const image=packet.images[i];if(!image||image.assetId!==id||Object.keys(image).some(k=>!['assetId','sourceUrl','imageUrl','creator','credit','sourceCaption','width','height','originalSha256','previewSha256','acquisition'].includes(k)))bad('STUDIO_TRANSFER_IMAGE_INVALID');
  const matches=media.filter(m=>m.concept_id===story.concept_id&&m.asset_id===id);if(matches.length>1)bad('STUDIO_TRANSFER_IMAGE_AMBIGUOUS');
  if(matches.length){if((matches[0].source_page_url||'')!==image.sourceUrl||(matches[0].file_url||'')!==image.imageUrl||(matches[0].creator||'')!==image.creator)bad('STUDIO_TRANSFER_IMAGE_SOURCE_CHANGED');continue;}
  const a=image.acquisition,https=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!/^(?:localhost|0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|\[|metadata\.)|\.(?:local|internal|localhost)$/i.test(u.hostname);}catch{return false;}};
  if(!/^photo:[a-f0-9]{16,64}$/.test(id)||!https(image.sourceUrl)||!https(image.imageUrl)||!image.creator?.trim()||![image.originalSha256,image.previewSha256,a?.pageSha256,a?.inputDigest].every(h=>/^[a-f0-9]{64}$/.test(h||''))||a?.basis!=='photo_request_source_copy'||!/^[-a-f0-9]{36}$/.test(a.requestId||'')||![image.width,image.height].every(n=>Number.isInteger(n)&&n>0&&n<=20000))bad('STUDIO_TRANSFER_ACQUISITION_REQUIRED');
  newMedia.push({concept_id:story.concept_id,asset_id:id,title:String(image.sourceCaption||'Source-backed project photograph').slice(0,600),creator:image.creator,attribution_text:image.credit||'',source_page_url:image.sourceUrl,file_url:image.imageUrl,thumb_url:image.imageUrl,width:image.width,height:image.height,rights_status:'preview_unreviewed',license:'',provider:'studio_source_acquisition',notes:'STUDIO SOURCE SHA256 '+image.originalSha256+' | source page SHA256 '+a.pageSha256+' | receipt '+a.requestId+' | private decoded reference; identity, attribution and usage rights require human review.'});
 }
 const unchanged=p.caption_draft===post.caption&&story.title===post.title&&(story.hook||'')===(post.hook||'')&&stableNative(JSON.parse(p.slide_sequence_asset_ids||'[]'))===stableNative(ids)&&!newMedia.length;
 return {unchanged,requestId:packet.requestId,contentDigest:packet.contentDigest,conceptId:story.concept_id,packageRowId:p.id,packageVersion:p.production_version,nextVersion:unchanged?p.production_version:p.production_version+1,newMedia,post,priorPackage:Object.fromEntries(Object.entries(p).filter(([k])=>!/token|secret|password|credential/i.test(k)))};
}
