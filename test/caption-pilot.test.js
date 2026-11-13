import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {EditorialEngineClient,requestFingerprint} from '../src/workspace/editorial-engine-client.js';
import {CaptionPilot} from '../src/workspace/caption-pilot.js';

// Synthetic retained evidence mirrors a real captured research packet's structure,
// without embedding founder research or making a provider/network request.
const workerId='6CkqfYc4Pyd4k8vi',sourceJobId='418e3861-610b-400a-9cc6-e0635ce6003d',sourceExecutionId='2353';
const claim='The documented project examines a youth community and its shared relationships.';
const sourceUrl='https://example.org/project';
const passage=claim+' The original photographer explains how the project developed and how these participants developed connections in the same cultural setting.';
const sourceHash='a'.repeat(64);
function retained(){
 const candidate={subject:'A specific youth project',prechecks_passed:true,claims:[{claim,claim_type:'verified_fact',source_url:sourceUrl}],sourceEvidence:[{claimIndex:0,url:sourceUrl,access:'source_text_captured',textExcerpt:passage}],editorialCase:{primary_appeal:'scene',cultural_payoff:'A documented shared cultural identity among participants.',visual_detail:'Layered clothing and reflective stage materials.',image_story_connection:'A specific photographic series documents the shared scene.',preset_connection:'Original culture and photographic storytelling.',familiarity_risk:'Documented relationships beyond generic nostalgia.',supporting_claim_indices:[0],recommendation:'preferred'}};
 const rows={'Verify Development Claim':[{job_id:sourceJobId,request_hash:sourceHash,execution_id:sourceExecutionId}],'Validate Development Dispatch':[{job_id:sourceJobId,request_hash:sourceHash}],'Collect Link Checks':[candidate],'Build Research Prompt':[{brandText:'Captured synthetic brand guidance: precise, restrained and source-grounded.'}],'Draft Editorial Concept':[{error:'invalid syntax'}],'Finalize Development Candidate':[{candidate_json:JSON.stringify({editorialStage:'research_only'})}],'Extract Original-Page Image Previews':[{asset_id:'retained-frame',thumb_url:'https://example.org/frame.jpg',source_relation:'context_only'}]};
 const execution={id:sourceExecutionId,workflowId:workerId,status:'success',startedAt:'2026-11-05T15:00:00Z',stoppedAt:'2026-11-05T15:01:00Z',data:{resultData:{runData:Object.fromEntries(Object.entries(rows).map(([name,values])=>[name,[{data:{main:[values.map(json=>({json}))]}}]]))}}};
 const story={id:'CON-DEV-'+sourceJobId,origin:'n8n_development',revision:'source-r1',engineJobId:sourceJobId,engineCandidateId:'DEV-'+sourceJobId+'-1',engineProvenance:{executionId:sourceExecutionId},title:candidate.subject,subject:candidate.subject,caption:'Earlier retained caption.',research:[{claim,claimType:'verified_fact',url:sourceUrl,capturedAccess:'source_text_captured',capturedTextExcerpt:passage}],media:[{id:'retained-frame',sourceUrl,previewUrl:'https://example.org/frame.jpg',rightsStatus:'preview_unreviewed'}],selectedAssetIds:['retained-frame'],approvalStatus:'pending',localDraft:{version:2,caption:'The founder working caption must survive.',selectedAssetIds:['retained-frame']}};
 return {execution,story};
}
const body=(story,direction='concise',key=randomUUID())=>({sourceRevision:story.revision,workingVersion:story.localDraft.version,direction,idempotencyKey:key});
const proposal=value=>value.proposal||value;
const confirmation=(story,p)=>({proposalId:p.id,sourceRevision:story.revision,workingVersion:story.localDraft.version,confirm:true});
async function fixture(t,{enabled=true}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-caption-pilot-')),filename=path.join(root,'research.sqlite'),research=new LocalResearchStore(filename),{execution,story}=retained();
 const clock={now:Date.now()},state={queueCalls:0,dispatches:0,jobs:[],candidates:[],mode:'pending',workerActive:true,reads:0};
 const config={enabled,approved:enabled,id:randomUUID(),workerVersion:'approved-caption-v1',graphSha256:'b'.repeat(64),expiresAt:new Date(clock.now+24*3600000).toISOString(),connection:{jobsTableId:'z22YLsWc4lO1yCG4',candidatesTableId:'W40NQ6jFBZWbpB3U',editorialWorkerId:workerId,headerName:'X-Mildincident-Development-Key',token:'synthetic-private-token-not-a-real-credential-123456'},dailyCaptionLimit:6,dailyStoryLimit:3,reviewThresholdUsd:2};
 const workerProjection={name:'MILDINCIDENT DEV — bounded editorial generation',nodes:[],connections:{},settings:{executionOrder:'v1',executionTimeout:240,availableInMCP:true}};config.graphSha256=createHash('sha256').update(JSON.stringify(workerProjection)).digest('hex');
 const inspection=()=>({configured:true,readOnly:false,workerActive:state.workerActive,generationApproved:state.workerActive,generationAvailable:state.workerActive,workerVersion:config.workerVersion,activeWorkerVersion:config.workerVersion,graphSha256:config.graphSha256});
 function makeClient(options={}){
  const connection=options.connection||options;
  return {connection:{...config.connection,...connection},readOnly:false,
   inspect:async()=>inspection(),api:async endpoint=>{assert.equal(endpoint,'/workflows/'+workerId);return{...structuredClone(workerProjection),id:workerId,active:state.workerActive,versionId:config.workerVersion,activeVersionId:state.workerActive?config.workerVersion:null};},executionDetails:async id=>{assert.equal(String(id),sourceExecutionId);state.reads++;return structuredClone(execution);},
   rows:async table=>table===config.connection.jobsTableId?state.jobs:state.candidates,
   queue:async request=>{state.queueCalls++;const row={id:state.jobs.length+1,job_id:request.id,request_hash:requestFingerprint(request),kind:request.kind,prompt:request.prompt,source_url:request.sourceUrl||'',editorial_context_json:JSON.stringify(request.editorialContext||null),status:'queued',execution_id:''};state.jobs.push(row);if(state.mode==='queue_uncertain')throw Object.assign(new Error('Synthetic uncertain queue'),{code:'ENGINE_NETWORK_UNCERTAIN'});return row;},
   dispatch:async()=>{state.dispatches++;if(state.mode==='dispatch_uncertain')throw Object.assign(new Error('Synthetic lost response'),{code:'ENGINE_DISPATCH_UNCERTAIN'});return new Promise(()=>{});},
   executionStatus:async()=>({status:'running',finished:false,startedAt:new Date(clock.now).toISOString()})};
 }
 const initial=makeClient({connection:{mode:'read_only',generationEnabled:false}});initial.readOnly=true;
 const engine=new EditorialEngineService({research,client:initial});
 const makePilot=(store=research,service=engine)=>new CaptionPilot({research:store,engine:service,loadConfig:async()=>structuredClone(config),createClient:makeClient,now:()=>clock.now});
 const pilot=makePilot();const stores=[research];t.after(async()=>{for(const store of stores)store.close();await fs.rm(root,{recursive:true,force:true});});
 return {root,filename,research,execution,story,state,config,clock,engine,pilot,makeClient,makePilot,stores};
}

