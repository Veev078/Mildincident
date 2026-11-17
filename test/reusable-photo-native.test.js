import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {preparePhotoVisualWorker,prepareReusablePhotoVisualWorker,validateReusableVisualJob} from '../src/n8n/photo-visual-worker.js';
import {photoSha256,captureVisualExecution} from '../src/photography/visual-assessment.js';
import {captureVisualFailure} from '../src/photography/visual-failure.js';
import {editorialGraphSha} from '../src/n8n/v14-editorial-patch.js';

const workerId='6CkqfYc4Pyd4k8vi';
function base(){return {id:workerId,name:'Offline reusable native fixture',versionId:'original',activeVersionId:'original',settings:{executionOrder:'v1'},nodes:[{name:'Draft Editorial Concept',type:'@n8n/n8n-nodes-langchain.openAi',typeVersion:2,retryOnFail:false,parameters:{modelId:{value:'gpt-5.4'},options:{maxTokens:1800}},credentials:{openAiApi:{id:'GENERATED_ONLY'}}},{name:'Finish Development Job',parameters:{columns:{value:{}}}},{name:'Return Development Job',parameters:{}}],connections:{'Development Job Claimed?':{main:[[{node:'Caption Improvement?',type:'main',index:0}]]}}};}
async function bound(count){
 const images=[];for(let i=0;i<count;i++){const bytes=await sharp({create:{width:32+i,height:24,channels:3,background:{r:30+i*20,g:100,b:190}}}).jpeg().toBuffer();images.push({assetId:'generated-'+i,sourceUrl:'https://example.org/project',imageUrl:'https://example.org/project/'+i+'.jpg',pageSha256:'a'.repeat(64),sourcePreviewSha256:'b'.repeat(64),originalSha256:'c'.repeat(64),inputSha256:photoSha256(bytes),width:32+i,height:24,contentType:'image/jpeg',data:bytes.toString('base64'),caption:'Generated test rectangle; no editorial claim.',creatorReported:''});}
 const manifest={storyId:'CON-generated',sourceRevision:'revision-1',workingVersion:0,photoRequestId:randomUUID(),photoInputDigest:'d'.repeat(64),subject:'Generated structural test',images:images.map(({data,...meta})=>meta)},p={version:1,purpose:'private_photo_visual_assessment',workerId,jobId:randomUUID(),approvalId:randomUUID(),manifest,manifestSha256:photoSha256(JSON.stringify(manifest)),images};
 p.authorization={scope:'photo_vision_v1',id:p.approvalId,jobId:p.jobId,maxRuns:1,expiresAt:new Date(Date.now()+600000).toISOString()};
 const row={job_id:p.jobId,kind:'brief',prompt:'Inspect generated fixtures only.',source_url:'',editorial_context_json:JSON.stringify({photoAssessment:p}),lease_token:randomUUID(),status:'generating'};row.request_hash=photoSha256(JSON.stringify({kind:row.kind,prompt:row.prompt,sourceUrl:'',editorialContext:{photoAssessment:p}}));
 return {p,row,dispatch:{job_id:p.jobId,request_hash:row.request_hash,dispatch_id:row.lease_token}};
}
const compact=p=>({version:2,images:p.images.map((_,i)=>({i,fit:'likely',seen:'SIMULATED generated rectangle.',frame:'SIMULATED centered geometry.',difference:'Fixture color and width.',use:i?'SIMULATED support.':'SIMULATED opener.',duplicate:null})),order:p.images.map((_,i)=>i)});
const output=json=>[{data:{main:[[{json}]]}}];
function runCode(node,rows,input){return vm.runInNewContext('(function(){'+node.parameters.jsCode+'})()',{$:name=>({first:()=>({json:rows[name]})}),$input:{first:()=>({json:input})},$execution:{id:'91001'},Buffer});}

