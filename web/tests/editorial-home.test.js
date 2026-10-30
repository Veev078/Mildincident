import test from 'node:test';
import assert from 'node:assert/strict';
import {todaySelection,home} from '../today.js';
import {resolveRoute,destination,navigation} from '../navigation.js';
import {analytics} from '../views.js';
const story=(id,extra={})=>({id,title:id,hook:'A recorded editorial premise',revision:'r1',media:[],...extra});
test('Today separates fresh proposals, historical results and genuinely saved work without inventing activity',()=>{
 const workspace={stories:[story('fresh',{origin:'n8n_development'}),story('recovered',{origin:'n8n_development',recoveredHistory:true}),story('saved'),story('passed'),story('existing')],founderReviews:{saved:{decision:'save',sourceRevision:'r1',workingVersion:0},passed:{decision:'pass',sourceRevision:'r1',workingVersion:0}}};
 const model=todaySelection(workspace);assert.deepEqual(model.fresh.map(s=>s.id),['fresh']);assert.deepEqual(model.continuing.map(s=>s.id),['saved']);assert.ok(!model.active.some(s=>s.id==='passed'));
 const html=home({workspace});assert.match(html,/1 new proposal awaiting/);assert.match(html,/Continue working/);assert.ok(!html.includes('data-founder-review'));
 const existing=home({workspace:{stories:[story('existing')]}});assert.match(existing,/No new ideas yet/);assert.match(existing,/On your desk/);assert.ok(!existing.includes('Continue working'));
});
test('working story revisions stay visible and stale founder decisions return to review rather than silently hiding material',()=>{
 const workspace={stories:[story('changed',{origin:'n8n_development',localDraft:{version:2,title:'Working title'}})],founderReviews:{changed:{decision:'pass',sourceRevision:'r1',workingVersion:1}}};
 assert.equal(todaySelection(workspace).fresh[0].title,'Working title');assert.equal(workspace.stories[0].title,'changed');
});
test('five editorial destinations preserve all old bookmarks, exact story IDs and library secondary routes',()=>{
 assert.equal(navigation.length,5);
 for(const [old,modern] of [['home','today'],['discovery','discover'],['pipeline','stories'],['publishing','production'],['library','library']])assert.equal(resolveRoute('#/'+modern).view,resolveRoute('#/'+old).view);
 assert.deepEqual(resolveRoute('#/story/CON-kept/caption'),{view:'story',id:'CON-kept',tab:'caption'});assert.equal(destination('analytics'),'library');assert.equal(destination('story'),'pipeline');assert.equal(resolveRoute('#/archive').view,'archive');
});
test('Insights keeps measured zero and consolidates missing audience values into one honest empty state',()=>{
 const html=analytics({workspace:{analytics:{metrics:[{name:'reach',label:'Reach',available:true,value:0},{name:'shares',available:false,value:null}]}}});
 assert.match(html,/<strong>0<\/strong>/);assert.ok(!html.includes('Not available'));
 const missing=analytics({workspace:{analytics:{metrics:[{name:'reach',available:false,value:null},{name:'likes',available:false,value:null}]}}});
 assert.equal((missing.match(/Audience insights are not available yet/g)||[]).length,1);assert.ok(!missing.includes('metric-card'));
});
