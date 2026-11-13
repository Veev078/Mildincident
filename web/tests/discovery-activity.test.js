import test from 'node:test';
import assert from 'node:assert/strict';
import {researchStatus,discovery} from '../discover.js';
import {DEFAULT_DISCOVERY_PROMPT} from '../discovery-request.js';
test('activity distinguishes saved, uncertain, queued, running, received, reviewable, failed and historical work',()=>{
 const saved={kind:'brief',prompt:'An actual question to research',version:0};
 assert.equal(researchStatus(saved).label,'Saved · not started');
 assert.equal(researchStatus({...saved,version:1}).label,'Execution unconfirmed');
 for(const [job,label]of [[{state:'queued'},'Queued'],[{state:'generating'},'Running'],[{state:'generating',resultPending:true},'Result received'],[{state:'completed'},'Result received'],[{state:'completed',candidates:[{}]},'Caption needed'],[{state:'failed'},'Generation failed'],[{state:'queued',lastError:'UNCERTAIN'},'Needs attention'],[{state:'completed',candidates:[{}],recoveredHistory:true},'Recovered historical work']])assert.equal(researchStatus({...saved,engineJob:job}).label,label);
});
test('Discover keeps only bounded current progress, never the historical ledger or photo/source desks',()=>{
 const saved={id:'saved',kind:'brief',prompt:'A saved direction',version:0},requests=[saved,...Array.from({length:20},(_,i)=>({...saved,id:'history'+i,engineJob:{recoveredHistory:true,state:'ready_to_review'}})),...Array.from({length:6},(_,i)=>({...saved,id:'active'+i,engineJob:{state:'generating'}}))];
 const before=JSON.stringify(requests),html=discovery({workspace:{stories:[],researchRequests:requests,engine:{readOnly:true}}});assert.equal((html.match(/data-request-id=/g)||[]).length,3);for(const removed of ['Research activity','Follow the photograph.','Publication leads','data-research-link','data-engine-review'])assert.ok(!html.includes(removed));assert.equal(JSON.stringify(requests),before);assert.ok(html.includes('Generate Stories'));
});
test('a failed founder story has one clear receipt, its actual cause and no second confirmation',()=>{
 const proposal={id:'failed-action',operation:'story',state:'failed',executionId:'2365',sourceLabel:DEFAULT_DISCOVERY_PROMPT,message:'The research context exceeded its limit. No AI model was reached.',canConfirm:false};
 const request={id:proposal.id,prompt:DEFAULT_DISCOVERY_PROMPT,engineJob:{state:'failed',lastError:'RESEARCH_INPUT_BUDGET_EXCEEDED',failure:{code:'RESEARCH_INPUT_BUDGET_EXCEEDED',stoppedBeforeModels:true}},generationProposal:proposal};
 const html=discovery({workspace:{stories:[],researchRequests:[request],engine:{configured:false}}});assert(html.includes('Story generation stopped.'));assert(html.includes('No AI model was reached.'));assert(!html.includes('data-story-generation-confirm'));assert.equal((html.match(/class="ai-operation-review"/g)||[]).length,1);assert.equal((html.match(/data-request-id=/g)||[]).length,0);
});
