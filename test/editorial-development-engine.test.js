import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {buildEditorialDevelopmentEngine} from '../src/n8n/editorial-development-engine.js';
function fixture(){const readers=['Get Brand Brain','Get Recent Research','Get Recent Pipeline','Get Past Rejections','Get Retired Editorial Archive','Read Current Seed For Research','Read Seed Presets For Research','Read Editorial Idea Bank For Research'];const processors=['Build Research Prompt','Research Candidates','Parse Research','Expand Claims for Link Check','Check Source Links','Collect Link Checks','Passed Prechecks?','Skip HTTP for Empty Research','Draft Editorial Concept','Quality Gate','Advance to Chief?','Build Pipeline Rows'];
 return {researchWorkflow:{id:'production-research',activeVersionId:'active-v1',activeVersion:{nodes:[...readers.map(name=>({name,type:'n8n-nodes-base.dataTable',parameters:{operation:'get',dataTableId:{value:'production-read-only'}}})),...processors.map(name=>({name,type:name.includes('?')?'n8n-nodes-base.if':name==='Check Source Links'?'n8n-nodes-base.httpRequest':['Research Candidates','Draft Editorial Concept'].includes(name)?'@n8n/n8n-nodes-langchain.openAi':'n8n-nodes-base.code',parameters:{jsCode:name==='Build Research Prompt'?"return [{json:{userPrompt:'Research',avoid:[]}}];":'return [];',options:{}}}))]}},sourcingWorkflow:{activeVersionId:'source-v1',activeVersion:{nodes:[{name:'Fetch First-Party Page Metadata',type:'n8n-nodes-base.httpRequest',parameters:{}},{name:'Extract Original-Page Image Previews',type:'n8n-nodes-base.code',parameters:{jsCode:'return [];'}}]}},jobsTableId:'dev_jobs',candidatesTableId:'dev_candidates',credentialId:'dev_auth',credentialName:'Dev credential'};}
test('editorial development clone has no production writers, schedules, subworkflow calls or automatic paid retries',()=>{
 const input=fixture();const before=JSON.stringify(input);const {workflow,review}=buildEditorialDevelopmentEngine(input);assert.equal(JSON.stringify(input),before);assert.equal(review.maxCandidates,1);assert.equal(review.maxResearchCalls,1);
 for(const node of workflow.nodes){assert.ok(!/scheduleTrigger|formTrigger|executeWorkflow/.test(node.type));if(node.type==='n8n-nodes-base.dataTable'&&node.parameters.operation!=='get')assert.ok(['dev_jobs','dev_candidates'].includes(node.parameters.dataTableId.value));if(node.parameters.jsCode)new vm.Script(`(function(){${node.parameters.jsCode}})`);if(node.type.includes('openAi'))assert.equal(node.retryOnFail,false);}
 const names=new Set(workflow.nodes.map(n=>n.name));for(const outputs of Object.values(workflow.connections))for(const branch of outputs.main)for(const edge of branch)assert.ok(names.has(edge.node),edge.node);
 assert.equal(workflow.nodes.find(n=>n.name==='Research Candidates').parameters.options.maxTokens,3500);assert.equal(workflow.nodes.find(n=>n.name==='Draft Editorial Concept').parameters.options.maxTokens,1800);
});
test('development prompt caps active research branches and incorporates prior development subjects into duplicate checks',()=>{
 const {workflow}=buildEditorialDevelopmentEngine(fixture());const prompt=workflow.nodes.find(n=>n.name==='Build Research Prompt').parameters.jsCode;
 const out=vm.runInNewContext(`(function(){${prompt}})()`,{$:name=>({all:()=>[{json:{candidate_json:JSON.stringify({story:{subject:'Previously generated subject'}})}}],first:()=>({json:{kind:'brief'}})})});
 assert.equal(out.length,1);assert.equal(out[0].json.source,'development_brief');assert.ok(out[0].json.avoid.includes('Previously generated subject'));
});

test('research input budget stops oversized prompts before the model node',()=>{
 const fixtureInput=fixture();fixtureInput.researchWorkflow.activeVersion.nodes.find(n=>n.name==='Build Research Prompt').parameters.jsCode="return [{json:{userPrompt:'a'.repeat(30001),avoid:[]}}];";
 const {workflow}=buildEditorialDevelopmentEngine(fixtureInput);const code=workflow.nodes.find(n=>n.name==='Build Research Prompt').parameters.jsCode;
 assert.throws(()=>vm.runInNewContext(`(function(){${code}})()`,{$:()=>({all:()=>[],first:()=>({json:{kind:'brief'}})})}),/RESEARCH_INPUT_BUDGET_EXCEEDED/);
 const guard=workflow.nodes.find(n=>n.name==='Guard Draft Input Budget').parameters.jsCode;
 assert.throws(()=>vm.runInNewContext(`(function(){${guard}})()`,{$input:{first:()=>({json:{claims:'a'.repeat(30001)}})},$:()=>({first:()=>({json:{brandText:''}})})}),/DRAFT_INPUT_BUDGET_EXCEEDED/);
});

test('worker refuses ambiguous duplicate-row claim before any model work',()=>{
 const {workflow}=buildEditorialDevelopmentEngine(fixture());const code=workflow.nodes.find(n=>n.name==='Verify Development Claim').parameters.jsCode;
 const row={job_id:'same',lease_token:'lease',status:'generating',kind:'brief',prompt:'A valid creative research request'};
 const out=vm.runInNewContext(`(function(){${code}})()`,{$input:{first:()=>({json:row}),all:()=>[{json:row},{json:row}]},$:()=>({first:()=>({json:{job_id:'same',dispatch_id:'lease'}})})});assert.equal(out[0].json.claimed,false);
});
