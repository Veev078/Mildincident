import test from 'node:test';import assert from 'node:assert/strict';
import {researchAccess,discoverySetup} from '../discovery-flow.js';
import {launchSavedResearch} from '../research-launch.js';
import {reviewPath,storyStep} from '../review-path.js';
const ready={configured:true,readOnly:false,generationApproved:true,generationAvailable:true,workerActive:true};
test('launch requires every existing approval flag; missing or read-only capability never exposes a start action',()=>{
 for(const engine of [{},{configured:true,readOnly:true},{...ready,readOnly:undefined},{...ready,generationApproved:false},{...ready,workerActive:false},{...ready,generationAvailable:false},{...ready,generationApproved:'true'},{...ready,workerActive:1},{...ready,generationAvailable:'true'}]){
  assert.equal(researchAccess(engine).canStart,false);
  assert.match(discoverySetup({workspace:{engine}}),/value="start" disabled/);
 }
 assert.equal(researchAccess(ready).canStart,true);
 assert.ok(discoverySetup({workspace:{engine:ready}}).includes('Generate Stories'));
});
test('modes map to the existing brief/current-preset contracts without fabricating preset controls or losing custom text',()=>{
 const workspace={engine:{configured:true,readOnly:true}};
 const custom=discoverySetup({workspace,discoveryMode:'custom',researchDraft:{prompt:'A specific <source> direction',sourceUrl:'https://example.org/'}});
 assert.ok(custom.includes('A specific &lt;source&gt; direction'));assert.ok(custom.includes('data-mode="custom"'));assert.ok(custom.includes('Save direction'));assert.ok(!custom.includes('<source>'));
 const preset=discoverySetup({workspace,discoveryMode:'preset'});assert.ok(preset.includes('Themes are unavailable'));assert.ok(!preset.includes('<select'));assert.match(preset,/value="save" disabled/);
 assert.ok(discoverySetup({workspace,researchDraft:{prompt:'Retain the actual draft'}}).includes('Your unsaved custom direction is still here'));
});
test('start follows save identity → queue → version-bound dispatch once and never retries uncertain requests',async()=>{
 const calls=[],api=async(url,options)=>{calls.push([url,JSON.parse(options.body)]);return url.endsWith('/queue')?{job:{state:'queued',version:4}}:{job:{state:'dispatching'}};};
 await launchSavedResearch({id:'saved-id'},{engine:ready,api});assert.deepEqual(calls,[['/api/research/requests/saved-id/engine/queue',{}],['/api/research/requests/saved-id/engine/start',{expectedVersion:4}]]);
 for(const state of ['dispatching','dispatch_uncertain','queue_uncertain','generating','failed','ready_to_review']){
  const count=calls.length;await assert.rejects(launchSavedResearch({id:'saved-id',engineJob:{state,version:4}},{engine:ready,api}));assert.equal(calls.length,count);
 }
 const count=calls.length;await assert.rejects(launchSavedResearch({id:'saved-id'},{engine:{...ready,readOnly:true},api}));assert.equal(calls.length,count);
 let writes=0;await assert.rejects(launchSavedResearch({id:'saved-id'},{engine:ready,api:async()=>{writes++;throw new Error('Uncertain queue outcome');}}));assert.equal(writes,1);
 let starts=0;await assert.rejects(launchSavedResearch({id:'saved-id',engineJob:{state:'queued',version:4}},{engine:ready,api:async()=>{starts++;throw new Error('Uncertain dispatch');}}));assert.equal(starts,1);
});
test('review path preserves every diagnostic/evidence item and treats absent approvals as unfinished rather than ready',()=>{
 const story={id:'CON-same',media:[],selectedAssetIds:[],caption:'Draft',blockers:['UNRECOGNIZED_GATE','PER_IMAGE_RIGHTS_PENDING'],productionDecisions:[{key:'handoff',title:'Old handoff',detail:'Keep exact IDs',tab:'publishing',evidence:[{postId:'same-id'}]}],localDraft:{stale:true}};
 const before=JSON.stringify(story),path=reviewPath(story);
 assert.equal(path.next.key,'revision');assert.equal(path.tasks[1].key,'handoff');assert.ok(path.codes.includes('UNRECOGNIZED_GATE'));assert.deepEqual(path.tasks[1].decisions[0].evidence,[{postId:'same-id'}]);assert.equal(JSON.stringify(story),before);
 const sparse=reviewPath({media:[],selectedAssetIds:[],caption:''});assert.ok(sparse.tasks.some(t=>t.key==='facts'));assert.ok(sparse.tasks.some(t=>t.key==='rights'));assert.ok(sparse.tasks.some(t=>t.key==='caption'));assert.equal(sparse.publicationApproved,false);
 assert.equal(storyStep(story).tab,'overview');assert.equal(storyStep({media:[],selectedAssetIds:[],caption:''}).tab,'images');
});

