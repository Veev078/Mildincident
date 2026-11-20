import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {LocalPreviewStore,attachLocalPreviews} from '../src/workspace/previews.js';
import {buildWorkspace} from '../src/workspace/model.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';
import {savedCopySelection,coverSelection} from '../web/selection-actions.js';

async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-saved-copy-')),store=new LocalPreviewStore(root),snapshot=workspaceSnapshot(),row=snapshot.records.media[0];
 row.notes='Image original reference: https://example.org/project/frame.jpg. Original page: https://example.org/project/';
 const before=buildWorkspace(snapshot).stories[0],story=buildWorkspace(snapshot).stories[0];
 story.media[0].sourceUrl='https://example.org/project/';
 story.media.push({id:'photo:saved-frame',title:'Generated test frame',sourceUrl:'https://example.org/project/',previewUrl:'',rightsStatus:'unreviewed'});
 const bytes=await sharp({create:{width:500,height:700,channels:3,background:'#526145'}}).jpeg().toBuffer();
 const saved=await store.save({storyId:story.id,assetId:'photo:saved-frame',bytes,contentType:'image/jpeg',originalName:'GENERATED-test-only.jpg',declaration:'private_review_only'});
 store.recordSourceInspection(story.id,'photo:saved-frame',saved.sha256,{sourceUrl:'https://example.org/project/',imageUrl:'https://example.org/project/frame.jpg',executionId:'999'});
 t.after(async()=>{store.close();await fs.rm(root,{recursive:true,force:true});});
 return {store,snapshot,before,story,saved};
}

test('matching saved publisher copy repairs display without migrating selection, rights or source revision',async t=>{
 const {store,snapshot,before,story,saved}=await setup(t),chosen=[...story.selectedAssetIds];
 const oldNotes=snapshot.records.media[0].notes;snapshot.records.media[0].notes='';assert.equal(buildWorkspace(snapshot).stories[0].revision,before.revision);snapshot.records.media[0].notes=oldNotes;
 attachLocalPreviews({stories:[story]},store);const ref=story.media[0];
 assert.equal(ref.savedCopy.assetId,'photo:saved-frame');assert.equal(ref.savedCopy.sha256,saved.sha256);
 assert.equal(ref.localPreview,null);assert.equal(ref.savedCopy.rightsGranted,false);assert.equal(ref.rightsStatus,before.media[0].rightsStatus);
 assert.match(ref.previewUrl,/photo%3Asaved-frame/);assert.equal(story.revision,before.revision);assert.deepEqual(story.selectedAssetIds,chosen);
 const changed=savedCopySelection(story,ref.id);assert.ok(changed.includes('photo:saved-frame'));assert.ok(!changed.includes(ref.id));assert.deepEqual(story.selectedAssetIds,chosen);
});

test('same image lead on another source page never silently links a file or transfers a review',async t=>{
 const {store,story}=await setup(t);story.media[0].sourceUrl='https://example.org/unrelated/';
 attachLocalPreviews({stories:[story]},store);assert.equal(story.media[0].savedCopy,undefined);
 assert.throws(()=>savedCopySelection(story,story.media[0].id),/Reopen/);
 const current={...story,localDraft:{selectedAssetIds:[story.media[0].id,'photo:saved-frame']}};
 assert.deepEqual(coverSelection(current,'photo:saved-frame'),['photo:saved-frame',story.media[0].id]);
});
