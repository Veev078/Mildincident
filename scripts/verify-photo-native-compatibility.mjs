// Opt-in offline replay. Never loads credentials, dispatches a workflow or opens
// a socket. Private execution input and reports must stay outside Git.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {preparePhotoVisualWorker} from '../src/n8n/photo-visual-worker.js';
import {editorialGraphSha} from '../src/n8n/v14-editorial-patch.js';
import {visualModelMessages} from '../src/photography/visual-assessment.js';

let stage='setup';
async function main(){
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,n)=>process.argv.slice(2+n*2,4+n*2)));
for(const key of ['--runtime','--langchain','--baseline','--execution','--out'])assert(args[key],`Supply ${key}; see docs/release/V16_NATIVE_COMPATIBILITY_REPAIR.md.`);
const runtime=path.resolve(args['--runtime']),source=path.resolve(args['--langchain']),out=path.resolve(args['--out']);
assert(!out.endsWith('.json'),'--out must be a private directory');
const sha=b=>createHash('sha256').update(b).digest('hex'),readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const requireRuntime=createRequire(path.join(runtime,'package.json')),native=requireRuntime('n8n-workflow'),get=requireRuntime('lodash/get');
assert.equal(requireRuntime('n8n-workflow/package.json').version,'2.46.5');
assert.equal((await readJson(path.join(source,'package.json'))).version,'2.46.6');
// These two dependencies are linked by the published node package itself. This
// is not an attestation of the Cloud build. Reproduce the captured Cloud failure
// below before using this runtime as compatibility evidence.
assert.equal((await readJson(path.join(source,'package.json'))).dependencies['n8n-workflow'],'2.46.5');
globalThis.fetch=()=>assert.fail('Offline proof cannot fetch');
for(const name of ['node:http','node:https','node:net','node:tls']){
 const mod=requireRuntime(name);
 for(const key of ['request','get','connect','createConnection'])if(typeof mod[key]==='function')mod[key]=()=>assert.fail('Offline proof cannot open a socket');
}
const nodeDir=path.join(source,'dist/nodes/vendors/OpenAi'),sourceHashes={};
const forbidden=new Proxy({}, {get:(_t,k)=>{throw Error('Unexpected native dependency: '+String(k));}});
async function loadModule(file,bindings){
 const text=await fs.readFile(file,'utf8');sourceHashes[path.relative(source,file)]=sha(text);const module={exports:{}};
 const scopedRequire=name=>{assert(Object.hasOwn(bindings,name),'Unbound native import '+name);return bindings[name];};
 vm.runInThisContext('(function(exports,require,module,__filename,__dirname){'+text+'\n})',{filename:file})(module.exports,scopedRequire,module,file,path.dirname(file));return module.exports;
}
const descriptions=createRequire(path.join(source,'package.json'))('./dist/nodes/vendors/OpenAi/v2/actions/descriptions.js');
const binary=createRequire(path.join(source,'package.json'))('./dist/nodes/vendors/OpenAi/helpers/binary-data.js');
const constants=createRequire(path.join(source,'package.json'))('./dist/nodes/vendors/OpenAi/helpers/constants.js');
// Unused optional features fail closed. There are no tool connections on this
// photo node; the empty connected-tools adapter cannot invoke anything.
const helpers={getConnectedTools:async()=>[]};
const responses=await loadModule(path.join(nodeDir,'v2/actions/text/helpers/responses.js'),{
 'lodash/get':get,'lodash/isObject':requireRuntime('lodash/isObject'),'n8n-workflow':native,
 '../../../../../../../utils/helpers':forbidden,'../../../../helpers/binary-data':binary,
});
let interceptedBody=null,interceptions=0;
const captured=Error('REQUEST_CAPTURED_WITHOUT_NETWORK');
const operation=await loadModule(path.join(nodeDir,'v2/actions/text/response.operation.js'),{
 '@n8n/ai-utilities/json-schema':forbidden,'../../../../../../utils/helpers':helpers,'lodash/get':get,'n8n-workflow':native,
 '../../../helpers/constants':constants,'../../../helpers/utils':forbidden,'../../../helpers/polling':forbidden,
 '../../../transport':{apiRequest:async function(method,endpoint,{body}){assert.equal(method,'POST');assert.equal(endpoint,'/responses');interceptions++;interceptedBody=body;throw captured;}},
 '../descriptions':descriptions,'./helpers/responses':responses,
});
const textActions=await loadModule(path.join(nodeDir,'v2/actions/text/index.js'),{'./classify.operation':{description:[]},'./response.operation':operation});
const nativeClass=await loadModule(path.join(nodeDir,'v2/OpenAiV2.node.js'),{
 'n8n-workflow':native,'../helpers/description':createRequire(path.join(source,'package.json'))('./dist/nodes/vendors/OpenAi/helpers/description.js'),
 '../methods':{},'./actions/router':forbidden,'./actions/text':textActions,
 ...Object.fromEntries(['audio','conversation','file','image','video'].map(name=>['./actions/'+name,{description:[]}]))
});
const description=new nativeClass.OpenAiV2({name:'openAi',displayName:'OpenAI'}).description;
stage='reproduce captured Cloud failures';
const baseline=await readJson(args['--baseline']),execution=await readJson(args['--execution']);
assert.equal(execution.id,'2363');assert.equal(execution.status,'error');
const runs=execution.data.resultData.runData,row=runs['Verify Development Claim'][0].data.main[0][0].json,dispatch=runs['Validate Development Dispatch'][0].data.main[0][0].json;
const packet=JSON.parse(row.editorial_context_json).photoAssessment;
assert.equal(packet.images.length,6);
assert.equal(sha(JSON.stringify(packet.manifest)),'220ad6d03125e3b7a9fe5e3afbf6e461c4fd056dacc5dee0941ab7a9184277db');
assert.equal(sha(JSON.stringify(visualModelMessages(packet))),'de30d4b4aedfa315c0f71f03250d36cbc3b26fccefa6a58e8c1142354c5fc8a7');
const expression=new native.Expression('UTC'),capturedGate=execution.workflowData.nodes.find(n=>n.name==='Photo Visual Assessment?');
const data={$:name=>{assert.equal(name,'Verify Development Claim');return {first:()=>({json:row})};}};
assert.throws(()=>expression.resolveSimpleParameterValue(capturedGate.parameters.conditions.conditions[0].leftValue,data),/Cannot access "prototype" due to security concerns/);
const oldModel=execution.workflowData.nodes.find(n=>n.name==='Assess Photo Pixels');
const failedModel=structuredClone(oldModel);failedModel.parameters.responses.values="={{ $('Validate Photo Assessment').first().json.messages }}";
const normalize=node=>({...structuredClone(node),parameters:native.NodeHelpers.getNodeParameters(description.properties,node.parameters,true,false,node,description)});
const reproduced=normalize(failedModel).parameters.responses.values;
assert.equal(reproduced.length,59);assert(reproduced.every(m=>m.type==='text'&&m.content===''));
assert.deepEqual(reproduced,oldModel.parameters.responses.values);
assert.deepEqual(normalize(failedModel).parameters,oldModel.parameters);
const filter=requireRuntime(path.join(path.dirname(requireRuntime.resolve('n8n-workflow')),'node-parameters/filter-parameter.js'));

