import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';
import {PhotographyService} from '../src/photography/service.js';
import {PhotoVisionPilot} from '../src/workspace/photo-vision-pilot.js';
import {CaptionPilot,preparePhotoVisionPolicyProposal} from '../src/workspace/caption-pilot.js';
import {EditorialEngineClient} from '../src/workspace/editorial-engine-client.js';
import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {prepareReusablePhotoVisualWorker} from '../src/n8n/photo-visual-worker.js';
import {editorialGraphSha} from '../src/n8n/v14-editorial-patch.js';
import {OBSERVED_RESEARCH_CONNECTION} from '../src/workspace/research-connection.js';

const connection={...OBSERVED_RESEARCH_CONNECTION,headerName:'X-Mildincident-Development-Key',token:'synthetic-photo-test-private-connection-0123456789'};
const workerId=connection.editorialWorkerId;
const output=json=>[{data:{main:[[{json}]]}}];
const waitFor=async predicate=>{for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,5));assert(predicate(),'The isolated local operation should settle.');};
function baseline(){return {id:workerId,name:'MILDINCIDENT DEV — bounded editorial generation',versionId:'accepted-before',activeVersionId:'accepted-before',settings:{executionOrder:'v1',executionTimeout:240,availableInMCP:true},connections:{'Development Job Claimed?':{main:[[{node:'Caption Improvement?',type:'main',index:0}]]}},nodes:[
 {name:'Research Candidates',type:'@n8n/n8n-nodes-langchain.openAi',retryOnFail:false,parameters:{modelId:{value:'gpt-5.4'},options:{maxTokens:3500,maxToolCalls:2}}},
 {name:'Draft Editorial Concept',type:'@n8n/n8n-nodes-langchain.openAi',retryOnFail:false,parameters:{modelId:{value:'gpt-5.4'},options:{maxTokens:1800}},credentials:{openAiApi:{id:'SYNTHETIC_ONLY'}}},
 {name:'Guard Draft Input Budget',type:'n8n-nodes-base.code',parameters:{}},
 {name:'Validate Caption Improvement',type:'n8n-nodes-base.code',parameters:{jsCode:'/* CAPTION_IMPROVEMENT_PACKET_V1_INVALID */'}},
 {name:'Finish Development Job',type:'n8n-nodes-base.dataTable',parameters:{operation:'update',dataTableId:{value:connection.jobsTableId},columns:{value:{}}}},
 {name:'Return Development Job',type:'n8n-nodes-base.respondToWebhook',parameters:{}}
 ]};}
