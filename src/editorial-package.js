import {createHash} from 'node:crypto';
import {selectPhotoSequence} from './photography/selection.js';
import {photoRelevance,storyPhotoIdentity} from './photography/story-intelligence.js';
import {validateVisualResult} from './photography/visual-assessment.js';

const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const text=value=>typeof value==='string'?value.trim():'';
const currentReview=a=>a.localReview?.context&&Object.hasOwn(a.localReview.context,'previewSha256')&&(a.localReview.context.previewSha256||null)!==(a.localPreview?.sha256||null)?null:a.localReview;

/** A caller's verified flag alone is not evidence. Recheck the current ordered
 * source manifest and decoded-file hashes; simulated/partial results stay out. */
export function editorialVisualEvidence(story,visualReview){
  if(!visualReview)return {status:'not_available',review:null};
  if(visualReview.simulation===true)return {status:'simulation_ignored',review:null};
  const m=visualReview.manifest,result=visualReview.result;
  if(visualReview.verified!==true||visualReview.simulation!==false||!/^\d+$/.test(visualReview.executionId||'')||!m)return {status:'unverified',review:null};
  if(story.localDraft?.stale||m.storyId!==story.id||m.sourceRevision!==story.revision||m.workingVersion!==(story.localDraft?.version||0))return {status:'stale',review:null};
  if(!Array.isArray(m.images)||m.images.length<1||m.images.length>6||new Set(m.images.map(i=>i.assetId)).size!==m.images.length||hash(m)!==visualReview.manifestSha256)return {status:'invalid_binding',review:null};
  try{validateVisualResult(result,{manifestSha256:visualReview.manifestSha256,images:m.images});}catch{return {status:'invalid_result',review:null};}
  for(const image of m.images){
    const a=(story.media||[]).find(a=>a.id===image.assetId);
    if(!a||!/^[a-f0-9]{64}$/.test(image.inputSha256||'')||!/^[a-f0-9]{64}$/.test(image.sourcePreviewSha256||'')||a.localPreview?.sha256!==image.sourcePreviewSha256||a.localPreview?.originalSha256&&a.localPreview.originalSha256!==image.originalSha256||a.sourceUrl&&a.sourceUrl!==image.sourceUrl)return {status:'stale_images',review:null};
  }
  return {status:'verified_current',review:visualReview};
}

/** Local, reviewable curation and writing context over existing evidence. No
 * request, model, rights decision, caption edit or selection mutation occurs. */
