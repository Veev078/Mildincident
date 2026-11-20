import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {canonical,sha256,sourceFingerprint} from '../src/package.js';
import {NativeBufferConnection,BUFFER_CHANNEL_ID,nativePostDigest,readNativeBufferPolicy} from '../src/workspace/native-buffer-connection.js';
import {nativePostTransferPacket} from '../src/workspace/native-post-transfer.js';
import {nativePreparationReadiness} from '../src/workspace/native-post-readiness.js';
import {validateNativePackageStart,prepareStudioPackagePreparation,prepareStudioPackageGateway} from '../src/n8n/studio-package-preparation.js';
import {publishingGraphSha} from '../src/n8n/buffer-handoff-security.js';
import {PUBLISHING_TABLES as T} from '../src/n8n/buffer-release-patch.js';
import {ApprovalRequests} from '../src/workspace/approval-requests.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {buildWorkspace} from '../src/workspace/model.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';
import {fixture} from './helpers/fixtures.js';

async function initialPost(t){
 const f=await fixture(t),research=new LocalResearchStore(path.join(f.root,'research.sqlite'));t.after(()=>research.close());
 const snapshot=workspaceSnapshot();snapshot.records.imports=[];snapshot.records.packages=[];
 const story=buildWorkspace(snapshot).stories[0];story.origin='n8n_production';story.caption='A factual caption prepared for three source-backed photographs.';story.selectedAssetIds=story.media.map(m=>m.id);
 story.media.forEach(m=>m.fileUrl='https://example.org/'+m.id+'.jpg');
 const approvals=new ApprovalRequests(research),prepared=approvals.prepare(story,{sourceRevision:story.revision,workingVersion:0,idempotencyKey:randomUUID(),confirm:'prepare_review_only'});
 return {...f,story,approval:approvals.get(prepared.id)};
}

test('an approved canonical story can prepare its first exact package; pending or ambiguous concepts cannot',async t=>{
 const f=await initialPost(t),packet=await nativePostTransferPacket(f),c={id:21,updatedAt:'2026-11-20T10:00:00Z',concept_id:f.story.id,...packet.expected.storyState},media=packet.images.map(i=>({concept_id:f.story.id,asset_id:i.assetId,file_url:i.imageUrl,source_page_url:i.sourceUrl,creator:i.creator}));
 assert.equal(packet.expected.packageVersion,null);assert.equal(nativePreparationReadiness(f.story).required,true);
 const context={story:c,packages:[],media,manual:[],guarded:[]};assert.equal(validateNativePackageStart(packet,context).storyRowId,21);
 for(const change of [x=>x.story.approval_status='unreviewed',x=>x.story.title='Changed since review',x=>x.story.stage='published',x=>x.packages.push({id:99}),x=>x.manual.push({concept_id:c.concept_id,state:'unknown'}),x=>x.story.updatedAt=null]){const ctx=structuredClone(context);change(ctx);assert.throws(()=>validateNativePackageStart(packet,ctx));}
 for(const change of [s=>s.approvalStatus='unreviewed',s=>s.origin='n8n_development',s=>s.production.relationship='ambiguous',s=>s.localDraft={stale:true}]){const s=structuredClone(f.story);change(s);await assert.rejects(nativePostTransferPacket({...f,story:s}),{code:'NATIVE_POST_NOT_LINKED'});}
 const invalid=structuredClone(packet);invalid.images[0].rights_status='reviewed_cleared';assert.throws(()=>validateNativePackageStart(invalid,context));
});

