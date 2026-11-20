import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture,fakeAdapter} from './helpers/fixtures.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {ApprovalRequests} from '../src/workspace/approval-requests.js';
import {StudioBufferDrafts} from '../src/workspace/buffer-drafts.js';
import {DraftLedger} from '../src/ledger.js';
import {LocalDraftStore} from '../src/workspace/store.js';

async function setup(t){
 const f=await fixture(t),research=new LocalResearchStore(path.join(f.root,'research.sqlite')),approvals=new ApprovalRequests(research),adapter=fakeAdapter();t.after(()=>research.close());
 const story={id:f.manifest.storyId,revision:f.manifest.sourceRevision,origin:'n8n_production',title:'Generated integration fixture',caption:f.manifest.caption,format:'carousel',targetSlideCount:2,selectedAssetIds:f.manifest.slides.map(s=>s.assetId),research:[],blockers:[],
  media:f.manifest.slides.map(s=>({id:s.assetId,sourceUrl:s.source.url,creator:s.source.creator,fileUrl:'https://example.org/verified/'+s.file,rightsStatus:'cleared',nativeRightsReview:{reviewed:true}})),
  production:{blockers:[],observedAt:new Date().toISOString(),providerObservedAt:new Date().toISOString(),providerSnapshotComplete:true,handoffs:[],provider:[],package:{id:'synthetic-package',rowId:'1',version:1,sourceDigest:'a'.repeat(64),finalApprovalStatus:'approved',finalCaption:f.manifest.caption,sourceClaimsReviewed:true,rightsStatus:'reviewed',finalAssetsVerified:true}}};
 const connection={singleWriterVerified:true,unscheduledDraftVerified:true,channelId:f.manifest.channelId,adapter,
  readFinalPackage:async()=>({manifest:structuredClone(f.manifest),inputRoot:f.inputRoot,privateRoot:f.privateRoot}),readCurrentPackage:async()=>structuredClone(f.manifest),readExistingHandoffs:async()=>({storyId:story.id,channelId:f.manifest.channelId,complete:true,observedAt:new Date().toISOString(),postIds:[]})};
 const service=new StudioBufferDrafts({approvals,ledger:f.ledger,connection}),reviewInput=()=>({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:randomUUID()}),confirm=d=>({sourceRevision:story.revision,workingVersion:0,approvalRequestId:d.approvalRequestId,reviewDigest:d.reviewDigest,confirm:'send_unscheduled_buffer_draft'});
 return {...f,story,research,approvals,adapter,connection,service,reviewInput,confirm};
}

test('Studio reviews actual final JPG bytes then explicitly confirms one exact unscheduled draft through the existing core',async t=>{
 const f=await setup(t),before=JSON.stringify(f.story),review=await f.service.review(f.story,f.reviewInput());assert(review.delivery.ready);assert.equal(f.adapter.creates,0);assert.equal(review.delivery.fileCount,2);assert.equal(review.approvalRequest.publicationApproved,false);
 assert.deepEqual(review.delivery.slides.map(s=>s.assetId),f.story.selectedAssetIds);
 const input=f.confirm(review.delivery),results=await Promise.allSettled([f.service.send(f.story,input,{readStory:()=>f.story}),f.service.send(f.story,input,{readStory:()=>f.story})]);
 assert.equal(f.adapter.creates,1);assert(results.some(r=>r.status==='fulfilled'));assert.equal(f.service.status(f.story).state,'confirmed_draft');assert.equal(JSON.stringify(f.story),before);
 const reopened=new DraftLedger(f.ledgerFile);t.after(()=>reopened.close());const restored=new StudioBufferDrafts({approvals:f.approvals,ledger:reopened,connection:f.connection});assert.equal(restored.status(f.story).postId,'fake-draft-1');assert.equal(restored.status(f.story).canSend,false);
 await assert.rejects(restored.send(f.story,input,{readStory:()=>f.story}),{code:'RECONCILIATION_REQUIRED'});assert.equal(f.adapter.creates,1);
});

