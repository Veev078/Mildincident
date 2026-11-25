import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHmac} from 'node:crypto';
import sharp from 'sharp';
import {fixture,handoffOptions,fakeAdapter} from './helpers/fixtures.js';
import {preparePackage,sha256,canonical,validateManifest} from '../src/package.js';
import {prepareAndSend,reconcileNativeDraft} from '../src/handoff.js';
import {DraftLedger} from '../src/ledger.js';
import {bindPublishingCredential,publishingGraphSha} from '../src/n8n/buffer-handoff-security.js';
import {nativePackageDigestMaterial} from '../src/native-package-identity.js';
import {stableNative,priorBufferHandoff,sharedBufferMaterial,assertSharedBufferClaim,validateNativePostTransfer} from '../src/n8n/buffer-native-contract.js';
import {prepareBufferClaimProof,verifySharedClaimOnce} from '../src/n8n/buffer-claim-proof.js';
import {prepareBufferClaimMigration} from '../src/n8n/buffer-claim-migration.js';
import {verifyMcpDraftReadback} from '../src/n8n/draft-guards.js';
import {publishingJwt,readNativeBufferPolicy,NativeBufferConnection,BUFFER_CHANNEL_ID} from '../src/workspace/native-buffer-connection.js';
import {STUDIO_PUBLISHING_AUDIENCE} from '../src/n8n/buffer-gateway-patch.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalDraftStore} from '../src/workspace/store.js';
import {ApprovalRequests} from '../src/workspace/approval-requests.js';
import {NativePostTransfers,nativePostTransferPacket} from '../src/workspace/native-post-transfer.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';
import {buildWorkspace} from '../src/workspace/model.js';

function nativeFixture(){
 const p={id:7,concept_id:'CON-SYNTHETIC-01',package_id:'PKG-SYNTHETIC',production_version:4,format:'carousel',buffer_claim_state:'idle',caption_draft:'A source-grounded caption for these three actual selected frames.',slide_sequence_asset_ids:JSON.stringify(['asset-1','asset-2','asset-3']),final_approval_status:'pending'};
 const media=[1,2,3].map(i=>({id:i,concept_id:p.concept_id,asset_id:'asset-'+i,file_url:'https://example.org/photo-'+i+'.jpg',source_page_url:'https://example.org/project',creator:'Fixture author',attribution_text:'Fixture credit',notes:'Existing native evidence',rights_status:'preview_unreviewed',width:1400,height:1400}));
 const packet={version:1,kind:'mildincident_studio_post_review',requestId:randomUUID(),contentDigest:'d'.repeat(64),expected:{storyId:p.concept_id,storyState:{title:'Fixture project',hook:'Grounded hook',format:'carousel',stage:'approved_for_sourcing',approval_status:'concept_approved'},packageId:p.package_id,packageRowId:p.id,packageVersion:p.production_version,packageDigest:'e'.repeat(64)},post:{caption:p.caption_draft,selectedAssetIds:media.map(m=>m.asset_id),format:'carousel',title:'Fixture project',hook:'Grounded hook',sourceRevision:'fixture-revision',workingVersion:0},images:media.map(m=>({assetId:m.asset_id,sourceUrl:m.source_page_url,imageUrl:m.file_url,creator:m.creator,credit:m.attribution_text,sourceCaption:'Frame',width:1400,height:1400,originalSha256:null,previewSha256:null,acquisition:null}))};
 return {p,media,packet,ctx:{story:{concept_id:p.concept_id,title:'Fixture project',hook:'Grounded hook',format:'carousel',stage:'approved_for_sourcing',approval_status:'concept_approved'},packages:[p],media,manual:[],guarded:[],packageDigest:'e'.repeat(64)}};
}

test('one canonical reservation protects manual and guarded writers, including old versions and unknown outcomes',()=>{
 const {p,media}=nativeFixture(),db=new DatabaseSync(':memory:');try{
 db.exec('CREATE TABLE packages(id INTEGER PRIMARY KEY,version INTEGER,state TEXT,owner TEXT,digest TEXT)');db.prepare('INSERT INTO packages VALUES(?,?,?,?,?)').run(p.id,p.production_version,'idle','','');
 const digest=sha256(stableNative(sharedBufferMaterial(p,media))),wins=[];
 for(const owner of ['manual','guarded']){const claim={packageRowId:p.id,conceptId:p.concept_id,packageVersion:p.production_version,owner,digest};const rows=db.prepare("UPDATE packages SET state='reserved',owner=?,digest=? WHERE id=? AND version=? AND state='idle' RETURNING *").all(owner,digest,p.id,p.production_version).map(r=>({...p,buffer_claim_state:r.state,buffer_claim_owner:r.owner,buffer_claim_digest:r.digest}));if(rows.length){assertSharedBufferClaim(rows,claim,'reserved');wins.push(owner);}else assert.throws(()=>assertSharedBufferClaim(rows,claim,'reserved'));}
 assert.deepEqual(wins,['manual']);
 for(const row of [{state:'sending',package_version:1},{status:'unknown'},{state:'abandoned',buffer_id:'prior-id'}])assert(priorBufferHandoff([{concept_id:p.concept_id,...row}],p.concept_id));
 const migration=prepareBufferClaimMigration({packages:[{...p,buffer_claim_state:null},{...p,id:8,concept_id:'CON-OTHER',buffer_claim_state:'create_started'}],manual:[{concept_id:p.concept_id,package_version:1,state:'unknown'}],guarded:[]});assert.equal(migration.rows[0].values.buffer_claim_state,'blocked_existing_handoff');assert.equal(migration.rows[1].action,'preserve_existing_claim');
 assert.throws(()=>prepareBufferClaimMigration({packages:[p,p],manual:[],guarded:[]}));
 }finally{db.close();}
});

