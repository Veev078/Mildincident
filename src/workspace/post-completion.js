import {finishPhotoEvidence} from './finish-evidence.js';
import {randomUUID} from 'node:crypto';
import {canonical,sha256} from '../package.js';
import {requireThat} from '../errors.js';
import {nativePostDigest} from './native-buffer-connection.js';

// A continuation of the EXISTING native approval and Buffer outbox, not a writer.
// Consent travels in the existing append-only transfer events. No new queue,
// workflow, provider client or retry path is introduced.
export const completionContent=story=>{
 const w={...story,...story.localDraft};
 return sha256(canonical({id:story.id,title:w.title,hook:w.hook,caption:w.caption,format:w.format,selected:w.selectedAssetIds,
  packageVersion:story.production?.package?.version,files:story.production?.finalFiles,
  claims:(story.research||[]).map(c=>({claim:c.claim,url:c.url,source:c.sourceName,type:c.claimType,excerpt:c.capturedTextExcerpt||null})),
  permissions:(w.selectedAssetIds||[]).map(id=>{const a=story.media.find(a=>a.id===id);return {id,source:a?.sourceUrl,creator:a?.creator,credit:a?.attribution||a?.sourceCredit,originalSha256:a?.localPreview?.originalSha256||null,rights:a?.nativeRightsReview};})}));
};
export class PostCompletion {
 constructor({transfers,buffer,connection,readStory,refreshSource=null,now=Date.now}){Object.assign(this,{transfers,buffer,connection,readStory,refreshSource,now});this.locks=new Set();}
 status(story,observedDelivery=null){
  const transfer=this.transfers?.latest(story.id),consent=transfer?.deliveryConsent,delivery=observedDelivery||this.buffer.status(story);
  const available=Boolean(this.transfers&&this.buffer.connected()&&this.connection?.canCreateDraft?.(story)&&story.nativePublishing?.approveAvailable);
  return {available,pending:!!consent&&(['dispatching','running','uncertain'].includes(transfer?.state)||transfer?.state==='native_post_approved'&&consent.expiresAt>this.now())&&!['confirmed_draft','needs_reconciliation','sending'].includes(delivery.state),canResume:!!consent&&consent.expiresAt>this.now()&&consent.digest===completionContent(story),delivery};
 }
 // One founder action drives the existing transfers and outbox. Checks never dispatch.
 async finish(story,input,{checkOnly=false}={}){
  requireThat(input&&Object.keys(input).every(k=>checkOnly?false:['sourceRevision','workingVersion','idempotencyKey'].includes(k)),'INVALID_BUFFER_REQUEST','Finish only the saved caption and slides.');
  if(!checkOnly){this.buffer.assertContent(story,input);requireThat(/^[a-f0-9-]{36}$/.test(input.idempotencyKey||''),'INVALID_BUFFER_REQUEST','Use one saved Finish Post request.');}
  requireThat(!this.locks.has(story.id),'RECONCILIATION_REQUIRED','This post is already being finished.');this.locks.add(story.id);
  const blocked=issue=>({state:'needs_attention',pending:false,issue});
  try{
   if(this.buffer.attempt(story))return {state:'delivery',pending:false,delivery:await this.buffer.check(story,{})};
   // An existing native/provider handoff is never a new-send opportunity.
   if(story.production?.handoffs?.some(h=>h.state!=='abandoned')||story.production?.provider?.length)return blocked({code:'EXISTING_DELIVERY',message:'This post already has a delivery record. Check that delivery before doing anything else.',action:'delivery'});
   await this.connection?.inspect?.({force:true});
   if(!checkOnly&&this.refreshSource){await this.refreshSource();story=await this.readStory(story.id);this.buffer.assertContent(story,input);}
   if(story.production?.handoffs?.some(h=>h.state!=='abandoned')||story.production?.provider?.length)return blocked({code:'EXISTING_DELIVERY',message:'An earlier delivery is now recorded. Check it before any new preparation or send.',action:'delivery'});
   if(story.localDraft?.stale)return blocked({code:'EDIT_CONFLICT',message:'The source changed. Your writing and earlier versions are saved. Compare them before continuing.',action:'edit_caption'});
   let prior=this.transfers?.latest(story.id);
   if(prior?.deliveryConsent&&(['dispatching','running','uncertain'].includes(prior.state)||prior.deliveryConsent.expiresAt>this.now()&&prior.deliveryConsent.digest===completionContent(story)))return {state:'confirmed',pending:false,message:'Your final confirmation is recorded. Continue its existing delivery.',resumeDelivery:true};
   if(['dispatching','running','uncertain'].includes(prior?.state)){
    try{const r=await this.transfers.reconcile(story);if(r.state==='running')return {state:'preparing',pending:true,message:'Checking the existing preparation. No new request is being sent.'};}
    catch{return blocked({code:'PREPARATION_UNCERTAIN',message:'The existing preparation has not been confirmed. It is preserved and will not be submitted again.',action:'check'});}
    story=await this.readStory(story.id);prior=this.transfers.latest(story.id);
   }
   const w={...story,...story.localDraft},ids=w.selectedAssetIds||[];
   if(!w.caption?.trim())return blocked({code:'CAPTION_REQUIRED',message:'Add the caption before finishing this post.',action:'edit_caption'});
   if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>story.media.filter(a=>a.id===id).length!==1))return blocked({code:'PHOTOS_REQUIRED',message:'Choose an unambiguous photograph sequence before finishing.',action:'replace_photo'});
   if(ids.length!==(w.format==='single_image'?1:w.targetSlideCount))return blocked({code:'SLIDE_COUNT',message:'The selected slides do not match the intended post length. Adjust the sequence or post length.',action:'replace_photo'});
   const current=!story.localDraft?.stale&&w.caption===story.caption&&canonical(ids)===canonical(story.selectedAssetIds)&&['title','hook','format','targetSlideCount'].every(k=>w[k]===story[k]);
   const saved=current&&story.production?.package&&(prior?.packageVersion===story.production.package.version&&['native_review_saved','native_post_approved'].includes(prior.state)||story.production.package.finalAssetsVerified);
   if(!saved){
    if(checkOnly)return blocked({code:'FINISH_REQUIRED',message:'Your saved post needs preparation. Finish Post will prepare this version.',action:'finish'});
    if(!this.transfers||!this.connection?.status?.(story).reviewAvailable)return blocked({code:'PREPARATION_DISABLED',message:this.connection?.status?.(story).preparationReason||'Private preparation is not enabled. Your post is saved; an authorized connection is needed to continue.',action:'connection'});
    const prepared=this.transfers.approvals.prepare(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:input.idempotencyKey,confirm:'prepare_review_only'});
    try{await this.transfers.submit(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,approvalRequestId:prepared.id,confirm:'submit_exact_post_for_native_review'});}catch(error){if(['SOURCE_FILE_REQUIRED','SOURCE_FILE_CHANGED','FOREIGN_ASSET'].includes(error.code))return blocked({code:error.code,message:error.message,action:'replace_photo'});throw error;}
    return {state:'preparing',pending:true,message:'Saving the exact caption and slide order and preparing the private files.'};
   }
   const evidence=await finishPhotoEvidence(story,this.transfers?.previews);if(evidence.issues.length)return blocked(evidence.issues[0]);
   if(!story.production?.package?.finalAssetsVerified||!story.production?.finalFiles?.length)return blocked({code:'FINAL_FILES_REQUIRED',message:'The caption and order are saved, but finished JPEGs are not available. The private preparation connection does not render slides; the existing native rendering path must be enabled separately.',action:'connection'});
   try{await this.connection.preparePreview(story);}catch{return blocked({code:'FINAL_FILE_VERIFICATION',message:'A finished slide could not be decoded or did not match its saved hash. Nothing will be sent; the native file needs recovery before continuing.',action:'connection'});}story=await this.readStory(story.id);
   if(!this.buffer.connected()||!this.connection.canCreateDraft(story))return blocked({code:'DELIVERY_DISABLED',message:'Your private post is prepared. Buffer draft delivery needs separately authorized activation before final confirmation can send it.',action:'connection'});
   const r=await this.review(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:checkOnly?randomUUID():input.idempotencyKey});
   if(!r.delivery.ready)return blocked({code:'DELIVERY_NOT_READY',message:r.delivery.message,action:'delivery'});
   return {state:'ready',pending:false,delivery:r.delivery,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0};
  }finally{this.locks.delete(story.id);}
 }
 async review(story,input){
  this.buffer.assertContent(story,input);
  if(story.production?.package?.finalApprovalStatus==='approved')return this.buffer.review(story,input);
  requireThat(this.status(story).available,'POST_NOT_READY','Finish photo permissions and verified final slides before the final review. Sending must be separately enabled.');
  requireThat(!this.buffer.attempt(story),'RECONCILIATION_REQUIRED','Check the existing delivery; do not send again.');
  return {delivery:{ready:true,completion:true,completionDigest:completionContent(story),finalPostDigest:nativePostDigest(story),fileCount:story.production.finalFiles.length}};
 }
 async confirm(story,input){
  requireThat(input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','idempotencyKey','completionDigest','finalPostDigest','confirm'].includes(k))&&input.confirm==='approve_and_send_unscheduled_draft','FINAL_REVIEW_REQUIRED','Confirm the facts, credits and exact finished post for one unscheduled Buffer draft.');
  this.buffer.assertContent(story,input);
  const evidence=await finishPhotoEvidence(story,this.transfers?.previews);requireThat(!evidence.issues.length,'POST_NOT_READY',evidence.issues[0]?.message||'Verify the original photographs before sending.');
  requireThat(!this.locks.has(story.id),'RECONCILIATION_REQUIRED','This post is already being prepared.');this.locks.add(story.id);
  try{
   const prior=this.transfers.latest(story.id);if(prior?.deliveryConsent&&(prior.deliveryConsent.digest===input.completionDigest&&prior.deliveryConsent.expiresAt>this.now()||['dispatching','running','uncertain'].includes(prior.state)))return {pending:true,message:'This confirmation is already recorded. Continue its existing delivery without confirming again.'};
   requireThat(this.status(story).available&&input.completionDigest===completionContent(story)&&input.finalPostDigest===nativePostDigest(story),'EDIT_CONFLICT','The final post or publishing authorization changed. Review it again.');
   const consent={digest:input.completionDigest,expiresAt:this.now()+10*60*1000,target:'unscheduled_draft'};
   await this.transfers.approve(story,{sourceRevision:input.sourceRevision,workingVersion:input.workingVersion,idempotencyKey:input.idempotencyKey,finalPostDigest:input.finalPostDigest,confirm:'approve_exact_native_post',factsReviewed:true,slidesReviewed:true},{deliveryConsent:consent});
   return {pending:true,message:'Approving this exact post, then sending one Buffer draft.'};
  }finally{this.locks.delete(story.id);}
 }
 async advance(story){
  requireThat(!this.locks.has(story.id),'RECONCILIATION_REQUIRED','The existing delivery is being checked.');this.locks.add(story.id);
  try{
   // Once a send has any durable intent, ALL subsequent calls are read-only.
   if(this.buffer.attempt(story)){const delivery=await this.buffer.check(story,{});return {pending:delivery.state==='sending',delivery};}
   let transfer=this.transfers.latest(story.id);const consent=transfer?.deliveryConsent;
   requireThat(consent?.target==='unscheduled_draft'&&consent.expiresAt>this.now(),'FINAL_REVIEW_REQUIRED','This final confirmation expired. Nothing will be sent automatically.');
   requireThat(consent.digest===completionContent(story),'EDIT_CONFLICT','The approved caption, order, files or permissions changed. Nothing will be sent.');
   if(['uncertain','dispatching','running'].includes(transfer.state)){
    const operation=await this.transfers.reconcile(story);
    if(operation.state==='running')return {pending:true,message:'Still checking the existing approval.'};
    transfer=this.transfers.latest(story.id);
   }
   requireThat(transfer.state==='native_post_approved','FINAL_REVIEW_REQUIRED','Final native approval was not verified.');
   story=await this.readStory(story.id);
   requireThat(consent.digest===completionContent(story)&&story.production.package.finalApprovalStatus==='approved','EDIT_CONFLICT','The native approved post differs from the confirmed preview.');
   const evidence=await finishPhotoEvidence(story,this.transfers?.previews);requireThat(!evidence.issues.length,'POST_NOT_READY',evidence.issues[0]?.message||'The original photographs changed.');
   requireThat(this.connection.canCreateDraft(story),'BUFFER_DRAFT_NOT_AUTHORIZED','Sending is no longer authorized. Your confirmation is preserved.');
   const review=await this.buffer.review(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:randomUUID()});
   requireThat(review.delivery.ready,'BUFFER_NOT_READY',review.delivery.message);
   const delivery=await this.buffer.send(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,approvalRequestId:review.approvalRequest.id,reviewDigest:review.delivery.reviewDigest,confirm:'send_unscheduled_buffer_draft'},{readStory:()=>this.readStory(story.id)});
   return {pending:delivery.state==='sending',delivery};
  }finally{this.locks.delete(story.id);}
 }
}
