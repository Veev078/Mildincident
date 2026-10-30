import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {editorialSelectionTools} from '../src/editorial-selection.js';
const tools=editorialSelectionTools();
// These are explicitly curated rubric scenarios for public cultural references, not generated stories or new source verification.
const caseFor=(detail,payoff)=>({primary_appeal:'photography',cultural_payoff:payoff,visual_detail:detail,image_story_connection:'The documented creative relationship changes the reading of this particular frame.',preset_connection:'A distinctive photographic moment within visual culture.',familiarity_risk:'Use a specific frame and relationship rather than celebrity name recognition.',supporting_claim_indices:[0]});
const scenario=(subject,territory,detail,payoff)=>({subject,territory,prechecks_passed:true,claims:[{claim:payoff,source_url:'https://example.org/recorded-fixture'}],editorialCase:caseFor(detail,payoff)});
test('a sourced puzzle and generic archive prestige cannot stand in for an independent editorial case',()=>{
 const puzzle={subject:'An unidentified actress in a mystery photo',hook_fact:'An identification puzzle solved by its subject',prechecks_passed:true,visual:{reference_url:'https://www.loc.gov/',notes:'A beautiful visually strong portrait'}};puzzle.editorialCase={primary_appeal:'identification_puzzle'};const held=tools.assess(puzzle);assert.equal(held.decision,'hold');assert.ok(held.reasons.some(r=>r.code==='IDENTIFICATION_WITHOUT_INDEPENDENT_PAYOFF'));assert.ok(held.reasons.some(r=>r.code==='EDITORIAL_CASE_INCOMPLETE'));
 const founder={subject:puzzle.subject,reviewer:'founder',basis:'editorial_taste',decision:'rejected'};assert.equal(tools.assess(puzzle,{feedback:[founder]}).decision,'reject');assert.equal(tools.assess({...puzzle,subject:'A different cultural story'},{feedback:[founder]}).decision,'hold');
});
test('varied public-reference scenarios can advance provisionally, but sources and specific visual details are required before drafting',()=>{
 const examples=[scenario('Derek Ridgers at the Batcave','fashion_subculture','batcave layered makeup and clothing','Batcave club participants made dress and makeup part of their nightlife identity.'),scenario('Deneuve and the reflected Boulat camera','music_film_pop','Boulat reflected in the mirror beside Deneuve','Saint Laurent designed Deneuve costumes for Belle de Jour.'),scenario('Atong Atem photographic self-staging','historic_photograph','painted faces and patterned fabrics','Atong Atem combines photographic self-staging with colour and cultural memory.'),scenario('Schiaparelli and Dalí lobster dress','art_odd_object','lobster printed across a white gown','Schiaparelli and Dalí connected surrealist art and fashion through the lobster dress.')];
 for(const c of examples){assert.equal(tools.assess(c).decision,'advance');const source={claimIndex:0,access:'source_text_captured'};assert.equal(tools.assess(c,{phase:'sources',sources:[source],photos:[]}).decision,'hold');const review=tools.assess(c,{phase:'sources',sources:[source],photos:[{source_relation:'subject_caption_match',source_caption:c.editorialCase.visual_detail}]});assert.equal(review.decision,'advance');assert.equal(review.pixelInspectionPerformed,false);assert.equal(review.tasteVerified,false);}
 const c=examples[1];assert.equal(tools.assess(c,{phase:'sources',sources:[{claimIndex:0,access:'access_unconfirmed'}],photos:[{source_relation:'subject_caption_match',source_caption:c.editorialCase.visual_detail}]}).decision,'hold');
});
test('comparison considers alternatives rather than committing to the first sourceable lead and does not rank fame',()=>{
 const first={subject:'An archive identification puzzle',prechecks_passed:true,claims:[]};const scene=scenario('A documented unfamiliar nightlife scene','fashion_subculture','layered makeup and club clothing','Club participants used fashion to construct a new nightlife identity.');const known=scenario('A familiar film-fashion connection','music_film_pop','mirrored camera and designer fitting','A designer and film star collaborated on character costumes.');const selected=tools.select([first,known,scene],{recentTerritories:['music_film_pop','music_film_pop']});assert.equal(selected.candidate.subject,scene.subject);assert.equal(selected.comparison.length,3);assert.equal(selected.alternativesVerified,false);assert.equal(tools.select([first]).review.decision,'hold');
 const serialized=vm.runInNewContext(`(${editorialSelectionTools.toString()})().assess(${JSON.stringify(scene)})`);assert.equal(serialized.decision,'advance');
});

