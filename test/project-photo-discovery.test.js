import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {PhotographyService} from '../src/photography/service.js';
import {automaticPhotoPlan,permittedProjectPage,fetchProjectPage,projectPageReferences} from '../src/photography/project-sources.js';

const url='https://www.dazeddigital.com/art-photography/article/123/1/test-project';
const html=`<html><h1>SYNTHETIC TEST SOURCE — NOT REAL PHOTOGRAPHY</h1><figure><img src="https://example.org/test.jpg" width="1500" height="1800"><figcaption>Test Maker, Test Project. Photos by Test Maker. Backstage contact sheet.</figcaption></figure><figure><img src="https://example.org/other.jpg"><figcaption>Different creator, unrelated project.</figcaption></figure><script>throw Error('NEVER EXECUTE SOURCE SCRIPTS')</script></html>`;
const makeStory=()=>({id:'CON-DEV-'+randomUUID(),revision:'source-r1',subject:'Test Maker, Test Project',title:'Test source-bound project',caption:'Original founder writing.',research:[{url,capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker discusses Test Project in the captured original source. These recorded passages are source context, never verified photographic identity.'}],recordedProjectLinks:[{url,label:'Test Maker, Test Project'}],media:[],selectedAssetIds:[],localDraft:{version:0,caption:'Original founder writing.',selectedAssetIds:[]}});
const request=(s,extra={})=>({sourceRevision:s.revision,workingVersion:s.localDraft.version,idempotencyKey:randomUUID(),direction:'best',...extra});
const confirm=s=>({confirm:true,sourceRevision:s.revision,workingVersion:s.localDraft.version});
async function setup(t,options={}){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mi-project-photos-')),research=new LocalResearchStore(path.join(dir,'research.sqlite')),service=new PhotographyService(research,options);t.after(async()=>{research.close();await fs.rm(dir,{recursive:true,force:true});});return{research,service};}

test('automatic discovery selects a source-bound project page before generic catalogues and cannot become a URL proxy',async()=>{
 const story=makeStory(),plan=automaticPhotoPlan(story,{direction:'behind'});assert.equal(plan.source,'project');assert.equal(plan.sourceUrl,url);assert.match(plan.query,/behind the scenes/);assert.equal(plan.paidCalls,0);
 for(const target of ['https://127.0.0.1/private','https://www.dazeddigital.com/unrecorded','https://evil.example/project',url+'?api_key=secret']){assert.equal(permittedProjectPage(story,target),false);await assert.rejects(fetchProjectPage(story,target,{fetchImpl:()=>{throw Error('MUST NOT FETCH');}}),{code:'PHOTO_SOURCE_NOT_BOUND'});}
 let calls=0;await assert.rejects(fetchProjectPage(story,url,{fetchImpl:async(u,options)=>{calls++;assert.equal(u,url);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return new Response('',{status:401});}}),/SOURCE_HTTP_401/);assert.equal(calls,1);
});
test('saved source markup yields image-specific references without executing code, downloading originals or granting rights',()=>{
 const story=makeStory(),result=projectPageReferences(story,{url,html,direction:'behind',basis:'founder_supplied_saved_page'});assert.equal(result.photos.length,2);const photo=result.photos[0];assert.match(photo.description,/Test Project/);assert.equal(photo.fileUrl,'');assert.equal(photo.rightsGranted,false);assert.equal(photo.pixelAnalysisPerformed,false);assert.equal(result.sourceCapture.networkFetched,false);assert.equal(result.sourceCapture.html,html);assert.match(result.sourceCapture.sha256,/^[a-f0-9]{64}$/);
 const copyright=projectPageReferences(story,{url,html:'<figure><img src="https://example.org/credit.jpg"><figcaption>Test Maker, Test Project. © Synthetic copyright holder</figcaption></figure>'}).photos[0];assert.equal(copyright.creator,'');assert.equal(copyright.creatorBasis,'copyright_holder_only');assert.match(copyright.sourceCredit,/Synthetic copyright holder/);assert.equal(copyright.rightsGranted,false);
});
test('request integrity binds the actual direction and supplied source bytes before any source request',async t=>{
 let calls=0;const {service,research}=await setup(t,{readProjectPage:async()=>{calls++;return html;}}),story=makeStory(),input=request(story),p=service.prepareDiscovery(story,input);
 assert.throws(()=>service.prepareDiscovery(story,{...input,direction:'series'}),{code:'EDIT_CONFLICT'});
 const stored=service.storyRequest(p.id);stored.plan.sourceUrl='https://www.dazeddigital.com/unrecorded';research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(stored),p.id);await assert.rejects(service.searchStoryRequest(story,p.id,confirm(story)),{code:'INVALID_PHOTO_RECEIPT'});assert.equal(calls,0);
 const imported=service.prepareDiscovery(story,request(story,{sourceUrl:url,html})),changed=service.storyRequest(imported.id);changed.savedHtml=html+'changed';research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(changed),imported.id);await assert.rejects(service.searchStoryRequest(story,imported.id,confirm(story)),{code:'INVALID_PHOTO_RECEIPT'});assert.equal(calls,0);
});
test('a contemporary original source without a supported reader leads to source-assisted import, not unrelated archive searches',async t=>{
 const {service}=await setup(t,{retrieve:()=>{throw Error('NO GENERIC ARCHIVE FALLBACK');},readProjectPage:()=>{throw Error('NO UNSUPPORTED SOURCE FETCH');}}),story=makeStory();story.subject='Duolingo’s 2025 mascot funeral campaign';story.research=[{url:'https://www.linkedin.com/posts/duolingo/recorded-original',claim:'An existing native source reference.'}];story.recordedProjectLinks=[];
 const plan=automaticPhotoPlan(story);assert.equal(plan.route,'source_assisted');assert.equal(plan.sourceCalls,0);const p=service.prepareDiscovery(story,request(story)),result=await service.searchStoryRequest(story,p.id,confirm(story));assert.equal(result.state,'unavailable');assert.equal(result.errorCode,'SOURCE_READER_UNAVAILABLE');assert.equal(result.sourceCalls,0);assert.match(result.message,/saved copy/);
});
test('source-first discovery works without a fabricated image anchor, duplicate clicks read once and restart preserves the receipt',async t=>{
 let calls=0;const {research,service}=await setup(t,{readProjectPage:async()=>{calls++;return html;}}),story=makeStory(),before=JSON.stringify(story),input=request(story),p=service.prepareDiscovery(story,input);
 assert.equal(service.storyRequest(p.id).packet.payload.target.assetId,null);await Promise.all([service.searchStoryRequest(story,p.id,confirm(story)),service.searchStoryRequest(story,p.id,confirm(story))]);assert.equal(calls,1);assert.equal(service.storyMedia(story).length,2);assert.equal(JSON.stringify(story),before);
 const restarted=new PhotographyService(research,{readProjectPage:()=>{throw Error('NO RETRY');}});await restarted.searchStoryRequest(story,p.id,confirm(story));assert.equal(restarted.storyRequestsFor(story)[0].state,'complete');assert.equal(restarted.storyMedia(story)[0].receiptBasis,'fetched_project_page');assert.equal(restarted.storyMedia(story)[0].rightsStatus,'unreviewed');assert.equal(JSON.stringify(restarted.storyRequestsFor(story)).includes('<script>'),false);
});
test('blocked source stops after one request; saved-page import recovers and deduplicates references in the same ledger',async t=>{
 let calls=0;const {service}=await setup(t,{readProjectPage:async()=>{calls++;throw Error('SOURCE_HTTP_403');},retrieve:()=>{throw Error('NO FALLBACK FETCH');}}),story=makeStory();
 const first=service.prepareDiscovery(story,request(story));const denied=await service.searchStoryRequest(story,first.id,confirm(story));assert.equal(denied.state,'unavailable');assert.match(denied.message,/HTTP 403/);await service.searchStoryRequest(story,first.id,confirm(story));assert.equal(calls,1);
 const input=request(story,{sourceUrl:url,html}),p=service.prepareDiscovery(story,input);const recovered=await service.searchStoryRequest(story,p.id,confirm(story));assert.equal(recovered.sourceCalls,0);assert.equal(recovered.newPhotoCount,2);assert.equal(recovered.sourceCapture.basis,'founder_supplied_saved_page');assert.equal(calls,1);
 const again=service.prepareDiscovery(story,request(story,{sourceUrl:url,html})),duplicate=await service.searchStoryRequest(story,again.id,confirm(story));assert.equal(duplicate.newPhotoCount,0);assert.equal(duplicate.duplicateCount,2);assert.equal(service.storyMedia(story).length,2);assert.throws(()=>service.prepareDiscovery(story,{...input,html:html+'different'}),{code:'EDIT_CONFLICT'});
});
test('changed story quarantines fetched references and an interrupted request never resumes automatically',async t=>{
 const story=makeStory(),{research,service}=await setup(t,{readProjectPage:async()=>{story.localDraft.version++;return html;}}),p=service.prepareDiscovery(story,request(story));const result=await service.searchStoryRequest(story,p.id,confirm(story),{readStory:()=>story});assert.equal(result.state,'review_required');assert.equal(service.storyMedia(story).length,0);assert.equal(service.storyRequest(p.id).receipt.photos.length,2);
 const next=service.prepareDiscovery(story,request(story));research.db.prepare("UPDATE photo_story_requests SET state='fetching' WHERE request_id=?").run(next.id);const restarted=new PhotographyService(research,{readProjectPage:()=>{throw Error('NO RETRY');}});assert.equal(restarted.storyRequestView(restarted.storyRequest(next.id)).state,'uncertain');await restarted.searchStoryRequest(story,next.id,confirm(story));assert.throws(()=>restarted.prepareDiscovery(story,request(story)),{code:'EDIT_CONFLICT'});
 const closed=restarted.closeInterruptedDiscovery(story,next.id,{...confirm(story),confirm:'close_interrupted_search'});assert.equal(closed.state,'unavailable');assert.equal(restarted.storyRequestsFor(story).length,2);assert.equal(restarted.prepareDiscovery(story,request(story)).state,'prepared');
});
test('legacy captures recover exact project links from an imported roundup and the next search follows them without changing native evidence',async t=>{
 let reads=0;const {service}=await setup(t,{readProjectPage:async(s,u)=>{reads++;assert.equal(u,'https://www.dazeddigital.com/art-photography/article/124/1/test-maker-test-project');return html;}}),story=makeStory();story.recordedProjectLinks=[];const before=JSON.stringify(story),page=html+'<a href="/art-photography/article/124/1/test-maker-test-project">Test Maker, Test Project</a>',p=service.prepareDiscovery(story,request(story,{sourceUrl:url,html:page}));
 await service.searchStoryRequest(story,p.id,confirm(story));assert.equal(reads,0);assert.equal(service.storyProjectTrails(story).length,1);const next=service.prepareDiscovery(story,request(story));assert.match(next.plan.sourceUrl,/article\/124/);await service.searchStoryRequest(story,next.id,confirm(story));assert.equal(reads,1);assert.equal(JSON.stringify(story),before);
 assert.deepEqual(service.storyProjectTrails({...story,revision:'changed'}),[]);
});
