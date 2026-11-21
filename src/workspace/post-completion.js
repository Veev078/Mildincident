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
 constructor({transfers,buffer,connection,readStory,now=Date.now}){Object.assign(this,{transfers,buffer,connection,readStory,now});this.locks=new Set();}
 status(story,observedDelivery=null){
  const transfer=this.transfers?.latest(story.id),consent=transfer?.deliveryConsent,delivery=observedDelivery||this.buffer.status(story);
  const available=Boolean(this.transfers&&this.buffer.connected()&&this.connection?.canCreateDraft?.(story)&&story.nativePublishing?.approveAvailable);
  return {available,pending:!!consent&&(['dispatching','running','uncertain'].includes(transfer?.state)||transfer?.state==='native_post_approved'&&consent.expiresAt>this.now())&&!['confirmed_draft','needs_reconciliation','sending'].includes(delivery.state),canResume:!!consent&&consent.expiresAt>this.now()&&consent.digest===completionContent(story),delivery};
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
  requireThat(!this.locks.has(story.id),'RECONCILIATION_REQUIRED','This post is already being prepared.');this.locks.add(story.id);
  try{
   const prior=this.transfers.latest(story.id);if(prior?.deliveryConsent&&(prior.deliveryConsent.digest===input.completionDigest||['dispatching','running','uncertain'].includes(prior.state)))return {pending:true,message:'This confirmation is already recorded. Continue its existing delivery without confirming again.'};
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
   if(this.buffer.attempt(story))return {pending:false,delivery:await this.buffer.check(story,{})};
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
   requireThat(this.connection.canCreateDraft(story),'BUFFER_DRAFT_NOT_AUTHORIZED','Sending is no longer authorized. Your confirmation is preserved.');
   const review=await this.buffer.review(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:randomUUID()});
   requireThat(review.delivery.ready,'BUFFER_NOT_READY',review.delivery.message);
   const delivery=await this.buffer.send(story,{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,approvalRequestId:review.approvalRequest.id,reviewDigest:review.delivery.reviewDigest,confirm:'send_unscheduled_buffer_draft'},{readStory:()=>this.readStory(story.id)});
   return {pending:false,delivery};
  }finally{this.locks.delete(story.id);}
 }
}
