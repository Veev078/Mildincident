import test from 'node:test';import assert from 'node:assert/strict';
import {buildPhotoReviewSandbox} from '../src/n8n/photo-review-sandbox.js';
test('sandbox uses active source code, bounded existing references and only manual/code nodes',()=>{
 const node={name:'Broaden — Qualify Cross-Source Preview Leads',parameters:{jsCode:"const safe=s=>{return s;};\nreturn [];"}};
 const source={versionId:'saved',activeVersionId:'active',nodes:[],activeVersion:{nodes:[node],connections:{}}};const before=JSON.stringify(source);
 const out=buildPhotoReviewSandbox({workflow:source,story:{concept_id:'CON-1',title:'Test'},media:Array.from({length:40},()=>({concept_id:'CON-1',provider:'brave_image_reference',thumb_url:'https://example.org/a.jpg'}))});
 assert.equal(out.review.sourceActiveVersion,'active');assert.equal(out.review.referenceCount,7);assert.equal(out.review.paidCalls,0);assert.equal(JSON.stringify(source),before);
 assert.ok(out.workflow.nodes.every(n=>['n8n-nodes-base.code','n8n-nodes-base.manualTrigger'].includes(n.type)));assert.equal(out.workflow.nodes.filter(n=>n.type.endsWith('manualTrigger')).length,1);
 assert.ok(!JSON.stringify(out.workflow).includes('credentials'));assert.throws(()=>buildPhotoReviewSandbox({workflow:{},story:{},media:[]}),{code:'SANDBOX_INPUT_REQUIRED'});
});