function installedProduction(){
 const node=(name,parameters={})=>({id:name,name,type:'n8n-nodes-base.code',typeVersion:2,position:[1,2],parameters,retryOnFail:false});
 const w={id:'YdW8V9Qxl2qn5mC8',versionId:randomUUID(),name:'Existing production fixture',settings:{availableInMCP:true},nodeGroups:[{id:'existing-group',nodes:['existing']}],nodes:[
 node('Read Studio Review Package',{filters:{conditions:[{keyName:'concept_id',condition:'eq',keyValue:'fixed'}]}}),node('Read Studio Review Story'),node('Read Studio Review Media'),node('Read Studio Review Guarded Handoffs'),
 node('Build Studio Native Package Digest',{jsCode:"const p=$('Read Studio Review Package').all();return p;"}),
 node('Validate Exact Studio Editorial Transfer',{jsCode:"const ps=read('Read Studio Review Package'),prior=ps[0];const plan=validateNativePostTransfer(packet,{story:c[0],packages:ps,packageDigest:$input.first().json.actual_package_digest});return [{json:plan}];"}),
 node('Studio Planner Package',{jsCode:"return $('Read Studio Review Package').all();"}),
 node('Assemble Production Package Draft',{jsCode:"const f=$('Normalize Production Draft Start').first().json,c=$('Get Concept for Production Package').first().json,media=$('Get Media for Production Package').all();return [{json:{concept_id:c.concept_id,package_id:'PKG-'+c.concept_id,production_version:1,final_approval_status:'pending',source_claims_reviewed:false,final_assets_verified:false}}];"}),
 node('Save New Draft Package',{columns:{mappingMode:'defineBelow',value:{package_id:'={{ $json.package_id }}',concept_id:'={{ $json.concept_id }}'}}}),
 node('Guard New Production Package'),node('Log Production Draft Revision'),node('Get Concept for Production Package'),
 node('Reopen Studio Story For Exact Review',{filters:{conditions:[{keyName:'updatedAt',condition:'eq',keyValue:'original'}]}}),
 {...node('Unrelated verified renderer'),credentials:{googleDriveOAuth2Api:{id:'existing-fixture-binding',name:'Existing fixture'}}},
 ],connections:{'Read Studio Review Guarded Handoffs':{main:[[{node:'Build Studio Native Package Digest',type:'main',index:0}]]},'Guard New Production Package':{main:[[{node:'Save New Draft Package',type:'main',index:0}]]},'Save New Draft Package':{main:[[{node:'Log Production Draft Revision',type:'main',index:0}]]}}};return w;
}

test('initial preparation patch preserves the existing assembler, credentials and groups and uses an exact conditional reservation',()=>{
 const w=installedProduction(),before=canonical(w),patch=prepareStudioPackagePreparation(w,{expectedVersion:w.versionId,expectedSha256:publishingGraphSha(w)}),get=name=>patch.update.nodes.find(n=>n.name===name);
 assert.equal(canonical(w),before);assert.deepEqual(patch.update.nodeGroups,w.nodeGroups);assert.deepEqual(get('Unrelated verified renderer'),w.nodes.at(-1));assert.deepEqual(get('Assemble Production Package Draft'),w.nodes.find(n=>n.name==='Assemble Production Package Draft'));
 assert.deepEqual(get('Reserve Initial Studio Package').parameters.filters.conditions.map(c=>c.keyName),['id','updatedAt','stage']);assert.equal(get('Reserve Initial Studio Package').parameters.columns.value.stage,'studio_package_preparing');
 const reads={'Read Studio Review Story':[{json:{concept_id:'CON-UNFAMILIAR-01',review_token:'fixture-token',approval_status:'concept_approved'}}],'Read Studio Review Media':[]};
 const result=vm.runInNewContext('(function(){'+get('Assemble Initial Studio Package').parameters.jsCode+'})()',{$:name=>({first:()=>reads[name][0],all:()=>reads[name]}),$input:{first:()=>({json:{}})}});
 assert.equal(result[0].json.final_approval_status,'pending');assert.equal(result[0].json.source_claims_reviewed,false);assert.equal(result[0].json.final_assets_verified,false);
 for(const n of patch.update.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new Function(n.parameters.jsCode));
 assert.throws(()=>prepareStudioPackagePreparation(w,{expectedVersion:w.versionId,expectedSha256:'0'.repeat(64)}));
});