test('disabled default allows an unpaid evidence-bound proposal but never dispatches or exposes private credentials',async t=>{
 const f=await fixture(t,{enabled:false}),before=JSON.stringify(f.story),p=proposal(await f.pilot.prepare(f.story,body(f.story)));
 assert.equal(p.canConfirm,false);assert.equal(p.state,'prepared');assert.equal(f.pilot.status(f.story).state,'disabled');assert.equal(f.state.queueCalls,0);assert.equal(f.state.dispatches,0);assert.equal(JSON.stringify(f.story),before);
 assert.ok(!JSON.stringify(p).includes(f.config.connection.token));assert.ok(!Object.hasOwn(p,'packet'));await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,p)));assert.equal(f.state.dispatches,0);
});

test('duplicate prepare and confirm clicks create one durable authorization and one dispatch',async t=>{
 const f=await fixture(t),request=body(f.story),[first,second]=await Promise.all([f.pilot.prepare(f.story,request),f.pilot.prepare(f.story,request)]),p=proposal(first);assert.equal(p.id,proposal(second).id);
 const before=JSON.stringify(f.story);const results=await Promise.all([f.pilot.confirm(f.story,confirmation(f.story,p)),f.pilot.confirm(f.story,confirmation(f.story,p))]);
 assert.equal(results[0].id,results[1].id);assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,1);assert.equal(f.pilot.counts().caption,1);assert.equal(JSON.stringify(f.story),before);
 const job=f.research.engineJob(p.id);assert.equal(job.authorization.maxRuns,1);assert.equal(job.authorization.jobId,p.id);assert.equal(f.research.authorizationRemaining(job.authorization),0);assert.notEqual(job.authorization.id,f.config.id);
 await f.pilot.confirm(f.story,confirmation(f.story,p));assert.equal(f.state.dispatches,1);
});

