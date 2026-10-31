import test from 'node:test';
import assert from 'node:assert/strict';
import {researchStatus,researchGroups,discovery} from '../discover.js';
import {DEFAULT_DISCOVERY_PROMPT} from '../discovery-request.js';
test('activity distinguishes saved, uncertain, queued, running, received, reviewable, failed and historical work',()=>{
 const saved={kind:'brief',prompt:'An actual question to research',version:0};
 assert.equal(researchStatus(saved).label,'Saved · not started');
 assert.equal(researchStatus({...saved,version:1}).label,'Execution unconfirmed');
 for(const [job,label]of [[{state:'queued'},'Queued'],[{state:'generating'},'Running'],[{state:'generating',resultPending:true},'Result received'],[{state:'completed'},'Result received'],[{state:'completed',candidates:[{}]},'Ready for review'],[{state:'failed'},'Needs attention'],[{state:'queued',lastError:'UNCERTAIN'},'Needs attention'],[{state:'completed',candidates:[{}],recoveredHistory:true},'Recovered historical work']])assert.equal(researchStatus({...saved,engineJob:job}).label,label);
});
test('equivalent default history groups visually but preserves every record and separates baseline and outcome',()=>{
 const base={kind:'discovery',prompt:DEFAULT_DISCOVERY_PROMPT,sourceUrl:'',baselineIds:['a'],version:0};
 const requests=[{...base,id:'one'},{...base,id:'two'}, {...base,id:'queued',engineJob:{state:'queued'}},{...base,id:'new-baseline',baselineIds:['b']},{...base,id:'specific',prompt:'A distinct direction about a photographic series'}];
 const groups=researchGroups(requests);assert.deepEqual(groups.map(g=>g.map(r=>r.id)),[['one','two'],['queued'],['new-baseline'],['specific']]);
 const html=discovery({workspace:{stories:[],researchRequests:requests}});
 assert.equal((html.match(/data-request-id=/g)||[]).length,5);assert.equal((html.match(/class="research-activity-row"/g)||[]).length,4);
 assert.ok(html.includes('2 equivalent historical records retained'));
 assert.ok(html.indexOf('founder-inbox')<html.indexOf('research-activity'));
});
