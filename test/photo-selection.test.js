import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {selectPhotoSequence} from '../src/photography/selection.js';
import {buildSourceSequencePlan,sourceSequenceDraft} from '../src/editorial-sequence.js';
import {fingerprint} from '../src/photography/fingerprint.js';
import {createWorkspaceServer} from '../src/workspace/server.js';
import {WorkspaceSource} from '../src/workspace/data-source.js';
import {LocalDraftStore} from '../src/workspace/store.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';

const asset=(id,caption,w,h,dhash,phash)=>({id,title:caption,sourceCaption:caption,sourceRelation:'subject_caption_match',sourceUrl:'https://example.org/project',previewUrl:'https://example.org/'+id+'.jpg',rightsStatus:'unreviewed',localPreview:{sha256:id.padEnd(64,'0'),originalSha256:id.padEnd(64,'1'),originalWidth:w,originalHeight:h,fingerprint:{version:'dhash-phash-v1',dhash,phash}}});
const story=()=>({id:'CON-selection',revision:'r1',subject:'Test Maker, Test Project',caption:'Founder writing.',research:[{url:'https://example.org/project'}],selectedAssetIds:['wide','portrait'],media:[asset('wide','Test Project, wide hillside view',1200,800,'0000000000000000','0000000000000000'),asset('variant','Test Project, a wide variation',1200,800,'0000000000000001','0000000000000003'),asset('portrait','Test Project, portrait',800,1200,'ffffffffffffffff','ffffffffffffffff'),asset('detail','Test Project, close-up detail',900,900,'aaaaaaaaaaaaaaaa','aaaaaaaaaaaaaaaa')]});

test('decoded structure produces inspectable opening choices and variety without changing writing, order or rights',()=>{
 const s=story(),before=JSON.stringify(s),r=selectPhotoSequence(s);assert.equal(r.openingCandidates[0].assetId,'wide');assert.equal(r.slides[0].assetId,'wide');assert.deepEqual(new Set(r.slides.map(a=>a.assetId)),new Set(['wide','portrait','detail']));assert.equal(r.withheld[0].assetId,'variant');assert.match(r.withheld[0].message,/possible variation/i);assert.equal(r.aiVisualAssessmentPerformed,false);assert.match(r.explanation,/No AI visual assessment/);assert.equal(r.rightsGranted,false);assert.equal(JSON.stringify(s),before);
 s.media[2].localReview={decision:'shortlist'};assert.equal(selectPhotoSequence(s).openingCandidates[0].assetId,'portrait');assert.deepEqual(s.selectedAssetIds,['wide','portrait']);
 s.media[0].localReview={decision:'reject',context:{previewSha256:null}};assert(selectPhotoSequence(s).slides.some(a=>a.assetId==='wide'),'feedback on absent old pixels must not reject a new private file');
});

test('simulated visual rankings never masquerade as a real model assessment; exact copies and uncertain dates cannot pad a suggestion',()=>{
 const s=story(),copy={...s.media[0],id:'copy'};s.media.push(copy,{...s.media[2],id:'wrong-date',dateContext:'different_year_context'});
 const fake={verified:true,simulation:true,result:{recommendedAssetIds:['detail'],images:[]}},r=selectPhotoSequence(s,{visualReview:fake});assert.equal(r.aiVisualAssessmentPerformed,false);assert(!r.slides.some(a=>['copy','wrong-date'].includes(a.assetId)));assert.equal(r.openingCandidates[0].assetId,'wide');
 const real={verified:true,simulation:false,executionId:'999',result:{recommendedAssetIds:['detail','portrait'],images:[{assetId:'detail',relevance:'project_match',composition:'SIMULATED contract value; not a photographic judgment.',carouselPotential:'SIMULATED detail'},{assetId:'portrait',relevance:'project_match',composition:'SIMULATED portrait',carouselPotential:'SIMULATED context'}]}};
 const verifiedContract=selectPhotoSequence(s,{visualReview:real});assert.equal(verifiedContract.aiVisualAssessmentPerformed,true);assert.deepEqual(verifiedContract.slides.map(a=>a.assetId),['detail','portrait']);assert.equal(verifiedContract.visualExecutionId,'999');
});

test('real decoded thumbnail measurements describe color while preserving the existing similarity contract',async()=>{
 const bytes=await sharp({create:{width:80,height:120,channels:3,background:'#cc3366'}}).jpeg().toBuffer(),r=await fingerprint(bytes);assert.equal(r.version,'dhash-phash-v1');assert.match(r.dhash,/^[a-f0-9]{16}$/);assert.match(r.phash,/^[a-f0-9]{16}$/);assert(r.tone.meanRgb.every((v,i)=>Math.abs(v-[204,51,102][i])<5));assert.equal(r.aestheticAssessment,'not_performed');assert.equal(r.rightsGranted,false);
});