test('one reusable compact graph routes every 1..6 input count to exactly that many structural native image rows',async()=>{
 const w=base(),before=JSON.stringify(w),proposal=prepareReusablePhotoVisualWorker(w,{expectedVersion:w.versionId,expectedSha256:editorialGraphSha(w)}),by=name=>proposal.workflow.nodes.find(n=>n.name===name);
 assert.equal(JSON.stringify(w),before);for(const old of w.nodes)assert.deepEqual(by(old.name),old);
 assert.equal(proposal.review.enabled,false);assert.equal(proposal.review.installed,false);assert.equal(proposal.review.permitIssued,false);assert.equal(proposal.review.addedModelOperations,1);assert.equal(proposal.review.maxOutputTokens,1200);assert.equal(proposal.review.perActionGraphInstallation,false);
 assert(!JSON.stringify(proposal.workflow).includes('00000000-0000-4000-8000-00000000000'));
 const sha=proposal.review.graphSha256;
 for(let count=1;count<=6;count++){
  const b=await bound(count),rows={'Verify Development Claim':b.row,'Validate Development Dispatch':b.dispatch};
  rows['Validate Photo Assessment']=runCode(by('Validate Photo Assessment'),rows)[0].json;
  assert.equal(rows['Validate Photo Assessment'].packet.jobId,b.p.jobId);
  let name='Photo Image Count 1',visited=[];
  while(name.startsWith('Photo Image Count')){visited.push(name);const node=by(name),condition=node.parameters.conditions.conditions[0],left=vm.runInNewContext(condition.leftValue.slice(3,-2),{$:()=>({first:()=>({json:rows['Validate Photo Assessment']})})});name=proposal.workflow.connections[name].main[left===condition.rightValue?0:1][0].node;}
  assert.equal(name,'Assess Photo Pixels '+count);assert.equal(new Set(visited).size,visited.length);
  const model=by(name),values=model.parameters.responses.values;
  assert(Array.isArray(values));assert.equal(values.length,count+1);assert.equal(values.filter(v=>v.type==='image').length,count);assert.equal(model.retryOnFail,false);assert.equal(model.parameters.options.maxTokens,1200);assert(!model.parameters.tools&&!model.parameters.builtInTools);
  for(const [n,message]of values.entries()){const key=n?'imageUrl':'content',resolved=vm.runInNewContext(message[key].slice(3,-2),{$:()=>({first:()=>({json:rows['Validate Photo Assessment']})})});assert.equal(resolved,rows['Validate Photo Assessment'].messages[n][key]);assert(resolved.length>0);}
  const response={status:'completed',id:'simulated',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(compact(b.p))}]}],usage:{input_tokens:1000,output_tokens:500,total_tokens:1500}},envelope=runCode(by('Finalize Photo Assessment'),rows,response)[0].json;
  const execution={id:'91001',workflowId:workerId,workflowVersionId:'reviewed-reusable',workflowData:proposal.workflow,status:'success',data:{resultData:{runData:{'Validate Photo Assessment':output(rows['Validate Photo Assessment']),[name]:output(response),'Finalize Photo Assessment':output(envelope)}}}},binding={approvedGraphSha256:sha,approvedWorkerVersion:'reviewed-reusable'};
  assert.equal(captureVisualExecution(execution,b.p,binding).result.images.length,count);
  for(const mutate of [e=>e.workflowVersionId='unreviewed',e=>e.data.resultData.runData[name].push({}),e=>e.data.resultData.runData['Draft Editorial Concept']=output({}),e=>e.data.resultData.runData['Assess Photo Pixels '+(count===6?1:6)]=output(response)]){const changed=structuredClone(execution);mutate(changed);assert.throws(()=>captureVisualExecution(changed,b.p,binding),{code:'INVALID_VISUAL_RESULT'});}
  assert.equal(proposal.review.graphSha256,sha);assert(!JSON.stringify(proposal.workflow).includes(b.p.jobId));assert(!JSON.stringify(proposal.workflow).includes(b.p.approvalId));
 }
});

