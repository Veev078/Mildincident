import {researchAccess} from './discovery-flow.js';

/** Only advertise actions that the existing preparation/start route can accept. */
export function canLaunchSavedResearch(request,engine={}) {
 if(!request||typeof request.id!=='string'||!request.id||!researchAccess(engine).canReview)return false;
 if(engine.founderPolicy?.mode==='founder_confirmed')return !request.engineJob&&!request.linkedStoryId&&!request.continuation;
 const job=request.engineJob;
 return !job||job.state==='queued'&&!job.dispatchId&&!job.executionId&&!job.receiptExecutionId&&Number.isSafeInteger(job.version);
}

/** Uses the existing guarded queue/start routes once; uncertain writes are never retried here. */
export async function launchSavedResearch(request,{engine,api}) {
 const access=researchAccess(engine);
 if(!access.canReview)throw new Error(access.message);
 if(!canLaunchSavedResearch(request,engine))throw new Error('This direction already has research activity or a linked result. Check its progress; existing or uncertain requests are never resent.');
 if(engine?.founderPolicy?.mode==='founder_confirmed'){
  if(!researchAccess(engine).canReview)throw new Error(researchAccess(engine).message);
  return api(`/api/research/requests/${encodeURIComponent(request.id)}/generation/prepare`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});
 }
 if(!researchAccess(engine).canStart)throw new Error(researchAccess(engine).message);
 let job=request.engineJob;
 if(!job){
  const result=await api(`/api/research/requests/${encodeURIComponent(request.id)}/engine/queue`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});
  job=result.job;
 }
 if(job?.state!=='queued'||job.dispatchId||job.executionId||job.receiptExecutionId||!Number.isSafeInteger(job.version))throw new Error('This request already has research activity or an unconfirmed outcome. Check its progress before considering another run.');
 return api(`/api/research/requests/${encodeURIComponent(request.id)}/engine/start`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({expectedVersion:job.version})});
}
