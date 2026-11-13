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

for(const failure of ['source_uncertain','image_denied'])test(`photo discovery preserves ${failure} evidence across restart and requires an explicit source recheck`,async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-photo-recovery-'));
 const url='https://www.life.com/test-maker-test-project/',image='https://static.life.com/generated-recovery-frame.jpg';
 const story={id:'CON-test-photo-recovery',revision:'source-revision',subject:'Test Maker, Test Project',research:[{url}],media:[],selectedAssetIds:[],caption:'Keep this caption.'};
 const bytes=await sharp({create:{width:640,height:800,channels:3,background:{r:60,g:120,b:90}}}).jpeg().toBuffer();
 let research,previews,service,pageCalls=0,imageCalls=0,allow=false;
 function open(){research=new LocalResearchStore(root+'/research.sqlite');previews=new LocalPreviewStore(root+'/previews');service=new PhotographyService(research,{previews,readProjectPage:async()=>{pageCalls++;if(failure==='source_uncertain'&&!allow)throw Error('SIMULATED_CONNECTION_LOST');return `<html><figure><img src="${image}"><figcaption>Test Maker, Test Project — generated fixture.</figcaption></figure></html>`;},fetchImage:async()=>{imageCalls++;return failure==='image_denied'&&!allow?new Response('',{status:401}):new Response(bytes,{headers:{'content-type':'image/jpeg'}});}});}
 const current=()=>({...story,media:[...story.media,...service.storyMedia(story)]});
 const prepare=(refreshSources=false)=>service.prepareDiscovery(current(),{idempotencyKey:randomUUID(),sourceRevision:story.revision,workingVersion:0,direction:'best',...(refreshSources?{refreshSources:true}:{})});
 const run=id=>service.searchStoryRequest(current(),id,{confirm:true,sourceRevision:story.revision,workingVersion:0},{readStory:current});
 open();t.after(async()=>{research?.close();previews?.close();await fs.rm(root,{recursive:true,force:true});});
 const first=prepare(),result=await run(first.id);assert.equal(result.state,failure==='source_uncertain'?'unavailable':'complete');
 const prior=research.db.prepare('SELECT data_json FROM photo_story_requests WHERE request_id=?').get(first.id).data_json;
 assert.equal(pageCalls,1);assert.equal(imageCalls,failure==='image_denied'?1:0);
 await run(first.id);assert.equal(pageCalls,1);assert.equal(imageCalls,failure==='image_denied'?1:0);
 research.close();previews.close();open();
 await run(first.id);const next=prepare();await run(next.id);
 assert.equal(pageCalls,1,'ordinary new action must not repeat a checked/uncertain source');
 assert.equal(imageCalls,failure==='image_denied'?1:0,'ordinary new action must not retry a denied image');
 allow=true;const explicit=prepare(true),rechecked=await run(explicit.id);assert.equal(rechecked.state,'complete');
 assert.equal(pageCalls,2);assert.equal(imageCalls,failure==='image_denied'?2:1);
 assert.equal(rechecked.acquisitionSummary.newDecodedPhotographs,failure==='source_uncertain'?1:0);
 assert.equal(rechecked.acquisitionSummary.decodedExistingReferences,failure==='image_denied'?1:0);
 assert.equal(research.db.prepare('SELECT data_json FROM photo_story_requests WHERE request_id=?').get(first.id).data_json,prior,'earlier evidence must remain immutable');
 assert.equal(story.caption,'Keep this caption.');assert.deepEqual(story.selectedAssetIds,[]);
});