test('reusable validator rejects a caption grant, unclaimed/different job, tampered image bytes/order and expired authorization before model routing',async()=>{
 const b=await bound(2);assert.equal(validateReusableVisualJob(b.row,b.dispatch,{workerId}).jobId,b.p.jobId);
 for(const mutate of [x=>x.p.authorization.scope='caption_policy',x=>x.p.authorization.id=randomUUID(),x=>x.p.authorization.expiresAt='2020-01-01',x=>x.p.images.reverse(),x=>x.p.images[0].data=x.p.images[0].data.slice(4),x=>x.row.status='queued',x=>x.dispatch.dispatch_id=randomUUID(),x=>x.p.jobId=randomUUID()]){
  const x=structuredClone(b);mutate(x);x.row.editorial_context_json=JSON.stringify({photoAssessment:x.p});assert.throws(()=>validateReusableVisualJob(x.row,x.dispatch,{workerId}),/PHOTO_VISION_PACKET_INVALID/);
 }
 assert.throws(()=>validateReusableVisualJob({...b.row,editorial_context_json:'{'},b.dispatch,{workerId}),/PHOTO_VISION_PACKET_INVALID/);
});

test('reusable output-limit reconciliation binds its chosen native count and version and retains measured usage only',async()=>{
 const w=base(),proposal=prepareReusablePhotoVisualWorker(w,{expectedVersion:w.versionId,expectedSha256:editorialGraphSha(w)}),b=await bound(3),model={status:'incomplete',max_output_tokens:1200,incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:1200,output_tokens:1200,total_tokens:2400},output:[{type:'message',content:[{type:'output_text',text:'DO NOT SALVAGE PARTIAL JSON'}]}]};
 const execution={id:'91001',workflowId:workerId,workflowVersionId:'reviewed-reusable',workflowData:proposal.workflow,status:'success',data:{resultData:{lastNodeExecuted:'Return Development Failure',runData:{'Validate Photo Assessment':output({packet:b.p}),'Assess Photo Pixels 3':output(model),'Fail Development Job':output({job_id:b.p.jobId,execution_id:'91001',status:'failed',result_count:0})}}}},binding={approvedGraphSha256:proposal.review.graphSha256,approvedWorkerVersion:'reviewed-reusable'};
 const f=captureVisualFailure(execution,b.p,binding);assert.equal(f.inputImageCount,3);assert.equal(f.usableAssessment,false);assert.equal(f.automaticRetry,false);assert.equal(f.usage.total_tokens,2400);assert(!JSON.stringify(f).includes('DO NOT SALVAGE'));
 assert.throws(()=>captureVisualFailure({...execution,workflowVersionId:'other'},b.p,binding),{code:'INVALID_VISUAL_RESULT'});
 for(const [status,reason,code]of [['completed',null,'PHOTO_RESULT_REJECTED'],['incomplete','content_filter','PHOTO_RESPONSE_INCOMPLETE']]){const rejected=structuredClone(execution),response=rejected.data.resultData.runData['Assess Photo Pixels 3'][0].data.main[0][0].json;response.status=status;response.incomplete_details={reason};const failure=captureVisualFailure(rejected,b.p,binding);assert.equal(failure.code,code);assert.equal(failure.usage.output_tokens,1200);assert.equal(failure.usableAssessment,false);assert(!JSON.stringify(failure).includes('DO NOT SALVAGE'));}
});

test('reusable proposal leaves the default legacy builder deterministic and job-bound',()=>{
 const w=base(),options={expectedVersion:w.versionId,expectedSha256:editorialGraphSha(w),approvedJobId:randomUUID(),approvalId:randomUUID()},first=preparePhotoVisualWorker(w,options);prepareReusablePhotoVisualWorker(w,options);assert.deepEqual(preparePhotoVisualWorker(w,options),first);assert.equal(first.workflow.nodes.filter(n=>n.name==='Assess Photo Pixels').length,1);assert.equal(first.review.imageCount,6);
});
