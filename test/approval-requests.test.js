import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import{randomUUID}from'node:crypto';
import{ApprovalRequests}from'../src/workspace/approval-requests.js';import{LocalResearchStore}from'../src/workspace/research-store.js';import{buildWorkspace}from'../src/workspace/model.js';import{workspaceSnapshot}from'./helpers/workspace-fixture.js';
async function setup(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-approval-')),research=new LocalResearchStore(path.join(root,'research.sqlite')),store=new ApprovalRequests(research),story=buildWorkspace(workspaceSnapshot()).stories[0];story.localDraft={version:2,baseRevision:story.revision,caption:'A specific founder-approved-for-review wording.',selectedAssetIds:['asset-2','asset-1']};story.media[0].localPreview={originalSha256:'a'.repeat(64),sha256:'b'.repeat(64)};t.after(async()=>{research.close();await fs.rm(root,{recursive:true,force:true});});return{research,store,story};}
const input=s=>({sourceRevision:s.revision,workingVersion:s.localDraft?.version||0,idempotencyKey:randomUUID(),confirm:'prepare_review_only'});
test('approval preparation is durable, duplicate-safe, exact and private, without approving or creating a publishing claim',async t=>{
 const f=await setup(t),before=JSON.stringify(f.story),body=input(f.story),first=f.store.prepare(f.story,body),again=f.store.prepare(f.story,input(f.story));assert.equal(first.id,again.id);assert.equal(first.state,'prepared');assert.equal(first.publicationApproved,false);assert.equal(first.bufferCreateEnabled,false);assert.equal(first.nativePreflightAccepted,false);assert.ok(first.blockers.some(i=>i.code==='EXISTING_OR_UNCERTAIN_HANDOFF'));assert.equal(JSON.stringify(f.story),before);
 const file=f.store.download(f.story,first.id);assert.equal(file.packet.editorial.caption,f.story.localDraft.caption);assert.deepEqual(file.packet.editorial.orderedMedia.map(m=>m.assetId),['asset-2','asset-1']);assert.equal(file.binding.pixels[1].uploadedOriginalSha256,'a'.repeat(64));assert.ok(!JSON.stringify(file).includes('never-expose'));
 const db=new LocalResearchStore(f.research.db.location());try{const reopened=new ApprovalRequests(db);assert.equal(reopened.status(f.story).id,first.id);assert.equal(reopened.download(f.story,first.id).contentDigest,first.contentDigest);}finally{db.close();}
});
test('caption edits, photo order, preview bytes, source revision and native rights changes invalidate prepared handoff without replacing history',async t=>{
 const f=await setup(t),first=f.store.prepare(f.story,input(f.story)),saved=JSON.stringify(f.store.get(first.id));
 for(const edit of [s=>s.localDraft.caption+=' Changed',s=>s.localDraft.selectedAssetIds.reverse(),s=>s.media[0].localPreview.sha256='c'.repeat(64),s=>s.revision='changed',s=>s.media[0].rightsStatus='cleared']){const s=structuredClone(f.story);edit(s);assert.equal(f.store.status(s).state,'changed');assert.equal(JSON.stringify(f.store.get(first.id)),saved);}
});
test('a development story cannot fabricate native identity or carry approval flags through a review request',async t=>{
 const f=await setup(t);f.story.origin='n8n_development';f.story.production={};const p=f.store.prepare(f.story,input(f.story));assert.equal(p.nativeTargetAvailable,false);assert.equal(p.nativePreflightAccepted,false);assert.match(p.message,/development story/);
 await assert.rejects(async()=>f.store.prepare(f.story,{...input(f.story),publicationApproved:true}),{code:'INVALID_APPROVAL_REQUEST'});
 const old=input(f.story);f.store.prepare(f.story,old);f.story.localDraft.caption+=' Changed';assert.throws(()=>f.store.prepare(f.story,old),{code:'EDIT_CONFLICT'});assert.throws(()=>f.store.download({...f.story,id:'CON-OTHER'},p.id),{code:'INVALID_APPROVAL_REQUEST'});
});

test('saving edited copy returns handoff invalidation in the same HTTP response without a separate workspace refresh',async t=>{
 const {createWorkspaceServer}=await import('../src/workspace/server.js'),{WorkspaceSource}=await import('../src/workspace/data-source.js'),{LocalDraftStore}=await import('../src/workspace/store.js');
 const f=await setup(t),root=path.dirname(f.research.db.location()),snapshot=workspaceSnapshot(),source=new WorkspaceSource({root,loadLive:async()=>snapshot}),drafts=new LocalDraftStore(path.join(root,'drafts.sqlite'));source.snapshot=snapshot;
 const server=createWorkspaceServer({source,drafts,research:f.research});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});drafts.close();});
 const story=await(await fetch(origin+'/api/stories/'+f.story.id)).json(),headers={Origin:origin,'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'};
 const prepared=await(await fetch(origin+'/api/stories/'+story.id+'/approval-requests',{method:'POST',headers,body:JSON.stringify({...input(story),workingVersion:0})})).json();assert.equal(prepared.approvalRequest.state,'prepared');
 const changed=await(await fetch(origin+'/api/stories/'+story.id+'/draft',{method:'PATCH',headers,body:JSON.stringify({baseRevision:story.revision,expectedVersion:0,caption:'A deliberate founder edit after preparing the review handoff.'})})).json();assert.equal(changed.approvalRequest.state,'changed');assert.equal(changed.approvalRequest.id,prepared.approvalRequest.id);assert.equal(changed.approvalRequest.publicationApproved,false);
});