async function fixture(t,{approved=false,noEngine=false,count=3}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-reusable-vision-')),filename=path.join(root,'research.sqlite'),research=new LocalResearchStore(filename),previews=new LocalPreviewStore(path.join(root,'previews')),photography=new PhotographyService(research,{previews}),stores=[research];
 t.after(async()=>{for(const store of stores)store.close();previews.close();await fs.rm(root,{recursive:true,force:true});});
 const story={id:'CON-generated-vision-fixture',origin:'n8n_development',revision:'source-r1',subject:'Generated geometric fixture',title:'Generated geometric fixture',caption:'The founder’s existing caption.',media:[],selectedAssetIds:['fixture-0'],localDraft:{version:2,caption:'The founder’s saved working caption.',selectedAssetIds:['fixture-0']}},photoRequestId=randomUUID(),digest='a'.repeat(64),pageSha256='b'.repeat(64);
 photography.storyTables();const receipt={createdAt:new Date().toISOString(),packet:{digest,payload:{target:{storyId:story.id,sourceRevision:story.revision,workingVersion:2},direction:{source:'project',query:'Generated geometric fixture',page:1}}},receipt:{photos:[]},plan:{}};
 research.db.prepare('INSERT INTO photo_story_requests VALUES(?,?,?,?,?)').run(photoRequestId,story.id,'complete',JSON.stringify(receipt),receipt.createdAt);
 for(let n=0;n<count;n++){
  const assetId='fixture-'+n,bytes=await sharp(Buffer.from(`<svg width="900" height="600"><rect width="900" height="600" fill="#${n+2}56789"/><circle cx="${100+n*170}" cy="300" r="80" fill="white"/><text x="30" y="570" fill="white" font-size="24">GENERATED NON EDITORIAL TEST ${n}</text></svg>`)).jpeg().toBuffer();
  const p=await previews.save({storyId:story.id,assetId,bytes,contentType:'image/jpeg',originalName:'generated-test-'+n+'.jpg',declaration:'private_review_only'}),sourceUrl='https://www.life.com/generated-fixture',imageUrl='https://static.life.com/generated-'+n+'.jpg';
  previews.recordPhotoSourceAcquisition(story.id,assetId,p.sha256,{sourceUrl,imageUrl,requestId:photoRequestId,inputDigest:digest,pageSha256});story.media.push({id:assetId,title:'Generated fixture '+n,sourceUrl,sourceCaption:'Generated test geometry.',creator:'Test only',localPreview:previews.get(story.id,assetId),rightsGranted:false});
 }
 const base=baseline(),prepared=prepareReusablePhotoVisualWorker(base,{expectedVersion:base.versionId,expectedSha256:editorialGraphSha(base)}),workflow={...prepared.workflow,id:workerId,versionId:'reusable-fixture-v1',activeVersionId:'reusable-fixture-v1',active:true,activeVersion:{nodes:prepared.workflow.nodes,connections:prepared.workflow.connections}},clock={now:Date.now()};
 const config={version:2,mode:'founder_confirmed',id:randomUUID(),enabled:true,approved:true,workerVersion:base.versionId,graphSha256:editorialGraphSha(base),operations:{caption:true,story:true},connection};
 config.photoVision=preparePhotoVisionPolicyProposal({basePolicy:config,workerVersion:workflow.versionId,graphSha256:prepared.review.graphSha256,now:clock.now});if(approved)Object.assign(config.photoVision,{approved:true,enabled:true});
 const state={posts:0,dispatches:0,reads:0,mode:'complete',jobs:[],executions:new Map(),nextExecution:9000,afterQueue:null};
 function nativeResult(row,{failed=false,version=workflow.versionId,graph=workflow}={}){
  const dispatch={job_id:row.job_id,request_hash:row.request_hash,dispatch_id:randomUUID()},claimed={...row,status:'generating',lease_token:dispatch.dispatch_id},executionId=String(++state.nextExecution),rows={'Verify Development Claim':claimed,'Validate Development Dispatch':dispatch},by=name=>workflow.nodes.find(n=>n.name===name);
  const run=(name,input)=>vm.runInNewContext('(function(){'+by(name).parameters.jsCode+'})()',{$:name=>({first:()=>({json:rows[name]})}),$input:{first:()=>({json:input})},$execution:{id:executionId},Buffer});
  const validated=run('Validate Photo Assessment',claimed)[0].json;rows['Validate Photo Assessment']=validated;const count=validated.packet.images.length;
  const compact={version:2,images:validated.packet.images.map((_,i)=>({i,fit:'likely',seen:'SIMULATED generated geometry.',frame:'SIMULATED circle at a fixture position.',difference:'Generated fixture '+i+'.',use:i?'SIMULATED supporting frame.':'SIMULATED cover.',duplicate:null})),order:Array.from({length:count},(_,i)=>count-i-1)};
  const model={id:'simulated-response',status:failed?'incomplete':'completed',max_output_tokens:1200,...(failed?{incomplete_details:{reason:'max_output_tokens'}}:{}),output:[{type:'message',content:[{type:'output_text',text:failed?'PARTIAL MUST NEVER BE SALVAGED':JSON.stringify(compact)}]}],usage:{input_tokens:1500,output_tokens:failed?1200:400,total_tokens:failed?2700:1900}};
  const runData={'Validate Photo Assessment':output(validated),['Assess Photo Pixels '+count]:output(model)};
  if(failed){assert.throws(()=>run('Finalize Photo Assessment',model),/PHOTO_OUTPUT_LIMIT_EXCEEDED/);runData['Finalize Photo Assessment']=[{data:{main:[[],[{json:{error:'PHOTO_OUTPUT_LIMIT_EXCEEDED'}}]]}}];runData['Fail Development Job']=output({job_id:row.job_id,execution_id:executionId,status:'failed',result_count:0});}
  else runData['Finalize Photo Assessment']=output(run('Finalize Photo Assessment',model)[0].json);
  const execution={id:executionId,workflowId:workerId,workflowVersionId:version,workflowData:structuredClone(graph),status:'success',data:{resultData:{lastNodeExecuted:failed?'Return Development Failure':'Return Photo Assessment',runData}}};state.executions.set(executionId,execution);
  Object.assign(row,{status:failed?'failed':'ready_to_review',error:failed?'PHOTO_OUTPUT_LIMIT_EXCEEDED':'',execution_id:executionId,result_count:0,result_json:failed?'':runData['Finalize Photo Assessment'][0].data.main[0][0].json.result_json});return execution;
 }
 const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 const fetchImpl=async(url,options={})=>{
  const u=new URL(url);state.reads++;
  if(u.pathname==='/api/v1/workflows/'+workerId)return json(workflow);
  if(u.pathname==='/api/v1/data-tables/'+connection.jobsTableId)return json({name:'mildincident_dev_editorial_jobs',columns:[{name:'editorial_context_json'}]});
  if(u.pathname==='/api/v1/data-tables/'+connection.candidatesTableId)return json({name:'mildincident_dev_editorial_candidates'});
  if(u.pathname==='/api/v1/data-tables/'+connection.jobsTableId+'/rows'){
   if(options.method==='POST'){state.posts++;state.jobs.push({...JSON.parse(options.body).data[0],id:state.posts});state.afterQueue?.();if(state.mode==='queue_uncertain')throw Error('SIMULATED lost queue response');}return json({data:state.jobs});
  }
  if(u.pathname==='/api/v1/data-tables/'+connection.candidatesTableId+'/rows')return json({data:[]});
  if(u.pathname.startsWith('/api/v1/executions/')){const execution=state.executions.get(u.pathname.split('/').at(-1));assert(execution);return json(execution);}
  if(u.pathname==='/webhook/mildincident-dev-editorial-job-v1'){
   state.dispatches++;const dispatch=JSON.parse(options.body),row=state.jobs.find(j=>j.job_id===dispatch.job_id);assert(row);assert.equal(row.request_hash,dispatch.request_hash);
   if(state.mode==='dispatch_uncertain')throw Error('SIMULATED lost dispatch response');
   const execution=nativeResult(row,{failed:state.mode==='failed'});return json({accepted:true,scope:'development_only',productionApplied:false,jobId:row.job_id,status:row.status,executionId:execution.id,...(state.mode==='failed'?{failureCode:'PHOTO_OUTPUT_LIMIT_EXCEEDED'}:{})});
  }assert.fail('Unexpected isolated request '+u.pathname);
 };
 const makeClient=({connection:override})=>new EditorialEngineClient({connection:override,apiKey:'synthetic-api-key',fetchImpl});
 function make(store=research){const service=new PhotographyService(store,{previews}),engine=noEngine?null:new EditorialEngineService({research:store,client:makeClient({connection:{...connection,mode:'read_only',generationEnabled:false}})}),captionPilot=noEngine?null:new CaptionPilot({research:store,engine,loadConfig:async()=>structuredClone(config),createClient:makeClient,now:()=>clock.now});if(engine)engine.captionPilot=captionPilot;return {pilot:new PhotoVisionPilot({research:store,photography:service,engine,captionPilot,createClient:makeClient,now:()=>clock.now}),captionPilot,engine,photography:service};}
 const services=make();return {root,filename,research,previews,story,photoRequestId,config,workflow,state,clock,make,stores,nativeResult,...services};
}
const prepareInput=(f,assetIds=f.story.media.map(a=>a.id),key=randomUUID())=>({sourceRevision:f.story.revision,workingVersion:f.story.localDraft.version,photoRequestId:f.photoRequestId,assetIds,idempotencyKey:key});
const confirmInput=(f,p)=>({proposalId:p.id,sourceRevision:f.story.revision,workingVersion:f.story.localDraft.version,confirm:true});