test('anonymous archival subjects are eligible when a separate cultural story and specific visual evidence warrant them',()=>{
 const c=scenario('An unidentified underground club participant','fashion_subculture','handmade glitter makeup and layered clothing','Club participants used handmade glitter makeup to express a new queer nightlife identity.');c.editorialCase.primary_appeal='identification_puzzle';c.editorialCase.independent_payoff='The nightlife community expressed a new shared queer cultural identity through dress.';const assessment=tools.assess(c,{phase:'sources',sources:[{claimIndex:0,access:'source_text_captured'}],photos:[{source_relation:'subject_caption_match',source_caption:'Handmade glitter makeup and layered clothing in the club.'}]});assert.equal(assessment.decision,'advance');assert.ok(assessment.rationale[0].message.includes('aesthetic quality remains unverified'));
});

test('an explicit weak-lead disposition is respected and reasoned preference precedes diversity tie-breaking',()=>{
 const scene=scenario('An unfamiliar scene','fashion_subculture','patterned club clothing and makeup','Nightlife fashion connects participants across an underground scene.');const preferred=scenario('A particular music portrait','music_film_pop','camera reflection beside the performer','The reflected photographer documents a specific musical creative collaboration.');preferred.editorialCase.recommendation='preferred';preferred.editorialCase.comparison_reason='The reflected photographer makes the creative relationship more specific than the other proposed scene survey.';const picked=tools.select([scene,preferred],{recentTerritories:['music_film_pop']});assert.equal(picked.candidate.subject,preferred.subject);
 preferred.editorialCase.recommendation='hold';assert.equal(tools.select([preferred,scene]).candidate.subject,scene.subject);
});

test('flattering generic adjectives do not satisfy the specific visual-detail requirement',()=>{
 const c=scenario('A celebrity portrait','music_film_pop','A beautiful compelling authentic vintage photograph','A film and fashion collaboration with recorded cultural context.');assert.equal(tools.assess(c).decision,'hold');
});

test('a recognizable name in a legitimate caption cannot masquerade as a specific visual detail',()=>{
 const c=scenario('Mira Sol','music_film_pop','An iconic beautiful portrait of Mira Sol','A documented relationship between a film role and a designer.');const result=tools.assess(c,{phase:'sources',sources:[{claimIndex:0,access:'source_text_captured'}],photos:[{source_relation:'subject_caption_match',source_caption:'Mira Sol publicity portrait'}]});assert.equal(result.decision,'hold');assert.ok(result.reasons.some(r=>r.code==='VISUAL_DETAIL_NOT_SPECIFIC'));
});

test('provider parsing isolates malformed leads, refuses incomplete JSON and keeps compact evidence for alternatives',()=>{
 const response=candidates=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates})}]}]});
 const good=scenario('A documented scene','fashion_subculture','handmade club makeup and clothing','Participants constructed a shared nightlife identity through dress.');
 assert.deepEqual(tools.responseCandidates({status:'incomplete',...response([good])}),[]);assert.deepEqual(tools.responseCandidates({output:[{type:'message',content:[{type:'output_text',text:'{"candidates":['}]}]}),[]);
 const parsed=tools.responseCandidates(response([null,{subject:1},{...good,claims:[null,...good.claims]}]));assert.equal(parsed.length,1);assert.equal(parsed[0].claims.length,1);
 const selected=tools.select([good,{...good,subject:'Another photographed cultural scene'}]);assert.equal(selected.comparison[1].claims[0].claim,good.claims[0].claim);assert.equal(selected.comparison[1].editorialCase.visual_detail,good.editorialCase.visual_detail);
});
test('sparse captions remain unknown, while captured image-page context can support differently worded captions',()=>{
 const c=scenario('A particular club scene','fashion_subculture','handmade glitter makeup and layered clothing','Nightlife participants constructed cultural identities through styling.');const source={claimIndex:0,access:'source_text_captured',url:'https://example.org/page',textExcerpt:'Handmade glitter makeup and layered clothing expressed the club scene.'};
 const photo={source_relation:'subject_caption_match',source_caption:'Club scene, 1982',source_page_url:source.url};const supported=tools.assess(c,{phase:'sources',sources:[source],photos:[photo]});assert.equal(supported.decision,'advance');assert.equal(supported.pixelInspectionPerformed,false);
 const sparse=tools.assess(c,{phase:'sources',sources:[{...source,textExcerpt:''}],photos:[photo]});assert.equal(sparse.decision,'hold');assert.ok(sparse.reasons.some(r=>r.code==='VISUAL_EVIDENCE_UNKNOWN'));
 assert.equal(tools.assess(c,{phase:'sources',sources:[source],photos:[{...photo,source_relation:'context_only'}]}).decision,'hold');assert.equal(tools.assess(c,{phase:'sources',sources:[{...source,contradiction:true}],photos:[photo]}).decision,'hold');
});
