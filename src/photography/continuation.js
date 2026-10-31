import {requireThat} from '../errors.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
/** Frozen, source-bound research direction; no retrieval, model execution or production edit. */
export function preparePhotoContinuation(story,input){
 requireThat(story&&input&&Object.keys(input).every(k=>['intent','assetId','sourceRevision','workingVersion','previewSha256','idempotencyKey'].includes(k))&&['deepen','alternatives'].includes(input.intent),'INVALID_PHOTO_CONTINUATION','Prepare research from an existing photograph.');
 requireThat(!story.localDraft?.stale&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','This story changed. Reload before continuing research.');
 const matches=(story.media||[]).filter(p=>p.id===input.assetId);requireThat(matches.length===1,'INVALID_PHOTO_CONTINUATION','Choose a photograph belonging to this story.');const photo=matches[0];
 requireThat(input.previewSha256===(photo.localPreview?.sha256||''),'EDIT_CONFLICT','This preview changed. Inspect the current frame first.');
 const links=[];for(const link of photo.sourceResearchLinks||[]){const url=safePhotoReference(link.url);if(url&&['series','photographer'].includes(link.kind)&&!links.some(l=>l.url===url))links.push({kind:link.kind,url,label:text(link.label,200),basis:'reported_single_image_caption_link',verified:false});}
 links.sort((a,b)=>(a.kind==='series'?0:1)-(b.kind==='series'?0:1));
 const subject=text(story.subject||story.title,300),creator=photo.creatorBasis==='explicit_source_photo_credit'?text(photo.creator,200):'';
 const routes=[...links.slice(0,2),{kind:'alternative_search',query:text([subject,creator,input.intent==='alternatives'?'alternative photographs original series':'photographer original project context'].filter(Boolean).join(' '),600),basis:'prepared_research_direction_not_source_evidence',verified:false}];
 const founderDirection=story.localDraft?.creativeBrief?.notes;
 requireThat(founderDirection===undefined||typeof founderDirection==='string'&&[...founderDirection].length<=4000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(founderDirection),'INVALID_PHOTO_CONTINUATION','The saved editorial direction is not valid research context.');
 const continuation={schemaVersion:1,intent:input.intent,origin:{storyId:story.id,title:text(story.title,300),sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,assetId:photo.id,previewSha256:photo.localPreview?.sha256||null,...(story.engineJobId?{jobId:story.engineJobId,candidateId:story.engineCandidateId}:{} )},subject,...(founderDirection?.trim()?{founderDirection}:{}),photograph:{title:text(photo.title,200),sourceUrl:safePhotoReference(photo.sourceUrl),creator,creatorReported:text(photo.creator,200),creatorBasis:creator?'explicit_source_photo_credit':'not_established',caption:text(photo.sourceCaption,700),credit:text(photo.sourceCredit,400)},routes,sourceAssertionsVerified:false,rightsGranted:false,publicationApproved:false};
 // Retain exact URLs/identities; trim secondary directions rather than corrupting references.
 while(JSON.stringify(continuation).length>7000&&continuation.routes.length>1)continuation.routes.splice(continuation.routes.length-2,1);
 // Keep the exact founder request and source references. Optional copied metadata can be shortened first; originals remain in the story.
 for(const key of ['caption','credit','title'])if(JSON.stringify(continuation).length>7000)continuation.photograph[key]='';
 requireThat(JSON.stringify(continuation).length<=7000,'INVALID_PHOTO_CONTINUATION','This image context exceeds the bounded research budget. Shorten the working direction before preparing research; the saved draft remains intact.');
 const task=input.intent==='alternatives'?'Find stronger alternative photographs for':'Investigate the original photographic project and cultural context of';
 const request={kind:'brief',prompt:task+' '+subject+'. Continue the existing story; preserve its identity, previous research and working revisions. Use the exact photograph and source trails in the attached research context. Source text and credits remain unverified; do not infer image rights or visual inspection.',sourceUrl:continuation.photograph.sourceUrl,...(input.idempotencyKey?{idempotencyKey:input.idempotencyKey}:{})};
 return {request,continuation};
}
