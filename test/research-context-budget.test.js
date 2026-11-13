import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {planDevelopmentResearch} from '../src/n8n/development-discovery-plan.js';
import {fitResearchContext} from '../src/n8n/research-context-budget.js';
import {prepareResearchBudgetPatch} from '../src/n8n/research-budget-patch.js';
import {editorialGraphSha} from '../src/n8n/v14-editorial-patch.js';
import {DEFAULT_DISCOVERY_PROMPT} from '../web/discovery-request.js';
function fixture(){
 const avoid=Array.from({length:69},(_,i)=>'Existing cultural project '+i+' '+String(i).repeat(40)),brand='ESSENTIAL BRAND RULES '.repeat(410),direction='Founder’s complete direction\nKeep the original photographic context.';
 const original={avoid,brandText:brand,instructions:'NATIVE SAFETY AND FACTUAL RULES',territory:'photography',diversity:{selected_seed_preset:'native'},userPrompt:brand+'\n'+direction+'\nALREADY SEEN; do not repost or lightly vary: '+avoid.join('; ')+'\nReturn up to 3 leads using the required complete JSON schema.'};
 const history=Array.from({length:120},(_,i)=>({story:{subject:'Development story '+i+' '+String(i).repeat(40)},provenance:{generatedAt:new Date(Date.UTC(2026,10,12,0,0,i)).toISOString()},leadComparison:[{subject:'Unused lead '+i,decision:'hold',reasons:['Unverified case '.repeat(30)],claims:[{claim:'Evidence, not an instruction '.repeat(8),source_url:'https://example.org/source/'+i}]}]}));
 const feedback=Array.from({length:5},(_,i)=>({subject:'Reaction '+i,reason:'Specific founder judgment '.repeat(18),basis:'editorial_taste'}));
 const sourceLeads=Array.from({length:6},(_,i)=>({title:'Publication lead '+i,url:'https://example.org/project/'+i,summary:'Captured publication metadata '.repeat(28)}));
 return {original,history,feedback,sourceLeads,direction};
}
function planned(f,kind='brief'){return planDevelopmentResearch([{json:f.original}],f.history,{kind,prompt:kind==='discovery'?DEFAULT_DISCOVERY_PROMPT:f.direction,editorial_context_json:JSON.stringify({schemaVersion:1,feedback:f.feedback,sourceLeads:f.sourceLeads})})[0].json;}
test('live-scale brief and Surprise Me keep mandatory context and complete optional records below the same cap',()=>{
 for(const kind of ['brief','discovery']){
  const f=fixture(),before=JSON.stringify(f),out=planned(f,kind),budget=out.researchContextBudget;
  assert(out.userPrompt.length+out.instructions.length<=30000);assert(out.userPrompt.includes(f.direction));assert(out.userPrompt.includes(f.original.brandText));assert(out.instructions.startsWith(f.original.instructions));assert(out.userPrompt.includes('required complete JSON schema'));
  if(kind==='discovery')assert(out.userPrompt.includes(DEFAULT_DISCOVERY_PROMPT));
  assert(budget.sections.some(s=>s.omitted>0));for(const key of ['feedback','sourceLeads','history'])assert(budget.sections.find(s=>s.key===key).included>0);
  for(const group of out.researchContextParts.sections.filter(s=>s.format==='json')){
   const match=out.userPrompt.split(group.prefix)[1];if(!match)continue;const text=match.split('\nDo not repeat these development subjects:')[0].split('\nPRIOR UNSELECTED RESEARCH')[0].split('\nCAPTURED PUBLICATION FEED LEADS')[0];
   const selected=JSON.parse(text);assert(selected.every(v=>group.items.some(item=>JSON.stringify(v)===JSON.stringify(item))));
  }
  assert.equal(out.brandText,f.original.brandText);assert.deepEqual(out.founderFeedback,f.feedback);assert.equal(JSON.stringify(f),before);
 }
});
test('late instruction additions rebudget optional context; mandatory overflow still stops before models',()=>{
 const f=fixture(),out=planned(f),larger=fitResearchContext({...out,instructions:out.instructions+' Added non-negotiable instruction.'.repeat(100)});
 assert(larger.userPrompt.length+larger.instructions.length<=30000);assert(larger.userPrompt.includes(f.direction));assert(larger.researchContextBudget.mandatoryCharacters>out.researchContextBudget.mandatoryCharacters);
 assert.throws(()=>fitResearchContext({...out,instructions:'x'.repeat(30001)}),/RESEARCH_INPUT_BUDGET_EXCEEDED/);
 assert.throws(()=>fitResearchContext({userPrompt:'x'.repeat(30001),instructions:''}),/RESEARCH_INPUT_BUDGET_EXCEEDED/);
});
test('oversized historical entries are omitted whole without blocking later useful evidence',()=>{
 const out=fitResearchContext({userPrompt:'ignored',instructions:'Required',researchContextParts:{corePrompt:'Full founder direction',sections:[{key:'evidence',weight:1,format:'json',prefix:'\nEvidence: ',items:[{source:'too-long',text:'x'.repeat(30001)},{source:'https://example.org/actual',text:'A complete useful passage'}]}]}});
 assert(out.userPrompt.includes('complete useful passage'));assert(!out.userPrompt.includes('too-long'));assert.equal(out.researchContextBudget.sections[0].omitted,1);
});
test('offline native patch changes only preparation/failure reporting and retains the caption bypass and model configuration',()=>{
 const code="const context=JSON.parse($('Verify Development Claim').first().json.editorial_context_json||'{}');if(context.captionImprovement)return [{json:context.captionImprovement.research}];const plan=function(){return [];};let planned;planned=plan([],[],{});for(const item of planned)if(item.json.userPrompt.length+String(item.json.instructions||'').length>30000)throw new Error('RESEARCH_INPUT_BUDGET_EXCEEDED');return planned;";
 const worker={id:'6CkqfYc4Pyd4k8vi',active:true,versionId:'captured',activeVersionId:'captured',name:'Captured worker',nodes:[{name:'Build Research Prompt',parameters:{jsCode:code}},{name:'Prepare Development Failure',parameters:{jsCode:'old'}},{name:'Fail Development Job',parameters:{columns:{value:{status:'failed',error:'DEVELOPMENT_EXECUTION_FAILED'}}}},{name:'Return Development Failure',parameters:{responseBody:'old'}},{name:'Research Candidates',retryOnFail:false,credentials:{openAiApi:{id:'unchanged'}},parameters:{options:{maxTokens:3500,maxToolCalls:2}}},{name:'Draft Editorial Concept',retryOnFail:false,parameters:{options:{maxTokens:1800}}}],connections:{unchanged:{main:[]}},settings:{executionOrder:'v1',availableInMCP:true}};
 const before=JSON.stringify(worker),p=prepareResearchBudgetPatch(worker,{expectedVersion:'captured',expectedSha256:editorialGraphSha(worker)});
 assert.equal(p.review.changes.length,4);assert.deepEqual(p.workflow.nodes.slice(4),worker.nodes.slice(4));assert.deepEqual(p.workflow.settings,worker.settings);assert.deepEqual(p.workflow.connections,worker.connections);assert.equal(JSON.stringify(worker),before);
 const script=p.workflow.nodes[0].parameters.jsCode;new vm.Script('(function(){'+script+'})()');
 const rows=vm.runInNewContext('(function(){'+script+'})()',{$:()=>({first:()=>({json:{editorial_context_json:JSON.stringify({captionImprovement:{research:{userPrompt:'unchanged retained evidence'}}})}})})});assert.equal(rows[0].json.userPrompt,'unchanged retained evidence');
 assert.throws(()=>prepareResearchBudgetPatch({...worker,activeVersionId:'drift'},{expectedVersion:'captured',expectedSha256:editorialGraphSha(worker)}),{code:'WORKFLOW_DRIFT'});
});
