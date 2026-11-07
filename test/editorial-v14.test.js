import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {editorialDirectionV14,editorialTasteCase} from '../src/editorial-v14.js';
import {prepareV14EditorialPatch,editorialGraphSha} from '../src/n8n/v14-editorial-patch.js';
import {CAPTION_DIRECTIONS} from '../src/workspace/caption-generation.js';
import {WRITING_DIRECTIONS} from '../web/writing-directions.js';
import {DEFAULT_DISCOVERY_PROMPT,editorialDiscoveryRequest} from '../web/discovery-request.js';
import {prepareDevelopmentEditorialContext} from '../src/n8n/development-discovery-plan.js';

function fixture(){
 const nodes=[['Build Research Prompt',{jsCode:'return [{json:{brandText:"Synthetic brand guidance",instructions:"Preserve original sources",userPrompt:"A fixture direction"}}];'}],['Research Candidates',{modelId:{value:'gpt-5.4'},options:{maxTokens:3500,maxToolCalls:2}}],['Draft Editorial Concept',{modelId:{value:'gpt-5.4'},responses:{values:[{content:'=Original source-bound message {{ $json.subject }}'}]},options:{maxTokens:1800,instructions:'Source support is mandatory.'}}],['Guard Draft Input Budget',{jsCode:"if(JSON.stringify($input.first().json).length>30000)throw Error('DRAFT_INPUT_BUDGET_EXCEEDED');return $input.all();"}],['Finalize Development Candidate',{jsCode:'return [{json:{candidate_json:JSON.stringify({captionDraft:"Synthetic fixture",claims:[{claim:"Retained fact"}]})}}];'}]].map(([name,parameters])=>({name,parameters,type:/Candidates|Concept/.test(name)?'@n8n/n8n-nodes-langchain.openAi':'n8n-nodes-base.code',retryOnFail:false,credentials:{openAiApi:{id:'synthetic-reference'}}}));
 return {id:'6CkqfYc4Pyd4k8vi',name:'MILDINCIDENT DEV — bounded editorial generation',versionId:'captured',activeVersionId:'captured',active:true,nodes,connections:{'Research Candidates':{main:[[{node:'Draft Editorial Concept',type:'main',index:0}]]}},settings:{executionTimeout:240,executionOrder:'v1',availableInMCP:true}};
}
test('new writing operations retain native IDs while expressing distinct editorial work; discovery remains a bounded ordinary brief',()=>{
 assert.deepEqual(Object.keys(WRITING_DIRECTIONS).sort(),Object.keys(CAPTION_DIRECTIONS).filter(k=>k!=='initial').sort());assert.equal(new Set(Object.values(WRITING_DIRECTIONS).map(d=>d.brief)).size,5);
 assert.match(WRITING_DIRECTIONS.narrative.brief,/progression/);assert.match(WRITING_DIRECTIONS.concise.brief,/Cut the preamble/);assert.match(WRITING_DIRECTIONS.alternate_angle.brief,/Change the idea/);
 const guidance=editorialDirectionV14();assert.equal(guidance.frame,'Things you never knew you missed.');assert.ok(guidance.lenses.every(l=>l.brief.length<2000));assert.match(DEFAULT_DISCOVERY_PROMPT,/internet oddities/);assert.match(DEFAULT_DISCOVERY_PROMPT,/reject a well-researched but boring/);assert.ok(DEFAULT_DISCOVERY_PROMPT.length<2000);
 const request=editorialDiscoveryRequest(),nativeContext=prepareDevelopmentEditorialContext(request);assert.equal(request.kind,'brief');assert.equal(nativeContext.founder_request,DEFAULT_DISCOVERY_PROMPT);assert.equal(nativeContext.founder_url,'');
});
test('source completeness cannot override an explicit editorial pass; age and metrics do not confer taste',()=>{
 const result=editorialTasteCase({hook:'A recorded entry point',editorialCase:{recommendation:'reject',cultural_payoff:'Only institutional importance, no reader payoff.'},research:[{url:'https://example.org/record',capturedAccess:'source_text_captured'}]});assert.equal(result.decision,'pass');assert.equal(result.sourceCount,1);assert.equal(result.pixelInspectionPerformed,false);assert.equal(result.performancePrediction,false);assert.ok(result.dimensions.some(d=>d.basis==='not_recorded'));
});
test('offline editorial patch changes only four prompt/budget/metadata nodes and preserves models, contracts, credentials, graph and settings',()=>{
 const worker=fixture(),before=structuredClone(worker),sha=editorialGraphSha(worker),{workflow,review}=prepareV14EditorialPatch(worker,{expectedSha256:sha});assert.deepEqual(worker,before);assert.equal(review.changes.length,4);assert.equal(review.installed,false);assert.equal(review.modelNodesAdded,0);assert.deepEqual(workflow.connections,worker.connections);assert.deepEqual(workflow.settings,worker.settings);assert.deepEqual(workflow.nodes.find(n=>n.name==='Research Candidates'),worker.nodes.find(n=>n.name==='Research Candidates'));
 for(let i=0;i<workflow.nodes.length;i++){assert.deepEqual(workflow.nodes[i].credentials,worker.nodes[i].credentials);assert.equal(workflow.nodes[i].retryOnFail,false);if(workflow.nodes[i].parameters.jsCode)new vm.Script('(function(){'+workflow.nodes[i].parameters.jsCode+'})');}
 const draft=workflow.nodes.find(n=>n.name==='Draft Editorial Concept');assert.equal(draft.parameters.options.maxTokens,1800);assert.equal(draft.parameters.builtInTools,undefined);assert.match(draft.parameters.responses.values[0].content,/minimal or story register/);assert.match(draft.parameters.responses.values[0].content,/Cut the preamble/);assert.match(workflow.nodes.find(n=>n.name==='Guard Draft Input Budget').parameters.jsCode,/\+\d+>30000/);
 for(const mutate of [w=>w.settings.availableInMCP=false,w=>w.activeVersionId='different',w=>w.nodes[1].retryOnFail=true]){const changed=structuredClone(worker);mutate(changed);assert.throws(()=>prepareV14EditorialPatch(changed,{expectedSha256:sha}));}
});
