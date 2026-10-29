import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {LocalResearchStore} from '../src/workspace/research-store.js';import {buildDiscoveryDesk} from '../src/editorial-discovery.js';
import {discovery} from '../web/views.js';import {buildWorkspace} from '../src/workspace/model.js';import {workspaceSnapshot} from './helpers/workspace-fixture.js';
import {WorkspaceSource} from '../src/workspace/data-source.js';import {LocalDraftStore} from '../src/workspace/store.js';import {createWorkspaceServer} from '../src/workspace/server.js';

async function setup(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-research-'));const store=new LocalResearchStore(path.join(root,'research.sqlite'));t.after(async()=>{store.close();await fs.rm(root,{recursive:true,force:true});});return {store,root};}
test('brief requests and append-only handoffs survive restart without implying n8n execution',async t=>{
 const {store,root}=await setup(t);const stories=[{id:'CON-EXISTING-01'}];let r=store.create({kind:'brief',prompt:'Investigate unusual cultural photography',sourceUrl:'https://example.org/source'},stories);
 assert.deepEqual(r.baselineIds,['CON-EXISTING-01']);assert.equal(new URL(r.handoffUrl).searchParams.get('request'),r.prompt);assert.equal(r.executionConfirmed,false);
 r=store.event(r.id,{event:'handoff_requested',expectedVersion:0},stories);r=store.event(r.id,{event:'story_linked',expectedVersion:1,storyId:stories[0].id},stories);
 assert.equal(r.events.length,2);assert.equal(r.linkedStoryId,stories[0].id);assert.equal(r.productionApplied,false);
 const other=new LocalResearchStore(path.join(root,'research.sqlite'));try{assert.equal(other.get(r.id).linkedStoryId,stories[0].id);assert.throws(()=>other.event(r.id,{event:'handoff_requested',expectedVersion:1},stories),{code:'EDIT_CONFLICT'});}finally{other.close();}
 assert.throws(()=>store.event(r.id,{event:'story_linked',expectedVersion:2,storyId:'CON-FOREIGN'},stories),{code:'INVALID_RESEARCH_REQUEST'});
});
test('request validation blocks credential links, empty/oversized briefs and arbitrary action fields',async t=>{
 const {store}=await setup(t);for(const input of [{kind:'brief',prompt:'short'},{kind:'brief',prompt:'a'.repeat(2001)},{kind:'brief',prompt:'Research a real subject',sourceUrl:'https://example.org/?api_key=secret'},{kind:'publish',prompt:'Research a real subject'},{kind:'brief',prompt:'Research a real subject',activate:true}])assert.throws(()=>store.create(input,[]),{code:'INVALID_RESEARCH_REQUEST'});
 assert.equal(store.all().length,0);
 const r=store.create({kind:'discovery',prompt:'Run the current bounded discovery preset'},[]);assert.equal(new URL(r.handoffUrl).pathname,'/form/mildincident-start-editorial-discovery');assert.equal(new URL(r.handoffUrl).search,'');
});
test('slate excludes rejected/published work, caps at five and separates evidence from taste',()=>{
 const source=buildWorkspace(workspaceSnapshot());const base=source.stories[0];const stories=Array.from({length:8},(_,i)=>({...base,id:`CON-${i}`,stage:'awaiting_chief_review',publishing:{observed:'none'}}));
 stories.push({...base,id:'CON-REJECT',stage:'rejected'},{...base,id:'CON-POSTED',stage:'awaiting_chief_review',publishing:{observed:'buffer_sent'}});
 const desk=buildDiscoveryDesk(stories);assert.equal(desk.candidates.length,5);assert.ok(desk.candidates.every(c=>!['CON-REJECT','CON-POSTED'].includes(c.storyId)));assert.equal(desk.generationPerformed,false);assert.equal(desk.candidates[0].pixelAnalysisPerformed,false);
 const html=discovery({workspace:{...source,discovery:desk,researchRequests:[]},researchDraft:{prompt:'<unsafe>'}});assert.ok(!html.includes('<unsafe>'));assert.match(html,/execution|submit/i);
});
test('research HTTP writes require intent and never create or overwrite production stories',async t=>{
 const {store,root}=await setup(t);const drafts=new LocalDraftStore(path.join(root,'drafts.sqlite'));const source=new WorkspaceSource({root});source.snapshot=workspaceSnapshot();const baseline=JSON.stringify(source.snapshot);
 const server=createWorkspaceServer({source,drafts,research:store});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));drafts.close();});const origin=`http://127.0.0.1:${server.address().port}`;
 const data={kind:'brief',prompt:'Research a distinctive photographer'};assert.equal((await fetch(origin+'/api/research/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).status,403);
 const response=await fetch(origin+'/api/research/requests',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(data)});assert.equal(response.status,201);assert.equal((await response.json()).productionApplied,false);
 const workspace=await(await fetch(origin+'/api/workspace')).json();assert.equal(workspace.researchRequests.length,1);assert.equal(workspace.stories.length,1);assert.equal(JSON.stringify(source.snapshot),baseline);
});
