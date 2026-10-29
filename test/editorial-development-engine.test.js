import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {buildEditorialDevelopmentEngine} from '../src/n8n/editorial-development-engine.js';
function fixture(){const readers=['Get Brand Brain','Get Recent Research','Get Recent Pipeline','Get Past Rejections','Get Retired Editorial Archive','Read Current Seed For Research','Read Seed Presets For Research','Read Editorial Idea Bank For Research'];const processors=['Build Research Prompt','Research Candidates','Parse Research','Expand Claims for Link Check','Check Source Links','Collect Link Checks','Passed Prechecks?','Skip HTTP for Empty Research','Draft Editorial Concept','Quality Gate','Advance to Chief?','Build Pipeline Rows'];
 return {researchWorkflow:{id:'production-research',activeVersionId:'active-v1',activeVersion:{nodes:[...readers.map(name=>({name,type:'n8n-nodes-base.dataTable',parameters:{operation:'get',dataTableId:{value:'production-read-only'}}})),...processors.map(name=>({name,type:name.includes('?')?'n8n-nodes-base.if':name==='Check Source Links'?'n8n-nodes-base.httpRequest':['Research Candidates','Draft Editorial Concept'].includes(name)?'@n8n/n8n-nodes-langchain.openAi':'n8n-nodes-base.code',parameters:{jsCode:name==='Build Research Prompt'?"return [{json:{userPrompt:'Research',avoid:[]}}];":name==='Quality Gate'?"const c=$('Passed Prechecks?').first().json;return [{json:{...c,decision:'advance',concept:$input.first().json.draft,reasons:[]}}];":'return [];',options:{},responses:{values:[{content:'=Recorded candidate {{ JSON.stringify($json) }}'}]}}}))]}},sourcingWorkflow:{activeVersionId:'source-v1',activeVersion:{nodes:[{name:'Fetch First-Party Page Metadata',type:'n8n-nodes-base.httpRequest',parameters:{}},{name:'Extract Original-Page Image Previews',type:'n8n-nodes-base.code',parameters:{jsCode:'return [];'}}]}},jobsTableId:'dev_jobs',candidatesTableId:'dev_candidates',credentialId:'dev_auth',credentialName:'Dev credential'};}
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

test('context table readers execute once instead of multiplying downstream reads per archive item',()=>{
 const {workflow}=buildEditorialDevelopmentEngine(fixture());const readers=workflow.nodes.filter(n=>n.type==='n8n-nodes-base.dataTable'&&n.parameters.operation==='get');assert.equal(readers.length,9);for(const reader of readers){assert.equal(reader.executeOnce,true,reader.name);assert.equal(reader.alwaysOutputData,true,reader.name);}
});

function replay(workflow,name,input,records={}) {
 const code=workflow.nodes.find(n=>n.name===name).parameters.jsCode;
 const items=rows=>rows.map(json=>({json}));
 return JSON.parse(JSON.stringify(vm.runInNewContext(`(function(){${code}})()`,{$input:{all:()=>items(input),first:()=>items(input)[0]},$execution:{id:'4242'},$:node=>{if(!(node in records))throw new Error('Node not executed');return {all:()=>items(records[node]),first:()=>items(records[node])[0]};}})));
}
test('source captions precede drafting and a generic page cover cannot pass the visual gate',()=>{
 const {workflow}=buildEditorialDevelopmentEngine(fixture());const next=name=>workflow.connections[name].main[0][0].node;
 assert.equal(next('Passed Prechecks?'),'Prepare First-Party Page Scan');assert.equal(next('Extract Original-Page Image Previews'),'Prepare Visual Draft Context');assert.equal(next('Related Source Image Found?'),'Guard Draft Input Budget');assert.equal(workflow.connections['Related Source Image Found?'].main[1][0].node,'Prepare Rejected Development Candidate');
 const records={'Collect Link Checks':[{subject:'Mira Sol and Elio North (1967)',visual:{reference_url:'https://archive.example.org/gallery'}}],'Prepare First-Party Page Scan':[{concept_id:'DEV-fixture',source_page_url:'https://archive.example.org/gallery'}]};
 const cover=replay(workflow,'Extract Original-Page Image Previews',[{statusCode:200,body:'<meta property="og:image" content="/cover.jpg">'}],records);assert.equal(cover.length,1);assert.equal(cover[0].json.source_relation,'page_cover');
 const blocked=replay(workflow,'Prepare Visual Draft Context',cover.map(i=>i.json),records)[0].json;assert.equal(blocked.hasRelatedImage,false);
 const images=replay(workflow,'Extract Original-Page Image Previews',[{statusCode:200,body:'<meta property="og:image" content="/cover.jpg"><img src="/portrait.jpg" alt="Mira Sol in Paris, 1974. © Alex Vale.">'}],records);
 const context=replay(workflow,'Prepare Visual Draft Context',images.map(i=>i.json),records)[0].json;assert.equal(context.hasRelatedImage,true);assert.equal(context.photoEvidence[0].years[0],1974);assert.equal(context.photoEvidence[0].credit,'© Alex Vale');assert.equal(context.photoEvidence[0].dateContext,'different_year_context');
 for(const node of workflow.nodes.filter(n=>n.type.includes('openAi')))assert.equal(node.parameters.simplify,false);
});
test('editorial rejection retains paid draft text and images, and never marks an unconfirmed source ready',()=>{
 const {workflow}=buildEditorialDevelopmentEngine(fixture());const job={job_id:'418e3861-610b-400a-9cc6-e0635ce6003d',kind:'brief'};
 const context={subject:'Mira Sol in a 1967 film',claims:[{link_status:'unconfirmed'}],photoEvidence:[{relation:'subject_caption_match',dateContext:'different_year_context',years:[1974]}]};
 const draft={title:'An existing generated idea',format:'single_image',caption:'For a younger audience, the appeal is simple.',hook:'A sourced connection',slide_outline:[]};
 const rejected=replay(workflow,'Quality Gate',[{draft}],{'Prepare Visual Draft Context':[context]})[0].json;
 assert.equal(rejected.decision,'reject');assert.ok(rejected.reasons.some(r=>r.includes('AUDIENCE_PITCH_IN_CAPTION')));assert.ok(rejected.reasons.some(r=>r.includes('PHOTO_DATE_CONTEXT')));assert.equal(rejected.concept.caption,draft.caption);
 const media={asset_id:'photo',thumb_url:'https://archive.example.org/photo.jpg',source_relation:'subject_caption_match'};
 const finalized=replay(workflow,'Finalize Development Candidate',[rejected],{'Verify Development Claim':[job],'Quality Gate':[rejected],'Extract Original-Page Image Previews':[media]})[0].json;
 const candidate=JSON.parse(finalized.candidate_json);assert.equal(candidate.status,'needs_research');assert.equal(candidate.captionDraft,draft.caption);assert.equal(candidate.media.length,1);assert.deepEqual(candidate.proposedAssetIds,['photo']);assert.equal(candidate.targetSlideCount,1);assert.equal(candidate.rightsGranted,false);
 const revised=replay(workflow,'Quality Gate',[{draft:{...draft,caption:'A documentary photograph from Paris, 1974.'}}],{'Prepare Visual Draft Context':[context]})[0].json;assert.equal(revised.decision,'advance');
 const stillOpen=JSON.parse(replay(workflow,'Finalize Development Candidate',[revised],{'Verify Development Claim':[job],'Quality Gate':[revised],'Extract Original-Page Image Previews':[media]})[0].json.candidate_json);assert.equal(stillOpen.status,'needs_research');assert.ok(stillOpen.gaps.some(g=>g.includes('unconfirmed')));
});