test('an expired unpaid review cannot start and a fresh review for the same direction is available',async t=>{
 const f=await fixture(t),request=body(f.story),p=await f.pilot.prepare(f.story,request);f.clock.now+=21*60000;
 const expired=await f.pilot.prepare(f.story,request);assert.equal(expired.id,p.id);assert.equal(expired.state,'expired');assert.equal(expired.canConfirm,false);
 await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,p)));assert.equal(f.state.queueCalls,0);assert.equal(f.pilot.counts().caption,0);
 const fresh=await f.pilot.prepare(f.story,body(f.story));assert.notEqual(fresh.id,p.id);assert.equal(fresh.state,'prepared');assert.equal(fresh.canConfirm,true);
});

test('concurrent confirmations across two stores cannot exceed one operation in flight',async t=>{
 const f=await fixture(t),store=new LocalResearchStore(f.filename);f.stores.push(store);const engine=new EditorialEngineService({research:store,client:f.engine.client}),second=f.makePilot(store,engine);
 const p1=proposal(await f.pilot.prepare(f.story,body(f.story,'concise'))),p2=proposal(await second.prepare(f.story,body(f.story,'narrative')));
 const results=await Promise.allSettled([f.pilot.confirm(f.story,confirmation(f.story,p1)),second.confirm(f.story,confirmation(f.story,p2))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,1);assert.equal(f.pilot.counts().caption,1);assert.equal(second.status(f.story).state,'busy');
});

test('queue and dispatch uncertainty preserve counts and never resubmit after duplicate confirmation or restart',async t=>{
 for(const mode of ['queue_uncertain','dispatch_uncertain']){
  const f=await fixture(t);f.state.mode=mode;const p=proposal(await f.pilot.prepare(f.story,body(f.story))),out=await f.pilot.confirm(f.story,confirmation(f.story,p));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.pilot.status(f.story).proposal.state,'uncertain');assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,mode==='queue_uncertain'?0:1);assert.equal(f.pilot.counts().caption,1);
  const store=new LocalResearchStore(f.filename);f.stores.push(store);const reopened=f.makePilot(store,new EditorialEngineService({research:store,client:f.engine.client}));await reopened.inspect();await reopened.confirm(f.story,confirmation(f.story,p));assert.equal(reopened.status(f.story).state,'busy');assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,mode==='queue_uncertain'?0:1);
  f.clock.now+=26*3600000;f.config.expiresAt=new Date(f.clock.now+3600000).toISOString();await reopened.inspect();assert.equal(reopened.status(f.story).state,'busy');
 }
});

test('fresh policy checks reject inactive workers, stale revisions and changed captured evidence before any remote write',async t=>{
 const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story)));f.state.workerActive=false;await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,p)));assert.equal(f.state.queueCalls,0);
 f.state.workerActive=true;await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,p),{readStory:()=>({...f.story,localDraft:{...f.story.localDraft,version:3,caption:'Newer founder copy'}})}));assert.equal(f.state.queueCalls,0);
 f.execution.data.resultData.runData['Build Research Prompt'][0].data.main[0][0].json.brandText+=' Changed after proposal review.';await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,p)));assert.equal(f.state.queueCalls,0);assert.equal(f.state.dispatches,0);
});

test('disable survives new store connections and blocks an already prepared request',async t=>{
 const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story)));f.pilot.disable();const store=new LocalResearchStore(f.filename);f.stores.push(store);const reopened=f.makePilot(store,new EditorialEngineService({research:store,client:f.engine.client}));await reopened.inspect();assert.equal(reopened.status(f.story).state,'disabled');await assert.rejects(reopened.confirm(f.story,confirmation(f.story,p)));assert.equal(f.state.queueCalls,0);assert.equal(f.state.dispatches,0);
});

test('disabling between queue acceptance and paid start leaves a durable uncertain reservation instead of spending',async t=>{
 const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story))),base=f.makeClient;
 f.pilot.createClient=options=>{const c=base(options),queue=c.queue;c.queue=async request=>{const result=await queue(request);f.pilot.disable();return result;};return c;};
 await f.pilot.confirm(f.story,confirmation(f.story,p));assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,0);assert.equal(f.pilot.status(f.story).proposal.state,'uncertain');assert.equal(f.pilot.counts().caption,1);
});

