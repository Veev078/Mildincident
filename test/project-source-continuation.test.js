import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectPhotoSourceWindow} from '../src/editorial-evidence.js';
import {projectPageReferences} from '../src/photography/project-sources.js';

const page='https://www.dazeddigital.com/art-photography/article/123/1/test-project';
const story={id:'CON-project-window',subject:'Test Maker, Test Project',research:[{url:page,capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker made Test Project.'}],media:[]};
const sha=s=>createHash('sha256').update(s).digest('hex');
const figure=(n,caption)=>`<figure><img src="https://images-prod.dazeddigital.com/azure/generated-${n}.jpg"><figcaption>${caption}</figcaption></figure>`;
const gallery=Array.from({length:52},(_,n)=>figure(n,n>=48?'Test Maker, Test Project. Photographs by Test Maker.':'Another artist and unrelated project.')).join('');

test('a 40-of-52 retained page continues through its twelve remaining references without repeating a reference window',()=>{
 const first=projectPageReferences(story,{url:page,html:gallery});
 assert.equal(first.photos.length,40);assert.equal(first.photos.filter(p=>p.sourceRelation==='subject_caption_match').length,4);
 assert.equal(first.sourceCapture.coverage.referenceCount,52);assert.equal(first.sourceCapture.coverage.extractionOffset,0);assert.equal(first.sourceCapture.coverage.retainedThrough,40);
 assert.equal(first.sourceCapture.coverage.nextOffset,40);assert.equal(first.sourceCapture.coverage.remainingReferenceCount,12);assert.equal(first.sourceCapture.coverage.extractionComplete,false);
 const second=projectPageReferences(story,{url:page,html:gallery,cursor:first.sourceCapture.extractionCursor});
 assert.equal(second.photos.length,12);assert.equal(second.sourceCapture.coverage.extractionOffset,40);assert.equal(second.sourceCapture.coverage.retainedThrough,52);
 assert.equal(second.sourceCapture.extractionCursor,null);assert.deepEqual(second.sourceCapture.extractionInputCursor,first.sourceCapture.extractionCursor);
 assert.equal(second.sourceCapture.coverage.extractionComplete,true);assert.equal(second.sourceCapture.coverage.completeShootVerified,false);
 assert.equal(new Set([...first.photos,...second.photos].map(p=>p.id)).size,52);
 for(const p of [...first.photos,...second.photos]){assert.equal(p.sourceCaptureSha256,sha(gallery));assert.equal(p.sourceParserVersion,'project-images-v2');assert(Number.isInteger(p.sourceReferenceIndex));assert.equal(p.rightsGranted,false);assert.equal(p.pixelAnalysisPerformed,false);}
 assert.equal(first.sourceCapture.html,gallery);assert.equal(second.sourceCapture.sha256,first.sourceCapture.sha256);
});

test('continuation cursors cannot be reused after capture, source, story, direction, parser or offset changes',()=>{
 const cursor=projectPageReferences(story,{url:page,html:gallery}).sourceCapture.extractionCursor;
 for(const options of [{html:gallery+'changed'},{url:page+'/changed'},{direction:'archive'},{cursor:{...cursor,captureSha256:'0'.repeat(64)}},{cursor:{...cursor,offset:1}},{cursor:{...cursor,offset:80}},{cursor:{...cursor,parserVersion:'unreviewed'}}]){
  assert.throws(()=>projectPageReferences(story,{url:page,html:gallery,cursor,...options}),{code:'INVALID_PHOTO_CURSOR'});
 }
 assert.throws(()=>projectPageReferences({...story,id:'CON-other'},{url:page,html:gallery,cursor}),{code:'INVALID_PHOTO_CURSOR'});
 assert.throws(()=>projectPageReferences({...story,subject:'Other Maker, Other Project'},{url:page,html:gallery,cursor}),{code:'INVALID_PHOTO_CURSOR'});
});

test('finishing the known reference windows does not call an underlying truncated page complete',()=>{
 const html=gallery+' '.repeat(300001),first=projectPageReferences(story,{url:page,html}),second=projectPageReferences(story,{url:page,html,cursor:first.sourceCapture.extractionCursor});
 assert.equal(second.photos.length,12);assert.equal(second.sourceCapture.coverage.referenceWindowComplete,true);
 assert.equal(second.sourceCapture.coverage.pageTruncated,true);assert.equal(second.sourceCapture.coverage.extractionComplete,false);
 const empty=inspectPhotoSourceWindow('<html>No images recorded on this source page.</html>',page,story);
 assert.equal(empty.images.length,0);assert.equal(empty.coverage.referenceCount,0);assert.equal(empty.coverage.extractionComplete,true);assert.equal(empty.coverage.completeShootVerified,false);
});

test('image-specific book and installation captions remain context while ordinary project photographs stay eligible',()=>{
 const html='<h1>Test Maker, Test Project — exhibition and book</h1>'+[
  figure(1,'Test Maker, Test Project. A photograph reproduced in the new book.'),
  figure(2,'Test Maker, Test Project. Book cover, 2025.'),
  figure(3,'Test Maker, Test Project. Double-page book spread.'),
  figure(4,'Test Maker, Test Project. Installation view at the gallery.'),
  figure(5,'Test Maker, Test Project. A gelatin silver photograph.'),
 ].join('');
 const result=projectPageReferences(story,{url:page,html});
 const by=n=>result.photos.find(p=>p.previewUrl.endsWith(`generated-${n}.jpg`));
 assert.equal(by(1).materialType,'photograph_reference');assert.equal(by(1).sourceRelation,'subject_caption_match');assert.equal(by(5).materialType,'photograph_reference');
 for(const [n,material] of [[2,'publication_cover'],[3,'publication_spread'],[4,'installation']]){assert.equal(by(n).materialType,material);assert.equal(by(n).sourceRelation,'context_documentation');assert.equal(by(n).materialBasis,'individual_image_caption_not_pixel_inspection');assert.equal(by(n).rightsGranted,false);}
});

test('reparsing a legacy page derives supported artist and publisher leads without rewriting its captured evidence',()=>{
 const html='<h1>Test Maker, Test Project</h1><p>Visit <a href="https://sophyrickett.com/test-project">Test Maker</a>.</p><p>Test Maker discusses Test Project with its <a href="https://www.cheeriopublishing.com/test-project">publisher</a>.</p><h2>Another Maker, Tokyo</h2><p>Read more <a href="https://www.climaxbooks.com/unrelated">here</a>.</p><a href="https://unreviewed.example/project">Test Maker, Test Project</a><!-- <a href="https://www.climaxbooks.com/comment-decoy">Test Maker, Test Project</a> --><script><a href="https://sophyrickett.com/script-decoy">Test Maker, Test Project</a></script>';
 const legacy={url:page,html,sha256:sha(html),capturedAt:'2026-11-01T10:00:00Z'},before=JSON.stringify(legacy);
 const result=projectPageReferences(story,{url:legacy.url,html:legacy.html,basis:'fetched_project_page'});
 assert.deepEqual(result.sourceCapture.projectTrails.map(t=>t.sourceKind),['artist','book_publisher']);
 assert.deepEqual(result.sourceCapture.projectTrails.map(t=>t.url),['https://sophyrickett.com/test-project','https://www.cheeriopublishing.com/test-project']);
 for(const trail of result.sourceCapture.projectTrails){assert.equal(trail.captureSha256,legacy.sha256);assert.equal(trail.parserVersion,'project-images-v2');assert.equal(trail.destinationFetched,false);assert.equal(trail.identityVerified,false);assert.equal(trail.rightsGranted,false);}
 assert.equal(JSON.stringify(legacy),before);
});
