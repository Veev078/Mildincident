import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {editorialHookOptions,draftEvidenceSignals} from '../src/editorial-hooks.js';
import {captionReviewSignals,inspectPhotoSource} from '../src/editorial-evidence.js';
import {hookOptionsView,photographicEvidenceSummary} from '../web/editorial-options.js';
const claims=[{claim:'A documented series from 1982.',source_url:'https://example.org/series'},{claim:'The maker described the setting.',source_url:'https://example.org/creator'}];
const sources=claims.map((c,i)=>({url:c.source_url,claimIndex:i,access:'source_text_captured',textExcerpt:'The maker documented a series in 1982 and wrote “The club was our second home.”'}));
const concept={recommended_hook:'visual_cultural',hook_options:[{approach:'discovery',text:'A nightclub’s homemade uniforms became a shared visual language.',claim_indices:[0]},{approach:'visual_cultural',text:'Glitter makeup turns this gathering into a collective portrait.',claim_indices:[1],interpretation:'A reading of the styling, not a claim about intention.'},{approach:'restrained',text:'A documented club series from 1982, photographed in its original setting.',claim_indices:[0]}]};
test('optional hooks retain three distinct claim-bound approaches and one explicit recommendation without changing mandatory fields',()=>{
 const before=JSON.stringify(concept),result=editorialHookOptions(concept,claims,sources);assert.equal(result.options.length,3);assert.equal(result.options.filter(o=>o.recommended).length,1);assert.equal(result.options[1].recommended,true);assert.ok(result.options.every(o=>o.evidenceStatus==='source_passages_recorded'&&o.factsVerifiedByHuman===false));assert.equal(JSON.stringify(concept),before);assert.deepEqual(editorialHookOptions({title:'Legacy',hook:'Legacy',caption:'Legacy'},claims,sources).options,[]);
 const sandbox=vm.runInNewContext(`(${editorialHookOptions.toString()})(${JSON.stringify(concept)},${JSON.stringify(claims)},${JSON.stringify(sources)})`);assert.equal(sandbox.options.length,3);
 const inaccessible=editorialHookOptions(concept,claims,[{...sources[0],url:'https://example.org/wrong-page'}]);assert.ok(inaccessible.options.every(o=>o.evidenceStatus==='source_review_needed'));
 const bad=editorialHookOptions({...concept,hook_options:[null,{...concept.hook_options[0],claim_indices:[99]},concept.hook_options[0]]},claims,sources);assert.equal(bad.options.length,1);assert.equal(bad.issues.length,2);
 const repeated=editorialHookOptions({...concept,hook_options:[concept.hook_options[0],{...concept.hook_options[0],approach:'restrained'}]},claims,sources);assert.equal(repeated.options.length,1);assert.equal(repeated.issues.length,1);
});
test('caption checks flag invented literal dates/quotes and forced language without certifying the rest of a draft',()=>{
 assert.deepEqual(draftEvidenceSignals({caption:'A club series from 1982. “The club was our second home.”'},claims,sources),[]);
 const gaps=draftEvidenceSignals({caption:'In 1971 the maker said “An invented quotation with no source.”'},claims,sources);assert.deepEqual(gaps.map(i=>i.code),['DRAFT_DATE_SUPPORT_OPEN','DRAFT_QUOTATION_SUPPORT_OPEN']);
 assert.equal(draftEvidenceSignals({caption:'A series from 1982.'},claims,[{...sources[0],url:'https://example.org/wrong-page'}])[0].code,'DRAFT_DATE_SUPPORT_OPEN');
 assert.ok(captionReviewSignals('In a world of unforgettable culture, tag a friend.').some(i=>i.code==='FORCED_ENGAGEMENT_IN_CAPTION'));assert.ok(captionReviewSignals('In a world of unforgettable culture.').some(i=>i.code==='GENERIC_CAPTION_OPENING'));assert.deepEqual(captionReviewSignals('Handmade clothes at a club gathering.'),[]);
});
test('page keyword, surname and placeholder imagery stay separate from exact unfamiliar subject captions',()=>{
 const html='<title>Mira Sol’s club photographs</title><p>Mira Sol photographed handmade glitter makeup.</p><img src="/portrait.jpg" alt="Mira Vale at the beach"><img src="/landscape.jpg" alt="Mountain scenery"><img src="/placeholder.jpg" alt="Mira Sol"><figure><img src="/real.jpg"><figcaption>Mira Sol, handmade glitter makeup. Photograph by Noor Lens.</figcaption></figure>';
 const images=inspectPhotoSource(html,'https://example.org/series',{subject:'Mira Sol',title:'A mountain of glitter makeup'});assert.equal(images.length,3);assert.equal(images.find(m=>m.url.endsWith('/portrait.jpg')).relation,'context_only');assert.equal(images.find(m=>m.url.endsWith('/landscape.jpg')).relation,'context_only');const exact=images.find(m=>m.url.endsWith('/real.jpg'));assert.equal(exact.relation,'subject_caption_match');assert.equal(exact.creator,'Noor Lens');assert.equal(exact.pixelAnalysisPerformed,false);assert.equal(exact.rightsGranted,false);
});
test('founder angle controls are optional, source-linked, escaped and revision-safe; photo summaries separate identity/credit/permission',()=>{
 const options=editorialHookOptions(concept,claims,sources).options,story={id:'CON-same',hook:options[0].text,hookOptions:options,research:claims.map(c=>({url:c.source_url,sourceName:'Recorded source'}))};
 assert.equal(hookOptionsView({...story,hookOptions:[]}), '');const html=hookOptionsView(story,{editable:true});assert.ok(html.includes('Compare editorial angles'));assert.ok(html.includes('Recommended'));assert.match(html,/data-index="0" disabled/);assert.ok(html.includes('https://example.org/series'));assert.ok(!html.includes('/ 5'));
 assert.match(hookOptionsView({...story,localDraft:{stale:true}},{editable:true}),/data-index="1" disabled/);assert.ok(!hookOptionsView({...story,hookOptions:[{...options[0],text:'An angle with <script>injected text</script>'}]}).includes('<script>'));
 assert.ok(photographicEvidenceSummary({sourceRelation:'page_cover',creatorBasis:'copyright_holder_only'}).includes('photographer is not established'));assert.ok(photographicEvidenceSummary({sourceRelation:'context_only'}).includes('does not establish a match'));assert.ok(photographicEvidenceSummary({sourceRelation:'subject_caption_match',creatorBasis:'explicit_source_photo_credit',creator:'Noor Lens'}).includes('Image identity needs visual review'));
});

test('photographic evidence separates browser references, private uploads and decoded source copies',()=>{
 const asset={photoRequestId:'request-one',sourceUrl:'https://example.org/project',previewUrl:'https://example.org/frame.jpg',sourceRelation:'subject_caption_match'};
 const reference=photographicEvidenceSummary(asset);assert(reference.includes('A browser preview or file link alone does not establish a saved source copy'));assert(reference.includes('Studio has not downloaded'));
 const upload=photographicEvidenceSummary({...asset,localPreview:{sha256:'a'.repeat(64),width:640,height:480,sourceInspection:null}});assert(upload.includes('A private upload is saved separately'));assert(!upload.includes('decoded a copy from this source'));
 const copy=photographicEvidenceSummary({...asset,photoRequestId:null,localPreview:{sha256:'a'.repeat(64),width:640,height:480,sourceInspection:{basis:'photo_request_source_copy'}}});
 assert(copy.includes('Source record and files'));assert(copy.includes('privately saved and decoded a copy from this source'));assert(copy.includes('Image identity and publication permission still need review'));assert(!copy.includes('Studio has not downloaded'));
});