test('gateway permits absent package only on a founder-confirmed initial review, never sends or final approvals',()=>{
 const original="if(!Number.isInteger(r.packageVersion)||r.packageVersion<1)throw Error('DENIED');return [{json:r}];",w={id:'v5ThKs5ZYP3RhZop',versionId:randomUUID(),name:'Existing coordinator',settings:{},nodes:[{name:'Read Authenticated Studio Publishing Envelope',parameters:{jsCode:original}}],connections:{}},p=prepareStudioPackageGateway(w,{expectedVersion:w.versionId,expectedSha256:publishingGraphSha(w)}),code=p.update.nodes[0].parameters.jsCode;
 for(const action of ['send','approve','file','connection'])assert.throws(()=>vm.runInNewContext('(function(){'+code+'})()',{r:{action,packageVersion:null}}));
 assert.equal(vm.runInNewContext('(function(){'+code+'})()',{r:{action:'review',packageVersion:null,packet:{expected:{packageVersion:null}},confirm:'submit_exact_post_for_native_review'}})[0].json.action,'review');
 assert.throws(()=>vm.runInNewContext('(function(){'+code+'})()',{r:{action:'review',packageVersion:null,packet:{expected:{packageVersion:null}}}}));
});

test('Studio and an already-read legacy form compete for one shared initial-package reservation; legacy output and stage survive',()=>{
 const w=installedProduction(),patch=prepareStudioPackagePreparation(w,{expectedVersion:w.versionId,expectedSha256:publishingGraphSha(w)}),get=name=>patch.update.nodes.find(n=>n.name===name),db=new DatabaseSync(':memory:');
 const original={id:21,concept_id:'CON-UNFAMILIAR-01',updatedAt:'original',stage:'approved_for_sourcing',approval_status:'concept_approved'},assembled={concept_id:original.concept_id,draft_action:'create',production_version:1,final_approval_status:'pending',caption_draft:'Original legacy caption',designer_notes:'Original notes'};
 const run=(name,map,input=[])=>vm.runInNewContext('(function(){'+get(name).parameters.jsCode+'})()',{$:n=>({isExecuted:Object.hasOwn(map,n),first:()=>map[n]?.[0],all:()=>map[n]||[]}),$input:{first:()=>input[0],all:()=>input}});
 db.exec('CREATE TABLE story(id INTEGER PRIMARY KEY,updatedAt TEXT,stage TEXT)');
 try{for(const first of ['studio','legacy']){
  db.prepare('INSERT OR REPLACE INTO story VALUES(?,?,?)').run(original.id,original.updatedAt,original.stage);
  const contexts={studio:{'Validate Studio Package Start':[{json:{}}],'Read Studio Review Story':[{json:original}]},legacy:{'Guard New Production Package':[{json:{}}],'Get Concept for Production Package':[{json:original}],'Assemble Production Package Draft':[{json:assembled}]}};
  let winner=0;
  for(const route of [first,first==='studio'?'legacy':'studio']){
   const map=contexts[route],scope=run('Build Shared Initial Package Reservation',map)[0].json;map['Build Shared Initial Package Reservation']=[{json:scope}];
   const reserved=db.prepare('UPDATE story SET stage=?,updatedAt=? WHERE id=? AND updatedAt=? AND stage=? RETURNING *').all('studio_package_preparing','claimed-'+route,scope.storyRowId,scope.storyUpdatedAt,scope.storyStage).map(row=>({json:{...original,...row}}));map['Reserve Initial Studio Package']=reserved;
   const current=db.prepare('SELECT * FROM story').get(),input=[{json:{...original,...current}}];
   if(reserved.length){assert.doesNotThrow(()=>run('Verify Initial Studio Package Reservation',map,input));winner++;}
   else assert.throws(()=>run('Verify Initial Studio Package Reservation',map,input),/NOT_RESERVED/);
   if(reserved.length&&route==='legacy'){
    assert.equal(canonical(run('Restore Legacy Initial Package Payload',map)),canonical([{json:assembled}]));map['Save New Draft Package']=[{json:{...assembled,id:50}}];map['Restore Legacy Initial Story Stage']=[{json:original}];
    assert.equal(canonical(run('Verify Legacy Initial Story Restoration',map,[{json:original}])),canonical(map['Save New Draft Package']));
   }
  }
  assert.equal(winner,1);
 }
 assert.equal(patch.update.connections['Guard New Production Package'].main[0][0].node,'Build Shared Initial Package Reservation');assert.equal(patch.update.connections['Validate Studio Package Start'].main[0][0].node,'Build Shared Initial Package Reservation');
 }finally{db.close();}
});