test('disabled and disconnected preparation is unpaid, receipt-bound, idempotent and browser safe',async t=>{
 const f=await fixture(t,{noEngine:true,count:6}),before=JSON.stringify(f.story),input=prepareInput(f),[p,duplicate]=await Promise.all([f.pilot.prepare(f.story,input),f.pilot.prepare(f.story,input)]);
 assert.equal(p.id,duplicate.id);assert.equal(p.state,'prepared');assert.equal(p.canConfirm,false);assert.equal(p.modelCalls,0);assert.equal(p.images.length,6);assert.equal(f.pilot.status(f.story).eligibleBatches[0].assetIds.length,6);assert.equal(f.pilot.policyState().state,'disabled');
 const raw=f.pilot.raw(p.id),safe=JSON.stringify(p);assert(!safe.includes(raw.packet.images[0].data));assert(!safe.includes(raw.packet.approvalId));assert(!safe.includes(connection.token));assert(!Object.hasOwn(p,'packet'));assert.equal(f.photography.storyRequest(f.photoRequestId).visualReviews.length,1);
 await assert.rejects(f.pilot.confirm(f.story,confirmInput(f,p)),{code:'PHOTO_NOT_AUTHORIZED'});assert.equal(f.state.posts,0);assert.equal(f.state.dispatches,0);assert.equal(JSON.stringify(f.story),before);
 for(const extra of [{packet:{}},{model:'other'},{authorization:{}},{sourceUrl:'https://example.org'}])await assert.rejects(f.pilot.prepare(f.story,{...input,...extra}));
 await assert.rejects(f.pilot.prepare(f.story,{...input,assetIds:[...input.assetIds].reverse()}),{code:'EDIT_CONFLICT'});
});

