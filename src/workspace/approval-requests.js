import {createHash} from 'node:crypto';
import {canonical} from '../package.js';
import {requireThat} from '../errors.js';
import {prepareProductionPacket} from './production-bridge.js';
import {validatePacketImport} from '../production-packet-contract.js';

/** A durable request for the EXISTING native review, never approval or a publishing claim. */
export class ApprovalRequests {
 constructor(research){this.db=research.db;this.db.exec(`CREATE TABLE IF NOT EXISTS studio_approval_requests(id TEXT PRIMARY KEY,story_id TEXT NOT NULL,content_digest TEXT NOT NULL,packet_json TEXT NOT NULL,binding_json TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(story_id,content_digest));CREATE TABLE IF NOT EXISTS studio_approval_request_aliases(key TEXT PRIMARY KEY,request_id TEXT NOT NULL)`);}
 binding(story,packet=prepareProductionPacket(story)){
  const selected=packet.editorial.orderedMedia;
  return {identity:packet.identity,editorial:packet.editorial,pixels:selected.map(m=>{const asset=story.media.find(a=>a.id===m.assetId);return {assetId:m.assetId,uploadedOriginalSha256:asset?.localPreview?.originalSha256||null,previewSha256:asset?.localPreview?.sha256||null,productionOriginalVerified:false};})};
 }
 digest(binding){return createHash('sha256').update(canonical(binding)).digest('hex');}
 get(id){const r=this.db.prepare('SELECT * FROM studio_approval_requests WHERE id=?').get(id);return r?{id:r.id,storyId:r.story_id,contentDigest:r.content_digest,packet:JSON.parse(r.packet_json),binding:JSON.parse(r.binding_json),createdAt:r.created_at}:null;}
 prepare(story,input){
  requireThat(story&&input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','idempotencyKey','confirm'].includes(k))&&input.confirm==='prepare_review_only'&&/^[a-f0-9-]{36}$/.test(input.idempotencyKey||''),'INVALID_APPROVAL_REQUEST','Prepare one exact private request for native review; publication flags are not accepted.');
  requireThat(!story.localDraft?.stale&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','Save and review the current caption and photograph order first.');
  const packet=prepareProductionPacket(story);requireThat(packet.editorial.caption?.trim()&&packet.editorial.orderedMedia.length>0&&packet.editorial.orderedMedia.every(m=>m.identityConfirmed),'APPROVAL_CONTENT_REQUIRED','Choose an unambiguous photo sequence and a nonempty caption before preparing review.');
  const binding=this.binding(story,packet),contentDigest=this.digest(binding);
  this.db.exec('BEGIN IMMEDIATE');try{
   const alias=this.db.prepare('SELECT request_id FROM studio_approval_request_aliases WHERE key=?').get(input.idempotencyKey),prior=this.get(alias?.request_id||input.idempotencyKey);requireThat(!prior||prior.storyId===story.id&&prior.contentDigest===contentDigest,'EDIT_CONFLICT','This handoff identity belongs to different content.');
   this.db.prepare('INSERT OR IGNORE INTO studio_approval_requests VALUES(?,?,?,?,?,?)').run(input.idempotencyKey,story.id,contentDigest,JSON.stringify(packet),JSON.stringify(binding),new Date().toISOString());
   const row=this.db.prepare('SELECT id FROM studio_approval_requests WHERE story_id=? AND content_digest=?').get(story.id,contentDigest);this.db.prepare('INSERT OR IGNORE INTO studio_approval_request_aliases VALUES(?,?)').run(input.idempotencyKey,row.id);this.db.exec('COMMIT');return this.public(this.get(row.id),story);
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 public(saved,story){
  if(!saved)return null;const current=prepareProductionPacket(story),unchanged=saved.contentDigest===this.digest(this.binding(story,current)),nativeTarget=Boolean(current.identity.origin==='n8n_production'&&current.identity.packageId&&current.identity.packageRowId);
  const check=validatePacketImport(saved.packet,current);
  return {id:saved.id,storyId:saved.storyId,contentDigest:saved.contentDigest,createdAt:saved.createdAt,state:unchanged?'prepared':'changed',unchanged,nativeTargetAvailable:nativeTarget,nativePreflightAccepted:check.accepted,captionVersion:saved.binding.identity.localVersion||0,photoCount:saved.binding.editorial.orderedMedia.length,blockers:check.issues.map(i=>({code:i.code,message:i.message})),message:!unchanged?'The working content or review evidence differs from this prepared copy. The earlier version is preserved; prepare the current version before a handoff.':!nativeTarget?'Prepared privately. This development story still needs acceptance into the existing native approval process.':'Prepared privately for the existing native approval process. No transfer, approval or Buffer operation has occurred.',productionApplied:false,publicationApproved:false,bufferCreateEnabled:false};
 }
 status(story){const row=this.db.prepare('SELECT id FROM studio_approval_requests WHERE story_id=? ORDER BY rowid DESC LIMIT 1').get(story.id);return row?this.public(this.get(row.id),story):null;}
 download(story,id){const saved=this.get(id);requireThat(saved?.storyId===story.id,'INVALID_APPROVAL_REQUEST','Open the original story’s prepared handoff.');return {schemaVersion:1,kind:'mildincident_native_approval_request',id:saved.id,createdAt:saved.createdAt,contentDigest:saved.contentDigest,binding:saved.binding,packet:saved.packet,currentCheck:this.public(saved,story),scope:'request_native_review_only',productionApplied:false,publicationApproved:false,bufferCreateEnabled:false};}
}
