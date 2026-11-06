import {requireThat} from '../errors.js';
import {separateEditorialCopy} from '../editorial-principles.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
// Native candidate previews are bounded; captured execution evidence keeps the full passage.
// Compare the same projection without altering the retained packet or its hash.
export const captionSourceExcerpt=value=>typeof value==='string'?value.slice(0,1800):'';
/** Operator-installed binding. Never accept a model input, URL or execution ID from the browser. */
export function validateCaptionBinding(binding,fingerprint){
 const b=binding,r=b?.request;
 requireThat(b?.direction===undefined||Object.hasOwn(CAPTION_DIRECTIONS,b.direction),'INVALID_CAPTION_BINDING','Choose a supported caption direction.');
 requireThat(b&&Object.keys(b).every(k=>['storyId','sourceRevision','sourceJobId','sourceCandidateId','sourceExecutionId','evidenceSha256','request','requestHash','direction'].includes(k))&&uuid.test(b.sourceJobId)&&b.storyId==='CON-DEV-'+b.sourceJobId&&b.sourceCandidateId==='DEV-'+b.sourceJobId+'-1'&&/^\d+$/.test(b.sourceExecutionId)&&/^[a-f0-9]{64}$/.test(b.evidenceSha256)&&typeof b.sourceRevision==='string'&&b.sourceRevision.length>0&&r&&Object.keys(r).every(k=>['id','kind','prompt','sourceUrl'].includes(k))&&uuid.test(r.id)&&r.id!==b.sourceJobId&&['brief','discovery'].includes(r.kind)&&typeof r.prompt==='string'&&r.prompt===r.prompt.trim()&&r.prompt.length>=12&&r.prompt.length<=2000&&typeof r.sourceUrl==='string'&&fingerprint(r)===b.requestHash,'INVALID_CAPTION_BINDING','Draft-only authorization must bind one new request to its exact original story, source revision and captured evidence.');
 return b;
}

/** Explicit native recovery lineage only; titles/subjects never establish identity. */
export function recoveredDrafts(story,requests){
 if(!story.engineJobId||!story.engineCandidateId||!story.engineProvenance?.executionId)return [];
 return requests.flatMap(r=>(r.engineJob?.candidates||[]).filter(c=>{
  const line=c.recovery;
  return c.status!=='rejected'&&c.captionDraft?.trim()&&line?.mode==='draft_only'&&line.sourceJobId===story.engineJobId&&line.sourceCandidateId===story.engineCandidateId&&line.sourceExecutionId===story.engineProvenance.executionId&&c.jobId!==story.engineJobId&&/^[a-f0-9]{64}$/.test(line.evidenceSha256)&&c.claims.length===(story.research||[]).length&&c.claims.every((claim,i)=>claim.url===story.research[i].url&&claim.claim===story.research[i].claim)&&(c.sourceEvidence||[]).filter(s=>s.access==='source_text_captured').length===story.research.filter(s=>s.capturedAccess==='source_text_captured').length&&c.sourceEvidence?.every(s=>s.url===story.research[s.claimIndex]?.url&&captionSourceExcerpt(s.textExcerpt)===captionSourceExcerpt(story.research[s.claimIndex]?.capturedTextExcerpt));
 }).map(candidate=>({request:r,candidate})));
}

export const CAPTION_DIRECTIONS=Object.freeze({initial:'Source-grounded caption',alternate_angle:'Another editorial angle',concise:'More concise',narrative:'More narrative',discovery_opening:'Stronger discovery opening',supported_perspective:'Different supported perspective'});

export function generatedCaptionVersions(story,requests){
 const related=recoveredDrafts(story,requests).map(({candidate:c})=>c);
 const versions=related.map(c=>{const copy=separateEditorialCopy({caption:c.captionDraft,production_notes:c.internalProductionNotes});return {id:'generated:'+c.id,kind:'generated',label:'AI draft'+(c.recovery?.direction?' · '+CAPTION_DIRECTIONS[c.recovery.direction]:'')+' · '+c.provenance.generatedAt,createdAt:c.provenance.generatedAt,jobId:c.jobId,candidateId:c.id,executionId:c.provenance.executionId,storyId:'CON-DEV-'+c.jobId,caption:copy.caption,originalCaption:c.captionDraft,notes:copy.notes,hookOptions:c.hookOptions||[],recovery:c.recovery,applicable:!c.recovery?.sourceRevision||c.recovery.sourceRevision===story.revision};});
 if(story.origin==='n8n_development'&&story.generatedCaptionOriginal?.trim()){
  const copy=separateEditorialCopy({caption:story.generatedCaptionOriginal,production_notes:story.internalProductionNotes});versions.push({id:'generated:'+story.engineCandidateId,kind:'generated',label:'Original AI draft',createdAt:story.engineProvenance?.generatedAt,candidateId:story.engineCandidateId,jobId:story.engineJobId,executionId:story.engineProvenance?.executionId,storyId:story.id,caption:copy.caption,originalCaption:story.generatedCaptionOriginal,notes:copy.notes,hookOptions:story.hookOptions||[],recovery:story.draftRecovery||null,applicable:true});
 }
 return [...new Map(versions.map(v=>[v.id,v])).values()].sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
}