test('one approved reusable graph handles duplicate confirm and different input counts with one claim per operation; Apply stays separate',async t=>{
 const f=await fixture(t,{approved:true}),before=JSON.stringify(f.story),graphBefore=JSON.stringify(f.workflow),p=await f.pilot.prepare(f.story,prepareInput(f));assert.equal(p.canConfirm,true);
 await Promise.all([f.pilot.confirm(f.story,confirmInput(f,p)),f.pilot.confirm(f.story,confirmInput(f,p))]);await waitFor(()=>f.research.engineJob(p.id)?.state==='ready_to_review');
 const view=f.pilot.status(f.story).proposal;assert.equal(view.state,'completed');assert.equal(f.state.posts,1);assert.equal(f.state.dispatches,1);assert.equal(view.result.images.length,3);assert.deepEqual(view.result.recommendedAssetIds,[...p.assetIds].reverse());assert.equal(JSON.stringify(f.story),before);assert.equal(f.photography.selectionReview(f.story).verified,true);
 assert.deepEqual(f.captionPilot.counts(),{caption:0,story:0});assert.equal(f.captionPilot.policyState('story').state,'available');assert.equal(f.captionPilot.usageReview().operations,1);assert.equal(f.captionPilot.usageReview().unmeasuredOperations,0);assert.equal(view.usage.output_tokens,400);assert.equal(view.applyRequired,true);
 const next=await f.pilot.prepare(f.story,prepareInput(f,[f.story.media[1].id]));await f.pilot.confirm(f.story,confirmInput(f,next));await waitFor(()=>f.research.engineJob(next.id)?.state==='ready_to_review');assert.equal(f.pilot.status(f.story).proposal.result.images.length,1);assert.equal(f.state.dispatches,2);assert.equal(JSON.stringify(f.workflow),graphBefore);
 for(const id of [p.id,next.id]){const job=f.research.engineJob(id);assert.equal(job.authorization.maxRuns,1);assert.equal(f.research.authorizationRemaining(job.authorization),0);assert.equal(f.research.db.prepare("SELECT COUNT(*) n FROM research_engine_events WHERE request_id=? AND state='dispatching'").get(id).n,1);}
});

