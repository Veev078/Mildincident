import {randomUUID,createHash} from 'node:crypto';
import {requireThat} from '../errors.js';
import {prepareVisualAssessment,PHOTO_VISION_LIMITS,validateVisualResult} from '../photography/visual-assessment.js';
import {EditorialEngineClient,requestFingerprint} from './editorial-engine-client.js';
import {EditorialEngineService} from './editorial-engine-service.js';
import {OBSERVED_RESEARCH_CONNECTION} from './research-connection.js';

const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const day=time=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
const prompt='Assess the exact retained private photographs for the current story. Return compact visual observations and an advisory cover and sequence. No research, search, caption drafting or rights decisions.';
const disabledPolicy=()=>({state:'disabled',enabled:false,canPrepare:true,canConfirm:false,mode:'founder_confirmed',message:'AI photo review is disabled until its reusable worker and policy extension are separately approved.',hardBillingCap:false});
const limits=Object.freeze({...PHOTO_VISION_LIMITS,minImages:1,maxModelCalls:1,maxResearchCalls:0,maxDraftCalls:0,maxToolCalls:0,format:'compact_v2',model:'gpt-5.4'});

/** A founder-confirmed action on the existing editorial engine and shared ledger.
 * Preparing reads private receipt-bound files. Only confirm can reserve a grant;
 * refresh reads native evidence. A result never changes the working selection. */