test('exact editorial transfer keeps evidence and rejects injected rights, stale versions, altered order and foreign files',()=>{
 const {p,packet,ctx}=nativeFixture(),before=canonical(ctx);let plan=validateNativePostTransfer(packet,ctx);assert.equal(plan.unchanged,true);
 const q=structuredClone(packet),id='photo:'+'a'.repeat(32);q.post.selectedAssetIds[2]=id;q.images[2]={...q.images[2],assetId:id,originalSha256:'a'.repeat(64),previewSha256:'b'.repeat(64),acquisition:{basis:'photo_request_source_copy',requestId:randomUUID(),inputDigest:'c'.repeat(64),pageSha256:'d'.repeat(64)}};plan=validateNativePostTransfer(q,ctx);assert.equal(plan.nextVersion,p.production_version+1);assert.equal(plan.newMedia[0].rights_status,'preview_unreviewed');assert.match(plan.newMedia[0].notes,/STUDIO SOURCE SHA256/);assert.equal(canonical(ctx),before);
 for(const edit of [q=>q.images[2].rights_status='reviewed_cleared',q=>q.images.reverse(),q=>q.expected.packageVersion++,q=>q.expected.storyState.title='Old title',q=>q.post.caption+=' ',q=>q.images[2].imageUrl='https://127.0.0.1/private',q=>q.images[2].acquisition.pageSha256=null]){const changed=structuredClone(q);edit(changed);assert.throws(()=>validateNativePostTransfer(changed,ctx));}
 ctx.manual=[{concept_id:p.concept_id,state:'initiated',package_version:1}];assert.throws(()=>validateNativePostTransfer(q,ctx),/PRIOR_HANDOFF/);
});

test('reservation timestamps do not invalidate editorial approval; changes to caption or sources do',()=>{
 const {p}=nativeFixture(),before=canonical(nativePackageDigestMaterial(p));assert.equal(canonical(nativePackageDigestMaterial({...p,updatedAt:'later',buffer_claim_state:'reserved',buffer_claim_owner:'one'})),before);assert.notEqual(canonical(nativePackageDigestMaterial({...p,caption_draft:'Changed'})),before);
});

test('Buffer success requires an independent exact draft read, including null schedule and null sent time',()=>{
 const expected={id:'a'.repeat(24),channelId:BUFFER_CHANNEL_ID,caption:'Exact caption',urls:['https://example.org/a.jpg','https://example.org/b.jpg']},post={id:expected.id,channelId:expected.channelId,text:expected.caption,status:'draft',dueAt:null,sentAt:null,assets:expected.urls.map(source=>({source}))};
 const response=p=>({content:[{type:'text',text:JSON.stringify({post:p})}]});assert(verifyMcpDraftReadback(expected,response(post)).verified);
 for(const p of [{...post,status:'scheduled'},{...post,sentAt:'2026-11-17'},{...post,assets:[...post.assets].reverse()},{...post,text:'Changed'},Object.fromEntries(Object.entries(post).filter(([k])=>k!=='dueAt'))])assert.equal(verifyMcpDraftReadback(expected,response(p)).verified,false);
});

