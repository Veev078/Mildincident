import test from 'node:test';
import assert from 'node:assert/strict';
import {todaySelection,home,lastSavedAt} from '../today.js';
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
test('Continue working uses actual private-save and current decision times rather than native row order or invented recency',()=>{
 const workspace={stories:[story('older',{localDraft:{updatedAt:'2026-10-28T10:00:00Z'}}),story('recent',{localDraft:{updatedAt:'2026-10-30T11:00:00Z'}}),story('just-saved'),story('undated',{localDraft:{updatedAt:'invalid-date'}})],founderReviews:{'just-saved':{decision:'save',sourceRevision:'r1',workingVersion:0,createdAt:'2026-10-30T12:00:00Z'}}};
 const before=JSON.stringify(workspace);assert.deepEqual(todaySelection(workspace).continuing.map(s=>s.id),['just-saved','recent','older','undated']);assert.equal(lastSavedAt(workspace.stories[3]),null);assert.equal(JSON.stringify(workspace),before);
 const outdated={decision:'save',sourceRevision:'old',workingVersion:0,createdAt:'2026-10-31T12:00:00Z'};assert.equal(lastSavedAt(workspace.stories[1],{recent:outdated}),'2026-10-30T11:00:00Z');
});
test('Today can resume a visited stage while stale copies still lead to explicit source comparison',()=>{
 const make=extra=>({workspace:{stories:[story('saved',{localDraft:{updatedAt:'2026-10-30T11:00:00Z',...extra}})]},lastStoryTabs:{saved:'caption'}});
 assert.match(home(make({})),/#\/story\/saved\/caption/);assert.match(home(make({})),/Continue the caption/);
 const stale=home(make({stale:true}));assert.ok(!stale.includes('Continue the caption'));assert.match(stale,/Review source changes/);
 const unknown=make({});unknown.lastStoryTabs.saved='__proto__';assert.ok(!home(unknown).includes('[object Object]'));
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
