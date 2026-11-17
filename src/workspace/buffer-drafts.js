import {canonical,sha256,validateManifest,sourceFingerprint,preparePackage,assertDraftRights} from '../package.js';
import {prepareAndSend,reconcileKnownDraft} from '../handoff.js';
import {prepareProductionPacket} from './production-bridge.js';
import {validatePacketImport} from '../production-packet-contract.js';
import {requireThat} from '../errors.js';

const same=(a,b)=>canonical(a)===canonical(b);
const working=story=>({...story,...(story.localDraft||{})});
const messages={
 POST_IN_TRASH:'Restore this post before sending it.',
 BUFFER_CONNECTION_REVIEW_REQUIRED:'Sending from Studio is not enabled yet. The existing Buffer workflow needs its duplicate-send and delivery checks completed first.',
 FINAL_JPEGS_REQUIRED:'The final, approved JPEG files still need verification in the existing production workflow.',
 EXISTING_HANDOFF_RECONCILIATION_REQUIRED:'Check the earlier Buffer delivery before sending again.',
};

/** Studio orchestration over the existing JPG preparer and durable draft ledger.
 * No production transport, credentials, workflow installation or enable flag is
 * supplied here. A separately reviewed native connection must be injected by
 * the server. Browser requests can never supply an adapter or file locations.
 */