test('native 202 acceptance persists across restart; check observes one execution, then reads Buffer independently',async t=>{
 const f=await fixture(t),provider=fakeAdapter();let calls=0,reads=0,completed=false;
 const adapter={nativeCoordinator:true,async createUnscheduledDraft(request){calls++;assert.equal(request.caption,f.manifest.caption);return{state:'native_accepted',executionId:'999001',requestId:'11111111-1111-4111-8111-111111111111'};},async observeNativeExecution(){return{state:completed?'complete':'running',executionId:'999001',requestId:'11111111-1111-4111-8111-111111111111',postId:completed?'a'.repeat(24):null};},async readPost(id){reads++;return{id,channelId:f.manifest.channelId,caption:f.manifest.caption,status:'draft',scheduledAt:null,sentAt:null,assetHashes:prepared.slides.map(s=>s.sha256)};}};
 const {prepared}=await prepareAndSend(handoffOptions(f,adapter));assert.equal(calls,1);assert.equal(reads,0);const ledger=new DraftLedger(f.ledgerFile);t.after(()=>ledger.close());const key=ledger.list()[0].scope_key;
 await reconcileNativeDraft({ledger,key,adapter});assert.equal(reads,0);completed=true;await reconcileNativeDraft({ledger,key,adapter});assert.equal(ledger.get(key).state,'confirmed_draft');assert.equal(reads,1);assert.equal((await prepareAndSend({...handoffOptions(f,adapter),ledger})).reused,true);assert.equal(calls,1);
});

test('lost native acceptance is reconciled from the recorded request only, with no second dispatch',async t=>{
 const f=await fixture(t);let creates=0;const adapter={nativeCoordinator:true,async readPost(){throw Error('No provider ID');},async createUnscheduledDraft(){creates++;throw Error('lost reply');},async observeNativeExecution(){return{state:'complete',executionId:'999002',requestId:'22222222-2222-4222-8222-222222222222',stoppedBeforeProvider:true};}};
 await assert.rejects(prepareAndSend(handoffOptions(f,adapter)));const key=f.ledger.list()[0].scope_key;await assert.rejects(reconcileNativeDraft({ledger:f.ledger,key,adapter}));assert.equal(f.ledger.get(key).native_execution_id,'999002');assert.equal(f.ledger.get(key).failure_code,'NATIVE_STOPPED_BEFORE_BUFFER');assert.equal(creates,1);
});

test('final native JPEG preservation transfers the approved bytes and retains documented editorial exceptions',async t=>{
 const f=await fixture(t);for(const slide of f.manifest.slides){const file=path.join(f.inputRoot,slide.file),bytes=await sharp(await fs.readFile(file)).jpeg().toBuffer();await fs.writeFile(file,bytes);slide.sha256=sha256(bytes);slide.rights={...slide.rights,status:'editorial_exception_authorized',exception:{storyId:f.manifest.storyId,assetId:slide.assetId,purpose:'Critical editorial analysis',nature:'Published photographic work',amount:'One necessary frame',market:'No substitute for the original'}};}
 const result=await preparePackage(f.manifest,{...f,preserveVerifiedJpeg:true});for(let i=0;i<result.slides.length;i++){assert.equal(result.slides[i].sha256,f.manifest.slides[i].sha256);assert.deepEqual(await fs.readFile(path.join(result.directory,result.slides[i].file)),await fs.readFile(path.join(f.inputRoot,f.manifest.slides[i].file)));}
 const bad=structuredClone(f.manifest);delete bad.slides[0].rights.exception.market;assert.throws(()=>validateManifest(bad));
});

test('dedicated publishing JWT is short lived and bound to the entire action, with disabled policy as default',async t=>{
 const f=await fixture(t),secret='b'.repeat(64),body={version:1,action:'send',requestId:randomUUID(),storyId:'CON-TEST-01'},token=publishingJwt(body,secret,120000),[h,c,sig]=token.split('.'),claims=JSON.parse(Buffer.from(c,'base64url'));
 assert.equal(sig,createHmac('sha256',secret).update(h+'.'+c).digest('base64url'));assert.equal(claims.exp-claims.iat,300);assert.equal(claims.aud,STUDIO_PUBLISHING_AUDIENCE);assert.equal(claims.bodySha256,sha256(canonical(body)));assert(!token.includes(secret));
 const config={dataRoot:f.root};assert.equal((await readNativeBufferPolicy({env:{},config})).enabled,false);
 const file=path.join(f.root,'disabled-policy.json');await fs.writeFile(file,JSON.stringify({version:1,enabled:false,approved:false}),{mode:0o600});assert.equal((await readNativeBufferPolicy({env:{STUDIO_BUFFER_POLICY_FILE:file},config})).enabled,false);
 let calls=0;const connection=new NativeBufferConnection({loadPolicy:async()=>({version:1,enabled:false,approved:false}),read:async()=>{calls++;throw Error('not expected');},fetchImpl:async()=>{calls++;throw Error('not expected');}});await connection.inspect();await assert.rejects(connection.submitReview({}));assert.equal(calls,0);
});

