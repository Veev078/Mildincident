import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { safePhotoReference, preparePhotoGuardPatch } from '../src/n8n/photo-url-guard.js';

test('photo reference guard rejects private literals and credential-bearing references without fetching', () => {
 for(const url of ['https://172.16.1.2/a.jpg','https://127.0.0.1/a','https://0x7f000001/a','https://example.local/a','https://[::1]/a','https://user:pass@example.org/a','https://example.org/a?access_token=private','https://example.org/a?X-Amz-Signature=private','https://example.org/a?%61pi_key=private','https://example.org/a?%zz=x','https://example.org/a%0afoo']) assert.equal(safePhotoReference(url),'',url);
 for(const url of ['https://archive.example.org/a.jpg?width=1200','https://imgs.search.brave.com/image.jpg','https://archive.example.org:443/a.jpg']) assert.equal(safePhotoReference(url),url);
 assert.equal(vm.runInNewContext(`(${safePhotoReference.toString()})('https://archive.example.org/a.jpg')`),'https://archive.example.org/a.jpg');
});
test('photo guard patch is pure, version/hash-bound and preserves downstream mappings and caps', () => {
 const code="const safe=s=>{return String(s);};\nconst out=[]; if(out.length>=7) return out; return [{json:{thumb_url:safe('https://172.16.0.1/image.jpg')}}];";
 const workflow={versionId:'v1',nodes:[{name:'Broaden — Qualify Cross-Source Preview Leads',parameters:{jsCode:code}}],connections:{existing:['unchanged']}};
 const options={expectedVersion:'v1',expectedCodeHash:createHash('sha256').update(code).digest('hex')};
 const patched=preparePhotoGuardPatch(workflow,options);
 assert.equal(workflow.nodes[0].parameters.jsCode,code);
 assert.deepEqual(patched.workflow.connections,workflow.connections);
 assert.equal(patched.review.productionApplied,false);
 assert.match(patched.workflow.nodes[0].parameters.jsCode,/out.length>=7/);
 assert.equal(vm.runInNewContext(`(function(){${patched.workflow.nodes[0].parameters.jsCode}})()`)[0].json.thumb_url,'');
 assert.throws(()=>preparePhotoGuardPatch({...workflow,versionId:'v2'},options),{code:'WORKFLOW_DRIFT'});
 assert.throws(()=>preparePhotoGuardPatch(workflow,{...options,expectedCodeHash:'changed'}),{code:'CODE_DRIFT'});
});