test('ambiguous dispatch and restart retain one spent claim; read-only reconcile imports the original result while Disable remains effective',async t=>{
 const f=await fixture(t,{approved:true}),p=await f.pilot.prepare(f.story,prepareInput(f));f.state.mode='dispatch_uncertain';await f.pilot.confirm(f.story,confirmInput(f,p));await waitFor(()=>f.research.engineJob(p.id)?.state==='dispatch_uncertain');
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const restarted=f.make(store);await restarted.pilot.inspect();assert.equal(restarted.pilot.status(f.story).proposal.state,'uncertain');assert.equal(restarted.captionPilot.policyState('story').state,'busy');
 await restarted.pilot.confirm(f.story,confirmInput(f,p));assert.equal(f.state.dispatches,1);assert.equal(f.state.posts,1);restarted.captionPilot.disable();f.nativeResult(f.state.jobs[0]);
 const reconciled=await restarted.pilot.refresh(f.story,p.id);assert.equal(reconciled.state,'completed');assert.equal(restarted.pilot.policyState().state,'disabled');assert.equal(restarted.captionPilot.policyState('story').state,'disabled');assert.equal(f.state.dispatches,1);assert.equal(f.state.posts,1);assert.equal(restarted.photography.selectionReview(f.story).executionId,reconciled.executionId);
});

test('ambiguous queue is reserved across restart and duplicate confirmation never queues or dispatches again',async t=>{
 const f=await fixture(t,{approved:true}),p=await f.pilot.prepare(f.story,prepareInput(f));f.state.mode='queue_uncertain';await f.pilot.confirm(f.story,confirmInput(f,p));assert.equal(f.research.engineJob(p.id).state,'queue_uncertain');
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const restarted=f.make(store);await restarted.pilot.inspect();await restarted.pilot.confirm(f.story,confirmInput(f,p));assert.equal(f.state.posts,1);assert.equal(f.state.dispatches,0);assert.equal(restarted.captionPilot.busy(),true);
 await restarted.pilot.refresh(f.story,p.id);await restarted.pilot.confirm(f.story,confirmInput(f,p));assert.equal(f.state.posts,1);assert.equal(f.state.dispatches,0);assert.equal(restarted.captionPilot.busy(),true);
});

test('a terminal failed assessment retains measured usage and no partial judgment, releases the shared claim, and survives restart',async t=>{
 const f=await fixture(t,{approved:true}),p=await f.pilot.prepare(f.story,prepareInput(f));f.state.mode='failed';await f.pilot.confirm(f.story,confirmInput(f,p));await waitFor(()=>f.research.engineJob(p.id)?.photoFailure);
 const view=f.pilot.status(f.story).proposal;assert.equal(view.state,'failed');assert.equal(view.result,null);assert.equal(view.usage.output_tokens,1200);assert.equal(view.failureCode,'PHOTO_OUTPUT_LIMIT_EXCEEDED');assert(!JSON.stringify(view).includes('PARTIAL MUST NEVER'));assert.equal(f.photography.selectionReview(f.story),null);assert.equal(f.captionPilot.busy(),false);assert.equal(f.captionPilot.usageReview().unmeasuredOperations,0);
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const restarted=f.make(store);await restarted.pilot.inspect();assert.equal(restarted.pilot.status(f.story).proposal.state,'failed');assert.equal(restarted.pilot.status(f.story).proposal.usage.output_tokens,1200);await restarted.pilot.confirm(f.story,confirmInput(f,p));assert.equal(f.state.dispatches,1);
});

