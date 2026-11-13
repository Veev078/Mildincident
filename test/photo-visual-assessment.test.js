import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import vm from 'node:vm';import {createHash,randomUUID} from 'node:crypto';import sharp from 'sharp';
import {createWorkspaceServer} from '../src/workspace/server.js';
import {EditorialEngineClient,requestFingerprint} from '../src/workspace/editorial-engine-client.js';import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';import {LocalResearchStore} from '../src/workspace/research-store.js';import {PhotographyService} from '../src/photography/service.js';import {photoSha256,photoJpegSize,prepareVisualAssessment,validateVisualJob,visualModelMessages,validateVisualResult,captureVisualExecution} from '../src/photography/visual-assessment.js';import {preparePhotoVisualWorker} from '../src/n8n/photo-visual-worker.js';import {editorialGraphSha} from '../src/n8n/v14-editorial-patch.js';
const workerId='6CkqfYc4Pyd4k8vi';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-photo-vision-')),research=new LocalResearchStore(root+'/research.sqlite'),previews=new LocalPreviewStore(root+'/previews');t.after(async()=>{research.close();previews.close();await fs.rm(root,{recursive:true,force:true});});
 const story={id:'CON-vision-fixture',revision:'revision-1',subject:'Test Maker, Test Project',research:[{url:'https://www.life.com/test-project',capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker created Test Project.'}],media:[],selectedAssetIds:[],caption:'Existing caption.',localDraft:{version:0,selectedAssetIds:[]}},service=new PhotographyService(research,{previews,readProjectPage:async()=>'<html>'+Array.from({length:6},(_,i)=>`<figure><img src="https://static.life.com/generated-${i}.jpg"><figcaption>Test Maker, Test Project. Photos by Test Maker.</figcaption></figure>`).join('')+'</html>',fetchImage:async url=>{const n=Number(url.match(/generated-(\d)/)[1]);return new Response(await sharp(Buffer.from(`<svg width="700" height="900"><rect width="700" height="900" fill="#${n+2}56789"/><circle cx="${100+n*70}" cy="250" r="100" fill="white"/><text x="30" y="750" fill="white" font-size="26">GENERATED TEST FRAME ${n}</text></svg>`)).jpeg().toBuffer(),{headers:{'content-type':'image/jpeg'}});}});
 const p=service.prepareDiscovery(story,{idempotencyKey:randomUUID(),sourceRevision:story.revision,workingVersion:0,direction:'best'});await service.searchStoryRequest(story,p.id,{confirm:true,sourceRevision:story.revision,workingVersion:0});story.media=service.storyMedia(story);assert.equal(story.media.length,6);const request=service.storyRequest(p.id),prepared=await prepareVisualAssessment({story,request,assetIds:story.media.map(a=>a.id),previews,workerId});
 return {root,research,previews,story,service,request,prepared};
}
function bound(packet){const p=structuredClone(packet);p.authorization={scope:'photo_vision_v1',id:p.approvalId,jobId:p.jobId,maxRuns:1,expiresAt:new Date(Date.now()+10*60000).toISOString()};const context={photoAssessment:p},row={job_id:p.jobId,kind:'brief',prompt:'Assess these exact source-bound photographs.',source_url:'',editorial_context_json:JSON.stringify(context),lease_token:randomUUID(),status:'generating'};row.request_hash=photoSha256(JSON.stringify({kind:row.kind,prompt:row.prompt,sourceUrl:'',editorialContext:context}));return {p,row,dispatch:{job_id:row.job_id,request_hash:row.request_hash,dispatch_id:row.lease_token},options:{workerId,approvedJobId:p.jobId,approvalId:p.approvalId}};}
const output=p=>({manifestSha256:p.manifestSha256,images:p.images.map(i=>({assetId:i.assetId,inputSha256:i.inputSha256,relevance:'likely',observations:'SIMULATED assessment of generated test pixels.',composition:'Visible fixture geometry only.',distinctiveness:'Distinct generated circle positions.',carouselPotential:'Possible fixture sequence; no real editorial judgment.',duplicateOf:null})),recommendedAssetIds:[p.images[0].assetId]});

test('six scoped private images become real bounded image blocks with independently verified byte hashes, not text URLs',async t=>{
 const {prepared,previews,story}=await fixture(t),p=prepared.packet;assert.equal(p.images.length,6);assert(prepared.review.packetCharacters<180000);for(const i of p.images){const bytes=Buffer.from(i.data,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),i.inputSha256);assert.deepEqual(photoJpegSize(bytes),{width:i.width,height:i.height});assert(i.width<=512&&i.height<=512);await sharp(bytes).raw().toBuffer();assert(previews.get(story.id,i.assetId).sourceInspection);}
 const b=bound(p);assert.equal(validateVisualJob(b.row,b.dispatch,b.options).manifestSha256,p.manifestSha256);const messages=visualModelMessages(p);assert.equal(messages.filter(m=>m.type==='image'&&m.imageUrl.startsWith('data:image/jpeg;base64,')).length,6);assert(!messages[0].content.includes(p.images[0].data));
 for(const change of [q=>q.authorization.scope='caption',q=>q.authorization.expiresAt='2020-01-01',q=>q.images[0].data=q.images[0].data.slice(4),q=>q.images.reverse()]){const c=bound(p);change(c.p);c.row.editorial_context_json=JSON.stringify({photoAssessment:c.p});assert.throws(()=>validateVisualJob(c.row,c.dispatch,c.options));}
 assert.throws(()=>validateVisualResult({...output(p),recommendedAssetIds:['unrecorded']},p));const bad=output(p);bad.images[0].inputSha256='0'.repeat(64);assert.throws(()=>validateVisualResult(bad,p));assert.equal(validateVisualResult(output(p),p).images.length,6);
});

test('photo results persist separately, never change caption/order/rights, reject another execution and quarantine later edits',async t=>{
 const {service,story,request,research,previews,root}=await fixture(t),before=JSON.stringify({caption:story.caption,selected:story.selectedAssetIds,media:story.media});const review=await service.prepareVisualReview(story,request.id,{assetIds:story.media.map(a=>a.id),sourceRevision:story.revision,workingVersion:0}),stored=service.storyRequest(request.id).visualReviews[0],p=stored.packet;
 const envelope={rightsGranted:false,publicationApproved:false,purpose:'private_photo_visual_assessment_result',jobId:p.jobId,manifestSha256:p.manifestSha256,result:output(p),executionId:'9999',usage:{input_tokens:1800,output_tokens:300}};
 const execution={id:'9999',workflowId:workerId,status:'success',data:{resultData:{runData:{'Validate Photo Assessment':[{data:{main:[[{json:{packet:p}}]]}}],'Finalize Photo Assessment':[{data:{main:[[{json:{result_json:JSON.stringify(envelope)}}]]}}]}}}};
 assert.equal(service.acceptVisualReview(story,request.id,execution,{offline:true}).visualReviews[0].state,'offline_simulation');assert.equal(service.selectionReview(story),null);const reopened=new LocalResearchStore(root+'/research.sqlite'),reopenedPreviews=new LocalPreviewStore(root+'/previews');try{const restarted=new PhotographyService(reopened,{previews:reopenedPreviews});assert.equal(restarted.storyRequestsFor(story)[0].visualReviews[0].manifestSha256,review.manifestSha256);}finally{reopened.close();reopenedPreviews.close();}assert.equal(JSON.stringify({caption:story.caption,selected:story.selectedAssetIds,media:story.media}),before);
 // Synthetic storage contract only: emulate a previously verified receipt to
 // exercise current-file binding. This never claims a real visual assessment.
 const prior=service.storyRequest(request.id),contract=structuredClone(prior),save=r=>research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(r),request.id);contract.visualReviews[0].state='complete';contract.visualReviews[0].simulation=false;save(contract);assert.equal(service.selectionReview(story)?.executionId,'9999');
 story.localDraft.version=1;assert.equal(service.selectionReview(story),null);story.localDraft.version=0;contract.visualReviews[0].result.images[0].inputSha256='f'.repeat(64);save(contract);assert.equal(service.selectionReview(story),null);save(prior);
 const drift=structuredClone(execution);drift.id='8888';assert.throws(()=>service.acceptVisualReview(story,request.id,drift,{offline:true}));assert.throws(()=>service.acceptVisualReview(story,request.id,execution));
 const args={assetIds:[story.media[0].id],sourceRevision:story.revision,workingVersion:0},[next,duplicate]=await Promise.all([service.prepareVisualReview(story,request.id,args),service.prepareVisualReview(story,request.id,args)]);assert(next.dispatchAvailable===false);assert.equal(next.jobId,duplicate.jobId);
 const changed=structuredClone(execution),newPacket=service.storyRequest(request.id).visualReviews.find(r=>r.packet.jobId===next.jobId).packet;changed.id='10000';changed.data.resultData.runData['Validate Photo Assessment'][0].data.main[0][0].json.packet=newPacket;changed.data.resultData.runData['Finalize Photo Assessment'][0].data.main[0][0].json.result_json=JSON.stringify({...envelope,jobId:newPacket.jobId,executionId:changed.id,manifestSha256:newPacket.manifestSha256,result:output(newPacket)});story.localDraft.version=1;
 assert.equal(service.acceptVisualReview(story,request.id,changed,{offline:true}).visualReviews[1].state,'review_required');
});

