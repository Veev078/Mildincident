// Offline replay of the actual captured native graphs. Private inputs and reports stay ignored.
import fs from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
import {buildEditorialDevelopmentEngine} from '../src/n8n/editorial-development-engine.js';
const dir='.local/engine-build/';const read=async name=>JSON.parse(await fs.readFile(dir+name,'utf8'));
const researchWorkflow=await read('research-current-verification.json'),sourcingWorkflow=await read('sourcing-approved-before.json'),cfg=await read('development-connection.json'),prior=await read('worker-taste-selection-final-readback.json');
const credential=prior.nodes.find(n=>n.name==='Development Job Request').credentials.httpHeaderAuth;
const {workflow,review}=buildEditorialDevelopmentEngine({researchWorkflow,sourcingWorkflow,jobsTableId:cfg.jobsTableId,candidatesTableId:cfg.candidatesTableId,credentialId:credential.id,credentialName:credential.name});
for(const n of workflow.nodes)if(n.parameters.jsCode)new vm.Script(`(function(){${n.parameters.jsCode}})`);
const names=new Set(workflow.nodes.map(n=>n.name));for(const output of Object.values(workflow.connections))for(const branch of output.main)for(const edge of branch||[])assert.ok(names.has(edge.node));
const items=values=>values.map(json=>({json}));const run=(name,input,records)=>JSON.parse(JSON.stringify(vm.runInNewContext(`(function(){${workflow.nodes.find(n=>n.name===name).parameters.jsCode}})()`,{$input:{all:()=>items(input),first:()=>items(input)[0]},$execution:{id:'4242'},$:key=>{if(!records[key])throw new Error('Not executed');return {all:()=>items(records[key]),first:()=>items(records[key])[0]};}})));
const reports=[];
for(const file of ['approved-generation-execution.json','proactive-quality-execution.json']){
 const execution=await read(file);const records=Object.fromEntries(Object.entries(execution.data.resultData.runData).map(([name,runs])=>[name,runs.flatMap(r=>r.data?.main?.[0]||[]).map(i=>i.json)]));
 for(const key of Object.keys(records))if(/^(?:Get |Read )/.test(key))records[key]=[...new Map(records[key].map(i=>[JSON.stringify(i),i])).values()];
 records['Prepare Context']=run('Prepare Context',[],records).map(i=>i.json);records['Build Research Prompt']=run('Build Research Prompt',[],records).map(i=>i.json);
 const prompt=records['Build Research Prompt'][0];assert.ok(prompt.userPrompt.length+prompt.instructions.length<=30000);assert.match(prompt.userPrompt,/"editorial_case"/);
 const out=run('Parse Research',records['Research Candidates'],records)[0].json;assert.equal(out.editorialSelection.decision,'hold');reports.push({execution:file.startsWith('approved')?'2254':'2258',mode:'recorded_original_response',decision:out.editorialSelection.decision,inputCharacters:prompt.userPrompt.length+prompt.instructions.length});
}
const job={job_id:'418e3861-610b-400a-9cc6-e0635ce6003d',kind:'discovery',lease_token:'lease',status:'generating'};
const sources=[{claim:'Nightlife participants constructed a shared identity through handmade styling.',claim_type:'verified_fact',source_name:'Synthetic fixture publisher',source_url:'https://example.org/scene'},{claim:'The photographer recorded this particular club scene.',claim_type:'verified_fact',source_url:'https://example.org/photographer'}];
const good={subject:'Synthetic club styling and scene',territory:'fashion_subculture',hook_fact:'Handmade styling creates a scene.',claims:sources,visual:{reference_url:sources[0].source_url},editorial_case:{primary_appeal:'scene',cultural_payoff:sources[0].claim,visual_detail:'handmade glitter makeup and layered clothing',image_story_connection:'Styling expresses the participants shared cultural identity.',preset_connection:'Photographic subculture discovery with a specific documented angle.',familiarity_risk:'Focus on the documented styling rather than generic nightlife nostalgia.',supporting_claim_indices:[0],recommendation:'preferred',comparison_reason:'The specific styling carries the cultural claim.'}};
for(const leads of [[],[good],[{subject:'Synthetic weak celebrity portrait',claims:sources},good]]){
 const provider={output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:leads})}]}]};
 const records={'Verify Development Claim':[job],'Research Candidates':[provider],'Build Research Prompt':[{avoid:[],founderFeedback:[],discoveryPlan:{preset:'fixture-preset',territory:'fashion_subculture'}}]};
 records['Parse Research']=run('Parse Research',[provider],records).map(i=>i.json);let c=records['Parse Research'][0];
 if(leads.length){assert.equal(c.subject,good.subject);records['Expand Claims for Link Check']=run('Expand Claims for Link Check',[c],records).map(i=>i.json);records['Check Source Links']=sources.map(()=>({statusCode:200,body:'<article><p>Nightlife participants constructed a shared identity through handmade styling. Handmade glitter makeup and layered clothing in the club scene.</p></article>'}));records['Collect Link Checks']=run('Collect Link Checks',records['Check Source Links'],records).map(i=>i.json);
 const photo={asset_id:'fixture-photo',thumb_url:'https://example.org/photo.jpg',source_relation:'subject_caption_match',source_caption:'Club scene',source_page_url:sources[0].source_url};records['Extract Original-Page Image Previews']=[photo];records['Prepare Visual Draft Context']=run('Prepare Visual Draft Context',[photo],records).map(i=>i.json);c=records['Prepare Visual Draft Context'][0];assert.equal(c.editorialSelection.decision,'advance');
 records['Quality Gate']=run('Quality Gate',[{output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'Synthetic fixture story',subject:good.subject,hook:good.hook_fact,format:'single_image',caption:'Handmade styling shapes the shared identity of this club scene.',slide_outline:[]})}]}]}],records).map(i=>i.json);
 assert.equal(records['Quality Gate'][0].decision,'advance');records['Build Pipeline Rows']=run('Build Pipeline Rows',records['Quality Gate'],records).map(i=>i.json);
 const final=run('Finalize Development Candidate',records['Build Pipeline Rows'],records)[0].json;const candidate=JSON.parse(final.candidate_json);assert.equal(candidate.leadComparison.length,leads.length);assert.equal(candidate.media.length,1);assert.equal(candidate.rightsGranted,false);
 }else assert.equal(c.prechecks_passed,false);
 reports.push({mode:'synthetic_native_path',leadCount:leads.length,selectedDecision:c.editorialSelection.decision});
}
for(const scenario of ['malformed','incomplete','duplicate','founder_rejected','unrelated_image','source_access_failure']){
 const provider={output:[{type:'message',content:[{type:'output_text',text:scenario==='malformed'?'broken JSON':JSON.stringify({candidates:scenario==='duplicate'?[good,good]:[good]})}]}],...(scenario==='incomplete'?{status:'incomplete'}:{})};
 const records={'Verify Development Claim':[job],'Research Candidates':[provider],'Build Research Prompt':[{avoid:[],founderFeedback:scenario==='founder_rejected'?[{subject:good.subject,reviewer:'founder',basis:'editorial_taste',decision:'rejected'}]:[],discoveryPlan:{preset:'fixture-preset'}}]};
 const selected=run('Parse Research',[provider],records)[0].json;
 if(['malformed','incomplete','founder_rejected'].includes(scenario))assert.equal(selected.editorialSelection.decision,'reject');
 if(scenario==='duplicate'){assert.equal(selected.leadComparison.filter(c=>c.decision==='reject').length,1);assert.equal(selected.editorialSelection.decision,'advance');}
 if(['unrelated_image','source_access_failure'].includes(scenario)){
 records['Collect Link Checks']=[{...selected,sourceEvidence:scenario==='source_access_failure'?[{claimIndex:0,access:'access_unconfirmed'}]:[{claimIndex:0,access:'source_text_captured'}]}];
 const context=run('Prepare Visual Draft Context',[{asset_id:'fixture',source_relation:scenario==='unrelated_image'?'context_only':'subject_caption_match',source_caption:good.editorial_case.visual_detail}],records)[0].json;assert.equal(context.editorialSelection.decision,'hold');
 }
 reports.push({mode:'synthetic_native_edge',scenario,passed:true});
}
const failure=run('Prepare Development Failure',[],{'Claim Queued Development Job':[job],'Validate Development Dispatch':[{job_id:job.job_id,dispatch_id:'lease'}]})[0].json;assert.equal(failure.error,'DEVELOPMENT_EXECUTION_FAILED');
await fs.writeFile(dir+'intelligence2-worker.json',JSON.stringify(workflow),{mode:0o600});await fs.writeFile(dir+'intelligence2-native-replay.json',JSON.stringify({reports,review,paidCalls:0,productionWrites:0},null,2),{mode:0o600});console.log(JSON.stringify({reports,nodes:workflow.nodes.length,paidCalls:0,productionWrites:0}));
