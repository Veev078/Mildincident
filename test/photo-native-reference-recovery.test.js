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
import {recordedSourceImageUrl} from '../src/photography/source-images.js';
import {photoFileKeys} from '../src/photography/story-intelligence.js';
import {photoSourceFailure} from '../src/photography/source-failure.js';
import {projectPageReferences,automaticPhotoPlan} from '../src/photography/project-sources.js';

// Real retained data establishes this storage shape: a selected native asset
// has a Brave thumbnail, an empty file_url, and an original lead in its notes.
// HTML and JPEGs below are isolated generated fixtures, not new hosted photos.
const source='https://new-publisher.example/features/unfamiliar-project/';
const image='https://cdn.new-publisher.example/unfamiliar-project/frame.jpg';
const story=()=>({id:'CON-native-reference',revision:'r1',subject:'Unfamiliar Maker, Unfamiliar Project',caption:'Keep the founder writing.',research:[{url:source,capturedAccess:'source_text_captured',capturedTextExcerpt:'Unfamiliar Maker created Unfamiliar Project.'}],media:[],selectedAssetIds:[],localDraft:{version:0,selectedAssetIds:[]}});
const input=s=>({idempotencyKey:randomUUID(),sourceRevision:s.revision,workingVersion:s.localDraft.version,direction:'best'});
const confirm=s=>({confirm:true,sourceRevision:s.revision,workingVersion:s.localDraft.version});
async function setup(t,options={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-native-reference-')),research=new LocalResearchStore(root+'/research.sqlite'),previews=new LocalPreviewStore(root+'/previews');
 t.after(async()=>{previews.close();research.close();await fs.rm(root,{recursive:true,force:true});});
 return {research,previews,service:new PhotographyService(research,{previews,...options})};
}

test('recorded original leads remain safe matching hints, never decoded search proxies or credentials',()=>{
 assert.equal(recordedSourceImageUrl({file_url:'',notes:`UNVERIFIED PHOTO LEAD. Image original reference: ${image}. Original page: new-publisher.example.`}),image);
 assert.equal(recordedSourceImageUrl({notes:'unrelated text https://elsewhere.example/photo.jpg'}),'');
 assert.equal(recordedSourceImageUrl({notes:'Image original reference: https://host.example/file?token=secret. Original page: host.example.'}),'');
 assert.equal(recordedSourceImageUrl({file_url:'https://127.0.0.1/private.jpg'}),'');
 assert.equal(recordedSourceImageUrl({notes:`Image original reference: ${image}. Original page: new-publisher.example.`,file_url:image+'?width=900'}),image+'?width=900');
 assert(photoFileKeys({id:'native',previewUrl:'https://imgs.search.brave.com/opaque-thumbnail',sourceImageUrl:image}).some(k=>photoFileKeys({previewUrl:image}).includes(k)));
});

test('a selected native thumbnail acquires only its exact page-bound original and preserves its ID, writing and rights',async t=>{
 const bytes=await sharp({create:{width:1200,height:1600,channels:3,background:'#3a5267'}}).jpeg().toBuffer(),calls=[];
 const {service,previews}=await setup(t,{readProjectPage:async()=>`<html><figure><img src="${image}"><figcaption>Unfamiliar Maker, Unfamiliar Project.</figcaption></figure></html>`,fetchImage:async url=>{calls.push(url);return new Response(bytes,{headers:{'content-type':'image/jpeg'}});}});
 const s=story();s.media=[{id:'chosen-native',sourceUrl:source,sourceImageUrl:image,previewUrl:'https://imgs.search.brave.com/opaque-thumbnail',rightsStatus:'unreviewed'}];s.selectedAssetIds=['chosen-native'];s.localDraft.selectedAssetIds=['chosen-native'];const before=JSON.stringify(s),p=service.prepareDiscovery(s,input(s)),result=await service.searchStoryRequest(s,p.id,confirm(s));
 assert.deepEqual(calls,[image]);assert.equal(result.newPhotoCount,0);assert.equal(result.cachedExistingCount,1);assert.equal(result.acquisitionSummary.savedImageRecords,1);assert.equal(result.acquisitionSummary.newDecodedFiles,1);assert.equal(result.acquisitionSummary.newReferencesWithoutFiles,0);assert.equal(previews.get(s.id,'chosen-native').originalWidth,1200);assert.equal(previews.get(s.id,'chosen-native').rightsGranted,false);assert.equal(JSON.stringify(s),before);
 const next=service.prepareDiscovery(s,input(s));assert.equal(next.plan.route,'sources_checked');const complete=await service.searchStoryRequest(s,next.id,confirm(s));assert.equal(calls.length,1);assert.equal(complete.acquisitionSummary.newDecodedFiles,0);
});

test('selected source versions match captured srcset variants and receive the best declared file before new references',async t=>{
 const s=story(),small=image.replace('.jpg','-small.jpg'),markup=Array.from({length:7},(_,n)=>`<figure><img src="https://cdn.new-publisher.example/unfamiliar-project/other-${n}.jpg"><figcaption>Unfamiliar Maker, Unfamiliar Project.</figcaption></figure>`).join('')+`<figure><img src="${small}" srcset="${small} 320w, ${image} 1600w"><figcaption>Unfamiliar Maker, Unfamiliar Project.</figcaption></figure>`,calls=[];
 const {service,previews}=await setup(t,{readProjectPage:async()=>'<html>'+markup+'</html>',fetchImage:async url=>{calls.push(url);return new Response(await sharp({create:{width:1000+calls.length,height:1200,channels:3,background:{r:calls.length*25,g:80,b:100}}}).jpeg().toBuffer(),{headers:{'content-type':'image/jpeg'}});}});
 s.media=[{id:'selected-small-reference',sourceUrl:source,sourceImageUrl:small,previewUrl:'https://imgs.search.brave.com/selected-small'}];s.localDraft.selectedAssetIds=['selected-small-reference'];const p=service.prepareDiscovery(s,input(s)),result=await service.searchStoryRequest(s,p.id,confirm(s));
 assert.equal(calls.length,6);assert.equal(calls[0],image);assert(previews.get(s.id,'selected-small-reference'));assert.equal(result.acquisitionSummary.newDecodedFiles,6);assert.equal(result.acquisitionSummary.pendingDownloads,2);assert.equal(result.acquisitionSummary.newReferencesWithoutFiles,2);assert.equal(result.acquisitionSummary.savedImageRecords,6);assert.equal(result.imageAttempts[0].originalCameraFileVerified,false);
});

test('retained sources can hydrate an explicit selected reference without promoting unrelated neighbours or rereading the page',async t=>{
 let pages=0,images=0;const {service,research,previews}=await setup(t,{readProjectPage:async()=>{pages++;return `<html><img src="${image}"><img src="https://cdn.new-publisher.example/other-project/not-selected.jpg"></html>`;}}),s=story();
 // First pass retains the real ledger/capture shape without acquiring any files.
 service.previews=null;const first=service.prepareDiscovery(s,input(s));await service.searchStoryRequest(s,first.id,confirm(s));assert.equal(service.storyMedia(s).length,0);
 s.media=[{id:'founder-choice',sourceUrl:source,sourceImageUrl:image,previewUrl:'https://imgs.search.brave.com/founder-choice'}];s.localDraft={version:1,selectedAssetIds:['founder-choice']};
 const resumed=new PhotographyService(research,{previews,readProjectPage:()=>assert.fail('No repeated source read'),fetchImage:async url=>{images++;assert.equal(url,image);return new Response(await sharp({create:{width:700,height:900,channels:3,background:'#734'}}).jpeg().toBuffer(),{headers:{'content-type':'image/jpeg'}});}}),p=resumed.prepareDiscovery(s,input(s));
 assert.equal(p.plan.route,'cached_project_evidence');assert.equal(p.plan.sourceProgression.reuse[0].reason,'selected_files_pending');const result=await resumed.searchStoryRequest(s,p.id,confirm(s));assert.equal(pages,1);assert.equal(images,1);assert.equal(result.newPhotoCount,0);assert.equal(result.excludedCount,1);assert(previews.get(s.id,'founder-choice'));assert.equal(resumed.storyMedia(s).length,0);
});

test('image errors distinguish a retained reference from a saved or usable photograph',()=>{
 assert.equal(photoSourceFailure('INVALID_PREVIEW_FILE').kind,'image_not_decodable');assert.equal(photoSourceFailure('SOURCE_IMAGE_TOO_LARGE').kind,'image_exceeds_limit');assert.equal(photoSourceFailure('LOCAL_PREVIEW_MISSING').kind,'private_file_missing');
});

test('CDN query commas remain part of real source URLs and chosen missing files lead the source plan',()=>{
 const small='https://cdn.new-publisher.example/frame.jpg?auto=format,compress&w=320',large='https://cdn.new-publisher.example/frame.jpg?auto=format,compress&w=1600',s=story();
 const result=projectPageReferences(s,{url:source,html:`<html><img src="${small}" srcset="${small} 320w, ${large} 1600w" alt="Unfamiliar Maker, Unfamiliar Project"></html>`});
 assert.equal(result.photos[0].previewUrl,large);assert(result.photos[0].referenceVariants.includes(small));assert.equal(result.photos[0].referenceVariants.length,2);
 const lazy=projectPageReferences(s,{url:source,html:`<html><img src="/placeholder.jpg" data-src="${image}"><img src="/placeholder.jpg" data-src="https://cdn.new-publisher.example/different.jpg"></html>`});
 assert.equal(lazy.photos.length,2);assert(lazy.photos.every(p=>!p.referenceVariants.some(v=>v.includes('placeholder'))));assert(!photoFileKeys(lazy.photos[0]).some(k=>photoFileKeys(lazy.photos[1]).includes(k)));
 s.recordedProjectLinks=[{url:'https://known-artist.example/projects/unfamiliar-project/',sourceKind:'artist'}];s.media=[{id:'selected',sourceUrl:source,sourceImageUrl:small}];s.localDraft.selectedAssetIds=['selected'];
 assert.equal(automaticPhotoPlan(s).sourceUrl,source);
});

test('copies attached to different chosen references do not become two newly discovered photographs',async t=>{
 const second=image.replace('frame.jpg','another-url.jpg'),bytes=await sharp({create:{width:600,height:800,channels:3,background:'#596'}}).jpeg().toBuffer(),{service,previews}=await setup(t,{readProjectPage:async()=>`<html><img src="${image}"><img src="${second}"></html>`,fetchImage:async()=>new Response(bytes,{headers:{'content-type':'image/jpeg'}})}),s=story();
 s.media=[{id:'first-choice',sourceUrl:source,sourceImageUrl:image},{id:'second-choice',sourceUrl:source,sourceImageUrl:second}];s.localDraft.selectedAssetIds=s.media.map(a=>a.id);const p=service.prepareDiscovery(s,input(s)),r=await service.searchStoryRequest(s,p.id,confirm(s));
 assert.equal(r.cachedExistingCount,2);assert.equal(r.acquisitionSummary.newDecodedFiles,1);assert.equal(r.acquisitionSummary.newDecodedPhotographs,0);assert.equal(previews.get(s.id,'first-choice').originalSha256,previews.get(s.id,'second-choice').originalSha256);assert.deepEqual(s.localDraft.selectedAssetIds,['first-choice','second-choice']);
 const historical=structuredClone(service.storyRequest(p.id));for(const attempt of historical.imageAttempts)delete attempt.newFileContent;assert.equal(service.acquisitionSummary(historical).newDecodedFiles,0,'Historical receipts without a novelty measurement must not invent a new-file count');
});
