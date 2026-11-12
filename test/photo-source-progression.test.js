import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import sharp from 'sharp';
import {LocalResearchStore} from '../src/workspace/research-store.js';import {LocalPreviewStore} from '../src/workspace/previews.js';import {PhotographyService} from '../src/photography/service.js';
import {projectSourceTrails} from '../src/photography/project-sources.js';
const a='https://www.life.com/project',b='https://sophyrickett.com/project',c='https://www.cheeriopublishing.com/project';
const story=()=>({id:'CON-source-memory',revision:'r1',subject:'Test Maker, Test Project',research:[{url:a,capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker made Test Project.'}],media:[],selectedAssetIds:[],localDraft:{version:0,selectedAssetIds:[]},caption:'Preserved copy.'});
const input=s=>({idempotencyKey:randomUUID(),sourceRevision:s.revision,workingVersion:s.localDraft.version,direction:'best'}),confirm=s=>({confirm:true,sourceRevision:s.revision,workingVersion:s.localDraft.version});
const html=(source,n)=>'<html>'+Array.from({length:n},(_,i)=>`<figure><img src="${new URL('/frame-'+i+'.jpg',source).href}"><figcaption>Test Maker, Test Project. Photograph by Test Maker.</figcaption></figure>`).join('')+'</html>';
async function setup(t,options={}){const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-source-memory-')),research=new LocalResearchStore(root+'/research.sqlite'),previews=new LocalPreviewStore(root+'/previews'),service=new PhotographyService(research,{previews,...options});t.after(async()=>{research.close();previews.close();await fs.rm(root,{recursive:true,force:true});});return {service,research,previews};}

test('an explicit next search advances through captured project/maker links, with no repeated page or archive fallback',async t=>{
 const calls=[],{service}=await setup(t,{readProjectPage:async(s,u)=>{calls.push(u);return html(u,1)+(u===a?`<a href="${b}">Test Maker</a>`:u===b?`<p>Test Maker, Test Project <a href="${c}">book publisher</a></p>`:`<a href="${a}">Test Maker, Test Project</a>`);},fetchImage:async()=>new Response('',{status:403}),retrieve:()=>assert.fail('No generic archive fallback')}),s=story(),before=JSON.stringify(s);
 const first=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,first.id,confirm(s));assert.deepEqual(calls,[a,b]);
 const next=service.prepareDiscovery(s,input(s));assert.equal(next.plan.sourceUrl,c);await service.searchStoryRequest(s,next.id,confirm(s));assert.deepEqual(calls,[a,b,c]);assert.equal(JSON.stringify(s),before);
 const same=service.prepareDiscovery(s,{...input(s),idempotencyKey:next.id});assert.equal(same.id,next.id);assert.throws(()=>service.prepareDiscovery({...s,id:'CON-another-story'},{...input(s),idempotencyKey:next.id}),{code:'EDIT_CONFLICT'});assert.deepEqual(calls,[a,b,c]);
});
test('roundup source trails cannot borrow a previous project heading for another story’s here link',()=>{
 const markup=`<h2>Test Maker, Test Project</h2><p>Read this project.</p><h2>Another Maker, Tokyo</h2><p>See more <a href="${c}">here</a>.</p><p>Test Maker, Test Project <a href="${b}">book publisher</a>.</p>`;
 assert.deepEqual(projectSourceTrails(markup,a,{photographer:'Test Maker',series:'Test Project'},[]).map(l=>l.url),[b]);
});
test('a seventh image is acquired from retained captured evidence, without refetching the page or replacing the six existing files',async t=>{
 let pages=0,images=0;const {service,previews}=await setup(t,{readProjectPage:async()=>{pages++;return html(a,7);},fetchImage:async u=>{images++;const n=Number(u.match(/frame-(\d)/)[1]);return new Response(await sharp({create:{width:300+n*3,height:400,channels:3,background:{r:n*25,g:100,b:70}}}).jpeg().toBuffer(),{headers:{'content-type':'image/jpeg'}});}}),s=story();
 const first=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,first.id,confirm(s));assert.equal(images,6);s.media=service.storyMedia(s);const hashes=s.media.slice(0,6).map(a=>previews.get(s.id,a.id).sha256),next=service.prepareDiscovery(s,input(s));assert.equal(next.plan.route,'cached_project_evidence');assert.equal(next.plan.sourceCalls,0);
 const result=await service.searchStoryRequest(s,next.id,confirm(s));assert.equal(pages,1);assert.equal(images,7);assert.equal(result.cachedExistingCount,1);assert.deepEqual(s.media.slice(0,6).map(a=>previews.get(s.id,a.id).sha256),hashes);
 const third=service.prepareDiscovery(s,input(s));assert.equal(third.plan.route,'sources_checked');await service.searchStoryRequest(s,third.id,confirm(s));assert.equal(pages,1);assert.equal(images,7);
});
test('bounded scans and corrupt evidence remain distinct; only explicit refresh rechecks a source',async t=>{
 let calls=0;const {service,research}=await setup(t,{readProjectPage:async()=>{calls++;return html(a,50);},fetchImage:async()=>new Response('',{status:403})}),s=story(),first=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,first.id,confirm(s));s.media=service.storyMedia(s);
 const memory=service.sourceMemory(s);assert.equal(memory.states[0].completeScan,false);assert(memory.projectExhausted===false);
 const next=service.prepareDiscovery(s,input(s));assert.equal(next.plan.sourceCalls,0);await service.searchStoryRequest(s,next.id,confirm(s));assert.equal(calls,1);
 const refresh=service.prepareDiscovery(s,{...input(s),refreshSources:true});await service.searchStoryRequest(s,refresh.id,confirm(s));assert.equal(calls,2);
 const p=service.storyRequest(refresh.id);p.sourceCaptures[0].html+='corrupted';research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(p),refresh.id);assert.equal(service.sourceMemory(s).states[0].state,'evidence_needs_review');assert.equal(service.sourceMemory(s).reuse.length,0);
});

test('remaining references after forty acquire exact page-bound files before pending copies, without rereading or changing earlier receipts',async t=>{
 let pages=0,images=0;const {service,previews,research}=await setup(t,{readProjectPage:async()=>{pages++;return html(a,52);},fetchImage:async u=>{images++;const n=Number(u.match(/frame-(\d+)/)[1]);return new Response(await sharp({create:{width:300,height:400,channels:3,background:{r:n*3,g:200-n,b:n*2}}}).jpeg().toBuffer(),{headers:{'content-type':'image/jpeg'}});}}),s=story();
 const current=()=>({...s,media:service.storyMedia(s)}),prepare=()=>service.prepareDiscovery(current(),input(s)),run=id=>service.searchStoryRequest(current(),id,confirm(s),{readStory:current});
 const first=prepare();await run(first.id);assert.equal(images,6);assert.equal(pages,1);
 const original=research.db.prepare('SELECT data_json FROM photo_story_requests WHERE request_id=?').get(first.id).data_json;
 const next=prepare();assert.equal(next.plan.sourceProgression.reuse[0].cursor.offset,40);const completed=await run(next.id);
 assert.equal(pages,1);assert.equal(images,12);assert.equal(completed.sourcePages[0].coverage.extractionOffset,40);assert.equal(completed.sourcePages[0].coverage.retainedThrough,52);
 assert.equal(completed.newPhotoCount,12);assert.equal(completed.acquisitionSummary.newDecodedPhotographs,6);assert.equal(completed.acquisitionSummary.newReferencesWithoutFiles,6);
 const acquired=service.storyMedia(s).filter(p=>p.photoRequestId===next.id&&previews.get(s.id,p.id));assert.equal(acquired.length,6);
 for(const photo of acquired){const proof=previews.get(s.id,photo.id).sourceInspection;assert.equal(proof.pageSha256,completed.sourcePages[0].sha256);assert.equal(proof.requestId,next.id);assert(photo.sourceReferenceIndex>=40);}
 const pending=prepare();assert.equal(pending.plan.sourceCalls,0);await run(pending.id);assert.equal(pages,1);assert.equal(images,18);
 assert.equal(research.db.prepare('SELECT data_json FROM photo_story_requests WHERE request_id=?').get(first.id).data_json,original);assert.equal(s.caption,'Preserved copy.');assert.deepEqual(s.localDraft.selectedAssetIds,[]);
});
