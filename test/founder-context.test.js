import test from 'node:test';import assert from 'node:assert/strict';
import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {requestFingerprint} from '../src/workspace/editorial-engine-client.js';
import {selectEditorialFeedback} from '../src/editorial-feedback.js';
test('latest reconsideration wins without changing the stored judgments or treating a whole subject as rejected',()=>{
 const a={candidateId:'frame-one',decision:'rejected',scope:'specific_photograph_selection',createdAt:'2026-10-29'},b={...a,decision:'approved',createdAt:'2026-10-30'};
 assert.deepEqual(selectEditorialFeedback([a,b]),[b]);assert.equal(a.decision,'rejected');
});
test('a burst of frame reviews keeps exact identities but no longer crowds other founder judgments out of discovery',()=>{
 const recent=Array.from({length:6},(_,i)=>({candidateId:'image-dialog:story-a:'+i,photograph:{storyId:'story-a',assetId:'frame-'+i},decision:'rejected',scope:'specific_photograph_selection',createdAt:'2026-10-30T12:0'+(6-i)+':00Z'}));
 const other={candidateId:'review:story-b',storyId:'story-b',decision:'approved',reason:'A useful cultural connection',createdAt:'2026-10-30T11:00:00Z'};
 const service=new EditorialEngineService({research:{founderTasteFeedback:()=>[other]},imageFeedback:()=>recent});const before=JSON.stringify({recent,other});
 const context=service.editorialContext();assert.equal(context.feedback.length,6);assert.equal(context.feedback[0].photograph.assetId,'frame-0');assert.equal(context.feedback[1].candidateId,other.candidateId);assert.equal(JSON.stringify({recent,other}),before);
 assert.ok(context.feedback.every(f=>f.scope!=='subject_ban'));
});
test('rich image feedback keeps bounded next-run context, retains the latest exact identities and leaves stored decisions intact',()=>{
 const feedback=Array.from({length:6},(_,i)=>({candidateId:'candidate-'+i,scope:'specific_photograph_selection',reason:'r'.repeat(1200),photograph:{assetId:'frame-'+i,sourceUrl:'https://example.org/'+String(i).repeat(2000)}}));
 const before=JSON.stringify(feedback);const service=new EditorialEngineService({research:{founderTasteFeedback:()=>structuredClone(feedback)},sourceLeads:()=>[{title:'Feed metadata',url:'https://example.org/source',summary:'s'.repeat(1200)}]});
 const context=service.editorialContext();assert.ok(JSON.stringify(context).length<=9500);assert.ok(context.omittedFeedbackCount>0);assert.equal(context.feedback[0].photograph.assetId,'frame-0');assert.equal(JSON.stringify(feedback),before);
 const request={kind:'discovery',prompt:'A new cultural direction',editorialContext:context};const hash=requestFingerprint(request);const changed=structuredClone(request);changed.editorialContext.feedback[0].photograph.assetId='a-different-frame';assert.notEqual(requestFingerprint(changed),hash);
});
test('image-dialog judgments join the latest bounded native context with exact scope and do not mutate stored feedback',()=>{
 const stored=[{candidateId:'proposal-review',createdAt:'2026-10-30T10:00:00Z',scope:'specific_editorial_proposal',decision:'approved'}],image=[{candidateId:'image-dialog:story:frame',createdAt:'2026-10-30T11:00:00Z',scope:'specific_photograph_selection',photograph:{assetId:'frame',previewSha256:'a'.repeat(64)},decision:'rejected',reason:'This frame lacks the intended photographic detail.'}];const original=JSON.stringify({stored,image});
 const service=new EditorialEngineService({research:{founderTasteFeedback:()=>stored},imageFeedback:()=>image});const context=service.editorialContext();assert.equal(context.feedback[0].candidateId,image[0].candidateId);assert.equal(context.feedback[0].photograph.previewSha256,'a'.repeat(64));assert.equal(context.feedback[1].decision,'approved');assert.equal(JSON.stringify({stored,image}),original);
});
