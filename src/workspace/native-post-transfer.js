import sharp from 'sharp';
import {canonical,sha256} from '../package.js';
import {requireThat,HandoffError} from '../errors.js';
import {nativePostDigest} from './native-buffer-connection.js';

/** Build only from the saved approval binding, current story and private custody. */
export async function nativePostTransferPacket({story,approval,previews}){
 const p=story.production?.package,w={...story,...(story.localDraft||{})};
 requireThat(!story.organization?.trashed&&!story.localDraft?.stale&&story.origin!=='n8n_development'&&p?.rowId&&p?.id&&p?.version,'NATIVE_POST_NOT_LINKED','This post needs its canonical record in the existing native approval process before transfer.');
 requireThat(approval?.storyId===story.id&&approval.binding.identity.sourceRevision===story.revision&&approval.binding.identity.localVersion===(story.localDraft?.version||null),'EDIT_CONFLICT','Save and prepare this exact post before sending it for native review.');
 requireThat(approval.binding.editorial.caption===w.caption&&canonical(approval.binding.editorial.orderedMedia.map(m=>m.assetId))===canonical(w.selectedAssetIds),'EDIT_CONFLICT','The saved review does not match this caption and slide order.');
 const images=[];
 for(const id of w.selectedAssetIds||[]){
  const a=story.media.find(a=>a.id===id);requireThat(a,'FOREIGN_ASSET','Choose photographs from this post.');
  const image={assetId:id,sourceUrl:a.sourceUrl,imageUrl:a.fileUrl||'',creator:a.creator,credit:a.attribution||a.sourceCredit||'',sourceCaption:a.sourceCaption||a.title||'',width:a.width||0,height:a.height||0,originalSha256:null,previewSha256:null,acquisition:null};
  if(id.startsWith('photo:')){
   requireThat(previews&&a.localPreview,'SOURCE_FILE_REQUIRED','Use an actually saved, source-backed photograph. A reference alone cannot be transferred.');
   const {bytes,preview}=await previews.readOriginal(story.id,id,a.localPreview.sha256),source=preview.sourceInspection;
   requireThat(source?.basis==='photo_request_source_copy'&&source.sourceUrl===a.sourceUrl,'SOURCE_FILE_REQUIRED','This photograph needs its existing source-acquisition evidence.');
   try{const m=await sharp(bytes,{failOn:'warning',limitInputPixels:40_000_000}).metadata();await sharp(bytes,{failOn:'warning',limitInputPixels:40_000_000}).raw().toBuffer();requireThat(m.width===preview.originalWidth&&m.height===preview.originalHeight&&sha256(bytes)===preview.originalSha256,'SOURCE_FILE_CHANGED','The original photograph differs from its saved custody record.');Object.assign(image,{imageUrl:source.imageUrl,width:m.width,height:m.height,originalSha256:preview.originalSha256,previewSha256:preview.sha256,acquisition:Object.fromEntries(['basis','requestId','inputDigest','pageSha256'].map(k=>[k,source[k]]))});}
   catch(error){if(error instanceof HandoffError)throw error;throw new HandoffError('SOURCE_FILE_CHANGED','The original photograph cannot be fully decoded. No native request was made.');}
  }
  images.push(image);
 }
 const packet={version:1,kind:'mildincident_studio_post_review',requestId:approval.id,expected:{storyId:story.id,storyState:{title:story.title,hook:story.hook||'',format:story.format,stage:story.stage,approval_status:story.approvalStatus},packageId:p.id,packageRowId:Number(p.rowId),packageVersion:p.version,packageDigest:p.sourceDigest},post:{caption:w.caption,selectedAssetIds:w.selectedAssetIds,format:w.format,title:w.title,hook:w.hook||'',sourceRevision:story.revision,workingVersion:story.localDraft?.version||0},images};
 return {...packet,contentDigest:sha256(canonical(packet))};
}

