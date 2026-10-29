import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {recordedSourceEvidence} from '../src/source-evidence.js';import {photoEvidenceTools} from '../src/editorial-evidence.js';import {safePhotoReference} from '../src/n8n/photo-url-guard.js';
const decode=photoEvidenceTools(safePhotoReference).decode;
test('source excerpts recover relevant passages, retain dates and remove scripts without claiming factual verification',()=>{
 const response={statusCode:200,headers:{'Content-Type':'text/html',authorization:'NEVER_EXPOSE'},data:'<title>Costume archive</title><nav>'+('Menu '.repeat(1000))+'</nav><script>NEVER_EXPOSE</script><p>Exhibition held June29–July8, 2018.</p><p>Two Belle de Jour costumes, 1967, designed by Elio North for Mira Sol.</p>'};
 const packet=recordedSourceEvidence(response,decode,'Elio North designed costumes for Mira Sol in Belle de Jour (1967)');assert.equal(packet.access,'source_text_captured');assert.match(packet.textExcerpt,/1967/);assert.ok(packet.textExcerpt.length<=1800);assert.ok(!JSON.stringify(packet).includes('NEVER_EXPOSE'));assert.equal(packet.humanFactVerification,false);
 const serialized=vm.runInNewContext(`(${recordedSourceEvidence.toString()})(${JSON.stringify(response)},${decode.toString()},'Mira Sol')`);assert.equal(serialized.access,'source_text_captured');
});
test('200 maintenance, binary PDF, missing and oversized sources never count as captured usable text',()=>{
 for(const data of ['<title>Site en maintenance</title>Nothing here','<title>Just a moment</title>Verify you are human','%PDF-1.7 binary','x'.repeat(2500001)])assert.equal(recordedSourceEvidence({statusCode:200,data},decode).access,'access_unconfirmed');
 assert.equal(recordedSourceEvidence({statusCode:200,headers:{'content-type':'application/pdf'},data:'not extracted text'},decode).access,'access_unconfirmed');assert.equal(recordedSourceEvidence({statusCode:404,data:'Not found'},decode).access,'dead_reference');
});

test('identification excerpts retain the naming reader, excluding comment guesses and navigation',()=>{
 const response={statusCode:200,data:'<nav>Wendy Phillips solved mystery repeated keywords</nav><article><p>Wendy Phillips was identified.</p><p>She was identified by James Owen, the only reader to match the face to the name.</p><p>Wendy Phillips confirmed the photograph was her.</p><p>Wendy Phillips filmography and later credits.</p></article><section id="comments"><p>Wendy Phillips was actually somebody else, I guess.</p></section>'};const packet=recordedSourceEvidence(response,decode,'Wendy Phillips was identified in the mystery portrait');assert.match(packet.textExcerpt,/James Owen/);assert.ok(!packet.textExcerpt.includes('somebody else'));
});
test('provider tool accounting distinguishes incomplete emitted records from actual reported requests',async()=>{
 const {providerWebSearchUsage}=await import('../src/source-evidence.js');const response={usage:{input_tokens:1},tool_usage:{web_search:{num_requests:2}},output:[{type:'web_search_call',status:'completed'},{type:'web_search_call',status:'completed'},{type:'web_search_call',status:'searching'}]};assert.deepEqual(providerWebSearchUsage(response),{calls:2,basis:'provider_reported_requests',emitted:3,completed:2,incomplete:1});delete response.tool_usage;assert.equal(providerWebSearchUsage(response).calls,null);
});

test('sole-credit claims are flagged against captured contributor evidence without rewriting copy',async()=>{
 const {attributionReviewSignals}=await import('../src/source-evidence.js');const sources=[{access:'source_text_captured',textExcerpt:'She was identified by James Owen; the subject confirmed it.'}];assert.equal(attributionReviewSignals({title:'The mystery she solved herself'},sources)[0].code,'ATTRIBUTION_ROLES_NEED_REVIEW');assert.deepEqual(attributionReviewSignals({title:'A reader suggested her name; she confirmed it'},sources),[]);
});
