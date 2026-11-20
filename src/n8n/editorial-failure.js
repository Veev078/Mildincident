/** Serializable allowlist: never persist provider messages, input rows or stacks. */
export function editorialFailureCode(error){
 const text=typeof error==='string'?error:typeof error?.message==='string'?error.message:'';
 const allowed=['RESEARCH_INPUT_BUDGET_EXCEEDED','DRAFT_INPUT_BUDGET_EXCEEDED','RESEARCH_CONTEXT_LAYOUT_CHANGED','INVALID_EDITORIAL_CONTEXT','INVALID_SOURCE_LEAD_CONTEXT','NO_RESEARCH_LEADS','NO_UNTESTED_DEVELOPMENT_DISCOVERY_LEAD'];
 return allowed.find(code=>text===code||text.startsWith(code+' [line '))||'DEVELOPMENT_EXECUTION_FAILED';
}

/** The job/lease ownership check is unchanged; only the safe failure reason differs. */
export const developmentFailureCode=`const failureCode=${editorialFailureCode.toString()};const row=$('Claim Queued Development Job').first().json;const dispatch=$('Validate Development Dispatch').first().json;if(row.job_id!==dispatch.job_id||row.lease_token!==dispatch.dispatch_id||row.status!=='generating')throw new Error('UNOWNED_DEVELOPMENT_FAILURE');return [{json:{job_id:row.job_id,lease_token:row.lease_token,error:failureCode($input.first().json.error),execution_id:String($execution.id)}}];`;
export const developmentFailureResponse='={{ { accepted: true, scope: "development_only", productionApplied: false, jobId: $("Validate Development Dispatch").first().json.job_id, status: "failed", executionId: String($execution.id), failureCode: $("Prepare Development Failure").first().json.error } }}';