export class StudioBufferDrafts {
 constructor({approvals,ledger=null,connection=null}){this.approvals=approvals;this.ledger=ledger;this.connection=connection;}
 connected(){const c=this.connection;return Boolean(this.ledger&&c?.singleWriterVerified===true&&c.unscheduledDraftVerified===true&&c.channelId&&['readFinalPackage','readCurrentPackage','readExistingHandoffs'].every(k=>typeof c[k]==='function')&&typeof c.adapter?.createUnscheduledDraft==='function'&&typeof c.adapter?.readPost==='function');}
 attempt(story){const attempts=this.ledger?.list().filter(a=>a.story_id===story.id)||[];return attempts.length===1?attempts[0]:null;}
 status(story){
  const packet=prepareProductionPacket(story),check=validatePacketImport(packet,packet),attempt=this.attempt(story),codes=[...check.issues.map(i=>i.code)];
  if((this.ledger?.list().filter(a=>a.story_id===story.id).length||0)>1)codes.unshift('DELIVERY_HISTORY_REVIEW_REQUIRED');
  if(story.organization?.trashed)codes.unshift('POST_IN_TRASH');
  if(!this.connected())codes.unshift('BUFFER_CONNECTION_REVIEW_REQUIRED');
  if(packet.production.package?.finalAssetsVerified!==true)codes.push('FINAL_JPEGS_REQUIRED');
  const ready=codes.length===0&&!attempt,uncertain=attempt&&attempt.state!=='confirmed_draft';
  return {state:attempt?(uncertain?'needs_reconciliation':'confirmed_draft'):ready?'ready':'blocked',ready,canSend:ready,canCheck:Boolean(attempt?.remote_id&&this.connected()),postId:attempt?.remote_id||null,verifiedAt:attempt?.verified_at||null,providerStatus:attempt?.observed_status||null,target:'unscheduled_draft',
   message:attempt?(uncertain?'Delivery needs checking. Do not send again.':`An unscheduled Buffer draft was verified${attempt.verified_at?' on '+attempt.verified_at:''}. Check its current status before taking any further action.`):ready?'Review the final caption and slides, then confirm one unscheduled Buffer draft.':messages[codes[0]]||'Complete the caption, photo permissions and final approval in the existing workflow.',
   blockers:[...new Set(codes)].map(code=>({code,message:messages[code]||check.issues.find(i=>i.code===code)?.message||'Review this requirement in the existing approval workflow.'}))};
 }
 assertContent(story,input){
  requireThat(!story.organization?.trashed,'POST_IN_TRASH',messages.POST_IN_TRASH);
  requireThat(!story.localDraft?.stale&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','The post changed. Save and review the current caption and slides.');
 }
 async finalPackage(story){
  requireThat(this.connected(),'BUFFER_CONNECTION_REVIEW_REQUIRED',messages.BUFFER_CONNECTION_REVIEW_REQUIRED);
  const data=await this.connection.readFinalPackage(story.id),manifest=validateManifest(data?.manifest),w=working(story),pkg=story.production?.package;
  requireThat(manifest.storyId===story.id&&manifest.sourceRevision===story.revision&&manifest.packageVersion===pkg?.version&&manifest.channelId===this.connection.channelId&&manifest.caption===w.caption&&same(manifest.slides.map(s=>s.assetId),w.selectedAssetIds),'STALE_PACKAGE','Final files must match this approved caption and slide order.');
  requireThat(manifest.slides.every(s=>{const a=story.media.find(a=>a.id===s.assetId);return a&&s.source.url===a.sourceUrl&&s.source.creator===a.creator;}),'STALE_PACKAGE','The final files must retain the selected photographs’ source and attribution.');
  return {...data,manifest};
 }
 digest(approval,manifest){return sha256(canonical([approval.id,approval.contentDigest,sourceFingerprint(manifest)]));}
 async review(story,input){
  requireThat(input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','idempotencyKey'].includes(k)),'INVALID_BUFFER_REQUEST','Review one saved post only.');this.assertContent(story,input);
  const approval=this.approvals.prepare(story,{...input,confirm:'prepare_review_only'}),status=this.status(story);
  if(!status.ready)return {approvalRequest:approval,delivery:status};
  const data=await this.finalPackage(story),prepared=await preparePackage(data.manifest,data);assertDraftRights(prepared);
  return {approvalRequest:approval,delivery:{...status,reviewDigest:this.digest(approval,data.manifest),approvalRequestId:approval.id,caption:data.manifest.caption,slides:prepared.slides.map((s,i)=>({position:i+1,assetId:s.assetId,sha256:s.sha256})),destination:'Unscheduled Buffer draft',fileCount:prepared.slides.length}};
 }
 async send(story,input,{readStory}){
  requireThat(input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','approvalRequestId','reviewDigest','confirm'].includes(k))&&input.confirm==='send_unscheduled_buffer_draft','INVALID_BUFFER_REQUEST','Explicitly confirm one unscheduled Buffer draft. Scheduling and publishing are not supported.');
  this.assertContent(story,input);const approval=this.approvals.get(input.approvalRequestId);
  requireThat(approval?.storyId===story.id&&this.approvals.public(approval,story).unchanged,'EDIT_CONFLICT','Review the current caption, photographs and approval evidence again.');
  const status=this.status(story);requireThat(!this.attempt(story), 'RECONCILIATION_REQUIRED','A delivery already exists or may have started. Check its status; do not resend.');
  requireThat(status.ready,'BUFFER_NOT_READY',status.message);
  const data=await this.finalPackage(story);requireThat(input.reviewDigest===this.digest(approval,data.manifest),'EDIT_CONFLICT','The approved final files changed. Review the exact post again.');
  const c=this.connection;
  // The existing core rechecks native identity, file bytes, rights and the
  // all-status handoff audit, then commits intent before one external create.
  await prepareAndSend({...data,ledger:this.ledger,adapter:c.adapter,readExistingHandoffs:scope=>c.readExistingHandoffs(scope),
   readCurrentPackage:async id=>{const latest=await readStory();this.assertContent(latest,input);requireThat(this.approvals.public(approval,latest).unchanged&&this.status(latest).blockers.length===0,'EDIT_CONFLICT','Approval evidence changed while preparing this post.');return c.readCurrentPackage(id);}});
  return this.status(await readStory());
 }
 async check(story,input){
  requireThat(input&&Object.keys(input).length===0,'INVALID_BUFFER_REQUEST','Check the recorded delivery without resending.');
  const attempt=this.attempt(story);requireThat(attempt?.remote_id,'REMOTE_ID_UNKNOWN','No Buffer ID was returned. A read-only check of the existing native ledger and Buffer is required. Do not resend.');
  requireThat(this.connected(),'BUFFER_CONNECTION_REVIEW_REQUIRED',messages.BUFFER_CONNECTION_REVIEW_REQUIRED);
  await reconcileKnownDraft({ledger:this.ledger,key:attempt.scope_key,adapter:this.connection.adapter});return this.status(story);
 }
}