const proposal=preparePhotoVisualWorker(baseline,{expectedVersion:baseline.versionId,expectedSha256:editorialGraphSha(baseline),approvedJobId:packet.jobId,approvalId:packet.approvalId,imageCount:6});
stage='corrected routing and historical byte validation';
for(const n of baseline.nodes)assert.deepEqual(proposal.workflow.nodes.find(p=>p.name===n.name),n);
assert.deepEqual(proposal.workflow.settings,baseline.settings);
const by=name=>proposal.workflow.nodes.find(n=>n.name===name),gate=by('Photo Visual Assessment?');
assert.equal(expression.resolveSimpleParameterValue(gate.parameters.conditions.conditions[0].leftValue,data),true);
const filterValue=structuredClone(gate.parameters.conditions);filterValue.conditions[0].leftValue=expression.resolveSimpleParameterValue(gate.parameters.conditions.conditions[0].leftValue,data);assert.equal(filter.executeFilter(filterValue),true);
for(const value of [null,false,{},[]])assert.equal(expression.resolveSimpleParameterValue(gate.parameters.conditions.conditions[0].leftValue,{$:()=>({first:()=>({json:{editorial_context_json:JSON.stringify({photoAssessment:value})}})})}),true);
for(const context of [{},{captionImprovement:{}},null])assert.equal(expression.resolveSimpleParameterValue(gate.parameters.conditions.conditions[0].leftValue,{$:()=>({first:()=>({json:{editorial_context_json:JSON.stringify(context)}})})}),false);
assert.equal(expression.resolveSimpleParameterValue(gate.parameters.conditions.conditions[0].leftValue,{$:()=>({first:()=>({json:{editorial_context_json:'{'}})})}),true);
assert.equal(proposal.workflow.connections[gate.name].main[2][0].node,'Prepare Development Failure');
// Historical replay only: no new approval object, grant, claim or dispatch is
// issued. Freeze time at the original execution when checking its old packet.
const replayTime=Date.parse(execution.startedAt);assert(Number.isFinite(replayTime));
class ReplayDate extends Date{static now(){return replayTime;}}
const validated=vm.runInNewContext('(function(){'+by('Validate Photo Assessment').parameters.jsCode+'})()',{
 $:name=>({first:()=>({json:name==='Verify Development Claim'?row:dispatch})}),Buffer,Date:ReplayDate,
})[0].json;
assert.equal(sha(JSON.stringify(validated.packet.manifest)),packet.manifestSha256);
const model=normalize(by('Assess Photo Pixels'));
stage='native collection normalization and expression resolution';
assert.equal(model.parameters.responses.values.length,7);
assert.equal(model.parameters.responses.values.filter(m=>m.type==='image').length,6);
const workflow=new native.Workflow({id:'offline-photo-compatibility',nodes:[
 ...['Verify Development Claim','Validate Photo Assessment'].map((name,n)=>({id:String(n),name,type:'n8n-nodes-base.code',typeVersion:2,position:[0,0],parameters:{}})),model,
],connections:{},nodeTypes:{getByNameAndVersion:type=>type==='@n8n/n8n-nodes-langchain.openAi'?{description}:undefined},settings:{timezone:'UTC'}});
const runExecutionData={resultData:{runData:{'Verify Development Claim':[{data:{main:[[{json:row}]]}}],'Validate Photo Assessment':[{data:{main:[[{json:validated}]]}}]}}};
const resolve=value=>workflow.expression.getParameterValue(value,runExecutionData,0,0,model.name,[{json:validated}],'manual',{});
const resolvedMessages=resolve(model.parameters.responses.values);
assert.deepEqual(resolvedMessages,visualModelMessages(packet));
const context={getNode:()=>model,getExecutionCancelSignal:()=>new AbortController().signal,
 getNodeParameter:(name,_i,fallback,options)=>{const value=resolve(get(model.parameters,name,fallback));return options?.extractValue?value.value:value;},
 helpers:new Proxy({}, {get:()=>assert.fail('No credentials, binary download, HTTP or helper access expected')}),
};
stage='native operation request boundary';
try{await operation.execute.call(context,0);assert.fail('Native request was not intercepted');}catch(error){assert.equal(error,captured);}
assert.equal(interceptions,1);assert.equal(interceptedBody.model,'gpt-5.4');assert.equal(interceptedBody.max_output_tokens,1200);
assert.equal(interceptedBody.store,false);assert.equal(interceptedBody.reasoning.effort,'low');assert.equal(interceptedBody.background,false);assert(!interceptedBody.tools?.length);
const expectedBody=await responses.createRequest.call(context,0,{model:'gpt-5.4',messages:visualModelMessages(packet),options:resolve(model.parameters.options),builtInTools:resolve(model.parameters.builtInTools||{}),tools:undefined});
assert.equal(JSON.stringify(interceptedBody),JSON.stringify(expectedBody));
assert.equal(interceptedBody.input.length,7);
assert.equal(interceptedBody.input[0].content[0].type,'input_text');assert(interceptedBody.input[0].content[0].text.trim());
const imageBlocks=interceptedBody.input.flatMap(m=>m.content.filter(c=>c.type==='input_image'));assert.equal(imageBlocks.length,6);
stage='decode six provider-bound image blocks';
const images=[];
for(const [n,block]of imageBlocks.entries()){
 assert.equal(block.detail,'high');assert(block.image_url.startsWith('data:image/jpeg;base64,'));
 const bytes=Buffer.from(block.image_url.slice('data:image/jpeg;base64,'.length),'base64'),meta=await sharp(bytes).metadata(),original=packet.images[n];
 assert.equal(sha(bytes),original.inputSha256);assert.equal(meta.format,'jpeg');assert.equal(meta.width,original.width);assert.equal(meta.height,original.height);assert(meta.width<=512&&meta.height<=512&&bytes.length<=16000);
 const decoded=await sharp(bytes,{failOn:'error'}).raw().toBuffer({resolveWithObject:true});assert.equal(decoded.info.width,original.width);assert.equal(decoded.info.height,original.height);assert(decoded.data.length>0);
 images.push({position:n+1,assetId:original.assetId,inputSha256:sha(bytes),width:meta.width,height:meta.height,bytes:bytes.length});
}
await fs.mkdir(out,{recursive:true,mode:0o700});
// Exact, reviewable execution representation. Original nodes are unchanged on
// the captured baseline and keep their observed expanded defaults. Only the six
// added photo nodes are replaced; the model uses the native normalizer above.
// This does not grant permission to accept arbitrary defaults during delivery.
assert.equal(editorialGraphSha(baseline),'0e1777e5785f703bd9a77593af01912a820eed0cb9c30ea9c50721ee4bc91cf6');
const originalNames=new Set(baseline.nodes.map(n=>n.name));
const expandReviewed=w=>({...structuredClone(execution.workflowData),name:w.name,connections:structuredClone(w.connections),settings:structuredClone(w.settings),nodes:w.nodes.map(n=>{
 const observed=execution.workflowData.nodes.find(o=>o.name===n.name);assert(observed,'Unknown node in expanded snapshot preparation');
 if(originalNames.has(n.name))return structuredClone(observed);
 return {...structuredClone(n),parameters:n.name==='Assess Photo Pixels'?normalize(n).parameters:{...structuredClone(observed.parameters),...structuredClone(n.parameters)}};
})});
let previousReview;try{previousReview=await readJson(path.join(out,'fresh-proposal-review.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(previousReview){assert.equal(previousReview.expectedVersion,baseline.versionId);assert.equal(previousReview.manifestSha256,packet.manifestSha256);assert.equal(previousReview.installed,false);}
const fresh=preparePhotoVisualWorker(baseline,{expectedVersion:baseline.versionId,expectedSha256:editorialGraphSha(baseline),approvedJobId:previousReview?.approvedJobId||randomUUID(),approvalId:previousReview?.approvalId||randomUUID(),imageCount:6});
const expandedFresh=expandReviewed(fresh.workflow),review={...fresh.review,approvedExecutionGraphSha256:editorialGraphSha(expandedFresh),executionDefaultsBasis:'Observed execution 2363; unchanged original nodes and reproduced native photo-node normalization',installedWorkerVersion:null,liveReadbackVerified:false,approvalStatus:'REVIEW ONLY; no grant, installation or paid execution authorized',manifestSha256:packet.manifestSha256,preparedModelMessagesSha256:sha(JSON.stringify(visualModelMessages(packet)))};
if(previousReview){assert.equal(previousReview.graphSha256,review.graphSha256);assert.equal(previousReview.approvedExecutionGraphSha256,review.approvedExecutionGraphSha256);}
await fs.writeFile(path.join(out,'fresh-proposed-graph.json'),JSON.stringify(fresh.workflow),{mode:0o600});
await fs.writeFile(path.join(out,'fresh-expected-execution-graph.json'),JSON.stringify(expandedFresh),{mode:0o600});
await fs.writeFile(path.join(out,'fresh-proposal-review.json'),JSON.stringify(review,null,2),{mode:0o600});
const report={status:'PASS',basis:'Captured execution 2363, six real retained JPEG inputs; actual n8n normalization, expression evaluator and OpenAI v2.3 operation with request transport intercepted',packages:{node:'@n8n/n8n-nodes-langchain@2.46.6',workflow:'n8n-workflow@2.46.5'},cloudBuildAttested:false,oldPrototypeFailureReproduced:true,old59EmptyMessagesReproduced:true,fullOldPhotoParametersReproduced:true,correctedGateValid:true,correctedCollectionMessages:7,imageInputs:6,allImagesFullyDecoded:true,manifestSha256:packet.manifestSha256,preparedModelMessagesSha256:sha(JSON.stringify(visualModelMessages(packet))),resolvedNodeMessagesSha256:sha(JSON.stringify(resolvedMessages)),providerRequestSha256:sha(JSON.stringify(interceptedBody)),providerBodyExactlyMatchesPreparedMessages:true,images,orderAndHashesMatch:true,maxOutputTokens:1200,sourceHashes,requestBoundaryInterceptions:1,networkRequests:0,modelExecutions:0,grantsIssued:0,liveWorkflowMutations:0,rightsGranted:false,assessmentProduced:false,freshProposedSavedGraphSha256:review.graphSha256,freshExpectedExecutionGraphSha256:review.approvedExecutionGraphSha256,liveReadbackVerified:false};
await fs.writeFile(path.join(out,'compatibility-proof.json'),JSON.stringify(report,null,2),{mode:0o600});
await fs.writeFile(path.join(out,'replay-only-graph.json'),JSON.stringify(proposal.workflow),{mode:0o600});
console.log(JSON.stringify(report));
}
try{await main();}catch(error){console.error(JSON.stringify({status:'STOP',stage,code:error.code||error.name||'COMPATIBILITY_CHECK_FAILED',privateInputsOmitted:true}));process.exitCode=1;}