export function captionVersions(story,requests,drafts){
 const local=[];let previous;
 for(const version of drafts.history(story.id)){
  if(typeof version.caption!=='string'||version.caption===previous)continue;previous=version.caption;
  local.push({id:'saved:'+version.version,kind:'saved',label:'Saved edit '+version.version,createdAt:version.updatedAt,caption:version.caption,notes:[],originalCaption:version.caption,sourceRevision:version.baseRevision,captionSource:version.captionSource||null,applicable:version.baseRevision===story.revision});
 }
 const generated=generatedCaptionVersions(story,requests),recorded=!story.generatedCaptionOriginal?.trim()&&story.caption?.trim()?[{id:'recorded:'+story.revision,kind:'recorded',label:'Recorded source caption',caption:story.caption,originalCaption:story.caption,notes:[],sourceRevision:story.revision,applicable:true}]:[];
 return [...generated,...recorded,...local];
}

export function captionGenerationState(story,requests,connection,status){
 const versions=generatedCaptionVersions(story,requests),result=versions.find(v=>v.storyId!==story.id)||null;
 const binding=connection?.captionRecovery,prior=requests.filter(r=>{const t=r.engineJob?.captionTarget;return t?.storyId===story.id&&t.sourceJobId===story.engineJobId&&t.sourceCandidateId===story.engineCandidateId&&t.sourceExecutionId===story.engineProvenance?.executionId;});
 const uncertain=prior.find(r=>['queue_uncertain','dispatch_uncertain'].includes(r.engineJob.state)),running=prior.find(r=>['dispatching','generating','queueing'].includes(r.engineJob.state));
 const bound=binding?.storyId===story.id?requests.find(r=>r.id===binding.request.id):null;
 const hasCaption=Boolean((story.localDraft?.caption??story.caption??'').trim());
 const supported=(story.research||[]).some(c=>c.claimType==='verified_fact'&&c.capturedAccess==='source_text_captured'&&c.capturedTextExcerpt?.length>=120);
 const exact=connection?.executionScope==='draft_only'&&binding?.storyId===story.id&&binding.sourceRevision===story.revision&&binding.sourceJobId===story.engineJobId&&binding.sourceCandidateId===story.engineCandidateId&&binding.sourceExecutionId===story.engineProvenance?.executionId;
 let generation;
 if(uncertain)generation={state:'review_required',jobId:uncertain.id,message:'The earlier request has an unconfirmed outcome. Check its result before commissioning another.'};
 else if(running)generation={state:'pending',jobId:running.id,message:'Drafting is in progress. Your current caption and photographs stay saved.'};
 else if(story.localDraft?.stale)generation={state:'review_required',message:'Compare source changes before requesting another version.'};
 else if(!supported)generation={state:'research_needed',message:'More source evidence is needed before drafting.'};
 else if(exact&&status.generationAvailable&&status.authorizedRunsRemaining>0&&(!bound||bound.engineJob?.state==='queued')&&(!(hasCaption||versions.length)||(binding.direction&&binding.direction!=='initial')))generation={state:'available',jobId:binding.request.id,direction:binding.direction||'initial',message:'Approved direction: '+CAPTION_DIRECTIONS[binding.direction||'initial']+'. One drafting-only run can reuse the retained research.'};
 else generation={state:'authorization_required',message:hasCaption||versions.length?'Another AI version needs a new single-run authorization. You can edit or reuse saved versions now.':'Saved research is available. Caption drafting needs a separately authorized single run.'};
 return {...(result?{state:'result_available',message:'A source-grounded draft is saved for this story.',result}:hasCaption?{state:'has_caption',message:'Your caption is saved.'}:generation),generation,versions};
}