test('Studio native review records one dispatch, reconciles exact caption/order, preserves local history and never imports rights',async t=>{
 const f=await fixture(t),research=new LocalResearchStore(path.join(f.root,'research.sqlite')),drafts=new LocalDraftStore(path.join(f.root,'drafts.sqlite'));t.after(()=>{research.close();drafts.close();});
 const snapshot=workspaceSnapshot(),initial=buildWorkspace(snapshot).stories[0];snapshot.records.imports=[];snapshot.records.guardedHandoffs=[];const ids=initial.selectedAssetIds;Object.assign(initial.production.package,{sourceDigest:'e'.repeat(64),id:'PKG-EXISTING',rowId:'1',version:1});initial.origin='n8n_production';let current=initial,submits=0,packet;
 drafts.save(initial,{baseRevision:initial.revision,expectedVersion:0,caption:'A revised, source-grounded caption for the two selected fixture frames.',selectedAssetIds:ids});current={...initial,localDraft:drafts.get(initial.id)};
 const approvals=new ApprovalRequests(research),a=approvals.prepare(current,{sourceRevision:current.revision,workingVersion:1,idempotencyKey:randomUUID(),confirm:'prepare_review_only'});
 const connection={reviewAvailable:true,async submitReview(p){submits++;packet=p;return{state:'native_accepted',requestId:p.requestId,executionId:'999003'};},async readReviewReceipt(){return{state:'native_review_saved',requestId:packet.requestId,contentDigest:packet.contentDigest,storyId:current.id,packageVersion:2,executionId:'999003'};}};
 const transfers=new NativePostTransfers({approvals,research,drafts,connection,refreshSource:async()=>{current={...current,caption:packet.post.caption,selectedAssetIds:packet.post.selectedAssetIds,format:packet.post.format,revision:'new-native-revision',production:{...current.production,package:{...current.production.package,version:2}}};},readStory:()=>current});
 const input={sourceRevision:current.revision,workingVersion:1,approvalRequestId:a.id,confirm:'submit_exact_post_for_native_review'};await transfers.submit(current,input);await assert.rejects(transfers.submit(current,input));assert.equal(submits,1);const result=await transfers.reconcile(current);assert.equal(result.state,'native_review_saved');assert.equal(result.rightsGranted,false);assert.equal(drafts.get(current.id).baseRevision,'new-native-revision');assert.equal(drafts.history(current.id).length,2);assert.equal(submits,1);
});

test('temporary native claim proof only touches its own reservation and cleans up on ambiguous proof',async()=>{
 const {p}=nativeFixture(),nativeNode=name=>({name,type:'n8n-nodes-base.dataTable',parameters:{columns:{value:{}},filters:{conditions:[]}}}),writer={workflowId:'Q02tRHMtZ90Kib18',update:{nodes:[nativeNode('Acquire Shared Buffer Reservation'),nativeNode('Commit Shared Buffer Create Intent')]}};
 const proof=prepareBufferClaimProof(writer,{rowId:p.id,storyId:p.concept_id,packageVersion:p.production_version});assert.equal(proof.review.bufferNodes,0);assert(proof.update.nodes.every(n=>!n.type.includes('mcp')&&!n.type.includes('openAi')));
 let row={...p,buffer_claim_owner:'',buffer_claim_digest:''};const dispatch=async r=>{if(r.action==='reserve'){if(row.buffer_claim_state!=='idle')return{changedRows:0};Object.assign(row,{buffer_claim_state:'reserved',buffer_claim_owner:r.owner,buffer_claim_digest:proof.review.digest});return{changedRows:1};}if(row.buffer_claim_owner===r.owner)Object.assign(row,{buffer_claim_state:'idle',buffer_claim_owner:'',buffer_claim_digest:''});return{changedRows:1};};
 const result=await verifySharedClaimOnce({proof,dispatch,readPackage:async()=>structuredClone(row)});assert(result.verified);assert.equal(row.buffer_claim_state,'idle');
 let first=true;await assert.rejects(verifySharedClaimOnce({proof,dispatch:async r=>{const result=await dispatch(r);if(r.action==='reserve'&&first){first=false;throw Error('lost probe reply');}return result;},readPackage:async()=>structuredClone(row)}),/not proven/);assert.equal(row.buffer_claim_state,'idle');
});

test('credential binding permits only the reviewed new JWT reference and stops on template drift',()=>{
 const graph={name:'Fixture',nodes:[{name:'Studio Publishing Request',parameters:{path:'fixed'},credentials:{jwtAuth:{id:'__APPROVED_PUBLISHING_JWT_CREDENTIAL__',name:'Dedicated'}}}],connections:{},settings:{availableInMCP:true}},expected=publishingGraphSha(graph),bound=bindPublishingCredential(graph,'newJwtCredential',expected);
 assert.equal(bound.update.nodes[0].credentials.jwtAuth.id,'newJwtCredential');assert.equal(graph.nodes[0].credentials.jwtAuth.id,'__APPROVED_PUBLISHING_JWT_CREDENTIAL__');assert.notEqual(bound.graphSha256,expected);const changed=structuredClone(graph);changed.settings.availableInMCP=false;assert.throws(()=>bindPublishingCredential(changed,'newJwtCredential',expected));
});