test('daily allowance counts confirmed failures and the review threshold is never advertised as a hard cap',async t=>{
 const f=await fixture(t);f.config.dailyCaptionLimit=1;const p=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,p));f.research.recordEngineState(p.id,'failed',{lastError:'REMOTE_EXECUTION_FAILED'});
 const next=proposal(await f.pilot.prepare(f.story,body(f.story,'narrative')));assert.equal(next.canConfirm,false);assert.equal(f.pilot.status(f.story).state,'limit_reached');await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,next)));assert.equal(f.state.dispatches,1);assert.equal(f.pilot.status(f.story).hardBillingCap,false);
});

test('successful observed draft and usage remain separate from working copy and survive store reopen',async t=>{
 const f=await fixture(t),before=JSON.stringify(f.story),p=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,p));
 const saved=f.research.engineJob(p.id),packet=f.pilot.raw(p.id).packet,id='DEV-'+p.id+'-1',candidate={id,jobId:p.id,status:'needs_research',captionDraft:'Synthetic provider draft: the documented relationships lead the story.',provenance:{executionId:'999',kind:'brief',generatedAt:new Date(f.clock.now).toISOString()},recovery:{mode:'draft_only',direction:packet.direction,sourceJobId:packet.source.sourceJobId,sourceCandidateId:packet.source.sourceCandidateId,sourceExecutionId:packet.source.sourceExecutionId,evidenceSha256:packet.evidenceSha256,sourceRevision:packet.source.sourceRevision,workingVersion:packet.source.workingVersion}};
 const usage={inputTokens:100,outputTokens:40,price:null,priceVerified:false};f.research.recordEngineState(p.id,'needs_research',{executionId:'999',candidates:[candidate],evidence:{[id]:{usage}}},saved.version);
 const complete=f.pilot.status(f.story).proposal;assert.equal(complete.state,'completed');assert.equal(complete.versionId,'generated:'+id);assert.equal(complete.executionId,'999');assert.deepEqual(complete.usage,usage);assert.equal(JSON.stringify(f.story),before);
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const reopened=f.makePilot(store,new EditorialEngineService({research:store,client:f.engine.client}));await reopened.inspect();assert.equal(reopened.status(f.story).proposal.state,'completed');assert.deepEqual(reopened.status(f.story).proposal.usage,usage);assert.equal(reopened.counts().caption,1);assert.equal(f.state.dispatches,1);
});

test('strict prepare input rejects caller model/evidence and request-key reuse across changed direction',async t=>{
 const f=await fixture(t),key=randomUUID();for(const extra of [{packet:{}},{sourceUrl:'https://example.org/other'},{authorization:{maxRuns:1}},{model:'other-model'}])await assert.rejects(f.pilot.prepare(f.story,{...body(f.story,'concise',key),...extra}));
 const p=proposal(await f.pilot.prepare(f.story,body(f.story,'concise',key)));await assert.rejects(f.pilot.prepare(f.story,body(f.story,'narrative',key)));assert.equal(f.state.queueCalls,0);assert.equal(f.state.dispatches,0);assert.equal(f.pilot.status(f.story).proposal.id,p.id);
});

test('racing prepare calls cannot bind one idempotency key to two directions',async t=>{
 const f=await fixture(t),key=randomUUID(),results=await Promise.allSettled([f.pilot.prepare(f.story,body(f.story,'concise',key)),f.pilot.prepare(f.story,body(f.story,'narrative',key))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(f.research.db.prepare('SELECT COUNT(*) n FROM studio_generation_actions').get().n,1);assert.equal(f.state.queueCalls,0);assert.equal(f.state.dispatches,0);
});

test('completion with missing or changed recovery lineage stays uncertain and blocks another operation',async t=>{
 for(const mutate of [candidate=>delete candidate.recovery,candidate=>candidate.recovery.sourceExecutionId='9999',candidate=>candidate.recovery.evidenceSha256='f'.repeat(64),candidate=>candidate.recovery.sourceRevision='other-source',candidate=>candidate.recovery.workingVersion=999]){
  const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,p));const packet=f.pilot.raw(p.id).packet,candidate={id:'DEV-'+p.id+'-1',jobId:p.id,status:'ready_to_review',captionDraft:'Synthetic untrusted output.',provenance:{executionId:'999',kind:'brief',generatedAt:new Date(f.clock.now).toISOString()},recovery:{mode:'draft_only',direction:packet.direction,sourceJobId:packet.source.sourceJobId,sourceCandidateId:packet.source.sourceCandidateId,sourceExecutionId:packet.source.sourceExecutionId,evidenceSha256:packet.evidenceSha256,sourceRevision:packet.source.sourceRevision,workingVersion:packet.source.workingVersion}};
  mutate(candidate);f.research.recordEngineState(p.id,'ready_to_review',{executionId:'999',candidates:[candidate]});assert.equal(f.pilot.status(f.story).proposal.state,'uncertain');assert.equal(f.pilot.status(f.story).state,'busy');const next=proposal(await f.pilot.prepare(f.story,body(f.story,'narrative')));assert.equal(next.canConfirm,false);assert.equal(f.state.dispatches,1);
 }
});