test('offline exact worker patch preserves every old node, routes malformed photo packets away from research, and finalizes only hash-bound results',async t=>{
 const {prepared}=await fixture(t),b=bound(prepared.packet);
 // Minimal graph contract fixture; production graph is separately captured and checked by the sprint.
 const base={id:workerId,versionId:'version',activeVersionId:'version',name:'Fixture native worker',settings:{executionOrder:'v1',availableInMCP:true},nodes:[{name:'Draft Editorial Concept',type:'@n8n/n8n-nodes-langchain.openAi',retryOnFail:false,parameters:{modelId:{value:'gpt-5.4'},responses:{values:[]},options:{maxTokens:1800}},credentials:{openAiApi:{id:'fixture-credential'}}},{name:'Finish Development Job',parameters:{columns:{value:{}}}},{name:'Return Development Job',parameters:{}}],connections:{'Development Job Claimed?':{main:[[{node:'Caption Improvement?',type:'main',index:0}],[{node:'Return Existing Development Job',type:'main',index:0}]]}}};
 const before=JSON.stringify(base),patch=preparePhotoVisualWorker(base,{expectedVersion:'version',expectedSha256:editorialGraphSha(base),approvedJobId:b.p.jobId,approvalId:b.p.approvalId});assert.equal(JSON.stringify(base),before);for(const n of base.nodes)assert.deepEqual(patch.workflow.nodes.find(x=>x.name===n.name),n);assert.equal(patch.review.sourceResearchCalls,0);assert.equal(patch.review.maxImages,6);
 const by=name=>patch.workflow.nodes.find(n=>n.name===name),rows={'Verify Development Claim':b.row,'Validate Development Dispatch':b.dispatch};
 const run=(name,input)=>vm.runInNewContext('(function(){'+by(name).parameters.jsCode+'})()',{$:n=>({first:()=>({json:rows[n]})}),$input:{first:()=>({json:input})},$execution:{id:'9999'},Buffer});
 rows['Validate Photo Assessment']=run('Validate Photo Assessment',b.row)[0].json;assert.equal(rows['Validate Photo Assessment'].messages.filter(i=>i.type==='image').length,6);
 const formatted=run('Finalize Photo Assessment',{id:'resp_fixture',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output(b.p))}]}],usage:{input_tokens:1800,output_tokens:300,total_tokens:2100}})[0].json;assert.equal(JSON.parse(formatted.result_json).result.images.length,6);
 for(const n of patch.workflow.nodes)if(n.parameters?.jsCode)new vm.Script('(function(){'+n.parameters.jsCode+'})');
 const gate=by('Photo Visual Assessment?').parameters.conditions.conditions[0].leftValue;for(const v of [null,false,{},[]])assert.equal(vm.runInNewContext(gate.slice(3,-2),{$:()=>({first:()=>({json:{editorial_context_json:JSON.stringify({photoAssessment:v})}})})}),true);
 for(const context of ['{}','{"captionImprovement":{}}','null'])assert.equal(vm.runInNewContext(gate.slice(3,-2),{$:()=>({first:()=>({json:{editorial_context_json:context}})})}),false);
 assert.equal(vm.runInNewContext(gate.slice(3,-2),{$:()=>({first:()=>({json:{editorial_context_json:'{'}})})}),true,'Malformed context must fail photo validation, not fall through to research.');
 assert.equal(patch.workflow.connections['Photo Visual Assessment?'].main[2][0].node,'Prepare Development Failure');
 const values=by('Assess Photo Pixels').parameters.responses.values;
 assert(Array.isArray(values));assert.equal(values.length,7);assert.equal(values.filter(m=>m.type==='image').length,6);
 for(const [n,message]of values.entries()){
  const field=n?'imageUrl':'content',rendered=vm.runInNewContext(message[field].slice(3,-2),{$:()=>({first:()=>({json:rows['Validate Photo Assessment']})})});
  assert.equal(rendered,visualModelMessages(b.p)[n][field]);
 }
 for(const count of [1,3]){
  const p=structuredClone(b.p);p.images=p.images.slice(0,count);p.manifest.images=p.manifest.images.slice(0,count);p.manifestSha256=photoSha256(JSON.stringify(p.manifest));const one=bound(p);
  const smaller=preparePhotoVisualWorker(base,{expectedVersion:'version',expectedSha256:editorialGraphSha(base),approvedJobId:p.jobId,approvalId:p.approvalId,imageCount:count});
  const context={$:name=>({first:()=>({json:name==='Verify Development Claim'?one.row:one.dispatch})}),Buffer};
  const validate=smaller.workflow.nodes.find(n=>n.name==='Validate Photo Assessment');
  assert.equal(vm.runInNewContext('(function(){'+validate.parameters.jsCode+'})()',context)[0].json.messages.length,count+1);
  assert.throws(()=>vm.runInNewContext('(function(){'+by('Validate Photo Assessment').parameters.jsCode+'})()',context),/PHOTO_IMAGE_COUNT_DRIFT/);
 }
 for(const count of [0,7,1.5])assert.throws(()=>preparePhotoVisualWorker(base,{expectedVersion:'version',expectedSha256:editorialGraphSha(base),approvedJobId:b.p.jobId,approvalId:b.p.approvalId,imageCount:count}),{code:'INVALID_PHOTO_VISION'});
});