/** Existing approval requests gain delivery events, not a second publishing queue. */
export class NativePostTransfers {
 constructor({approvals,research,drafts,previews,connection,refreshSource,readStory}){
  Object.assign(this,{approvals,drafts,previews,connection,refreshSource,readStory});this.db=research.db;
  this.db.exec('CREATE TABLE IF NOT EXISTS studio_approval_transfer_events(id INTEGER PRIMARY KEY,approval_id TEXT NOT NULL,story_id TEXT NOT NULL,state TEXT NOT NULL,data_json TEXT NOT NULL,created_at TEXT NOT NULL)');
 }
 latest(storyId){const r=this.db.prepare('SELECT * FROM studio_approval_transfer_events WHERE story_id=? ORDER BY id DESC LIMIT 1').get(storyId);return r?{approvalId:r.approval_id,state:r.state,...JSON.parse(r.data_json),createdAt:r.created_at}:null;}
 event(approval,story,state,data){this.db.prepare('INSERT INTO studio_approval_transfer_events(approval_id,story_id,state,data_json,created_at) VALUES(?,?,?,?,?)').run(approval.id,story.id,state,JSON.stringify(data),new Date().toISOString());}
 async submit(story,input){
  requireThat(input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','approvalRequestId','confirm'].includes(k))&&input.confirm==='submit_exact_post_for_native_review','INVALID_NATIVE_REVIEW','Confirm sending this exact saved caption and slides to the existing native review. This does not approve or send a Buffer draft.');
  const a=this.approvals.get(input.approvalRequestId);requireThat(a?.storyId===story.id&&this.approvals.public(a,story).unchanged&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','The post changed. Review its current saved version.');
  requireThat(this.connection?.reviewAvailable===true,'NATIVE_REVIEW_DISABLED','The native review connection is not enabled.');
  const packet=await nativePostTransferPacket({story,approval:a,previews:this.previews});
  this.db.exec('BEGIN IMMEDIATE');try{const prior=this.latest(story.id);requireThat(!prior||!['dispatching','running','uncertain'].includes(prior.state),'RECONCILIATION_REQUIRED','A native review transfer is unresolved. Check its existing request; do not submit again.');requireThat(!prior||prior.contentDigest!==packet.contentDigest,'NATIVE_REVIEW_ALREADY_SENT','This exact post was already transferred. Check its current native review.');this.event(a,story,'dispatching',{contentDigest:packet.contentDigest,sourceRevision:story.revision,workingVersion:input.workingVersion});this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}
  let receipt;try{receipt=await this.connection.submitReview(packet);if(receipt.state==='native_accepted'){requireThat(receipt.requestId===a.id&&/^\d+$/.test(String(receipt.executionId||'')),'NATIVE_REVIEW_UNCERTAIN','The native acceptance did not match this request.');const data={contentDigest:packet.contentDigest,sourceRevision:story.revision,workingVersion:input.workingVersion,executionId:String(receipt.executionId)};this.event(a,story,'dispatching',data);return {state:'dispatching',...data};}return await this.accept(story,a,packet,receipt);}
  catch(error){this.event(a,story,'uncertain',{contentDigest:packet.contentDigest,sourceRevision:story.revision,workingVersion:input.workingVersion,executionId:/^\d+$/.test(receipt?.executionId||'')?receipt.executionId:null});throw new HandoffError('NATIVE_REVIEW_UNCERTAIN','Native review delivery was not confirmed. The request is retained; check it without resubmitting.');}
 }
 async accept(before,approval,packet,receipt){
  const approving=packet.phase==='approve';
  requireThat(receipt?.requestId===packet.requestId&&receipt.contentDigest===packet.contentDigest&&receipt.storyId===before.id&&Number.isInteger(receipt.packageVersion)&&receipt.packageVersion>=packet.expected.packageVersion&&(approving?receipt.state==='native_post_approved':['native_review_saved','unchanged'].includes(receipt.state)),'NATIVE_REVIEW_UNCERTAIN','The native receipt does not confirm this exact post.');
  await this.refreshSource();const current=this.readStory(before.id),post=packet.post;
  requireThat(current&&current.production?.package?.version===receipt.packageVersion&&current.caption===post.caption&&canonical(current.selectedAssetIds)===canonical(post.selectedAssetIds)&&current.format===post.format,'NATIVE_REVIEW_UNCERTAIN','The independently refreshed native copy does not match the submitted caption and slides.');
  if(approving)requireThat(current.production.package.finalApprovalStatus==='approved'&&current.production.package.sourceClaimsReviewed===true,'NATIVE_REVIEW_UNCERTAIN','Native final approval was not independently confirmed.');
  const local=this.drafts.get(before.id);requireThat((local?.version||0)===post.workingVersion&&(!local||local.baseRevision===before.revision),'EDIT_CONFLICT','Writing changed while native review was saved. Both versions are preserved; compare before continuing.');
  if(local&&current.revision!==before.revision)this.drafts.rebase(current,{expectedVersion:local.version,previousRevision:before.revision,currentRevision:current.revision,confirm:'keep_local_after_review'});
  const safe={contentDigest:packet.contentDigest,sourceRevision:before.revision,packageVersion:receipt.packageVersion,executionId:/^\d+$/.test(receipt.executionId||'')?receipt.executionId:null,rightsGranted:false,filesPrepared:current.production.package.finalAssetsVerified===true,nativeFinalApproved:approving,published:false};const state=approving?'native_post_approved':'native_review_saved';this.event(approval,before,state,safe);return {state,...safe};
 }
 async reconcile(story){
  const prior=this.latest(story.id);requireThat(prior&&['uncertain','dispatching','running'].includes(prior.state),'NATIVE_REVIEW_NOT_UNCERTAIN','There is no unresolved native review request.');
  const approval=this.approvals.get(prior.approvalId),original={...story,revision:prior.sourceRevision,localDraft:this.drafts.get(story.id)};
  // Only a read of the recorded request marker; never the submit endpoint.
  const receipt=await this.connection.readReviewReceipt({storyId:story.id,requestId:prior.approvalId,contentDigest:prior.contentDigest,executionId:prior.executionId,createdAt:prior.createdAt,approval:prior.kind==='approve'});
  if(receipt.state==='running')return {state:'running',executionId:prior.executionId};
  const post=approval.packet.editorial,packet={phase:prior.kind==='approve'?'approve':'review',requestId:prior.approvalId,contentDigest:prior.contentDigest,expected:{packageVersion:approval.packet.identity.packageVersion},post:{caption:post.caption,selectedAssetIds:post.orderedMedia.map(m=>m.assetId),format:post.format,workingVersion:prior.workingVersion}};
  return this.accept(original,approval,packet,receipt);
 }
 async approve(story,input){
  requireThat(input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','idempotencyKey','finalPostDigest','confirm','factsReviewed','slidesReviewed'].includes(k))&&input.confirm==='approve_exact_native_post'&&input.factsReviewed===true&&input.slidesReviewed===true,'FINAL_REVIEW_REQUIRED','Explicitly confirm the facts, credits and exact finished slides.');
  requireThat(input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0)&&input.finalPostDigest===nativePostDigest(story),'EDIT_CONFLICT','The final post changed. Preview the current files and caption.');
  requireThat(this.connection?.status(story).approveAvailable===true,'FINAL_REVIEW_REQUIRED','Preview the verified final files and complete native photo permissions first.');
  const prepared=this.approvals.prepare(story,{sourceRevision:story.revision,workingVersion:input.workingVersion,idempotencyKey:input.idempotencyKey,confirm:'prepare_review_only'}),a=this.approvals.get(prepared.id),contentDigest=sha256(canonical([a.contentDigest,input.finalPostDigest]));
  this.db.exec('BEGIN IMMEDIATE');try{const prior=this.latest(story.id);requireThat(!prior||!['dispatching','running','uncertain'].includes(prior.state),'RECONCILIATION_REQUIRED','Check the existing native operation before approving another version.');this.event(a,story,'dispatching',{kind:'approve',contentDigest,sourceRevision:story.revision,workingVersion:input.workingVersion});this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}
  try{const r=await this.connection.approvePost(story,{requestId:a.id,contentDigest,factsReviewed:true,slidesReviewed:true});requireThat(r.state==='native_accepted'&&r.requestId===a.id&&/^\d+$/.test(String(r.executionId||'')),'NATIVE_REVIEW_UNCERTAIN','Approval acceptance was not confirmed.');const data={kind:'approve',contentDigest,sourceRevision:story.revision,workingVersion:input.workingVersion,executionId:String(r.executionId)};this.event(a,story,'dispatching',data);return {state:'dispatching',...data};}
  catch{this.event(a,story,'uncertain',{kind:'approve',contentDigest,sourceRevision:story.revision,workingVersion:input.workingVersion});throw new HandoffError('NATIVE_REVIEW_UNCERTAIN','Native approval was not confirmed. Check the existing operation; do not resubmit.');}
 }
}