test('empty or rejected model output is never presented as a completed caption',async t=>{
 for(const rejected of [false,true]){
  const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,p));f.research.recordEngineState(p.id,rejected?'rejected':'ready_to_review',{executionId:'999',candidates:[{id:'DEV-'+p.id+'-1',jobId:p.id,status:rejected?'rejected':'ready_to_review',captionDraft:rejected?'Rejected synthetic copy.':''}]});assert.notEqual(f.pilot.status(f.story).proposal.state,'completed');assert.ok(!f.pilot.status(f.story).proposal.versionId);assert.equal(f.state.dispatches,1);
 }
});

test('legacy start cannot bypass a confirmed pilot reservation or a durable disable',async t=>{
 const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,p));const legacy=f.research.create({kind:'discovery',prompt:'A synthetic separate story request.'},[]);f.research.claimEngineQueue(legacy.id,requestFingerprint(legacy));f.research.recordEngineState(legacy.id,'queued',{});
 assert.throws(()=>f.pilot.guardLegacyStart(legacy.id),{code:'GENERATION_BUSY'});f.research.recordEngineState(p.id,'failed',{lastError:'REMOTE_EXECUTION_FAILED'});f.pilot.disable();assert.throws(()=>f.pilot.guardLegacyStart(legacy.id));assert.equal(f.state.dispatches,1);
});

test('durable disable cannot be bypassed by removing the policy file and starting through legacy routes',async t=>{
 const f=await fixture(t);f.pilot.disable();f.config.enabled=false;f.config.approved=false;await f.pilot.inspect();
 const legacy=f.research.create({kind:'discovery',prompt:'A synthetic legacy start after disabling.'},[]);f.research.claimEngineQueue(legacy.id,requestFingerprint(legacy));f.research.recordEngineState(legacy.id,'queued',{});
 assert.throws(()=>f.pilot.guardLegacyStart(legacy.id),{code:'CAPTION_POLICY_DISABLED'});assert.equal(f.state.dispatches,0);
});

test('legacy full-story starts share the durable three-per-day allowance under an approved pilot',async t=>{
 const f=await fixture(t);await f.pilot.inspect();
 for(let index=0;index<4;index++){
  const request=f.research.create({kind:'discovery',prompt:'A synthetic full story request number '+index+'.'},[]);f.research.claimEngineQueue(request.id,requestFingerprint(request));f.research.recordEngineState(request.id,'queued',{});
  if(index===3){assert.throws(()=>f.pilot.guardLegacyStart(request.id),{code:'CAPTION_POLICY_DISABLED'});break;}
  f.research.claimEngineDispatch(request.id,f.research.engineJob(request.id).version,randomUUID(),null,{beforeClaim:()=>f.pilot.guardLegacyStart(request.id)});f.research.recordEngineState(request.id,'failed',{lastError:'REMOTE_EXECUTION_FAILED'});
 }
 assert.equal(f.pilot.counts().story,3);assert.equal(f.pilot.counts().caption,0);assert.equal(f.state.dispatches,0);
});

test('working copy is rechecked under the reservation lock after the last awaited source read',async t=>{
 const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story))),input=confirmation(f.story,p),exec=f.research.db.exec.bind(f.research.db);let changed=false;
 f.research.db.exec=sql=>{const result=exec(sql);if(sql==='BEGIN IMMEDIATE'&&!changed){changed=true;f.story.localDraft={...f.story.localDraft,version:3,caption:'An edit after the final asynchronous check.'};}return result;};
 await assert.rejects(f.pilot.confirm(f.story,input,{readStory:()=>f.story}),{code:'EDIT_CONFLICT'});assert.equal(changed,true);assert.equal(f.state.queueCalls,0);assert.equal(f.state.dispatches,0);assert.equal(f.pilot.counts().caption,0);
});

