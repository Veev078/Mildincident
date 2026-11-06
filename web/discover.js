import {storyGenerationReview,aiUsagePanel} from './ai-operations.js';
import {discoverySetup,researchAccess} from './discovery-flow.js';
import {founderQueue} from './review.js';
import {esc,storyUrl} from './components.js';
export function discovery(state){
 const requests=state.workspace.researchRequests||[],active=requests.filter(r=>r.engineJob&&!r.engineJob.recoveredHistory&&!r.engineJob.candidates?.some(c=>(state.workspace.stories||[]).some(s=>s.id==='CON-DEV-'+c.jobId))).sort((a,b)=>Number(Boolean(a.engineJob.candidates?.length))-Number(Boolean(b.engineJob.candidates?.length))).slice(0,3);
 const saved=requests.find(r=>!r.engineJob&&!r.linkedStoryId&&!r.generationProposal&&!r.continuation);
 const savedDirection=saved?`<p class="saved-direction">Direction saved.${researchAccess(state.workspace.engine).canReview?` <button class="text-button" data-start-saved-research="${esc(saved.id)}">Generate Stories</button>`:''}</p>`:'';
 const progress=active.length?`<section class="generation-progress" aria-label="Generation progress">${active.map(r=>{const status=researchStatus(r),job=r.engineJob;return `<article data-request-id="${esc(r.id)}"><strong>${esc(status.label)}</strong><p>${esc(status.detail)}</p>${job.candidates?.length?job.candidates.map(c=>`<a class="text-link" href="${storyUrl('CON-DEV-'+c.jobId)}">Develop this story →</a>`).join(''):['queued'].includes(job.state)&&!job.dispatchId&&researchAccess(state.workspace.engine).canReview?`<button class="small-button" data-start-saved-research="${esc(r.id)}">Generate Stories</button>`:''}${job.lastError?'<button class="text-button" data-engine-action="refresh">Check for results</button><p class="small muted">This request will not be resent automatically.</p>':''}</article>`;}).join('')}</section>`:'';
 return `<header class="page-heading discovery-intro"><div><h1>Discover</h1><p>Find the next story worth making.</p></div></header>${discoverySetup(state)}${storyGenerationReview(state)}${aiUsagePanel(state)}${savedDirection}${progress}${founderQueue(state)}`;
}
export function researchStatus(request){
 const job=request.engineJob;
 if(job?.recoveredHistory)return {label:'Recovered historical work',detail:'An earlier result, kept separate from new research.'};
 if(job?.lastError||['failed','blocked','cancelled','queue_uncertain','dispatch_uncertain'].includes(job?.state))return {label:'Needs attention',detail:'Research did not complete normally. Inspect the record before trying again.',tone:'warn'};
 if(job?.candidates?.length){const captioned=job.candidates.some(c=>c.captionDraft?.trim());return {label:captioned?'Draft received':'Caption needed',detail:captioned?'A preliminary draft is saved; photographs and factual review remain open.':'Research is saved; a usable caption has not been generated.'};}
 if(job?.resultPending||['completed','completed_with_gaps','ready_to_review','approved','rejected','needs_research'].includes(job?.state))return {label:'Result received',detail:'Delivery is being checked; no reviewable proposal is available yet.'};
 if(job?.state==='queueing')return {label:'Queueing',detail:'Saving the job to the research queue; acceptance is not yet confirmed.'};
 if(job?.state==='dispatching')return {label:'Starting · unconfirmed',detail:'A start was requested; execution has not yet been confirmed. Do not submit again.'};
 if(job?.state==='queued')return {label:'Queued',detail:'Waiting for an authorized research run. No result yet.'};
 if(['generating','running','researching','drafting','dispatched','dispatching'].includes(job?.state))return {label:'Running',detail:'The recorded research job is in progress. No result yet.'};
 if(job)return {label:'Progress unconfirmed',detail:'A job record exists; its outcome has not been confirmed.'};
 if(request.version||request.events?.length)return {label:'Execution unconfirmed',detail:request.linkedStoryId?'An existing story was linked manually; execution is not confirmed.':'A form was opened; this does not confirm research ran.'};
 return {label:'Saved · not started',detail:'Direction saved · research not started. Saving does not run research.'};
}
