import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPageReferences,automaticPhotoPlan} from '../src/photography/project-sources.js';
import {sourceProgression,advancePhotoPlan} from '../src/photography/source-progression.js';

const page='https://www.life.com/project';
const story=()=>({id:'CON-source-metadata',revision:'r1',subject:'Test Maker, Test Project',research:[{url:page,capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker made Test Project.'}],media:[]});
const markup=n=>'<html>'+Array.from({length:n},(_,i)=>`<figure><img src="https://static.life.com/generated-${i}.jpg"><figcaption>Test Maker, Test Project. Photograph by Test Maker.</figcaption></figure>`).join('')+'</html>';
function retained(n=52){const s=story(),parsed=projectPageReferences(s,{url:page,html:markup(n)}),capture=parsed.sourceCapture,request={id:'captured-request',plan:{identity:capture.identity,direction:'best',custom:''},packet:{payload:{target:{sourceRevision:s.revision}}},sourceCaptures:[capture],imageAttempts:[],startedAt:capture.capturedAt};return{s,parsed,capture,request};}
const savedPhotos=photos=>photos.map(p=>({...p,localPreview:{sha256:'generated-preview'},sourceCaption:p.description}));

test('corrupt first-window coverage cannot skip the twelve unexamined references or claim completion',()=>{
 for(const coverage of [{retainedThrough:999},{extractionOffset:-40,retainedThrough:999},{extractionOffset:13,retainedThrough:52},{parserVersion:'unreviewed',retainedThrough:52}]){
  const {s,parsed,capture,request}=retained();s.media=savedPhotos(parsed.photos);Object.assign(capture.coverage,coverage);
  const before=JSON.stringify(request);let memory;assert.doesNotThrow(()=>{memory=sourceProgression(s,[request]);});
  assert.equal(memory.states[0].completeScan,false);assert(memory.states[0].remainingReferences>=12);assert(memory.states[0].scanOffset<=40);assert(memory.reuse.length>0);
  assert((memory.reuse[0].cursor?.offset||0)<=40);assert.equal(JSON.stringify(request),before);
 }
});

test('a forged later window beyond the actual capture never creates an invalid cursor or throws',()=>{
 const {s,parsed,capture,request}=retained(7);s.media=savedPhotos(parsed.photos);
 capture.coverage={...capture.coverage,extractionOffset:40,retainedThrough:52,retainedCount:12,referenceCount:52};
 capture.extractionInputCursor={version:1,parserVersion:'project-images-v2',captureSha256:capture.sha256,sourceUrl:page,contextSha256:'0'.repeat(64),offset:40};
 let memory;assert.doesNotThrow(()=>{memory=sourceProgression(s,[request]);});assert(memory.states[0].scanOffset<=7);
 for(const reuse of memory.reuse)assert((reuse.cursor?.offset||0)<7);
});

test('unfinished hash-verified scans remain reusable after a day with zero planned source reads',()=>{
 const {s,parsed,capture,request}=retained();s.media=savedPhotos(parsed.photos);capture.capturedAt=new Date(Date.now()-3*86400000).toISOString();request.startedAt=capture.capturedAt;
 const before=JSON.stringify(request),memory=sourceProgression(s,[request]);assert.equal(memory.states[0].nextOffset,40);assert.equal(memory.reuse[0].reason,'continue_scan');
 const plan=advancePhotoPlan(automaticPhotoPlan(s),memory);assert.equal(plan.route,'cached_project_evidence');assert.equal(plan.sourceCalls,0);assert.equal(JSON.stringify(request),before);
});

test('an expired complete scan still supplies a missing seventh file, while an entirely completed source can be checked afresh',()=>{
 const {s,parsed,capture,request}=retained(7);s.media=savedPhotos(parsed.photos);delete s.media[6].localPreview;capture.capturedAt=new Date(Date.now()-3*86400000).toISOString();request.startedAt=capture.capturedAt;
 const pending=sourceProgression(s,[request]);assert.equal(pending.reuse[0].reason,'pending_images');assert.equal(advancePhotoPlan(automaticPhotoPlan(s),pending).sourceCalls,0);
 s.media[6].localPreview={sha256:'generated-seventh-preview'};const complete=sourceProgression(s,[request]);
 assert.equal(complete.reuse.length,0);assert.equal(advancePhotoPlan(automaticPhotoPlan(s),complete).route,'retained_project_page');
});

test('legacy source-trail derivation is hash-bound and does not rewrite original captures',()=>{
 const {s,capture,request}=retained(1);capture.html=capture.html.replace('</html>','<p>Test Maker, Test Project <a href="https://www.cheeriopublishing.com/test-project">book publisher</a>.</p></html>');
 // Model an intact old capture which predates projectTrails, not forged mutable
 // source evidence: its page hash is recomputed when the legacy fixture is made.
 const parsed=projectPageReferences(s,{url:page,html:capture.html});Object.assign(capture,{sha256:parsed.sourceCapture.sha256});delete capture.projectTrails;
 const before=JSON.stringify(request),derived=projectPageReferences(s,{url:page,html:capture.html}).sourceCapture.projectTrails;
 assert.equal(derived.length,1);assert.equal(derived[0].captureSha256,capture.sha256);sourceProgression(s,[request]);assert.equal(JSON.stringify(request),before);
});