async function connectionFixture(t){
 const f=await fixture(t),s=workspaceSnapshot(),id=s.records.stories[0].concept_id,reviewed='2026-11-20T10:00:00Z',evidence='evidence: https://example.org/permitted-use';s.records.imports=[];s.records.guardedHandoffs=[];s.observedAt=new Date().toISOString();
 const p=s.records.packages[0];Object.assign(p,{id:11,format:'carousel',production_version:2,editorial_handoff_version:2,caption_draft:'A finished caption with reviewed facts and attributed photographs.',final_caption:'A finished caption with reviewed facts and attributed photographs.',final_approval_status:'approved',source_claims_reviewed:true,rights_review_status:'reviewed',final_assets_verified:true,render_batch_id:'BATCH-FIXTURE'});
 s.records.media.forEach((m,i)=>Object.assign(m,{file_url:'https://example.org/photo-'+i+'.jpg',attribution_text:'Fixture photographer',rights_status:'reviewed_cleared',notes:'HUMAN IMAGE REVIEW | '+evidence,license:'Fixture test permission'}));
 s.records.files=s.records.media.slice(0,2).map((m,i)=>({concept_id:id,package_id:p.package_id,package_version:2,render_batch_id:p.render_batch_id,file_record_id:'file-'+i,source_asset_id:m.asset_id,slide_number:i+1,source_url:m.source_page_url,source_credit:m.attribution_text,checksum_sha256:f.manifest.slides[i].sha256,rights_snapshot:JSON.stringify({rights_evidence:evidence}),rights_evidence_status:'human_cleared',storage_verified:true,storage_status:'verified_private',render_quality_status:'passed',mime_type:'image/jpeg',pixel_width:1080,pixel_height:1350}));
 s.records.finalReviews=[{concept_id:id,decision:'Approve',validation_status:'validated_applied',raw_submission_redacted:JSON.stringify({concept_id:id,production_version:2,render_batch_id:p.render_batch_id,founder_confirmed_assets:true,validatedAppliedAt:reviewed})}];
 const ids=['BzMqQS8lfkwN7peQ','Q02tRHMtZ90Kib18','YdW8V9Qxl2qn5mC8','f0LkxPxzvqh3zyUQ','rhZU4CyF5t0kYMzz','v5ThKs5ZYP3RhZop'],workflows=ids.map(id=>({id,name:'Native test fixture '+id,versionId:randomUUID(),nodes:[],connections:{},settings:{},active:true}));for(const w of workflows)w.activeVersionId=w.versionId;
 const policy={version:2,id:randomUUID(),enabled:true,approved:true,target:'unscheduled_draft',founderConfirmationRequired:true,channelId:BUFFER_CHANNEL_ID,jwtSecret:'a'.repeat(64),graphs:workflows.map(w=>({id:w.id,version:w.versionId,sha256:publishingGraphSha(w)})),operations:{nativeReview:true,finalApproval:true,bufferDraft:true},claimProof:{verified:true,graphSha256:publishingGraphSha(workflows[1])},providerProof:{verified:true,channelId:BUFFER_CHANNEL_ID},draftOnlyContractReviewed:true};
 const tables={[T.stories]:s.records.stories,[T.packages]:s.records.packages,[T.media]:s.records.media,[T.files]:s.records.files,[T.manual]:[],[T.guarded]:[],[T.staging]:[],Jiows2tODEIIOFa3:s.records.finalReviews};let calls=0;
 const read=async url=>{if(url.startsWith('/api/v1/workflows/'))return workflows.find(w=>url.endsWith(w.id));const table=url.match(/data-tables\/([^/]+)\/rows/)?.[1];return {data:tables[table]||[],nextCursor:null};};
 const connection=new NativeBufferConnection({loadPolicy:async()=>structuredClone(policy),read,source:{snapshot:s},drafts:{all:()=>new Map()},fetchImpl:async(_url,options)=>{calls++;const b=JSON.parse(options.body);return new Response(JSON.stringify({state:'native_accepted',requestId:b.requestId,executionId:'900001'}),{status:202});}});
 await connection.inspect();const story=buildWorkspace(s).stories[0],files=s.records.files;
 const manifest={schemaVersion:1,storyId:id,packageVersion:2,sourceRevision:story.revision,channelId:BUFFER_CHANNEL_ID,caption:p.final_caption,slides:files.map(file=>({assetId:file.source_asset_id,file:file.checksum_sha256+'.original',sha256:file.checksum_sha256,source:{url:file.source_url,creator:'Photographer'},rights:{status:'cleared',evidence:['https://example.org/permitted-use'],reviewedBy:'Founder (applied native final post review)',reviewedAt:reviewed,credit:'Fixture photographer'}}))};
 return {...f,connection,policy,story,manifest,s,calls:()=>calls,request:{idempotencyKey:randomUUID(),channelId:BUFFER_CHANNEL_ID,caption:p.final_caption,assets:files.map(file=>({assetId:file.source_asset_id,sha256:file.checksum_sha256}))}};
}

