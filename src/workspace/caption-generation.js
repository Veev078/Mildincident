import {requireThat} from '../errors.js';
import {separateEditorialCopy} from '../editorial-principles.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
/** Operator-installed binding. Never accept a model input, URL or execution ID from the browser. */
export function validateCaptionBinding(binding,fingerprint){
 const b=binding,r=b?.request;
 requireThat(b&&Object.keys(b).every(k=>['storyId','sourceRevision','sourceJobId','sourceCandidateId','sourceExecutionId','evidenceSha256','request','requestHash'].includes(k))&&uuid.test(b.sourceJobId)&&b.storyId==='CON-DEV-'+b.sourceJobId&&b.sourceCandidateId==='DEV-'+b.sourceJobId+'-1'&&/^\d+$/.test(b.sourceExecutionId)&&/^[a-f0-9]{64}$/.test(b.evidenceSha256)&&typeof b.sourceRevision==='string'&&b.sourceRevision.length>0&&r&&Object.keys(r).every(k=>['id','kind','prompt','sourceUrl'].includes(k))&&uuid.test(r.id)&&r.id!==b.sourceJobId&&['brief','discovery'].includes(r.kind)&&typeof r.prompt==='string'&&r.prompt===r.prompt.trim()&&r.prompt.length>=12&&r.prompt.length<=2000&&typeof r.sourceUrl==='string'&&fingerprint(r)===b.requestHash,'INVALID_CAPTION_BINDING','Draft-only authorization must bind one new request to its exact original story, source revision and captured evidence.');
 return b;
}

/** Explicit native recovery lineage only; titles/subjects never establish identity. */
export function recoveredDrafts(story,requests){
 if(!story.engineJobId||!story.engineCandidateId||!story.engineProvenance?.executionId)return [];
 return requests.flatMap(r=>(r.engineJob?.candidates||[]).filter(c=>{
  const line=c.recovery;
  return c.status!=='rejected'&&c.captionDraft?.trim()&&line?.mode==='draft_only'&&line.sourceJobId===story.engineJobId&&line.sourceCandidateId===story.engineCandidateId&&line.sourceExecutionId===story.engineProvenance.executionId&&c.jobId!==story.engineJobId&&/^[a-f0-9]{64}$/.test(line.evidenceSha256)&&c.claims.length===(story.research||[]).length&&c.claims.every((claim,i)=>claim.url===story.research[i].url&&claim.claim===story.research[i].claim)&&c.sourceEvidence?.every(s=>s.url===story.research[s.claimIndex]?.url&&s.textExcerpt===(story.research[s.claimIndex]?.capturedTextExcerpt||''));
 }).map(candidate=>({request:r,candidate})));
}

export function captionGenerationState(story,requests,connection,status){
 const found=recoveredDrafts(story,requests);
 if(found.length>1)return {state:'review_required',message:'More than one related draft exists. Review their versions before choosing copy.',relatedStoryIds:found.map(x=>'CON-DEV-'+x.candidate.jobId)};
 if(found.length===1){const c=found[0].candidate,copy=separateEditorialCopy({caption:c.captionDraft,production_notes:c.internalProductionNotes});return {state:'result_available',message:'A real draft from the retained research is available. Review it here before using it; your saved work stays intact.',result:{jobId:c.jobId,candidateId:c.id,executionId:c.provenance.executionId,storyId:'CON-DEV-'+c.jobId,caption:copy.caption,originalCaption:c.captionDraft,notes:copy.notes,hookOptions:c.hookOptions||[],recovery:c.recovery}};}
 const binding=connection?.captionRecovery,prior=requests.filter(r=>{const t=r.engineJob?.captionTarget;return t?.storyId===story.id&&t.sourceJobId===story.engineJobId&&t.sourceCandidateId===story.engineCandidateId&&t.sourceExecutionId===story.engineProvenance?.executionId;});
 if(prior.length>1)return {state:'review_required',message:'Several caption operations are recorded for this story. Review their results before requesting another.'};
 const request=prior[0]||(binding?.storyId===story.id?requests.find(r=>r.id===binding.request.id):null),job=request?.engineJob;
 if(job){
  if(['dispatching','generating'].includes(job.state))return {state:'pending',message:'Caption drafting is running. Your photographs and working copy are preserved.',jobId:request.id};
  if(!['queued','queueing'].includes(job.state)||job.dispatchId)return {state:'review_required',message:'The previous request needs review. Check for its result; it will not be sent again automatically.',jobId:request.id};
  if(job.state==='queueing')return {state:'pending',message:'Preparing the exact caption request. Check for updates before trying again.',jobId:request.id};
 }
 if((story.localDraft?.caption??story.caption??'').trim())return {state:'has_caption',message:'A caption is already saved.'};
 const supported=(story.research||[]).some(c=>c.claimType==='verified_fact'&&c.capturedAccess==='source_text_captured'&&c.capturedTextExcerpt?.length>=120);
 if(!supported)return {state:'research_needed',message:'The retained evidence is insufficient for caption drafting. Review the sources first.'};
 if(story.localDraft?.stale)return {state:'review_required',message:'Compare source changes before requesting a caption.'};
 const exact=connection?.executionScope==='draft_only'&&binding?.storyId===story.id&&binding.sourceRevision===story.revision&&binding.sourceJobId===story.engineJobId&&binding.sourceCandidateId===story.engineCandidateId&&binding.sourceExecutionId===story.engineProvenance?.executionId;
 if(exact&&status.generationAvailable&&status.authorizedRunsRemaining>0)return {state:'available',message:'One authorized caption request can reuse the saved evidence. No new research or source fetching.',jobId:binding.request.id};
 return {state:'authorization_required',message:'Saved research can support a caption. A separate, single-run drafting authorization and the exact native connection are required. No research will be repeated.'};
}