test('edits during the final worker inspection block the paid claim while retaining the queued reservation',async t=>{
 const f=await fixture(t),p=proposal(await f.pilot.prepare(f.story,body(f.story))),input=confirmation(f.story,p),base=f.makeClient;
 f.pilot.createClient=options=>{const client=base(options),inspect=client.inspect;client.inspect=async()=>{const result=await inspect();f.story.localDraft={...f.story.localDraft,version:3,caption:'A newer edit during native inspection.'};return result;};return client;};
 const result=await f.pilot.confirm(f.story,input,{readStory:()=>f.story});assert.equal(result.state,'uncertain');assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,0);assert.equal(f.pilot.counts().caption,1);assert.equal(f.research.engineJob(p.id).lastError,'EDIT_CONFLICT');
});

test('a separately approved one-caption acceptance can prohibit all story starts',async t=>{
 const f=await fixture(t);f.config.dailyCaptionLimit=1;f.config.dailyStoryLimit=0;await f.pilot.inspect();assert.equal(f.pilot.policyState().limits.story,0);assert.equal(f.pilot.policyState().state,'available');
 const p=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,p));assert.equal(f.pilot.counts().caption,1);assert.equal(f.state.dispatches,1);
});


test('policy client rejects a different job before any queue or webhook request',async()=>{
 let calls=0;const client=new EditorialEngineClient({apiKey:'synthetic-api-key',fetchImpl:async()=>{calls++;throw Error('No request expected');},connection:{mode:'standard',generationEnabled:true,executionScope:'caption_policy',jobsTableId:'z22YLsWc4lO1yCG4',candidatesTableId:'W40NQ6jFBZWbpB3U',editorialWorkerId:'6CkqfYc4Pyd4k8vi',headerName:'X-Mildincident-Development-Key',token:'synthetic-private-token-with-thirty-two-characters',approvedGraphSha256:'a'.repeat(64),authorization:{id:randomUUID(),maxRuns:1,expiresAt:new Date(Date.now()+60000).toISOString()},captionAction:{jobId:randomUUID(),requestHash:'b'.repeat(64)}}});
 const other={id:randomUUID(),kind:'brief',prompt:'Different unauthorized request',sourceUrl:''};await assert.rejects(client.queue(other),{code:'CAPTION_SCOPE_MISMATCH'});await assert.rejects(client.dispatch(other,randomUUID()),{code:'CAPTION_SCOPE_MISMATCH'});assert.equal(calls,0);
});

test('confirmed retained evidence survives native history expiry without research replay or old permit reuse',async t=>{
 const f=await fixture(t),first=proposal(await f.pilot.prepare(f.story,body(f.story)));await f.pilot.confirm(f.story,confirmation(f.story,first));const old=f.pilot.raw(first.id);f.research.recordEngineState(first.id,'failed',{lastError:'SIMULATED_TERMINAL_FAILURE'});
 f.engine.client.executionDetails=async()=>{throw Object.assign(new Error('History expired'),{code:'ENGINE_HTTP_404'});};
 const next=proposal(await f.pilot.prepare(f.story,body(f.story,'narrative'))),review=f.pilot.raw(next.id);assert.equal(review.evidenceBasis,'stored_packet');assert.equal(review.packet.authorization,null);assert.equal(review.packet.evidenceSha256,old.packet.evidenceSha256);assert.notEqual(review.id,old.id);
 await f.pilot.confirm(f.story,confirmation(f.story,next));const fresh=f.pilot.raw(next.id);assert.notEqual(fresh.packet.authorization.id,old.packet.authorization.id);assert.equal(fresh.packet.authorization.jobId,next.id);assert.equal(f.state.dispatches,2);assert.equal(f.pilot.counts().caption,2);
 f.research.recordEngineState(next.id,'failed',{lastError:'SIMULATED_TERMINAL_FAILURE'});fresh.packet.evidenceSha256='0'.repeat(64);f.research.db.prepare('UPDATE studio_generation_actions SET data_json=? WHERE id=?').run(JSON.stringify(fresh),next.id);
 await assert.rejects(f.pilot.prepare(f.story,body(f.story,'concise')));assert.equal(f.state.dispatches,2);
});