test('photo operations use the existing queue, single-use durable claims and exact native delivery; a lost response is never resubmitted',async t=>{
 const {prepared,research,previews,service}=await fixture(t),json=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
 for(const lost of [false,true]){
  const packet=structuredClone(prepared.packet);packet.jobId=randomUUID();packet.approvalId=randomUUID();const b=bound(packet);
  const base={id:workerId,name:'MILDINCIDENT DEV — bounded editorial generation',versionId:'original',activeVersionId:'original',settings:{executionOrder:'v1',availableInMCP:true},connections:{'Development Job Claimed?':{main:[[{node:'Caption Improvement?',type:'main',index:0}]]}},nodes:[
   {name:'Research Candidates',type:'@n8n/n8n-nodes-langchain.openAi',retryOnFail:false,parameters:{modelId:{value:'gpt-5.4'},options:{maxTokens:3500,maxToolCalls:2}}},
   {name:'Draft Editorial Concept',type:'@n8n/n8n-nodes-langchain.openAi',retryOnFail:false,parameters:{modelId:{value:'gpt-5.4'},options:{maxTokens:1800}},credentials:{openAiApi:{id:'fixture-only'}}},
   {name:'Guard Draft Input Budget',type:'n8n-nodes-base.code',parameters:{}},{name:'Validate Caption Improvement',type:'n8n-nodes-base.code',parameters:{jsCode:'/* CAPTION_IMPROVEMENT_PACKET_V1_INVALID */'}},
   {name:'Finish Development Job',type:'n8n-nodes-base.dataTable',parameters:{operation:'update',dataTableId:{value:'devjobs'},columns:{value:{}}}},{name:'Return Development Job',type:'n8n-nodes-base.respondToWebhook',parameters:{}}]};
  const patch=preparePhotoVisualWorker(base,{expectedVersion:'original',expectedSha256:editorialGraphSha(base),approvedJobId:b.p.jobId,approvalId:b.p.approvalId}),workflow={...patch.workflow,id:workerId,versionId:'prepared',activeVersionId:'prepared',active:true,activeVersion:{nodes:patch.workflow.nodes,connections:patch.workflow.connections}};
  const request=research.create({kind:'brief',prompt:b.row.prompt,sourceUrl:'',idempotencyKey:b.p.jobId},[]),context={photoAssessment:b.p},requestHash=requestFingerprint({...request,editorialContext:context}),jobs=[];let posts=0,dispatches=0;
  const envelope={purpose:'private_photo_visual_assessment_result',jobId:b.p.jobId,manifestSha256:b.p.manifestSha256,result:output(b.p),usage:{input_tokens:1800,output_tokens:300,total_tokens:2100},responseId:'simulated-provider-response',executionId:'9999',rightsGranted:false,publicationApproved:false};
  const expanded=structuredClone(workflow);expanded.nodes.find(n=>n.name==='Assess Photo Pixels').parameters.builtInTools={};
  const execution={id:'9999',workflowId:workerId,workflowVersionId:'prepared',status:'success',workflowData:expanded,data:{resultData:{runData:{'Validate Photo Assessment':[{data:{main:[[{json:{packet:b.p}}]]}}],'Finalize Photo Assessment':[{data:{main:[[{json:{result_json:JSON.stringify(envelope)}}]]}}]}}}};
  const executionBinding={approvedGraphSha256:patch.review.graphSha256,approvedExecutionGraphSha256:editorialGraphSha(expanded),approvedWorkerVersion:'prepared'};
  assert.equal(captureVisualExecution(execution,b.p,executionBinding).jobId,request.id);
  assert.throws(()=>captureVisualExecution(execution,b.p,{approvedGraphSha256:patch.review.graphSha256}),{code:'INVALID_VISUAL_RESULT'});
  assert.throws(()=>captureVisualExecution({...execution,workflowVersionId:'unreviewed'},b.p,executionBinding),{code:'INVALID_VISUAL_RESULT'});
  assert.throws(()=>captureVisualExecution(execution,b.p,{...executionBinding,approvedExecutionGraphSha256:'0'.repeat(64)}),{code:'INVALID_VISUAL_RESULT'});
  const altered=structuredClone(execution);altered.workflowData.nodes[0].parameters.options.maxTokens=9999;
  assert.throws(()=>captureVisualExecution(altered,b.p,executionBinding),{code:'INVALID_VISUAL_RESULT'});
  const connection={mode:'standard',generationEnabled:true,executionScope:'photo_vision',jobsTableId:'devjobs',candidatesTableId:'devresults',editorialWorkerId:workerId,headerName:'X-Mildincident-Development-Key',token:'synthetic-private-token-with-thirty-two-characters',...executionBinding,authorization:b.p.authorization,photoAction:{jobId:request.id,requestHash,manifestSha256:b.p.manifestSha256,approvalId:b.p.approvalId}};
  const client=new EditorialEngineClient({connection,apiKey:'synthetic-test-api-key',fetchImpl:async(url,options)=>{
   const u=new URL(url);if(u.pathname==='/api/v1/workflows/'+workerId)return json(workflow);
   if(u.pathname==='/api/v1/data-tables/devjobs')return json({name:'mildincident_dev_editorial_jobs',columns:[{name:'editorial_context_json'}]});
   if(u.pathname==='/api/v1/data-tables/devresults')return json({name:'mildincident_dev_editorial_candidates'});
   if(u.pathname==='/api/v1/data-tables/devjobs/rows'){if(options.method==='POST'){posts++;jobs.push({...JSON.parse(options.body).data[0],id:1});}return json({data:jobs});}
   if(u.pathname==='/api/v1/data-tables/devresults/rows')return json({data:[]});
   if(u.pathname==='/api/v1/executions/9999')return json(execution);
   if(u.pathname==='/webhook/mildincident-dev-editorial-job-v1'){dispatches++;if(lost)throw Error('SIMULATED_AMBIGUOUS_RESPONSE');Object.assign(jobs[0],{status:'ready_to_review',result_count:0,result_json:JSON.stringify(envelope),execution_id:'9999'});return json({accepted:true,scope:'development_only',purpose:'private_photo_visual_assessment',status:'ready_to_review',jobId:request.id,executionId:'9999',productionApplied:false});}
   assert.fail('Unexpected simulated endpoint '+u.pathname);
  }}),engine=new EditorialEngineService({research,client});
  await assert.rejects(client.queue({...request,editorialContext:{captionImprovement:{}}}));const captionClient=new EditorialEngineClient({connection:{...connection,executionScope:'caption_policy',approvedExecutionGraphSha256:undefined,captionAction:{jobId:request.id,requestHash}},apiKey:'synthetic-test-api-key',fetchImpl:()=>assert.fail('Wrong-scope photo request must not read or write')});await assert.rejects(captionClient.queue({...request,editorialContext:context}),{code:'PHOTO_SCOPE_MISMATCH'});assert.equal(posts,0);
  const inspection=await client.inspect();assert.equal(inspection.maxResearchCalls,0);assert.equal(inspection.maxDraftCalls,0);assert.equal(inspection.maxPhotoCalls,1);
  workflow.settings.executionTimeout=999;await assert.rejects(client.inspect(),{code:'UNSAFE_ENGINE_WORKFLOW'});delete workflow.settings.executionTimeout;
  await engine.queue(request.id,{editorialContext:context});await engine.queue(request.id,{editorialContext:context});assert.equal(posts,1);
  const server=createWorkspaceServer({source:{snapshot:null},research,engine,photography:service,previews});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  try{const publicWorkspace=await(await fetch(origin+'/api/workspace')).json();assert(!publicWorkspace.researchRequests.some(r=>r.id===request.id));assert(!JSON.stringify(publicWorkspace).includes(b.p.images[0].data));assert(!JSON.stringify(publicWorkspace).includes(b.p.authorization.id));
   for(const route of ['/api/research/requests/'+request.id+'/engine/start','/api/research/requests/'+request.id+'/events','/api/research/requests']){const denied=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit',Origin:origin},body:JSON.stringify({kind:'brief',prompt:request.prompt,idempotencyKey:request.id})});assert.equal((await denied.json()).error.code,'PHOTO_SCOPE_MISMATCH');}assert.equal(dispatches,0);
  }finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});}

  await engine.start(request.id,research.engineJob(request.id).version);
  for(let n=0;n<30&&!['ready_to_review','dispatch_uncertain'].includes(research.engineJob(request.id).state);n++)await new Promise(r=>setTimeout(r,5));
  const saved=research.engineJob(request.id);assert.equal(saved.state,lost?'dispatch_uncertain':'ready_to_review');assert.equal(saved.photoExecutionGraphSha256,executionBinding.approvedExecutionGraphSha256);assert.equal(saved.photoWorkerVersion,'prepared');if(!lost){assert.equal(saved.photoResult.result.images.length,6);assert.deepEqual(saved.candidates,[]);}
  const restarted=new EditorialEngineService({research,client});await assert.rejects(restarted.start(request.id,saved.version));assert.equal(dispatches,1);assert.equal(posts,1);assert.equal(research.authorizationRemaining(connection.authorization),0);
 }
});
