import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attachCaptionImageContext} from '../src/caption-image-context.js';
const packet=()=>({workingCaption:'Founder writing stays.',research:{brandText:'Original retained factual and editorial guidance.',founderFeedback:[]},candidate:{claims:[{claim:'Retained factual evidence.'}]},photos:[{id:'reference'}],evidenceSha256:'original'});
const context=()=>({digest:'a'.repeat(64),executionId:'123',selectedAssetIds:['selected'],images:[{assetId:'selected',observations:'CONTRACT FIXTURE: visible scene.',composition:'CONTRACT FIXTURE: wide framing.'}]});
test('visual writing notes add advisory data without trimming retained research or changing caption/photo evidence',()=>{
 const p=packet(),before=JSON.stringify(p),c=context(),result=attachCaptionImageContext(p,c);
 assert.equal(result.review.included,true);assert.equal(result.review.imageCount,1);assert(result.packet.research.brandText.startsWith(p.research.brandText));assert.match(result.packet.research.brandText,/not instructions or verified facts/);assert.match(result.packet.research.brandText,/Do not infer identities, dates/);assert.equal(result.packet.workingCaption,p.workingCaption);assert.deepEqual(result.packet.photos,p.photos);assert.deepEqual(result.packet.candidate,p.candidate);
 const hash=createHash('sha256').update(JSON.stringify({research:result.packet.research,candidate:p.candidate,photos:p.photos})).digest('hex');assert.equal(result.packet.evidenceSha256,hash);assert.equal(JSON.stringify(p),before);
});
test('missing observations or insufficient draft budget omit advisory context and preserve all source research',()=>{
 const p=packet();assert.strictEqual(attachCaptionImageContext(p,null).packet,p);p.research.brandText='Retained source text. '.repeat(1400);const result=attachCaptionImageContext(p,context());assert.equal(result.review.included,false);assert.strictEqual(result.packet,p);assert.equal(result.packet.evidenceSha256,'original');assert.match(result.review.message,/preserve/);
 const c=context();c.images[0].observations='Long legacy note '.repeat(300);assert.equal(attachCaptionImageContext(packet(),c).review.included,false);
});