function recurring(f,operations={caption:true,story:true}){
 Object.assign(f.config,{version:2,mode:'founder_confirmed',operations});
 for(const key of ['dailyCaptionLimit','dailyStoryLimit','reviewThresholdUsd','expiresAt'])delete f.config[key];
}
test('recurring founder policy has no daily quota, but every caption needs a fresh explicit single-use action',async t=>{
 const f=await fixture(t);recurring(f);const grants=new Set();
 for(let i=0;i<8;i++){
  const p=await f.pilot.prepare(f.story,body(f.story));assert.equal(p.canConfirm,true);assert.equal(f.state.dispatches,i);
  await f.pilot.confirm(f.story,confirmation(f.story,p));grants.add(f.pilot.raw(p.id).packet.authorization.id);
  f.research.recordEngineState(p.id,'failed',{lastError:'SIMULATED_TERMINAL_FAILURE'});
 }
 assert.equal(grants.size,8);assert.equal(f.state.dispatches,8);assert.equal(f.pilot.counts().caption,8);assert.equal(f.pilot.policyState().limits,null);assert.equal(f.pilot.policyState().mode,'founder_confirmed');
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const reopened=f.makePilot(store);await reopened.inspect();assert.equal(reopened.counts().caption,8);assert.equal(reopened.policyState().state,'available');
});
test('story review freezes the saved request and preset context; duplicate confirmations dispatch only once and persist the receipt',async t=>{
 const f=await fixture(t);recurring(f);const before=JSON.stringify(f.story),r=f.research.create({kind:'discovery',prompt:'Discover one specific photographic cultural story.'},[]);
 const [a,b]=await Promise.all([f.pilot.prepareStory(r.id),f.pilot.prepareStory(r.id)]);assert.equal(a.id,b.id);assert.equal(a.limits.maxResearchCalls,1);assert.equal(f.state.dispatches,0);
 await Promise.all([f.pilot.confirmStory(r.id,{confirm:true}),f.pilot.confirmStory(r.id,{confirm:true})]);assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,1);assert.equal(f.pilot.counts().story,1);assert.equal(f.pilot.counts().caption,0);
 const p=f.pilot.raw(r.id),candidate={id:'DEV-'+r.id+'-1',jobId:r.id,status:'ready_to_review',captionDraft:'SIMULATED source-grounded story caption.',provenance:{executionId:'999',kind:'discovery',generatedAt:new Date(f.clock.now).toISOString()}};
 f.research.recordEngineState(r.id,'ready_to_review',{executionId:'999',candidates:[candidate],evidence:{[candidate.id]:{usage:{inputTokens:4564,outputTokens:626,models:[{toolCalls:0}]}}}});
 const out=f.pilot.storyStatus(r.id);assert.equal(out.state,'completed');assert.equal(out.resultStoryId,'CON-DEV-'+r.id);assert.equal(out.estimatedUsd,.0208);assert.equal(f.pilot.usageSummary().allTime.operations,1);assert.equal(f.pilot.usageSummary().allTime.estimatedUsd,.0208);assert.equal(p.authorization.maxRuns,1);assert.equal(f.research.authorizationRemaining(p.authorization),0);assert.equal(JSON.stringify(f.story),before);
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const reopened=f.makePilot(store);await reopened.inspect();assert.equal(reopened.storyStatus(r.id).state,'completed');assert.equal(reopened.usageSummary().recent[0].executionId,'999');await reopened.confirmStory(r.id,{confirm:true});assert.equal(f.state.dispatches,1);
});
test('a completed needs-research story exposes its real draft and review gaps without another dispatch or approval',async t=>{
 const f=await fixture(t);recurring(f);const r=f.research.create({kind:'brief',prompt:'A specific cultural story fixture.'},[]);await f.pilot.prepareStory(r.id);await f.pilot.confirmStory(r.id,{confirm:true});
 const candidate={id:'DEV-'+r.id+'-1',jobId:r.id,status:'needs_research',title:'A preliminary story',captionDraft:'A source-grounded preliminary caption, not publication-approved.',photographicStage:'needs_research',provenance:{executionId:'999'},claims:[{claim:'A source-reported fact.',url:sourceUrl,sourceName:'Original publisher'},{claim:'An editorial inference.',url:sourceUrl,sourceName:'Editorial inference'}],gaps:['Image identity and permission remain unverified.']};
 f.research.recordEngineState(r.id,'needs_research',{executionId:'999',candidates:[candidate]});const out=f.pilot.storyStatus(r.id);assert.equal(out.state,'completed');assert.equal(out.editorialStatus,'preliminary');assert.equal(out.preview.caption,candidate.captionDraft);assert.equal(out.preview.claims.length,2);assert.equal(out.preview.sources.length,1);assert.equal(out.preview.sources[0].label,'Original publisher');assert.deepEqual(out.preview.gaps,candidate.gaps);assert.equal(out.canConfirm,false);assert.equal(f.state.dispatches,1);assert.equal(f.pilot.storyStatus(r.id).executionId,'999');
});
test('caption and story confirmations share one durable in-flight slot across independent database connections',async t=>{
 const f=await fixture(t);recurring(f);const store=new LocalResearchStore(f.filename);f.stores.push(store);const second=f.makePilot(store),r=f.research.create({kind:'discovery',prompt:'A separately confirmed cultural story.'},[]),caption=await f.pilot.prepare(f.story,body(f.story));await second.prepareStory(r.id);
 const results=await Promise.allSettled([f.pilot.confirm(f.story,confirmation(f.story,caption)),second.confirmStory(r.id,{confirm:true})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.state.dispatches,1);assert.equal(f.state.queueCalls,1);
});
test('lost story queue or dispatch response is durable uncertainty and never resubmits, including after restart',async t=>{
 for(const mode of ['queue_uncertain','dispatch_uncertain']){
  const f=await fixture(t);recurring(f);f.state.mode=mode;const r=f.research.create({kind:'discovery',prompt:'A single simulated editorial generation.'},[]);await f.pilot.prepareStory(r.id);await f.pilot.confirmStory(r.id,{confirm:true});await new Promise(r=>setImmediate(r));
  const store=new LocalResearchStore(f.filename);f.stores.push(store);const reopened=f.makePilot(store);await reopened.inspect();assert.equal(reopened.storyStatus(r.id).state,'uncertain');await reopened.confirmStory(r.id,{confirm:true});assert.equal(f.state.queueCalls,1);assert.equal(f.state.dispatches,mode==='queue_uncertain'?0:1);assert.equal(reopened.policyState('story').state,'busy');
 }
});
test('operation allowlist, changed source binding, durable disable and legacy bypass remain fail-closed under per-use approval',async t=>{
 const f=await fixture(t);recurring(f,{caption:false,story:true});const p=await f.pilot.prepare(f.story,body(f.story));assert.equal(p.canConfirm,false);await assert.rejects(f.pilot.confirm(f.story,confirmation(f.story,p)));
 const r=f.research.create({kind:'discovery',prompt:'An original direction that must stay exact.'},[]);await f.pilot.prepareStory(r.id);f.research.db.prepare('UPDATE research_requests SET prompt=? WHERE id=?').run('A different direction after review.',r.id);await assert.rejects(f.pilot.confirmStory(r.id,{confirm:true}),{code:'EDIT_CONFLICT'});assert.equal(f.state.dispatches,0);
 f.pilot.disable();const next=f.research.create({kind:'discovery',prompt:'A fresh direction while future starts are disabled.'},[]);await f.pilot.prepareStory(next.id);await assert.rejects(f.pilot.confirmStory(next.id,{confirm:true}));assert.throws(()=>f.pilot.guardLegacyStart(next.id),{code:'CAPTION_POLICY_DISABLED'});assert.equal(f.state.dispatches,0);
});

test('source stories and older caption drafts remain available beyond the recent activity window',async t=>{
 const f=await fixture(t),source=f.research.create({kind:'brief',prompt:'A retained source story before many later operations.'},[]);f.research.claimEngineQueue(source.id,'a'.repeat(64));f.research.recordEngineState(source.id,'ready_to_review',{executionId:'2353',candidates:[{id:'DEV-'+source.id+'-1',captionDraft:'Retained original caption.'}]});
 for(let i=0;i<105;i++)f.research.create({kind:'brief',prompt:'A later saved direction number '+i+'.'},[]);
 assert.equal(f.research.all().length,100);assert.ok(!f.research.all().some(r=>r.id===source.id));assert.ok(f.research.workspaceRequests().some(r=>r.id===source.id));assert.equal(f.research.workspaceRequests().length,101);
});
