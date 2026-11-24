import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {nativeBufferFixture} from './helpers/native-buffer-fixture.js';import {ApprovalRequests} from '../src/workspace/approval-requests.js';import {NativePostTransfers} from '../src/workspace/native-post-transfer.js';import {StudioBufferDrafts} from '../src/workspace/buffer-drafts.js';import {PostCompletion} from '../src/workspace/post-completion.js';import {DraftLedger} from '../src/ledger.js';
async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'finish-post-')),f=await nativeBufferFixture(root),approvals=new ApprovalRequests(f.research),ledger=new DraftLedger(f.research.db.location());t.after(async()=>{ledger.close();f.close();await fs.rm(root,{recursive:true,force:true});});
 // Simulates a separately authorized recurring draft connection; never a live grant.
 f.policy.version=2;f.policy.id=randomUUID();f.policy.target='unscheduled_draft';f.policy.founderConfirmationRequired=true;
 const readStory=()=>{const s=f.source.view(f.drafts.all()).stories[0];s.nativePublishing=f.connection.status(s);return s;};
 const transfers=new NativePostTransfers({approvals,research:f.research,drafts:f.drafts,previews:f.previews,connection:f.connection,refreshSource:()=>f.source.refresh(),readStory}),buffer=new StudioBufferDrafts({approvals,ledger,connection:f.connection});
 const service=()=>new PostCompletion({transfers,buffer,connection:f.connection,refreshSource:()=>f.source.refresh(),readStory}),input=()=>({sourceRevision:readStory().revision,workingVersion:readStory().localDraft?.version||0,idempotencyKey:randomUUID()});return {...f,fixture:f,readStory,transfers,buffer,service,input};
}
test('Finish drives preparation, actual JPEG preview, one consent and independent simulated delivery; restart never submits again',async t=>{
 const f=await setup(t),caption=f.readStory().caption,ids=f.readStory().selectedAssetIds,s=f.service();
 assert.equal((await s.finish(f.readStory(),f.input())).state,'preparing');assert.deepEqual(f.calls,['review']);assert.equal(f.fixture.creates,0);
 const resumed=f.service(),ready=await resumed.finish(f.readStory(),{},{checkOnly:true});assert.equal(ready.state,'ready');assert.equal(f.calls.filter(x=>x==='review').length,1);assert.equal(f.fixture.creates,0);assert.equal(f.readStory().nativePublishing.preparedSlides.length,3);
 const i={sourceRevision:ready.sourceRevision,workingVersion:ready.workingVersion,idempotencyKey:randomUUID(),completionDigest:ready.delivery.completionDigest,finalPostDigest:ready.delivery.finalPostDigest,confirm:'approve_and_send_unscheduled_draft'};
 await resumed.confirm(f.readStory(),i);let delivered=await resumed.advance(f.readStory());if(delivered.pending)delivered=await resumed.advance(f.readStory());assert.equal(delivered.delivery.state,'confirmed_draft');assert.equal(f.fixture.creates,1);assert(f.fixture.checks>0);assert.equal([...f.posts.values()][0].dueAt,null);assert.equal([...f.posts.values()][0].text,caption);assert.deepEqual(f.readStory().selectedAssetIds,ids);
 await f.service().finish(f.readStory(),f.input());assert.equal(f.fixture.creates,1);assert.equal(f.calls.filter(x=>x==='review').length,1);
});
test('checking an untouched post cannot create preparation, while repeated Finish resumes one durable transfer',async t=>{
 const f=await setup(t),s=f.service();assert.equal((await s.finish(f.readStory(),{},{checkOnly:true})).issue.action,'finish');assert.equal(f.calls.length,0);
 const results=await Promise.allSettled([s.finish(f.readStory(),f.input()),s.finish(f.readStory(),f.input())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.calls.filter(x=>x==='review').length,1);
 await f.service().finish(f.readStory(),f.input());assert.equal(f.calls.filter(x=>x==='review').length,1);assert.equal(f.fixture.creates,0);
});
test('unknown usage is a specific slide issue; no final approval, rights mutation or provider create is inferred',async t=>{
 const f=await setup(t);f.snapshot.records.media[0].rights_status='unknown';f.snapshot.records.media[0].notes='Publicly available NASA preview is not permission';
 await f.service().finish(f.readStory(),f.input());const r=await f.service().finish(f.readStory(),{},{checkOnly:true});assert.equal(r.issue.code,'PHOTO_USAGE_REQUIRED');assert(r.issue.assetId);assert(r.issue.slide);assert.equal(r.issue.action,'replace_photo');assert.equal(f.snapshot.records.media[0].rights_status,'unknown');assert.equal(f.calls.includes('approve'),false);assert.equal(f.fixture.creates,0);
});
test('missing/corrupt privately saved originals cannot be replaced by URLs or preview metadata',async t=>{
 const f=await setup(t);await f.service().finish(f.readStory(),f.input());await f.service().finish(f.readStory(),{},{checkOnly:true});const p=f.previews.get(f.id,'asset-3');await fs.writeFile(path.join(f.previews.root,'blobs',p.originalSha256+'.original'),'not a JPEG');
 const r=await f.service().finish(f.readStory(),f.input());assert.equal(r.issue.code,'PHOTO_ORIGINAL_REQUIRED');assert.equal(r.issue.slide,1);assert.equal(f.fixture.creates,0);
});
test('unavailable preparation is one truthful connection issue and cannot mutate native records',async t=>{
 const f=await setup(t);f.policy.enabled=false;const before=JSON.stringify(f.snapshot.records),r=await f.service().finish(f.readStory(),f.input());assert.equal(r.issue.code,'PREPARATION_DISABLED');assert.equal(f.calls.length,0);assert.equal(JSON.stringify(f.snapshot.records),before);
});
test('a lost preparation reply is reconciled from its recorded execution, never dispatched again',async t=>{
 const f=await setup(t),submit=f.connection.submitReview.bind(f.connection);f.connection.submitReview=async p=>{await submit(p);throw Error('Lost reply');};await assert.rejects(f.service().finish(f.readStory(),f.input()),{code:'NATIVE_REVIEW_UNCERTAIN'});assert.equal(f.transfers.latest(f.id).state,'uncertain');
 const r=await f.service().finish(f.readStory(),{},{checkOnly:true});assert.equal(r.state,'ready');assert.equal(f.calls.filter(x=>x==='review').length,1);assert.equal(f.fixture.creates,0);
});
test('an unbound upload does not inherit image permission just because it uses a cleared asset ID',async t=>{
 const f=await setup(t);await f.service().finish(f.readStory(),f.input());await f.service().finish(f.readStory(),{},{checkOnly:true});
 f.previews.db.prepare('DELETE FROM local_source_preview_evidence WHERE story_id=? AND asset_id=?').run(f.id,'asset-3');const r=await f.service().finish(f.readStory(),f.input());assert.equal(r.issue.code,'PHOTO_ORIGINAL_REQUIRED');assert.equal(r.issue.assetId,'asset-3');assert.equal(f.fixture.creates,0);
});
