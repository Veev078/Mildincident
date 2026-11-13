import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {captureResearchFailure} from '../src/workspace/research-failure.js';import {developmentFailureCode} from '../src/n8n/editorial-failure.js';
const item=json=>({data:{main:[[{json}]]}});
test('handled native errors are safe, correlated and do not equate execution success with story success',()=>{
 const execution={id:'2365',status:'success',data:{resultData:{runData:{'Verify Development Claim':[item({job_id:'approved-job',request_hash:'approved-hash'})],'Build Research Prompt':[{data:{main:[[],[{json:{error:'RESEARCH_INPUT_BUDGET_EXCEEDED [line 367]',prompt:'NEVER_COPY'}}]]}}],'Prepare Development Failure':[item({error:'DEVELOPMENT_EXECUTION_FAILED'})]}}}};
 assert.equal(captureResearchFailure(execution,{jobId:'different',requestHash:'approved-hash'}),null);
 const binding={jobId:'approved-job',requestHash:'approved-hash'};assert(captureResearchFailure(execution,binding).stoppedBeforeModels);
 execution.data.resultData.runData['Research Candidates']=[item({})];assert.equal(captureResearchFailure(execution,binding).stoppedBeforeModels,false);
 const row={job_id:'approved-job',status:'generating',lease_token:'approved-lease'},dispatch={job_id:'approved-job',dispatch_id:'approved-lease'};
 const run=error=>vm.runInNewContext('(function(){'+developmentFailureCode+'})()',{$input:{first:()=>({json:{error}})},$:name=>({first:()=>({json:name==='Claim Queued Development Job'?row:dispatch})}),$execution:{id:'2365'}})[0].json;
 assert.equal(run('RESEARCH_INPUT_BUDGET_EXCEEDED [line 367]').error,'RESEARCH_INPUT_BUDGET_EXCEEDED');assert.equal(run('Private provider message and secret').error,'DEVELOPMENT_EXECUTION_FAILED');dispatch.dispatch_id='different';assert.throws(()=>run('anything'),/UNOWNED_DEVELOPMENT_FAILURE/);
});