import {storyWorkspace} from '../views.js';
test('recorded source access remains bound to a development story and is unavailable without its read connection',()=>{
 const story={id:'CON-DEV-fixture',title:'A source fixture',origin:'n8n_development',engineJobId:'fixture-job',media:[],research:[]};
 const html=storyWorkspace({workspace:{engine:{configured:true,readOnly:true}}},story,'research');assert.ok(html.includes('Read recorded source evidence'));assert.ok(html.includes('data-request="fixture-job"'));assert.ok(html.includes('does not visit new sources or start research'));assert.ok(!/data-engine-action="evidence"[^>]*disabled/.test(html));
 assert.match(storyWorkspace({workspace:{engine:{configured:false}}},story,'research'),/data-engine-action="evidence"[^>]*disabled/);
 assert.ok(!storyWorkspace({workspace:{engine:{configured:true}}},{...story,origin:undefined},'research').includes('Read recorded source evidence'));
});

import {discovery} from '../discover.js';
test('genuine new proposals lead Discover; a blank inbox leads with the honest discovery entry',()=>{
 const workspace={stories:[{id:'new',title:'A recorded proposal',origin:'n8n_development',revision:'r1',media:[]}],engine:{configured:true,readOnly:true}};
 const populated=discovery({workspace});assert.ok(populated.includes('founder-inbox'));
 const history=discovery({workspace:{...workspace,stories:[{...workspace.stories[0],recoveredHistory:true}]}});assert.ok(history.indexOf('discovery-start')<history.indexOf('founder-inbox'));
});

test('native manual-link and handoff administration are removed from Discover without removing backend request records',()=>{
 const request={id:'saved',kind:'brief',prompt:'A retained private direction',handoffUrl:'https://example.org/form'};
 const workspace={stories:[],researchRequests:[request],engine:{configured:false}},before=JSON.stringify(workspace);
 const html=discovery({workspace});assert.ok(!html.includes('data-research-handoff'));assert.ok(!html.includes('data-research-link'));assert.equal(JSON.stringify(workspace),before);
});

test('stale provider observations require an update, not an invented earlier publishing handoff',()=>{
 const story={media:[],selectedAssetIds:[],caption:'A working caption',publishing:{observed:'unknown',requiresReview:true,postIds:[]},productionPreparation:{blockers:['PROVIDER_SNAPSHOT_STALE']}};
 const path=reviewPath(story);assert.equal(path.next.key,'source');assert.equal(path.next.label,'Check the latest source records');assert.ok(!path.tasks.some(t=>t.key==='handoff'));assert.ok(path.codes.includes('PROVIDER_SNAPSHOT_STALE'));assert.equal(storyStep(story).label,'Review source records');
 const recorded=reviewPath({...story,publishing:{...story.publishing,postIds:['existing-id']}});assert.equal(recorded.next.key,'handoff');assert.ok(recorded.tasks.some(t=>t.key==='source'));
});

test('per-use Generate Stories prepares an unpaid plan and never falls into a legacy queue/start dispatch',async()=>{
 const engine={configured:true,readOnly:true,founderPolicy:{mode:'founder_confirmed',enabled:true,state:'available',operations:{caption:true,story:true}}},calls=[],api=async(url,options)=>{calls.push([url,JSON.parse(options.body)]);return {proposal:{id:'saved',state:'prepared'}};};
 const result=await launchSavedResearch({id:'saved'},{engine,api});assert.equal(result.proposal.state,'prepared');assert.deepEqual(calls,[['/api/research/requests/saved/generation/prepare',{}]]);assert.equal(researchAccess(engine).canStart,true);assert.equal(researchAccess({...engine,founderPolicy:{...engine.founderPolicy,state:'inactive'}}).canStart,false);assert.equal(researchAccess({...engine,founderPolicy:{...engine.founderPolicy,state:'inactive'}}).canReview,true);
 const html=discoverySetup({workspace:{engine}});assert.match(html,/no daily request quota/i);assert.match(html,/separate confirmation/);
});
