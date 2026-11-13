import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';
import {PhotographyService} from '../src/photography/service.js';
import {permittedSourceImage,readSourceImage,acquireReceiptImage} from '../src/photography/source-images.js';
import {projectPageReferences} from '../src/photography/project-sources.js';

const url='https://sophyrickett.com/exhibition-cob-gallery/',fallback='https://www.cheeriopublishing.com/pissingwomen';
const html=(count=1)=>'<html>'+Array.from({length:count},(_,n)=>`<figure><img src="https://images.squarespace-cdn.com/content/fixture-${n}.jpg"><figcaption>Test Maker, Test Project. Photographs by Test Maker.</figcaption></figure>`).join('')+'</html>';
const story=()=>({id:'CON-acquisition-test',revision:'r1',subject:'Test Maker, Test Project',research:[{url,capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker created Test Project.'},{url:fallback}],media:[],selectedAssetIds:[],caption:'Original writing.',localDraft:{version:0,selectedAssetIds:[]}});
const input=s=>({idempotencyKey:randomUUID(),sourceRevision:s.revision,workingVersion:s.localDraft.version,direction:'best'});
const confirm=s=>({confirm:true,sourceRevision:s.revision,workingVersion:s.localDraft.version});
async function setup(t,options={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-source-images-')),research=new LocalResearchStore(root+'/research.sqlite'),previews=new LocalPreviewStore(root+'/previews');
 const bytes=await sharp({create:{width:500,height:700,channels:3,background:'#456'}}).jpeg().toBuffer();
 const calls=[],service=new PhotographyService(research,{previews,readProjectPage:async()=>html(),fetchImage:async(u,o)=>{calls.push(u);assert.equal(o.redirect,'manual');assert.equal(o.credentials,'omit');return new Response(bytes,{headers:{'content-type':'image/jpeg'}});},...options});
 t.after(async()=>{previews.close();research.close();await fs.rm(root,{recursive:true,force:true});});return{root,research,previews,service,calls};
}

test('project receipts acquire bounded decoded files, preserve source provenance and remove exact pixel repeats across URLs',async t=>{
 const {service,previews,calls}=await setup(t,{readProjectPage:async()=>html(8)}),s=story(),before=JSON.stringify(s),p=service.prepareDiscovery(s,input(s));
 const results=await Promise.all([service.searchStoryRequest(s,p.id,confirm(s)),service.searchStoryRequest(s,p.id,confirm(s))]);const result=results[0];
 assert.equal(calls.length,6);assert.equal(result.decodedImageCount,1);assert.equal(result.pixelDuplicateCount,5);assert.equal(service.storyMedia(s).length,3); // one decoded and two unattempted references
 const media=service.storyMedia(s),preview=previews.get(s.id,media[0].id);assert.equal(preview.originalWidth,500);assert.equal(preview.sourceInspection.basis,'photo_request_source_copy');assert.equal(preview.sourceInspection.requestId,p.id);assert.equal(preview.sourceInspection.visualInspectionPerformed,false);assert.equal(preview.rightsGranted,false);
 assert.deepEqual((await previews.readPreview(s.id,media[0].id)).preview.sha256,preview.sha256);assert.equal(JSON.stringify(s),before);
 const restarted=new PhotographyService(service.research||{db:service.db},{previews,fetchImage:()=>assert.fail('No automatic refetch')});
 await restarted.searchStoryRequest(s,p.id,confirm(s));assert.equal(calls.length,6);
});
test('only a supported image host and an exact intact network capture can authorize image acquisition',async t=>{
 const {service,previews}=await setup(t),s=story(),p=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,p.id,confirm(s));const request=service.storyRequest(p.id),photo=request.receipt.photos[0];let calls=0;
 const fetchImpl=()=>{calls++;assert.fail('Unbound image must not be fetched');};
 for(const changed of [{...photo,previewUrl:'https://images.squarespace-cdn.com/unrecorded.jpg'},{...photo,previewUrl:'https://127.0.0.1/private'},{...photo,sourceUrl:'https://evil.example/project'}])await assert.rejects(acquireReceiptImage({story:s,request,photo:changed,store:previews,fetchImpl}));
 request.sourceCaptures[0].html+='tampered';await assert.rejects(acquireReceiptImage({story:s,request,photo,store:previews,fetchImpl}));assert.equal(calls,0);
 assert(permittedSourceImage('https://www.life.com/people/project','https://static.life.com/wp-content/test.jpg'));assert(!permittedSourceImage(url,'https://evil.example/image.jpg'));assert(!permittedSourceImage(url,'https://images.squarespace-cdn.com/image?token=private'));
});
test('known source denial permits a different recorded source; ambiguous transport does not retry or fall through',async t=>{
 const seen=[],{service}=await setup(t,{readProjectPage:async(s,u)=>{seen.push(u);if(u===url)throw Error('SOURCE_HTTP_403');return html();}}),s=story(),p=service.prepareDiscovery(s,input(s));
 const result=await service.searchStoryRequest(s,p.id,confirm(s));assert.equal(result.state,'complete');assert.deepEqual(seen,[url,fallback]);assert.equal(result.sourceAttempts[0].errorCode,'SOURCE_HTTP_403');assert.equal(result.decodedImageCount,1);
 const other=await setup(t,{readProjectPage:async()=>{throw Error('timeout');}}),next=other.service.prepareDiscovery(s,input(s)),failed=await other.service.searchStoryRequest(s,next.id,confirm(s));assert.equal(failed.sourceCalls,1);assert.equal(failed.state,'unavailable');
});
test('saved HTML remains network-free and interrupted image acquisition never resumes on restart',async t=>{
 const {service,research,calls}=await setup(t),s=story(),p=service.prepareDiscovery(s,{...input(s),html:html(),sourceUrl:url});await service.searchStoryRequest(s,p.id,confirm(s));assert.equal(calls.length,0);
 const next=service.prepareDiscovery(s,input(s));research.db.prepare("UPDATE photo_story_requests SET state='fetching' WHERE request_id=?").run(next.id);const restarted=new PhotographyService(research,{fetchImage:()=>assert.fail('No retry')});assert.equal((await restarted.searchStoryRequest(s,next.id,confirm(s))).state,'uncertain');
});

test('repeated source references can gain decoded evidence without replacing selections or a founder preview',async t=>{
 const {service,previews,calls}=await setup(t),s=story();s.media=[{id:'existing-frame',previewUrl:'https://images.squarespace-cdn.com/content/fixture-0.jpg',sourceUrl:url}];s.selectedAssetIds=['existing-frame'];s.localDraft.selectedAssetIds=['existing-frame'];
 const p=service.prepareDiscovery(s,input(s)),r=await service.searchStoryRequest(s,p.id,confirm(s));assert.equal(r.newPhotoCount,0);assert.equal(r.cachedExistingCount,1);assert(previews.get(s.id,'existing-frame').sourceInspection);assert.deepEqual(s.selectedAssetIds,['existing-frame']);
 const next=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,next.id,confirm(s));assert.equal(calls.length,1);
});
test('bad MIME, oversized streams, redirects and undecodable pixels never become a preview',async t=>{
 await assert.rejects(readSourceImage('https://static.life.com/file',{fetchImpl:async()=>new Response('not an image',{headers:{'content-type':'text/html'}})}),{code:'INVALID_PREVIEW_TYPE'});
 await assert.rejects(readSourceImage('https://static.life.com/file',{fetchImpl:async()=>new Response('x',{headers:{'content-type':'image/jpeg','content-length':String(9*1024*1024)}})}),{code:'SOURCE_IMAGE_TOO_LARGE'});
 await assert.rejects(readSourceImage('https://static.life.com/file',{fetchImpl:async()=>new Response(Buffer.alloc(9*1024*1024),{headers:{'content-type':'image/jpeg'}})}),{code:'SOURCE_IMAGE_TOO_LARGE'});
 await assert.rejects(readSourceImage('https://static.life.com/file',{fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://evil.example'}})}),{code:'SOURCE_HTTP_302'});
 const {service,previews}=await setup(t,{fetchImage:async()=>new Response('not pixels',{headers:{'content-type':'image/jpeg'}})}),s=story(),p=service.prepareDiscovery(s,input(s)),result=await service.searchStoryRequest(s,p.id,confirm(s));assert.equal(result.decodedImageCount,0);assert.equal(previews.all().size,0);assert.equal(result.imageAttempts.length,1);
});

test('a founder preview saved during image retrieval is never replaced or relabelled as a source copy',async t=>{
 const s=story();s.media=[{id:'chosen',previewUrl:'https://images.squarespace-cdn.com/content/fixture-0.jpg',sourceUrl:url}];
 const {service,previews}=await setup(t);const bytes=await sharp({create:{width:500,height:700,channels:3,background:'#456'}}).jpeg().toBuffer();
 service.fetchImage=async()=>{await previews.save({storyId:s.id,assetId:'chosen',bytes,contentType:'image/jpeg',originalName:'founder-owned.jpg',declaration:'private_review_only'});return new Response(bytes,{headers:{'content-type':'image/jpeg'}});};
 const p=service.prepareDiscovery(s,input(s)),result=await service.searchStoryRequest(s,p.id,confirm(s));assert.equal(result.imageAttempts[0].errorCode,'EDIT_CONFLICT');assert.equal(previews.get(s.id,'chosen').originalName,'founder-owned.jpg');assert.equal(previews.get(s.id,'chosen').sourceInspection,null);
});

test('single-image WordPress captions and Squarespace data-image keep exact image context; shared captions do not',()=>{
 const result=projectPageReferences(story(),{url:'https://www.life.com/people/jack-nicholson-early-photos/',html:'<div class="wp-caption"><img data-image="https://static.life.com/one.jpg" src="/placeholder.jpg"><p class="wp-caption-text">Test Maker, Test Project. Photograph by Test Maker.</p></div><div class="wp-caption"><img src="/two.jpg"><img src="/three.jpg"><p class="wp-caption-text">Unrelated shared caption</p></div>'});
 const first=result.photos.find(p=>p.previewUrl.endsWith('/one.jpg'));assert(first);assert.match(first.description,/Test Project/);assert.equal(first.creator,'Test Maker');assert(result.photos.filter(p=>!/one.jpg$/.test(p.previewUrl)).every(p=>!p.description.includes('shared caption')));
});

test('a working-version change stops image storage and quarantines the source receipt',async t=>{
 const s=story(),{service,previews}=await setup(t,{fetchImage:async()=>{s.localDraft.version++;return new Response('not used',{headers:{'content-type':'image/jpeg'}});}}),p=service.prepareDiscovery(s,input(s));
 const result=await service.searchStoryRequest(s,p.id,confirm(s),{readStory:()=>s});assert.equal(result.state,'review_required');assert.equal(result.imageAttempts[0].errorCode,'EDIT_CONFLICT');assert.equal(previews.all().size,0);assert.equal(service.storyMedia(s).length,0);
});
test('interrupted image review can retain its receipt by explicit reconciliation without refetching',async t=>{
 const {service,research,calls}=await setup(t),s=story(),p=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,p.id,confirm(s));
 research.db.prepare("UPDATE photo_story_requests SET state='fetching' WHERE request_id=?").run(p.id);const restarted=new PhotographyService(research,{fetchImage:()=>assert.fail('No automatic acquisition')});
 const result=restarted.closeInterruptedDiscovery(s,p.id,{...confirm(s),confirm:'close_interrupted_search'});assert.equal(result.state,'complete');assert.equal(result.errorCode,'SOURCE_INTERRUPTED_IMAGE_REVIEW');assert.equal(restarted.storyMedia(s).length,1);assert.equal(calls.length,1);
});
