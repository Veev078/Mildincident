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
