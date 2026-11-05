import test from 'node:test';
import assert from 'node:assert/strict';
import {researchStatus,discovery} from '../discover.js';
import {DEFAULT_DISCOVERY_PROMPT} from '../discovery-request.js';
test('activity distinguishes saved, uncertain, queued, running, received, reviewable, failed and historical work',()=>{
 const saved={kind:'brief',prompt:'An actual question to research',version:0};
 assert.equal(researchStatus(saved).label,'Saved · not started');
 assert.equal(researchStatus({...saved,version:1}).label,'Execution unconfirmed');
 for(const [job,label]of [[{state:'queued'},'Queued'],[{state:'generating'},'Running'],[{state:'generating',resultPending:true},'Result received'],[{state:'completed'},'Result received'],[{state:'completed',candidates:[{}]},'Ready for review'],[{state:'failed'},'Needs attention'],[{state:'queued',lastError:'UNCERTAIN'},'Needs attention'],[{state:'completed',candidates:[{}],recoveredHistory:true},'Recovered historical work']])assert.equal(researchStatus({...saved,engineJob:job}).label,label);
});
test('Discover keeps only bounded current progress, never the historical ledger or photo/source desks',()=>{
 const saved={id:'saved',kind:'brief',prompt:'A saved direction',version:0},requests=[saved,...Array.from({length:20},(_,i)=>({...saved,id:'history'+i,engineJob:{recoveredHistory:true,state:'ready_to_review'}})),...Array.from({length:6},(_,i)=>({...saved,id:'active'+i,engineJob:{state:'generating'}}))];
 const before=JSON.stringify(requests),html=discovery({workspace:{stories:[],researchRequests:requests,engine:{readOnly:true}}});assert.equal((html.match(/data-request-id=/g)||[]).length,3);for(const removed of ['Research activity','Follow the photograph.','Publication leads','data-research-link','data-engine-review'])assert.ok(!html.includes(removed));assert.equal(JSON.stringify(requests),before);assert.ok(html.includes('Generate Stories'));
});
