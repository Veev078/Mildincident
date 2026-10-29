import {randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {captureEditorialEvidence} from '../editorial-evidence.js';
import {requestFingerprint} from './editorial-engine-client.js';
const COMPLETED_STATES=new Set(['ready_to_review','needs_research','approved','rejected']);
const REMOTE_STATES=new Set(['queued','generating','ready_to_review','needs_research','failed','rejected','approved']);
export class EditorialEngineService {
  constructor({research,client}){this.research=research;this.client=client;this.inspection={configured:Boolean(client),generationAvailable:false,generationApproved:false,workerActive:false};this.refreshing=null;}
  status(){return {...this.inspection};}
  async inspect(){requireThat(this.client,'ENGINE_NOT_CONFIGURED','The private development engine connection is unavailable.');this.inspection=await this.client.inspect();return this.status();}
  async queue(id){requireThat(this.client,'ENGINE_NOT_CONFIGURED','The private development engine connection is unavailable.');const request=this.research.get(id);requireThat(request,'RESEARCH_REQUEST_NOT_FOUND','Research request is unavailable.');const claim=this.research.claimEngineQueue(id,requestFingerprint(request));if(!claim.claimed)return claim.job;
    try{const row=await this.client.queue(request);requireThat(REMOTE_STATES.has(row.status),'INVALID_ENGINE_RESULT','Remote job status is unknown.');return this.research.recordEngineState(id,row.status,{remoteRowId:String(row.id),executionId:String(row.execution_id||''),lastError:null});}
    catch(error){this.research.recordEngineState(id,'queue_uncertain',{lastError:error.code||'ENGINE_REQUEST_FAILED'});throw error;}
  }
  async refresh(){requireThat(this.client,'ENGINE_NOT_CONFIGURED','The private development engine connection is unavailable.');if(this.refreshing)return this.refreshing;
    this.refreshing=(async()=>{await this.inspect();const jobs=await this.client.rows(this.client.connection.jobsTableId);const candidates=await this.client.rows(this.client.connection.candidatesTableId);const {sanitizeDevelopmentCandidate}=await import('./editorial-engine-client.js');
      for(const request of this.research.all()){const local=request.engineJob;if(!local)continue;const matches=jobs.filter(row=>row.job_id===request.id);requireThat(matches.length<=1,'AMBIGUOUS_ENGINE_JOB','Multiple remote rows share a request identity.');const row=matches[0];if(!row)continue;
        requireThat(row.request_hash===requestFingerprint(request)&&REMOTE_STATES.has(row.status),'INVALID_ENGINE_RESULT','Remote request identity or status does not match.');
        const result=candidates.filter(c=>c.job_id===request.id).map(sanitizeDevelopmentCandidate);requireThat(result.length<=1,'AMBIGUOUS_ENGINE_RESULT','Development job produced more than its one-candidate budget.');
        const executionId=String(row.execution_id||local.receiptExecutionId||local.executionId||'');
        requireThat(!local.receiptExecutionId||!row.execution_id||String(row.execution_id)===local.receiptExecutionId,'INVALID_ENGINE_RESULT','Remote execution differs from the accepted dispatch receipt.');
        requireThat(!(local.candidates?.length&&!result.length),'ENGINE_RECONCILIATION_INCOMPLETE','An earlier imported result is missing from this read. The saved Studio result is preserved; refresh read-only.');
        requireThat(result.every(c=>c.provenance.kind===request.kind&&(!executionId||c.provenance.executionId===executionId)),'INVALID_ENGINE_RESULT','Candidate execution or mode does not match its job.');
        if(['ready_to_review','needs_research','approved','rejected'].includes(row.status))requireThat(result.length===1,'INVALID_ENGINE_RESULT','Completed development job is missing its correlated result.');
        let observedState=row.status;let failure=row.error?'REMOTE_EXECUTION_FAILED':null;
        let resultPending=false;
        if((row.status==='generating'||row.status==='queued'&&local.receiptExecutionId)&&executionId){const execution=await this.client.executionStatus(executionId);resultPending=execution.status==='success'&&!result.length;if(['error','failed','crashed','canceled'].includes(execution.status)){observedState='failed';failure='REMOTE_EXECUTION_FAILED';}}
        if(row.status==='queued'&&['dispatching','dispatch_uncertain','generating','failed'].includes(local.state)&&observedState!=='failed')observedState=local.state;
        if(COMPLETED_STATES.has(local.state)&&!COMPLETED_STATES.has(row.status)&&result.length){observedState=local.state;failure='STALE_ENGINE_OBSERVATION';}
        const data={nativeStatus:row.status,remoteRowId:String(row.id),executionId,candidates:result,resultPending,lastError:failure};
        if(local.state!==observedState||local.nativeStatus!==row.status||local.lastError!==data.lastError||JSON.stringify(local.candidates||[])!==JSON.stringify(result)||local.executionId!==data.executionId||Boolean(local.resultPending)!==resultPending)this.research.recordEngineState(request.id,observedState,data);
      }return this.status();})();try{return await this.refreshing;}finally{this.refreshing=null;}
  }
  async captureEvidence(id){requireThat(this.client,'ENGINE_NOT_CONFIGURED','The development connection is unavailable.');const request=this.research.get(id);const job=request?.engineJob;requireThat(job?.executionId&&job.candidates?.length===1,'INVALID_ENGINE_RESULT','Reconcile one completed candidate before inspecting its execution.');
    const execution=await this.client.executionDetails(job.executionId);const candidate=job.candidates[0];const evidence=captureEditorialEvidence(execution,{workerId:this.client.connection.editorialWorkerId,jobId:id,requestHash:requestFingerprint(request),candidate});
    return this.research.recordEngineState(id,job.state,{evidence:{...(job.evidence||{}),[candidate.id]:evidence}},job.version);
  }
  review(id,input){
    requireThat(input&&Object.keys(input).every(k=>['candidateId','decision','reason','expectedVersion'].includes(k))&&['approved','rejected','needs_research'].includes(input.decision)&&typeof input.reason==='string'&&input.reason.trim().length>=10&&input.reason.length<=2000&&Number.isSafeInteger(input.expectedVersion),'INVALID_ENGINE_REVIEW','Choose an editorial decision, reason and current job version.');
    const job=this.research.engineJob(id);requireThat(job?.candidates?.some(c=>c.id===input.candidateId),'INVALID_ENGINE_REVIEW','Review an existing correlated development result.');
    return this.research.recordEngineState(id,job.state,{reviewDecisions:{...(job.reviewDecisions||{}),[input.candidateId]:{decision:input.decision,reason:input.reason.trim(),createdAt:new Date().toISOString()}}},input.expectedVersion);
  }
  async acceptReceipt(id,dispatchId,receipt){
    const current=this.research.engineJob(id);requireThat(current?.dispatchId===dispatchId,'EDIT_CONFLICT','Dispatch ownership changed; reconcile read-only.');
    requireThat(!current.executionId||current.executionId===receipt.executionId,'INVALID_ENGINE_RESULT','Receipt execution conflicts with the observed job.');
    this.research.recordEngineState(id,COMPLETED_STATES.has(current.state)||current.state==='failed'?current.state:'generating',{dispatchReceipt:receipt,receiptExecutionId:receipt.executionId,executionId:receipt.executionId,resultPending:!current.candidates?.length,lastError:null});
    try{await this.refresh();}catch{
      const latest=this.research.engineJob(id);this.research.recordEngineState(id,latest.state,{lastError:'ENGINE_RECONCILIATION_PENDING'});
    }
  }
  async start(id,expectedVersion){requireThat(Number.isSafeInteger(expectedVersion),'EDIT_CONFLICT','An expected engine-job version is required.');const inspection=await this.inspect();requireThat(inspection.generationAvailable,'GENERATION_NOT_APPROVED','The bounded AI worker is inactive or its exact version/spend has not been approved. Queueing alone does not spend credits.');const request=this.research.get(id);requireThat(request,'RESEARCH_REQUEST_NOT_FOUND','Research request is unavailable.');const dispatchId=randomUUID();const claimed=this.research.claimEngineDispatch(id,expectedVersion,dispatchId);
    // Durable claim precedes the external call. Never automatically redispatch after a timeout or process restart.
    this.client.dispatch(request,dispatchId).then(receipt=>this.acceptReceipt(id,dispatchId,receipt)).catch(error=>{const current=this.research.engineJob(id);if(['dispatching','generating'].includes(current?.state))this.research.recordEngineState(id,'dispatch_uncertain',{lastError:error.code||'ENGINE_DISPATCH_UNCERTAIN'});});
    return claimed;
  }
}
