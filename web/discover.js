import {storyGenerationReview,storyProposal,aiUsagePanel} from './ai-operations.js';
import {discoverySetup} from './discovery-flow.js';
import {canLaunchSavedResearch} from './research-launch.js';
import {DEFAULT_DISCOVERY_PROMPT} from './discovery-request.js';
import {founderQueue,reviewQueueSelection} from './review.js';
import {esc,storyUrl} from './components.js';
export function discovery(state){
 const requests=state.workspace.researchRequests||[],reviewed=storyProposal(state),active=requests.filter(r=>r.id!==reviewed?.id&&r.engineJob&&!r.engineJob.recoveredHistory&&!r.engineJob.candidates?.some(c=>(state.workspace.stories||[]).some(s=>s.id==='CON-DEV-'+c.jobId))).sort((a,b)=>Number(Boolean(a.engineJob.candidates?.length))-Number(Boolean(b.engineJob.candidates?.length))).slice(0,3);
 const saved=requests.filter(r=>!r.engineJob&&!r.linkedStoryId&&!r.generationProposal&&!r.continuation).slice(0,3);
 const savedDirection=saved.length?`<section class="saved-directions" aria-label="Saved directions">${saved.map(request=>`<p class="saved-direction"><strong>Direction saved.</strong> ${esc(request.preset?.name||(request.prompt===DEFAULT_DISCOVERY_PROMPT?'Surprise Me':request.prompt.length>100?request.prompt.slice(0,97)+'…':request.prompt))}${canLaunchSavedResearch(request,state.workspace.engine)?` <button class="text-button" data-start-saved-research="${esc(request.id)}" aria-label="Review saved direction: ${esc(request.preset?.name||(request.prompt===DEFAULT_DISCOVERY_PROMPT?'Surprise Me':request.prompt.slice(0,100)))}">Review story plan</button>`:''}</p>`).join('')}</section>`:'';
 const progress=active.length?`<section class="generation-progress" aria-label="Generation progress">${active.map(r=>{const status=researchStatus(r),job=r.engineJob;return `<article data-request-id="${esc(r.id)}"><strong>${esc(status.label)}</strong><p>${esc(status.detail)}</p>${job.candidates?.length?job.candidates.map(c=>`<a class="text-link" href="${storyUrl('CON-DEV-'+c.jobId)}">Develop this story →</a>`).join(''):['queued'].includes(job.state)&&!job.dispatchId&&canLaunchSavedResearch(r,state.workspace.engine)?`<button class="small-button" data-start-saved-research="${esc(r.id)}">Generate Stories</button>`:''}${job.lastError?'<button class="text-button" data-engine-action="refresh">Check for results</button><p class="small muted">This request will not be resent automatically.</p>':''}</article>`;}).join('')}</section>`:'';
 const queue=founderQueue(state),hasProposals=reviewQueueSelection(state).shown.length>0,setup=discoverySetup(state),review=storyGenerationReview(state);
 const delivered=reviewed?.state==='completed'&&!reviewed.deliveryPending&&(state.workspace.stories||[]).some(story=>story.id===(reviewed.resultStoryId||'CON-DEV-'+reviewed.id));
 // A delivered proposal has one primary card. Its complete operation receipt
 // remains inspectable without repeating the entire caption above that card.
 const currentReview=delivered?`<details class="discovery-receipt"><summary>Latest story request · saved</summary>${review}</details>`:review;
 return `<header class="page-heading discovery-intro"><div><h1>Discover</h1><p>Find the next story worth making.</p></div></header>${!delivered?currentReview:''}${progress}${hasProposals?queue+setup:setup+queue}${savedDirection}${delivered?currentReview:''}<details class="discovery-usage"><summary>AI usage & pause controls</summary>${aiUsagePanel(state)}</details>`;
}
export function researchStatus(request){
 const job=request.engineJob;
 if(job?.recoveredHistory)return {label:'Recovered historical work',detail:'An earlier result, kept separate from new research.'};
 if(job?.state==='failed'&&job.failure?.code==='RESEARCH_INPUT_BUDGET_EXCEEDED')return {label:job.failure.stoppedBeforeModels?'Stopped before AI started':'Story generation stopped',detail:request.generationProposal?.message||'The research context exceeded its input limit. Saved work is unchanged; this request will not be resent.',tone:'warn'};
 if(job?.state==='failed')return {label:'Generation failed',detail:request.generationProposal?.message||'The request failed. A successful workflow response does not mean a story was generated. Saved work is unchanged.',tone:'warn'};
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