test('Disable between queue acceptance and claim blocks spending and leaves a durable reservation',async t=>{
 const f=await fixture(t,{approved:true}),p=await f.pilot.prepare(f.story,prepareInput(f));f.state.afterQueue=()=>f.captionPilot.disable();await f.pilot.confirm(f.story,confirmInput(f,p));
 assert.equal(f.state.posts,1);assert.equal(f.state.dispatches,0);assert.equal(f.research.engineJob(p.id).state,'dispatch_uncertain');assert.equal(f.pilot.policyState().state,'disabled');assert.equal(f.captionPilot.disabled(),true);
});

test('confirmation rechecks working revision, exact source metadata, private bytes, reviewed policy graph and expiry',async t=>{
 const f=await fixture(t,{approved:true}),input=prepareInput(f),p=await f.pilot.prepare(f.story,input);
 await assert.rejects(f.pilot.confirm(f.story,confirmInput(f,p),{readStory:()=>({...f.story,localDraft:{...f.story.localDraft,version:3}})}),{code:'EDIT_CONFLICT'});
 const record=f.previews.get(f.story.id,input.assetIds[0]),filename=path.join(f.previews.root,'blobs',record.sha256+'.jpg'),bytes=await fs.readFile(filename);await fs.writeFile(filename,Buffer.from('CORRUPTED GENERATED TEST BYTES'));await assert.rejects(f.pilot.confirm(f.story,confirmInput(f,p)),{code:'LOCAL_PREVIEW_CORRUPTED'});await fs.writeFile(filename,bytes);
 f.config.photoVision.graphSha256='f'.repeat(64);await assert.rejects(f.pilot.confirm(f.story,confirmInput(f,p)),{code:'PHOTO_NOT_AUTHORIZED'});f.config.photoVision.graphSha256=editorialGraphSha(f.workflow);
 f.clock.now+=21*60000;await assert.rejects(f.pilot.confirm(f.story,confirmInput(f,p)),{code:'PHOTO_NOT_AUTHORIZED'});assert.equal(f.state.posts,0);assert.equal(f.state.dispatches,0);
});

test('a completed result with later edits stays historical and cannot become the current selection review',async t=>{
 const f=await fixture(t,{approved:true}),p=await f.pilot.prepare(f.story,prepareInput(f));await f.pilot.confirm(f.story,confirmInput(f,p));await waitFor(()=>f.research.engineJob(p.id)?.photoResult);f.story.localDraft.version++;
 assert.equal(f.pilot.status(f.story).proposal.state,'review_required');assert.equal(f.photography.selectionReview(f.story),null);assert.equal(f.story.localDraft.caption,'The founder’s saved working caption.');assert.deepEqual(f.story.selectedAssetIds,['fixture-0']);
});

test('one-time photo acceptance stays consumed after terminal failure and restart without restricting recurring caption/story',async t=>{
 const f=await fixture(t,{approved:true});f.config.photoVision.operationLimit=1;const p=await f.pilot.prepare(f.story,prepareInput(f));f.state.mode='failed';await f.pilot.confirm(f.story,confirmInput(f,p));await waitFor(()=>f.research.engineJob(p.id)?.photoFailure);
 assert.equal(f.pilot.policyState().state,'limit_reached');assert.equal(f.captionPilot.policyState('caption').state,'available');assert.equal(f.captionPilot.policyState('story').state,'available');
 const store=new LocalResearchStore(f.filename);f.stores.push(store);const restarted=f.make(store);await restarted.pilot.inspect();const next=await restarted.pilot.prepare(f.story,prepareInput(f));assert.equal(next.canConfirm,false);await assert.rejects(restarted.pilot.confirm(f.story,confirmInput(f,next)),{code:'PHOTO_NOT_AUTHORIZED'});assert.equal(f.state.posts,1);assert.equal(f.state.dispatches,1);assert.equal(restarted.pilot.policyState().limits.confirmedOperations,1);
});