export class PhotoVisionPilot {
 constructor({research,photography,engine=null,captionPilot=null,createClient=null,now=()=>Date.now()}){
  this.research=research;this.photography=photography;this.engine=engine;this.captionPilot=captionPilot;this.now=now;
  this.createClient=createClient||(captionPilot?options=>captionPilot.createClient(options):options=>new EditorialEngineClient({...options,apiKey:engine?.client?.apiKey}));
  if(captionPilot)captionPilot.photoVisionPilot=this;
  research.db.exec(`CREATE TABLE IF NOT EXISTS studio_generation_actions(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE NOT NULL,story_id TEXT NOT NULL,created_at TEXT NOT NULL,confirmed_at TEXT,day_key TEXT,data_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS studio_generation_control(id INTEGER PRIMARY KEY CHECK(id=1),disabled INTEGER NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS studio_generation_policy_events(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,event TEXT NOT NULL,data_json TEXT NOT NULL);`);
 }
 policyState(){return this.captionPilot?.photoPolicyState?.()||disabledPolicy();}
 async inspect(){if(this.captionPilot)await this.captionPilot.inspect();return this.policyState();}
 raw(id){const row=this.research.db.prepare('SELECT data_json,confirmed_at FROM studio_generation_actions WHERE id=?').get(id);if(!row)return null;const p=JSON.parse(row.data_json);return p.operation==='photo'?{...p,confirmedAt:row.confirmed_at}:null;}
 binding(){return this.captionPilot?.photoBinding?.()||null;}
 eligibleBatches(story){
  if(!story||story.localDraft?.stale||!this.photography?.previews)return [];
  this.photography.storyTables();const batches=[];
  for(const row of this.research.db.prepare("SELECT request_id FROM photo_story_requests WHERE story_id=? AND state='complete' ORDER BY rowid DESC LIMIT 100").all(story.id)){
   const receipt=this.photography.storyRequest(row.request_id);if(receipt.packet?.payload?.target?.sourceRevision!==story.revision)continue;
   const assets=(story.media||[]).filter(asset=>{const p=this.photography.previews.get(story.id,asset.id),e=p?.sourceInspection;return e?.basis==='photo_request_source_copy'&&e.requestId===receipt.id&&e.inputDigest===receipt.packet.digest&&p.sha256;}).map(asset=>({id:asset.id,title:String(asset.title||asset.sourceCaption||'Saved photograph').slice(0,300),previewSha256:this.photography.previews.get(story.id,asset.id).sha256}));
   if(assets.length)batches.push({photoRequestId:receipt.id,assetIds:assets.map(a=>a.id),assets});
  }return batches;
 }
 validateStory(story,input){requireThat(story&&!story.localDraft?.stale&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','Save and reload the current story before reviewing its photographs.');}
 contextMatches(story,p){return story?.id===p.storyId&&story.revision===p.sourceRevision&&!story.localDraft?.stale&&(story.localDraft?.version||0)===p.workingVersion&&String(story.subject||story.title)===p.packet.manifest.subject&&p.packet.images.every(image=>{
  const preview=this.photography.previews?.get(story.id,image.assetId),e=preview?.sourceInspection;
  return story.media?.some(a=>a.id===image.assetId)&&preview?.sha256===image.sourcePreviewSha256&&preview.originalSha256===image.originalSha256&&e?.requestId===p.photoRequestId&&e.inputDigest===p.packet.manifest.photoInputDigest&&e.pageSha256===image.pageSha256&&e.sourceUrl===image.sourceUrl&&e.imageUrl===image.imageUrl;
 });}
 async packet(story,p){return prepareVisualAssessment({story,request:this.photography.storyRequest(p.photoRequestId),assetIds:p.assetIds,previews:this.photography.previews,jobId:p.id,approvalId:p.packet?.approvalId||p.approvalId,workerId:OBSERVED_RESEARCH_CONNECTION.editorialWorkerId});}
 reviewBinding(p){return sha({packet:{...p.packet,authorization:null},policy:p.reviewPolicy,limits});}
 result(p,job=this.research.engineJob(p.id)){
  const envelope=job?.photoResult;if(!['ready_to_review','approved'].includes(job?.state)||envelope?.purpose!=='private_photo_visual_assessment_result'||envelope.rightsGranted!==false||envelope.publicationApproved!==false||job.requestHash!==p.requestHash||envelope.jobId!==p.id||envelope.executionId!==job.executionId||envelope.manifestSha256!==p.packet.manifestSha256)return null;
  try{return validateVisualResult(envelope.result,p.packet);}catch{return null;}
 }
 proposal(p,story=null){
  if(!p)return null;const job=this.research.engineJob(p.id),result=this.result(p,job),policy=this.policyState(),current=story?this.contextMatches(story,p):true;
  const state=!p.confirmedAt?(Date.parse(p.expiresAt)>this.now()?'prepared':'expired'):result?(current?'completed':'review_required'):['failed','rejected'].includes(job?.state)?'failed':!job||['dispatch_uncertain','queue_uncertain'].includes(job.state)||['ready_to_review','needs_research','approved'].includes(job.state)?'uncertain':job.state==='dispatching'&&!job.executionId?'dispatching':['dispatching','generating'].includes(job.state)?'running':'queued';
  const usage=job?.photoResult?.usage||job?.photoFailure?.usage||null,estimatedUsd=Number.isFinite(usage?.input_tokens)&&Number.isFinite(usage?.output_tokens)?usage.input_tokens*2.5/1e6+usage.output_tokens*15/1e6:null;
  const canConfirm=!p.confirmedAt&&current&&policy.state==='available'&&Date.parse(p.expiresAt)>this.now()&&JSON.stringify(p.reviewPolicy)===JSON.stringify(this.binding());
  return {id:p.id,jobId:p.id,operation:'photo',storyId:p.storyId,photoRequestId:p.photoRequestId,sourceRevision:p.sourceRevision,workingVersion:p.workingVersion,sourceLabel:p.sourceLabel,createdAt:p.createdAt,expiresAt:p.expiresAt,state,canConfirm,reviewSha256:p.reviewSha256,manifestSha256:p.packet.manifestSha256,assetIds:[...p.assetIds],images:p.packet.images.map(i=>({assetId:i.assetId,sourcePreviewSha256:i.sourcePreviewSha256,inputSha256:i.inputSha256,width:i.width,height:i.height})),review:{...p.review},limits:{...limits},modelCalls:p.confirmedAt?null:0,estimatedCost:'Approximately $0.03–$0.08 for one assessment; account pricing and hidden transport retries may differ. This is not a hard cap.',hardBillingCap:false,founderConfirmationRequired:true,permitIssued:Boolean(p.confirmedAt),applyRequired:true,rightsGranted:false,publicationApproved:false,...(job?.executionId?{executionId:job.executionId}:{}),result:result||null,usage,estimatedUsd,message:state==='failed'?(job?.photoFailure?.message||'AI photo review failed. No complete suggestions were accepted; this operation will not run again automatically.'):state==='uncertain'?'This operation needs read-only reconciliation. It will not be resent.':state==='review_required'?'The story or private inputs changed. The saved assessment remains in history; prepare a fresh request.':state==='completed'?'Review the suggested cover and order. Apply separately to change the working selection.':policy.message,...(state==='failed'?{failureCode:job?.photoFailure?.code||job?.lastError||'PHOTO_ASSESSMENT_FAILED'}:{})};
 }
 syncResult(story,p){
  const result=this.result(p);if(!result)return;
  const request=this.photography.storyRequest(p.photoRequestId),saved=request?.visualReviews?.find(r=>r.packet.jobId===p.id),job=this.research.engineJob(p.id);if(!saved)return;
  if(saved.executionId){requireThat(saved.executionId===job.executionId&&JSON.stringify(saved.result)===JSON.stringify(result),'INVALID_VISUAL_RESULT','An earlier saved visual result differs from this execution.');return;}
  Object.assign(saved,{state:this.contextMatches(story,p)?'complete':'review_required',result,usage:job.photoResult.usage||null,executionId:job.executionId,simulation:false,receivedAt:new Date(this.now()).toISOString()});
  this.research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(request),request.id);
 }
 status(story){
  const row=this.research.db.prepare("SELECT id FROM studio_generation_actions WHERE story_id=? AND json_extract(data_json,'$.operation')='photo' ORDER BY rowid DESC LIMIT 1").get(story.id),p=row?this.raw(row.id):null;
  if(p)this.syncResult(story,p);
  return {policy:this.policyState(),canPrepare:true,eligibleBatches:this.eligibleBatches(story),proposal:p?this.proposal(p,story):null};
 }
 async prepare(story,input){
  requireThat(input&&Object.keys(input).every(k=>['assetIds','photoRequestId','sourceRevision','workingVersion','idempotencyKey'].includes(k))&&uuid(input.idempotencyKey)&&uuid(input.photoRequestId)&&Array.isArray(input.assetIds)&&input.assetIds.length>=1&&input.assetIds.length<=6&&input.assetIds.every(id=>typeof id==='string'&&id.length>0)&&new Set(input.assetIds).size===input.assetIds.length,'INVALID_PHOTO_VISION','Choose one to six saved photographs from one completed receipt.');this.validateStory(story,input);
  const matches=p=>p&&p.storyId===story.id&&p.photoRequestId===input.photoRequestId&&p.sourceRevision===input.sourceRevision&&p.workingVersion===input.workingVersion&&JSON.stringify(p.assetIds)===JSON.stringify(input.assetIds);
  const existing=this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE idempotency_key=?').get(input.idempotencyKey);
  if(existing){const p=this.raw(existing.id);requireThat(matches(p),'EDIT_CONFLICT','This request identity belongs to another photo review.');await this.inspect();return this.proposal(p,story);}
  const id=randomUUID(),approvalId=randomUUID(),now=this.now(),p={id,operation:'photo',storyId:story.id,sourceRevision:story.revision,workingVersion:input.workingVersion,photoRequestId:input.photoRequestId,assetIds:[...input.assetIds],sourceLabel:String(story.title||story.subject||'Photographs').slice(0,300),approvalId,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+20*60000).toISOString()};
  const prepared=await this.packet(story,p);p.packet=prepared.packet;p.review=prepared.review;await this.inspect();p.reviewPolicy=this.binding();p.reviewSha256=this.reviewBinding(p);
  this.research.db.exec('BEGIN IMMEDIATE');try{
   this.research.db.prepare('INSERT OR IGNORE INTO studio_generation_actions VALUES(?,?,?,?,NULL,NULL,?)').run(id,input.idempotencyKey,story.id,p.createdAt,JSON.stringify(p));
   const row=this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE idempotency_key=?').get(input.idempotencyKey),saved=this.raw(row.id);requireThat(matches(saved),'EDIT_CONFLICT','This request identity belongs to another photo review.');
   if(saved.id===id){const request=this.photography.storyRequest(input.photoRequestId);request.visualReviews||=[];requireThat(request.visualReviews.length<20,'PHOTO_REVIEW_LIMIT','Review the retained photo assessments before preparing more.');request.visualReviews.push({packet:p.packet,review:p.review,state:'prepared',createdAt:p.createdAt});this.research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(request),request.id);}
   this.research.db.exec('COMMIT');return this.proposal(saved,story);
  }catch(error){this.research.db.exec('ROLLBACK');throw error;}
 }
 assertStart(id){
  const p=this.raw(id),a=p?.packet?.authorization,b=this.binding();
  requireThat(p?.confirmedAt&&this.captionPilot&&this.policyState().enabled&&this.captionPilot.photoWorkerReady&&b&&JSON.stringify(b)===JSON.stringify(p.reviewPolicy)&&p.policyId===this.captionPilot.config.id&&a?.scope==='photo_vision_v1'&&a.id===p.packet.approvalId&&a.jobId===p.id&&a.maxRuns===1&&Date.parse(a.expiresAt)>this.now()&&p.reviewSha256===this.reviewBinding(p),'PHOTO_NOT_AUTHORIZED','Future photo starts are disabled, expired, or differ from the reviewed approval.');
  requireThat(!this.captionPilot.busy(id),'GENERATION_BUSY','Another operation needs completion or reconciliation.');
 }
 async confirm(story,input,{readStory=()=>story}={}){
  requireThat(input&&Object.keys(input).every(k=>['proposalId','sourceRevision','workingVersion','confirm'].includes(k))&&uuid(input.proposalId)&&input.confirm===true,'INVALID_PHOTO_VISION','Explicitly confirm one reviewed photo assessment.');
  let p=this.raw(input.proposalId);requireThat(p?.storyId===story.id&&p.sourceRevision===input.sourceRevision&&p.workingVersion===input.workingVersion,'INVALID_PHOTO_VISION','Open this story’s exact prepared photo review.');if(p.confirmedAt)return this.proposal(p,story);
  const validate=current=>{this.validateStory(current,input);requireThat(this.contextMatches(current,p)&&p.reviewSha256===this.reviewBinding(p),'EDIT_CONFLICT','The reviewed story or private photographs changed. Prepare a fresh request.');};
  const validateNow=()=>{const current=readStory();requireThat(!current?.then,'EDIT_CONFLICT','Use the current synchronous Studio snapshot before starting.');validate(current);};
  validate(story);await this.inspect();requireThat(this.engine?.client&&this.captionPilot&&this.policyState().state==='available','PHOTO_NOT_AUTHORIZED',this.policyState().message);
  const fresh=await readStory();validate(fresh);const rebuilt=await this.packet(fresh,p);requireThat(sha(rebuilt.packet)===sha({...p.packet,authorization:null}),'PHOTO_EVIDENCE_CHANGED','The retained photo bytes or source metadata changed. Prepare a fresh request.');
  await this.inspect();validate(await readStory());
  this.research.db.exec('BEGIN IMMEDIATE');try{
   p=this.raw(p.id);if(p.confirmedAt){this.research.db.exec('COMMIT');return this.proposal(p,story);}
   validateNow();requireThat(this.policyState().state==='available'&&Date.parse(p.expiresAt)>this.now()&&JSON.stringify(p.reviewPolicy)===JSON.stringify(this.binding()),'PHOTO_NOT_AUTHORIZED',this.policyState().message);requireThat(!this.captionPilot.busy(p.id),'GENERATION_BUSY','Another operation needs reconciliation.');
   p.packet.authorization={scope:'photo_vision_v1',id:p.packet.approvalId,jobId:p.id,maxRuns:1,expiresAt:new Date(this.now()+20*60000).toISOString()};p.policyId=this.captionPilot.config.id;
   p.requestHash=requestFingerprint({kind:'brief',prompt,sourceUrl:'',editorialContext:{photoAssessment:p.packet}});
   const time=new Date(this.now()).toISOString();this.research.db.prepare('UPDATE studio_generation_actions SET confirmed_at=?,day_key=?,data_json=? WHERE id=?').run(time,day(time),JSON.stringify(p),p.id);
   this.research.db.prepare('INSERT INTO studio_generation_policy_events(created_at,event,data_json) VALUES(?,?,?)').run(time,'confirmed',JSON.stringify({proposalId:p.id,operation:'photo',policyId:p.policyId,photoPolicyId:p.reviewPolicy.policyId,manifestSha256:p.packet.manifestSha256,reviewSha256:p.reviewSha256}));
   const receipt=this.photography.storyRequest(p.photoRequestId),saved=receipt.visualReviews.find(r=>r.packet.jobId===p.id);saved.packet=p.packet;this.research.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(receipt),receipt.id);
   this.research.db.exec('COMMIT');
  }catch(error){this.research.db.exec('ROLLBACK');throw error;}
  try{
   const request=this.research.create({idempotencyKey:p.id,kind:'brief',prompt,sourceUrl:''},[]),b=this.binding(),client=this.createClient({connection:{...this.captionPilot.config.connection,mode:'standard',generationEnabled:true,approvedWorkerVersion:b.workerVersion,approvedGraphSha256:b.graphSha256,...(b.approvedExecutionGraphSha256?{approvedExecutionGraphSha256:b.approvedExecutionGraphSha256}:{}),executionScope:'photo_vision_policy',photoPolicyId:b.policyId,photoOutputFormat:'compact_v2',authorization:p.packet.authorization,photoAction:{jobId:p.id,approvalId:p.packet.approvalId,manifestSha256:p.packet.manifestSha256,requestHash:p.requestHash}}});
   const actionEngine=new EditorialEngineService({research:this.research,client});actionEngine.captionPilot=this.captionPilot;this.assertStart(p.id);validateNow();
   await actionEngine.queue(request.id,{editorialContext:{photoAssessment:p.packet}});await this.inspect();validateNow();this.assertStart(p.id);
   await actionEngine.start(p.id,this.research.engineJob(p.id).version,{beforeClaim:()=>{this.assertStart(p.id);validateNow();}});
  }catch(error){const job=this.research.engineJob(p.id);if(job?.state==='queued')this.research.recordEngineState(p.id,'dispatch_uncertain',{lastError:error.code||'PHOTO_START_UNCERTAIN'});}
  return this.proposal(this.raw(p.id),story);
 }
 async refresh(story,proposalId,{readStory=()=>story}={}){
  const p=this.raw(proposalId);requireThat(p?.storyId===story.id,'INVALID_PHOTO_VISION','Reconcile this story’s recorded photo operation.');
  if(p.confirmedAt){requireThat(this.engine?.client,'ENGINE_NOT_CONFIGURED','A private read connection is required for reconciliation.');await this.engine.refresh();this.syncResult(await readStory(),p);}else await this.inspect();
  return this.proposal(this.raw(p.id),await readStory());
 }
}
