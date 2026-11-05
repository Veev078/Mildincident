import {researchAccess} from './discovery-flow.js';

/** Uses the existing guarded queue/start routes once; uncertain writes are never retried here. */
export async function launchSavedResearch(request,{engine,api}) {
 if(!researchAccess(engine).canStart)throw new Error(researchAccess(engine).message);
 let job=request.engineJob;
 if(!job){
  const result=await api(`/api/research/requests/${encodeURIComponent(request.id)}/engine/queue`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});
  job=result.job;
 }
 if(job?.state!=='queued'||job.dispatchId||job.executionId||job.receiptExecutionId||!Number.isSafeInteger(job.version))throw new Error('This request already has research activity or an unconfirmed outcome. Check its progress before considering another run.');
 return api(`/api/research/requests/${encodeURIComponent(request.id)}/engine/start`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({expectedVersion:job.version})});
}