test('recurring policy requires each exact immutable approval, final rights/files and explicit reviewed send; bare adapter stays blocked',async t=>{
 const f=await connectionFixture(t);assert.equal(f.connection.canCreateDraft(f.story),true);assert.equal(f.connection.canCreateDraft({...f.story,id:'CON-ANOTHER-01'}),true);
 await assert.rejects(f.connection.adapter.createUnscheduledDraft(f.request),{code:'BUFFER_DRAFT_NOT_AUTHORIZED'});assert.equal(f.calls(),0);
 const approval={id:randomUUID(),storyId:f.story.id,contentDigest:'d'.repeat(64)},digest=sha256(canonical([approval.id,approval.contentDigest,sourceFingerprint(f.manifest)]));let saved=approval;
 const adapter=f.connection.confirmedDraftAdapter({story:f.story,approval,manifest:f.manifest,reviewDigest:digest,readApproval:()=>saved});
 saved={...approval,contentDigest:'e'.repeat(64)};await assert.rejects(adapter.createUnscheduledDraft(f.request),{code:'BUFFER_DRAFT_NOT_AUTHORIZED'});assert.equal(f.calls(),0);
 saved=approval;const wrong=structuredClone(f.request);wrong.assets.reverse();await assert.rejects(adapter.createUnscheduledDraft(wrong),{code:'EDIT_CONFLICT'});assert.equal(f.calls(),0);
 const receipt=await adapter.createUnscheduledDraft(f.request);assert.equal(receipt.executionId,'900001');assert.equal(f.calls(),1);
 f.s.records.media[0].notes='HUMAN IMAGE REVIEW | evidence: https://example.org/changed';await assert.rejects(adapter.createUnscheduledDraft(f.request),{code:'RIGHTS_EVIDENCE_MISSING'});assert.equal(f.calls(),1);
});

test('version-one single-post acceptance is preserved and recurring policy cannot authorise schedules or inherit an old acceptance',async t=>{
 const f=await connectionFixture(t);Object.assign(f.policy,{version:1,acceptance:{storyId:f.story.id,packageVersion:2,contentDigest:nativePostDigest(f.story),expiresAt:new Date(Date.now()+60000).toISOString()}});await f.connection.inspect({force:true});assert.equal(f.connection.canCreateDraft(f.story),true);assert.equal(f.connection.canCreateDraft({...f.story,id:'CON-ANOTHER-01'}),false);
 const file=path.join(f.root,'policy.json'),load=()=>readNativeBufferPolicy({env:{STUDIO_BUFFER_POLICY_FILE:file},config:{dataRoot:f.root}});const p={version:2,id:randomUUID(),enabled:false,approved:false,target:'unscheduled_draft',founderConfirmationRequired:true};await fs.writeFile(file,JSON.stringify(p),{mode:0o600});assert.equal((await load()).enabled,false);
 for(const edit of [p=>p.target='scheduled',p=>p.founderConfirmationRequired=false,p=>p.acceptance=f.policy.acceptance,p=>p.id=null]){const bad=structuredClone(p);edit(bad);await fs.writeFile(file,JSON.stringify(bad));await assert.rejects(load(),{code:'BUFFER_POLICY_INVALID'});}
});
