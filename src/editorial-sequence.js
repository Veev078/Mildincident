import {createHash} from 'node:crypto';
import {requireThat} from './errors.js';
import {selectPhotoSequence} from './photography/selection.js';
import {photoRelevance,storyPhotoIdentity} from './photography/story-intelligence.js';
const sourceContext=story=>({version:3,storyId:story.id,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,selectedAssetIds:story.localDraft?.selectedAssetIds??story.selectedAssetIds??[],caption:story.localDraft?.caption??story.caption??'',identity:story.photography?.identity||storyPhotoIdentity(story),images:(story.media||[]).map(a=>({id:a.id,sourceUrl:a.sourceUrl,sourcePreviewUrl:a.sourcePreviewUrl||a.previewUrl,caption:a.sourceCaption||a.title,material:a.materialType,dateContext:a.dateContext,sourceRelation:a.sourceRelation,sha256:a.localPreview?.sha256||null,originalSha256:a.localPreview?.originalSha256||null,fingerprint:a.localPreview?.fingerprint||null,review:a.localReview||null}))});
const contextDigest=story=>createHash('sha256').update(JSON.stringify(sourceContext(story))).digest('hex');
/** One source/selection planner. Optional visual evidence must already be verified
 * against the current private images; this module never invokes a model. */
export function buildSourceSequencePlan(story,{visualReview=null}={}) {
  const selected=story.localDraft?.selectedAssetIds??story.selectedAssetIds??[];
  const review=m=>m.localReview?.context&&Object.hasOwn(m.localReview.context,'previewSha256')&&(m.localReview.context.previewSha256||null)!==(m.localPreview?.sha256||null)?null:m.localReview;
  const identity=story.photography?.identity||storyPhotoIdentity(story);
  const related=(story.media||[]).filter(m=>(photoRelevance(m,identity).category==='direct'||m.materialType==='design_documentation'&&m.sourceRelation==='subject_caption_match')&&(m.sourceCaption||m.title)&&review(m)?.decision!=='reject');
  related.sort((a,b)=>{
    const order=id=>selected.includes(id)?selected.indexOf(id):Number.MAX_SAFE_INTEGER;
    const preference=asset=>review(asset)?.decision==='shortlist'?0:review(asset)?.decision==='hold'?2:1;
    // An explicit sequence remains the founder’s order. Feedback ranks only remaining eligible references.
    return order(a.id)-order(b.id)||(selected.includes(a.id)?0:preference(a)-preference(b))||Number(a.materialType==='design_documentation')-Number(b.materialType==='design_documentation')||Number(!a.localPreview?.originalSha256)-Number(!b.localPreview?.originalSha256);
  });
  const seen=new Set();const distinct=related.filter(m=>{const key=m.localPreview?.originalSha256||m.sourcePreviewUrl||m.previewUrl||m.id;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
  const slide=(m,index,total)=>({assetId:m.id,caption:m.sourceCaption||m.title,credit:m.sourceCredit||m.creator||'',years:m.sourceYears||[],material:m.materialType||'source_reference',role:index===0?'question':index===total-1?'payoff':'context',note:`Source-reference proposal: ${m.sourceCaption||m.title}`.slice(0,500)});
  const recommendation=selectPhotoSequence(story,{visualReview});
  const options=[],verified=recommendation.aiVisualAssessmentPerformed;
  // Once actual visual evidence exists, metadata options must not reintroduce
  // excluded, uncertain or weak frames behind the reviewed recommendation.
  const supported=verified?recommendation.slides:distinct.map((m,index)=>slide(m,index,distinct.length));
  if(supported.length)options.push({id:'single-source-frame',label:'Let one frame carry the story',format:'single_image',targetSlideCount:1,slides:[supported[0]],basis:verified?recommendation.basis:'source_caption_metadata'});
  if(!verified&&distinct.length>=2)options.push({id:'source-sequence',label:'A sequence from these source references',format:'carousel',targetSlideCount:distinct.length,slides:supported,basis:'source_caption_metadata'});
  if(recommendation.slides.length>=2&&(recommendation.decodedCandidateCount>=2||recommendation.aiVisualAssessmentPerformed))options.push({id:'curated-sequence',label:'A varied starting sequence',format:'carousel',targetSlideCount:recommendation.slides.length,slides:recommendation.slides,basis:recommendation.basis});
  const currentContextDigest=contextDigest(story),binding={...sourceContext(story),currentContextDigest,visualExecutionId:recommendation.visualExecutionId,visualManifestSha256:verified?visualReview.manifestSha256||null:null,visualResult:verified?visualReview.result:null,options};
  const digest=createHash('sha256').update(JSON.stringify(binding)).digest('hex');
  return {basis:verified?'verified_image_bound_ai':'source_caption_metadata',pixelReviewPerformed:verified,rightsGranted:false,options,recommendation,digest,contextDigest:currentContextDigest,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,gaps:supported.length<2?[verified?'The verified assessment supports fewer than two distinct frames; no padded carousel proposed.':'Fewer than two distinct subject-related source references; no padded carousel proposed.']:[]};
}

/** Applies only a recomputed proposal to the existing versioned local draft. */
export function sourceSequenceDraft(story,plan,input){
 requireThat(input&&Object.keys(input).every(k=>['planDigest','optionId','sourceRevision','workingVersion'].includes(k))&&input.planDigest===plan.digest&&plan.contextDigest===contextDigest(story)&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0)&&!story.localDraft?.stale,'EDIT_CONFLICT','The story, image files or proposal changed. Review the current sequence before applying.');
 const option=plan.options.find(o=>o.id===input.optionId);requireThat(option,'INVALID_LOCAL_EDIT','Choose a current sequence proposal.');
 const selectedAssetIds=option.slides.map(s=>s.assetId),brief=structuredClone(story.localDraft?.creativeBrief||story.creativeBrief||{}),roles=new Map((brief.sequenceRoles||[]).filter(r=>selectedAssetIds.includes(r.assetId)).map(r=>[r.assetId,r]));
 for(const slide of option.slides)if(!roles.has(slide.assetId))roles.set(slide.assetId,{assetId:slide.assetId,role:slide.role,note:slide.note.slice(0,500)});brief.sequenceRoles=[...roles.values()];
 return {baseRevision:story.revision,expectedVersion:input.workingVersion,selectedAssetIds,format:option.format,targetSlideCount:option.targetSlideCount,creativeBrief:brief};
}
