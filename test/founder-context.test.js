import test from 'node:test';import assert from 'node:assert/strict';
import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {requestFingerprint} from '../src/workspace/editorial-engine-client.js';
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