test('delivery uncertainty survives reopening; only independent read-back can reconcile a known ID',async t=>{
 const f=await setup(t),review=await f.service.review(f.story,f.reviewInput()),read=f.adapter.readPost;f.adapter.readPost=async()=>{throw Error('Simulated connection loss; never production');};
 await assert.rejects(f.service.send(f.story,f.confirm(review.delivery),{readStory:()=>f.story}),{code:'RECONCILIATION_REQUIRED'});assert.equal(f.service.status(f.story).state,'needs_reconciliation');assert.equal(f.adapter.creates,1);
 f.adapter.readPost=read;await f.service.check(f.story,{});assert.equal(f.service.status(f.story).state,'confirmed_draft');assert.equal(f.adapter.creates,1);
 const post=f.adapter.posts.get('fake-draft-1');post.status='scheduled';post.scheduledAt='2026-12-01T12:00:00Z';await assert.rejects(f.service.check(f.story,{}),{code:'RECONCILIATION_REQUIRED'});assert.equal(f.service.status(f.story).state,'needs_reconciliation');assert.equal(f.adapter.creates,1);
});

test('lost create response is never resubmitted, including after process restart or request identity change',async t=>{
 const f=await setup(t);let calls=0;f.adapter.createUnscheduledDraft=async()=>{calls++;throw Error('Ambiguous provider timeout');};const r=await f.service.review(f.story,f.reviewInput());
 await assert.rejects(f.service.send(f.story,f.confirm(r.delivery),{readStory:()=>f.story}),{code:'RECONCILIATION_REQUIRED'});
 const db=new DraftLedger(f.ledgerFile);t.after(()=>db.close());const service=new StudioBufferDrafts({approvals:f.approvals,ledger:db,connection:f.connection});assert.equal(service.status(f.story).canSend,false);await assert.rejects(service.check(f.story,{}),{code:'REMOTE_ID_UNKNOWN'});
 const again=await service.review(f.story,f.reviewInput());assert.equal(again.delivery.state,'needs_reconciliation');assert.equal(calls,1);
});

test('changed caption, rights, order, final bytes, destination and scheduling flags fail before any send',async t=>{
 const f=await setup(t),r=await f.service.review(f.story,f.reviewInput()),input=f.confirm(r.delivery);
 for(const change of [s=>s.caption+=' Changed',s=>s.selectedAssetIds.reverse(),s=>s.media[0].rightsStatus='pending',s=>s.production.package.sourceClaimsReviewed=false,s=>s.organization={trashed:true}]){
  const story=structuredClone(f.story);change(story);await assert.rejects(f.service.send(story,input,{readStory:()=>story}));
 }
 await assert.rejects(f.service.send(f.story,{...input,dueAt:'2026-12-01T00:00:00Z'},{readStory:()=>f.story}),{code:'INVALID_BUFFER_REQUEST'});
 f.manifest.channelId='wrong-channel';await assert.rejects(f.service.send(f.story,input,{readStory:()=>f.story}),{code:'STALE_PACKAGE'});f.manifest.channelId=f.connection.channelId;
 await fs.writeFile(path.join(f.inputRoot,f.manifest.slides[0].file),'corrupt');await assert.rejects(f.service.send(f.story,input,{readStory:()=>f.story}));assert.equal(f.adapter.creates,0);assert.equal(f.ledger.list().length,0);
});

test('disabled default never calls transport or disguises a review packet as a Buffer send',async t=>{
 const f=await setup(t),service=new StudioBufferDrafts({approvals:f.approvals,ledger:f.ledger}),review=await service.review(f.story,f.reviewInput());assert.equal(review.delivery.canSend,false);assert.equal(review.delivery.state,'blocked');assert.equal(review.delivery.blockers[0].code,'BUFFER_CONNECTION_REVIEW_REQUIRED');assert.equal(f.adapter.creates,0);assert.equal(f.ledger.list().length,0);
});