test('sequence application binds source, files, caption, feedback and working version rather than trusting a stale browser plan',()=>{
 const s=story(),plan=buildSourceSequencePlan(s),input={planDigest:plan.digest,optionId:'curated-sequence',sourceRevision:s.revision,workingVersion:0},patch=sourceSequenceDraft(s,plan,input);assert.deepEqual(new Set(patch.selectedAssetIds),new Set(['wide','portrait','detail']));assert(!Object.hasOwn(patch,'caption'));assert.equal(s.selectedAssetIds.length,2);
 for(const mutate of [x=>x.caption+=' edited',x=>x.revision='r2',x=>x.media[0].localPreview.sha256='f'.repeat(64),x=>x.media[1].localReview={decision:'reject'},x=>x.localDraft={version:1,selectedAssetIds:['detail']}]){const changed=structuredClone(s);mutate(changed);assert.throws(()=>sourceSequenceDraft(changed,buildSourceSequencePlan(changed),input),{code:'EDIT_CONFLICT'});}
 assert.throws(()=>sourceSequenceDraft(s,plan,{...input,selectedAssetIds:['injected']}),{code:'EDIT_CONFLICT'});
});

test('actual local HTTP applies a private-file suggestion once, keeps earlier order/history and survives reopening storage',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-sequence-')),snapshot=workspaceSnapshot(),id=snapshot.records.stories[0].concept_id;
 const drafts=new LocalDraftStore(root+'/drafts.sqlite'),previews=new LocalPreviewStore(root+'/previews'),source=new WorkspaceSource({root,loadLive:async()=>snapshot});source.snapshot=snapshot;
 const originalView=source.view.bind(source);source.view=ds=>{const w=originalView(ds);for(const s of w.stories)for(const a of s.media){a.sourceRelation='subject_caption_match';a.sourceCaption='A source-linked test frame, not a real photograph.';}return w;};
 for(let n=1;n<=3;n++){const w=n===2?600:900,h=n===2?900:600,svg=`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${['red','blue','green'][n-1]}"/><circle cx="${n*140}" cy="${n*100}" r="120" fill="white"/></svg>`,bytes=await sharp(Buffer.from(svg)).jpeg().toBuffer();await previews.save({storyId:id,assetId:'asset-'+n,bytes,contentType:'image/jpeg',originalName:'generated-'+n+'.jpg',declaration:'private_review_only'});}
 const initial=source.view(drafts.all()).stories[0];drafts.save(initial,{baseRevision:initial.revision,expectedVersion:0,caption:'Founder exact edited caption.',selectedAssetIds:['asset-2','asset-1'],creativeBrief:{sequenceRoles:[{assetId:'asset-2',role:'context',note:'Founder note kept exactly.'}]}});
 const server=createWorkspaceServer({source,drafts,previews});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,url=origin+'/api/stories/'+id;
 t.after(async()=>{await new Promise(r=>server.close(r));previews.close();drafts.close();await fs.rm(root,{recursive:true,force:true});});
 const before=await(await fetch(url)).json(),plan=before.sourceSequencePlan,input={planDigest:plan.digest,optionId:'curated-sequence',sourceRevision:before.revision,workingVersion:1},options={method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(input)};
 assert(plan.options.some(o=>o.id===input.optionId));assert.equal((await fetch(url+'/sequence-proposals/apply',{...options,headers:{'Content-Type':'application/json'}})).status,403);assert.equal((await fetch(url+'/sequence-proposals/apply',{...options,headers:{...options.headers,Origin:'https://foreign.example'}})).status,403);
 const attempts=await Promise.all([fetch(url+'/sequence-proposals/apply',options),fetch(url+'/sequence-proposals/apply',options)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
 const after=await(await fetch(url)).json();assert.equal(after.localDraft.caption,before.localDraft.caption);assert.equal(after.localDraft.version,2);assert.deepEqual(after.localDraft.selectedAssetIds,plan.options.find(o=>o.id==='curated-sequence').slides.map(s=>s.assetId));assert.equal(drafts.history(id).length,2);assert.deepEqual(before.localDraft.selectedAssetIds,['asset-2','asset-1']);assert(after.media.every(a=>a.rightsStatus===before.media.find(b=>b.id===a.id).rightsStatus));assert.equal(after.localDraft.creativeBrief.sequenceRoles.find(r=>r.assetId==='asset-2').note,'Founder note kept exactly.');
 const reopened=new LocalDraftStore(root+'/drafts.sqlite');try{assert.deepEqual(reopened.get(id).selectedAssetIds,after.localDraft.selectedAssetIds);assert.equal(reopened.get(id).caption,before.localDraft.caption);}finally{reopened.close();}
 const current=after.sourceSequencePlan,damage=after.media.find(a=>a.id===current.options.find(o=>o.id==='curated-sequence').slides[0].assetId).localPreview.sha256;await fs.writeFile(path.join(previews.root,'blobs',damage+'.jpg'),'not the captured pixels');const failed=await fetch(url+'/sequence-proposals/apply',{...options,body:JSON.stringify({planDigest:current.digest,optionId:'curated-sequence',sourceRevision:after.revision,workingVersion:2})});assert.notEqual(failed.status,200);assert.equal(drafts.get(id).version,2);
});
