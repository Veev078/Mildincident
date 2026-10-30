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

test('exhausted seed discovery continues only through seed-free branches carrying the same native preset',()=>{
 const seeded={json:{territory:'music_scene',seed_idea_key:'used-seed',userPrompt:'Specific already-tested seed',instructions:'Native research rules',brandText:'Native foundation',diversity:{selected_seed_preset:'native-visual'}}};
 const history=[{story:{subject:'Previously tested project'},discoveryPlan:{seedIdeaKey:'used-seed'}}];const fresh={json:{territory:'photography',userPrompt:'Native preset routes without the idea bank',instructions:'Native research rules',brandText:'Native foundation',diversity:{selected_seed_preset:'native-visual'},discovery_approach:'visual_first'}};
 const before=JSON.stringify([seeded,history,fresh]);const [result]=planDevelopmentResearch([seeded],history,{kind:'discovery',prompt:'Follow new cultural routes'},[fresh]);assert.equal(result.json.discoveryPlan.seedPoolExhausted,true);assert.equal(result.json.discoveryPlan.preset,'native-visual');assert.equal(result.json.discoveryPlan.territory,'photography');assert.equal(result.json.discoveryPlan.seedIdeaKey,'');assert.equal(result.json.discoveryPlan.freshBranchPreparedCount,1);assert.ok(result.json.userPrompt.includes('not a recommended subject list'));assert.ok(!result.json.userPrompt.includes('Specific already-tested seed'));assert.equal(result.json.brandText,'Native foundation');assert.equal(JSON.stringify([seeded,history,fresh]),before);
 assert.throws(()=>planDevelopmentResearch([seeded],history,{kind:'discovery',prompt:'Fresh routes'},[{json:{...fresh.json,diversity:{selected_seed_preset:'invented-preset'}}}]),/DISCOVERY_FALLBACK_PROVENANCE_CHANGED/);
 assert.throws(()=>planDevelopmentResearch([seeded],history,{kind:'brief',prompt:'Retain this exact brief'},[fresh]),/NO_UNTESTED_DEVELOPMENT_DISCOVERY_LEAD/);
});

test('when native production history exhausted the bank before preparing any branches, fallback still requires captured preset identity',()=>{
 const fresh={json:{territory:'scene',userPrompt:'Native seed-free branch',instructions:'Native foundation',diversity:{selected_seed_preset:'selected-native'}}};const job={kind:'discovery',prompt:'Explore new work'};
 assert.throws(()=>planDevelopmentResearch([],[],job,[fresh]),/DISCOVERY_FALLBACK_PROVENANCE_CHANGED/);const [out]=planDevelopmentResearch([],[],job,[fresh],'selected-native');assert.equal(out.json.discoveryPlan.preset,'selected-native');assert.equal(out.json.discoveryPlan.preparedBranchCount,0);assert.equal(out.json.discoveryPlan.seedPoolExhausted,true);
});

test('captured contemporary publication leads inform native research as unverified source context, not generated angles or photographer credits',()=>{
 const request={json:{territory:'fashion_subculture',instructions:'Native brand',userPrompt:'Current native preset',diversity:{selected_seed_preset:'native'}}};const sourceLeads=[{title:'Independent contemporary photography project',url:'https://example.org/project',summary:'An observed feed announcement',publishedAt:'2026-10-30T12:00:00Z',photographDate:null,isGeneratedStory:false}];const [out]=planDevelopmentResearch([request],[],{kind:'discovery',prompt:'Find new cultural stories',editorial_context_json:JSON.stringify({schemaVersion:1,feedback:[],sourceLeads})});assert.ok(out.json.userPrompt.includes('publication dates are not photograph dates'));assert.ok(out.json.userPrompt.includes('An observed feed announcement'));assert.ok(out.json.userPrompt.includes('Institutional archives are optional sources'));assert.equal(out.json.discoveryPlan.preset,'native');assert.equal(out.json.discoveryPlan.territory,'fashion_subculture');
 assert.throws(()=>planDevelopmentResearch([request],[],{kind:'discovery',prompt:'Fresh work',editorial_context_json:JSON.stringify({schemaVersion:1,feedback:[],sourceLeads:[{title:'Malformed',url:'javascript:invalid',summary:''}]})}),/INVALID_SOURCE_LEAD_CONTEXT/);
});