test('HTTP handoff requires the private origin and intent, rejects publication flags, and reports preflight failure without inventing an uncertain send',async t=>{
 const f=await setup(t),{createWorkspaceServer}=await import('../src/workspace/server.js'),{WorkspaceSource}=await import('../src/workspace/data-source.js'),{workspaceSnapshot}=await import('./helpers/workspace-fixture.js');
 const snapshot=workspaceSnapshot(),source=new WorkspaceSource({root:f.root,loadLive:async()=>snapshot}),drafts=new LocalDraftStore(path.join(f.root,'http-drafts.sqlite'));source.snapshot=snapshot;
 const server=createWorkspaceServer({source,drafts,research:f.research});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,id=snapshot.records.stories[0].concept_id,url=origin+'/api/stories/'+id+'/buffer-draft/';
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));drafts.close();});
 const story=await(await fetch(origin+'/api/stories/'+id)).json(),input={sourceRevision:story.revision,workingVersion:0,idempotencyKey:randomUUID()},options={method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(input)};
 assert.equal((await fetch(url+'review',{...options,headers:{...options.headers,Origin:'https://unrelated.invalid'}})).status,403);
 assert.equal((await fetch(url+'review',{...options,headers:{Origin:origin,'Content-Type':'application/json'}})).status,403);
 const review=await(await fetch(url+'review',options)).json();assert.equal(review.delivery.canSend,false);assert(review.approvalRequest.id);
 const failed=await(await fetch(url+'send',{...options,body:JSON.stringify({sourceRevision:story.revision,workingVersion:0,approvalRequestId:review.approvalRequest.id,reviewDigest:'unused',confirm:'send_unscheduled_buffer_draft'})})).json();assert.equal(failed.error.code,'BUFFER_NOT_READY');assert.equal(failed.delivery.state,'blocked');assert.equal(failed.delivery.postId,null);
 const publish=await(await fetch(url+'send',{...options,body:JSON.stringify({...input,publish:true})})).json();assert.equal(publish.error.code,'INVALID_BUFFER_REQUEST');assert.equal(f.adapter.creates,0);assert.equal(f.ledger.list().length,0);
});

test('Trash is append-only, confirmed and restorable across restart without touching drafts, history or approval evidence',async t=>{
 const f=await setup(t),file=path.join(f.root,'drafts.sqlite');let drafts=new LocalDraftStore(file);
 const review=await f.service.review(f.story,f.reviewInput()),approval=JSON.stringify(f.approvals.get(review.approvalRequest.id));drafts.save(f.story,{baseRevision:f.story.revision,expectedVersion:0,caption:f.story.caption,selectedAssetIds:f.story.selectedAssetIds});const before=JSON.stringify(drafts.get(f.story.id)),history=JSON.stringify(drafts.history(f.story.id));
 assert.throws(()=>drafts.organize(f.story,{baseRevision:f.story.revision,expectedVersion:0,trashed:true}),{code:'TRASH_CONFIRMATION_REQUIRED'});
 drafts.organize(f.story,{baseRevision:f.story.revision,expectedVersion:0,pinned:true,archived:true});const trashed=drafts.organize(f.story,{baseRevision:f.story.revision,expectedVersion:1,trashed:true,confirm:'move_to_trash'});assert.equal(trashed.trashed,true);drafts.close();drafts=new LocalDraftStore(file);t.after(()=>drafts.close());
 assert.equal(drafts.organization(f.story.id).trashed,true);assert.throws(()=>f.approvals.prepare({...f.story,organization:drafts.organization(f.story.id)},{...f.reviewInput(),confirm:'prepare_review_only'}),{code:'POST_IN_TRASH'});
 assert.throws(()=>drafts.organize(f.story,{baseRevision:f.story.revision,expectedVersion:1,trashed:false}),{code:'EDIT_CONFLICT'});
 const restored=drafts.organize(f.story,{baseRevision:f.story.revision,expectedVersion:2,trashed:false});assert.equal(restored.archived,true);assert.equal(restored.pinned,true);assert.equal(JSON.stringify(drafts.get(f.story.id)),before);assert.equal(JSON.stringify(drafts.history(f.story.id)),history);assert.equal(JSON.stringify(f.approvals.get(review.approvalRequest.id)),approval);
});
