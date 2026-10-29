import test from 'node:test';import assert from 'node:assert/strict';
import {prepareDevelopmentEditorialContext,planDevelopmentResearch} from '../src/n8n/development-discovery-plan.js';
test('proactive context preserves native preset routing while on-demand briefs retain exact direction and link',()=>{
 const discovery=prepareDevelopmentEditorialContext({kind:'discovery',prompt:'Find one surprising photographic connection'});assert.equal(discovery.founder_request,'');assert.equal(discovery.theme,'');
 const brief=prepareDevelopmentEditorialContext({kind:'brief',prompt:'Research this specific scene',source_url:'https://archive.example.org/scene'});assert.equal(brief.founder_request,'Research this specific scene');assert.equal(brief.founder_url,'https://archive.example.org/scene');
});
test('one discovery branch respects current preset, avoids recent development repetition and skips tested seed leads',()=>{
 const requests=['film','fashion'].map(territory=>({json:{territory,userPrompt:'Native brand and preset rules',discovery_approach:'visual_first',avoid:['Existing native subject'],diversity:{selected_seed_preset:'current_native_preset'}}}));
 const history=[{story:{subject:'An existing film story',territory:'film'},provenance:{generatedAt:'2026-10-29T12:00:00Z'}}];
 const input=JSON.stringify({requests,history});const [planned]=planDevelopmentResearch(requests,history,{kind:'discovery',prompt:'Look beyond famous celebrity pairings'});
 assert.equal(planned.json.discoveryPlan.territory,'fashion');assert.equal(planned.json.discoveryPlan.preset,'current_native_preset');assert.deepEqual(planned.json.diversity.chosen_territories,['fashion']);assert.ok(planned.json.avoid.includes('An existing film story'));assert.match(planned.json.userPrompt,/Look beyond famous celebrity pairings/);assert.equal(JSON.stringify({requests,history}),input);
 const brief=planDevelopmentResearch(requests,history,{kind:'brief',prompt:'A specific film brief'});assert.equal(brief[0].json.discoveryPlan.territory,'film');
 const seedRequests=[{json:{...requests[0].json,seed_idea_key:'TEST-SEED-1'}},{json:{...requests[1].json,seed_idea_key:'TEST-SEED-2'}}];const tested=[{story:{founder_feedback:'SEED-BANK: TEST-SEED-1 · earlier subject'}}];
 assert.equal(planDevelopmentResearch(seedRequests,tested,{kind:'discovery',prompt:'Current preset'})[0].json.seed_idea_key,'TEST-SEED-2');
 assert.throws(()=>planDevelopmentResearch(seedRequests.slice(0,1),tested,{kind:'discovery',prompt:'Current preset'}),/NO_UNTESTED_DEVELOPMENT_DISCOVERY_LEAD/);
});