export function buildEditorialPackage(story,{visualReview=null}={}){
  const media=story.media||[],byId=new Map(media.map(a=>[a.id,a]));
  const selected=[...(story.localDraft?.selectedAssetIds??story.selectedAssetIds??[])],caption=story.localDraft?.caption??story.caption??'';
  const visual=editorialVisualEvidence(story,visualReview),review=visual.review,assessed=new Map((review?.result.images||[]).map(i=>[i.assetId,i]));
  const inputs=new Map((review?.manifest.images||[]).map(i=>[i.assetId,i])),identity=story.photography?.identity||storyPhotoIdentity(story);
  const recommendation=selectPhotoSequence(story,{visualReview:review}),verified=Boolean(review),gaps=[];
  const gap=(code,message,assetIds=[])=>gaps.push({code,message,assetIds});
  const imageEvidence=id=>{
    const a=byId.get(id),v=assessed.get(id),input=inputs.get(id);
    return {assetId:id,sourceCaption:text(a?.sourceCaption||a?.title),sourceUrl:text(a?.sourceUrl),creatorReported:text(a?.creator),credit:text(a?.sourceCredit||a?.attribution),material:a?.materialType||'source_reference',sourceYears:a?.sourceYears||[],dateContext:a?.dateContext||'not_established',previewSha256:a?.localPreview?.sha256||null,originalSha256:a?.localPreview?.originalSha256||null,inputSha256:input?.inputSha256||null,observations:v?.observations||null,composition:v?.composition||null,distinctiveness:v?.distinctiveness||null,carouselPotential:v?.carouselPotential||null,relevance:v?.relevance||null,pixelReviewPerformed:Boolean(v),basis:v?'verified_image_bound_observation':'reported_source_metadata',attributionVerified:a?.creatorVerified===true,rightsStatus:a?.rightsStatus||'unreviewed',rightsGranted:false};
  };
  // Without a real result, metadata is a set to inspect, never an aesthetic
  // endorsement. Keep it separate from the actual visual recommendation.
  const proposedIds=story.localDraft?.stale?[]:recommendation.slides.map(s=>s.assetId);
  const slides=proposedIds.map((id,index)=>{
    const s=recommendation.slides[index],e=imageEvidence(id),previous=index?imageEvidence(proposedIds[index-1]):null;
    return {...s,...e,position:index+1,pacing:index===0?'opening':index===proposedIds.length-1?'closing':'development',note:verified?e.carouselPotential||s.note:s.note,transition:previous?verified?`Compare “${previous.observations}” with “${e.observations}”; ${e.carouselPotential}`:'Compare the actual frames for a meaningful change; source descriptions alone do not establish visual progression.':null};
  });
  const withheld=recommendation.withheld.map(w=>({...w,reason:w.message})),withheldIds=new Set(withheld.map(w=>w.assetId));
  for(const a of media){
    if(proposedIds.includes(a.id)||withheldIds.has(a.id))continue;
    let reason='',basis='source_metadata';
    if(currentReview(a)?.decision==='reject'){reason='Your rejection of these current pixels is retained.';basis='founder_review';}
    else if(verified&&!assessed.has(a.id)){reason='Outside the verified image manifest; inspect separately before adding it.';basis='not_visually_assessed';}
    else if(photoRelevance(a,identity).category!=='direct')reason='Source context does not establish a project frame; supporting material and unrelated work are kept out of the proposal.';
    else if(a.dateContext==='different_year_context'&&!selected.includes(a.id))reason='The source reports a different date context; resolve its relationship to this story first.';
    if(reason)withheld.push({assetId:a.id,reason,message:reason,basis});
  }
  const used=[...new Set([...selected,...proposedIds])],selectedImages=selected.map(imageEvidence),proposedImages=proposedIds.map(imageEvidence);
  if(story.localDraft?.stale)gap('STALE_STORY','Resolve the changed source against your saved work before applying a package.');
  if(!verified)gap(visual.status==='simulation_ignored'?'SIMULATED_REVIEW_IGNORED':'VISUAL_REVIEW_NEEDED',visual.status==='simulation_ignored'?'A simulated assessment is present. Its observations and ranking are excluded from this package.':visual.status==='not_available'?'No complete verified visual review is available. These are source and file suggestions to inspect.':'The supplied visual review is unverified or no longer matches this source, working version or image files. Its observations and ranking are excluded.');
  if(verified&&!proposedIds.length)gap('NO_SUPPORTED_IMAGES','The complete visual assessment supports no eligible sequence. Keep the draft and find or inspect stronger project frames.');
  if(proposedIds.length===1)gap('SINGLE_SUPPORTED_FRAME',verified?'One supported frame can carry a single-image post; no carousel is padded.':'Only one distinct project candidate is available; inspect it for a single-image post.');
  if(!proposedIds.length&&!verified)gap('NO_PROJECT_CANDIDATES','No eligible project candidates are available from the current source evidence.');
  const missing=selected.filter(id=>!byId.has(id));if(missing.length)gap('MISSING_SELECTED_IMAGES','Some saved selections are absent from the current source; restore or deliberately replace them.',missing);
  const unreviewed=selected.filter(id=>!assessed.has(id));if(verified&&unreviewed.length)gap('SELECTED_IMAGES_NOT_ASSESSED','Some current selected images were outside this visual review; its observations cannot describe those frames.',unreviewed);
  const dropped=selected.filter(id=>!proposedIds.includes(id));if(verified&&dropped.length)gap('CURRENT_SELECTION_DIFFERS','The proposed sequence omits current selections. Inspect the reasons and retain your order until deliberate Apply.',dropped);
  const noPixels=used.filter(id=>!byId.get(id)?.localPreview?.sha256);if(noPixels.length)gap('PRIVATE_PIXELS_MISSING','Source references do not establish decoded image content. Inspect or attach the actual files.',noPixels);
  const noCredit=used.filter(id=>{const a=byId.get(id);return !text(a?.sourceCredit||a?.attribution||a?.creator);});if(noCredit.length)gap('ATTRIBUTION_MISSING','Record the actual photographer/creator and required credit from image-specific source evidence.',noCredit);
  const unverifiedCredit=used.filter(id=>{const a=byId.get(id);return a&&text(a.sourceCredit||a.attribution||a.creator)&&a.creatorVerified!==true;});if(unverifiedCredit.length)gap('ATTRIBUTION_UNVERIFIED','Recorded credit is reported metadata. Confirm creator identity and required attribution against the image source.',unverifiedCredit);
  const rights=used.filter(id=>byId.get(id)?.nativeRightsReview?.reviewed!==true);if(rights.length)gap('IMAGE_RIGHTS_REVIEW','Human permission or editorial-exception evidence is still needed for these images. Discovery and visual review grant no rights.',rights);
  if(story.sourceClaimsReviewed!==true)gap('FACTS_REVIEW','Check names, dates, project context and caption claims against retained sources. Visible content does not verify those facts.');
  const dated=used.filter(id=>byId.get(id)?.dateContext==='different_year_context');if(dated.length)gap('IMAGE_DATE_CONTEXT','Use the image-specific recorded dates; do not imply these are from a different event, film or year.',dated);
  const hookDirections=verified?proposedImages.slice(0,3).filter(i=>i.observations).map(i=>({assetId:i.assetId,text:`Anchor the opening in this observed detail: “${i.observations}”. Then establish the project through sourced facts.`,basis:'verified_image_bound_observation',requiresHumanReview:true})):[];
  const captionGuidance=verified?['Describe only observations attached to the actual selected image hashes. Proposed images are separate until you apply their sequence.','Use the opening frame’s specific visible detail as a hook; let the next frames add a reason to keep looking.','Keep reported creator, date and project claims tied to their sources. A visual interpretation remains an interpretation.']:['Keep the current caption while inspecting the proposed source references. Reported captions and decoded dimensions do not justify new claims about visible content.'];
  const comparison={addedAssetIds:proposedIds.filter(id=>!selected.includes(id)),removedAssetIds:selected.filter(id=>!proposedIds.includes(id)),orderChanged:JSON.stringify(selected)!==JSON.stringify(proposedIds),coverChanged:(selected[0]||null)!==(proposedIds[0]||null)};
  const status=story.localDraft?.stale?'stale_story':!proposedIds.length?'no_supported_images':verified?'visual_recommendation':'source_review_needed';
  const summary=status==='stale_story'?'Source changes need review before curation.':status==='no_supported_images'?'No supported package yet; stronger evidence or photographs are needed.':verified?`${proposedIds.length===1?'One supported image':`${proposedIds.length} supported frames`} proposed from the verified visual review. Your caption and order are preserved.`:`${proposedIds.length} source-backed candidate${proposedIds.length===1?'':'s'} to inspect. No visual quality judgment has been performed.`;
  const binding={storyId:story.id||null,sourceRevision:story.revision||null,workingVersion:story.localDraft?.version||0,captionSha256:hash(caption),selectedAssetIds:selected,images:media.map(a=>({assetId:a.id,sourceUrl:a.sourceUrl||null,sourceCaption:a.sourceCaption||a.title||'',sha256:a.localPreview?.sha256||null,originalSha256:a.localPreview?.originalSha256||null,review:currentReview(a)||null,rightsStatus:a.rightsStatus||null,credit:a.sourceCredit||a.attribution||a.creator||'',creatorVerified:a.creatorVerified===true,nativeRightsReview:a.nativeRightsReview||null})),visualManifestSha256:review?.manifestSha256||null,visualExecutionId:review?.executionId||null};
  const approval={humanReviewRequired:true,factsVerifiedByHuman:story.sourceClaimsReviewed===true,rightsGranted:false,publicationApproved:false,selectionChanged:false,captionChanged:false};
  const proposal={status:verified?'visual_proposal':'metadata_candidates',format:proposedIds.length===1?'single_image':proposedIds.length>1?'carousel':null,coverAssetId:proposedIds[0]||null,selectedAssetIds:proposedIds,coverAlternatives:recommendation.openingCandidates.filter(a=>a.assetId!==proposedIds[0]).map(a=>({...a,reasons:verified?[assessed.get(a.assetId)?.composition,assessed.get(a.assetId)?.distinctiveness,'An assessed sequence member to compare as an opening; it was not independently ranked as a stronger cover.'].filter(Boolean):a.reasons})),slides,withheld,comparison};
  const captionContext={basis:verified?'verified_image_bound_observations_and_reported_sources':'reported_source_metadata_only',pixelReviewPerformed:verified,visualStatus:visual.status,visualExecutionId:review?.executionId||null,manifestSha256:review?.manifestSha256||null,founderDirection:text(story.localDraft?.creativeBrief?.notes||story.creativeBrief?.notes),selectedImages,proposedImages,hookDirections,captionGuidance,gaps};
  const current={caption,selectedAssetIds:selected,slides:selectedImages};
  const digest=hash({version:1,binding,status,current,proposal,captionContext,approval,research:story.research||[]});
  return {version:1,digest,binding,status,summary,current,proposal,captionContext,gaps,approval,rightsGranted:false,publicationApproved:false};
}
