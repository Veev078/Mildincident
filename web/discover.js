import {storyGenerationReview,storyProposal,aiUsagePanel} from './ai-operations.js';
import {discoverySetup} from './discovery-flow.js';
import {canLaunchSavedResearch} from './research-launch.js';
import {DEFAULT_DISCOVERY_PROMPT} from './discovery-request.js';
import {founderQueue,reviewQueueSelection} from './review.js';
import {esc,storyUrl} from './components.js';
export function discovery(state){
 const requests=state.workspace.researchRequests||[],reviewed=storyProposal(state),pending=['prepared','queued','running','dispatching','uncertain'].includes(reviewed?.state)||reviewed?.deliveryPending===true;
 const archived=new Map();
 for(const r of requests){const p=r.generationProposal,j=r.engineJob;if(p||j)archived.set(r.id,{id:r.id,proposal:p,request:r});}
 if(reviewed)archived.set(reviewed.id,{...archived.get(reviewed.id),id:reviewed.id,proposal:reviewed});
 const history=[...archived.values()].filter(r=>(r.id!==reviewed?.id||!pending)&&!r.request?.engineJob?.recoveredHistory),delivery=state.workspace.engine?.delivery,issues=delivery?.reconciliationIssues||[];
 const failed=history.filter(r=>r.proposal?.state==='failed'||r.request?.engineJob?.state==='failed').length;
 const saved=requests.filter(r=>!r.engineJob&&!r.linkedStoryId&&!r.generationProposal&&!r.continuation).slice(0,3);
 const status=history.length||delivery?.state==='unavailable'||issues.length?`<details class="discovery-status" data-remember-disclosure="discovery-status"><summary>${delivery?.state==='unavailable'?'Result updates need attention':issues.length?'Some earlier results need checking':failed?`${failed} earlier request${failed===1?'':'s'} need${failed===1?'s':''} review`:'Recent requests'} <span>View history</span></summary>${delivery?.state==='unavailable'?'<p class="small">Result updates are temporarily unavailable. Saved stories remain here. No generation will be repeated.</p>':''}${issues.length?'<p class="small">Some records could not be reconciled. Other results can still arrive; affected records remain unchanged.</p>':''}<button class="small-button" data-engine-action="refresh">Check recorded results</button><div class="discovery-history">${history.map(r=>`<details data-request-id="${esc(r.id)}"><summary>${esc(r.request?researchStatus(r.request).label:r.proposal?.state==='failed'?'Story generation stopped':'Request saved')}${r.proposal?.executionId?' · '+esc(r.proposal.executionId):''}</summary>${r.proposal&&r.id===reviewed?.id?storyGenerationReview(state):`<p class="small">${esc(r.proposal?.message||researchStatus(r.request).detail)}</p>${r.request?.engineJob?.executionId?`<p class="small muted">Execution ${esc(r.request.engineJob.executionId)}</p>`:''}`}</details>`).join('')}${issues.map(i=>`<p class="small">Request ${esc(i.requestId)} · ${esc(i.code)}</p>`).join('')}</div></details>`:'';
 return `<header class="page-heading discovery-intro"><div><h1>Discover</h1><p>Find the next story worth making.</p></div></header>${discoverySetup(state)}${pending?storyGenerationReview(state):''}${status}${founderQueue(state)}${saved.length?`<details class="saved-directions"><summary>Saved directions · ${saved.length}</summary><span class="sr-only">Direction saved.</span>${saved.map(r=>`<p>${esc(r.preset?.name||r.prompt.slice(0,100))}${canLaunchSavedResearch(r,state.workspace.engine)?` <button class="text-button" data-start-saved-research="${esc(r.id)}">Review story plan</button>`:''}</p>`).join('')}</details>`:''}<details class="discovery-usage"><summary>AI usage & pause controls</summary>${aiUsagePanel(state)}</details>`;
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
