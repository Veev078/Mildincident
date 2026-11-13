import {editorialFailureCode} from '../n8n/editorial-failure.js';

/** Read-only reconciliation also covers handled failures with workflow status success. */
export function captureResearchFailure(execution,{jobId,requestHash}){
 const runs=execution?.data?.resultData?.runData,first=name=>runs?.[name]?.[0]?.data?.main?.[0]?.[0]?.json;
 const claim=first('Verify Development Claim');
 if(!claim||claim.job_id!==jobId||claim.request_hash!==requestHash||!['success','error','failed','crashed','canceled'].includes(execution.status))return null;
 const prepared=first('Prepare Development Failure');let code=editorialFailureCode(prepared?.error),stage='generation';
 for(const [name,kind] of [['Build Research Prompt','research_preparation'],['Guard Draft Input Budget','draft_preparation']]){
  for(const run of runs[name]||[]){const value=run.error?.message||run.data?.main?.[1]?.[0]?.json?.error,c=editorialFailureCode(value);if(c!=='DEVELOPMENT_EXECUTION_FAILED'){code=c;stage=kind;}}
 }
 if(!prepared&&code==='DEVELOPMENT_EXECUTION_FAILED')return null;
 return {code,stage,executionId:String(execution.id),stoppedBeforeModels:!['Research Candidates','Draft Editorial Concept'].some(name=>runs[name]?.length)};
}

export function researchFailureMessage(failure){
 if(failure?.code==='RESEARCH_INPUT_BUDGET_EXCEEDED')return 'Story generation stopped while preparing its research context because it exceeded the input limit.'+(failure.stoppedBeforeModels?' No AI model was reached.':'')+' Your saved work is unchanged. This request will not be resent.';
 if(failure?.code==='DRAFT_INPUT_BUDGET_EXCEEDED')return 'Drafting stopped because the retained evidence exceeded the input limit. Earlier research and saved writing are preserved. This request will not be resent.';
 return 'The generation request failed. A successful workflow response does not mean a story was created. Your saved work is unchanged. Check the recorded result before another request.';
}
