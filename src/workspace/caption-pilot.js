import fs from 'node:fs/promises';import path from 'node:path';import{randomUUID,createHash}from'node:crypto';
import{requireThat}from'../errors.js';import{CAPTION_DIRECTIONS}from'./caption-generation.js';
import{prepareCaptionImprovementPacket,validateCaptionImprovementJob}from'../n8n/caption-improvement-worker.js';
import{EditorialEngineClient,requestFingerprint}from'./editorial-engine-client.js';
import{EditorialEngineService}from'./editorial-engine-service.js';
import{OBSERVED_RESEARCH_CONNECTION}from'./research-connection.js';
import {researchFailureMessage} from './research-failure.js';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const day=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const terminal=new Set(['ready_to_review','needs_research','approved','rejected','failed']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
export const perUsePolicy=c=>c?.version===2&&c.mode==='founder_confirmed';
export function policyApprovalValid(c,now=Date.now()){
 const common=c?.enabled===true&&c.approved===true&&uuid(c.id)&&typeof c.workerVersion==='string'&&c.workerVersion.length>0&&/^[a-f0-9]{64}$/.test(c.graphSha256||'');
 if(!common)return false;
 if(perUsePolicy(c))return c.dailyCaptionLimit===undefined&&c.dailyStoryLimit===undefined&&c.reviewThresholdUsd===undefined&&
  (c.expiresAt===undefined||Date.parse(c.expiresAt)>now)&&c.operations&&Object.keys(c.operations).every(k=>['caption','story'].includes(k))&&
  ['caption','story'].every(k=>typeof c.operations[k]==='boolean')&&(c.operations.caption||c.operations.story);
 return (c.version===undefined||c.version===1)&&c.mode===undefined&&Date.parse(c.expiresAt)>now&&Number.isInteger(c.dailyCaptionLimit)&&c.dailyCaptionLimit>0&&c.dailyCaptionLimit<=6&&Number.isInteger(c.dailyStoryLimit)&&c.dailyStoryLimit>=0&&c.dailyStoryLimit<=3&&c.reviewThresholdUsd===2;
}
const usageEstimate=usage=>Number.isFinite(usage?.inputTokens)&&Number.isFinite(usage?.outputTokens)?usage.inputTokens*2.5/1e6+usage.outputTokens*15/1e6+(usage.models||[]).reduce((n,m)=>n+(Number.isFinite(m.toolCalls)?m.toolCalls*.01:0),0):null;
export async function readCaptionPilotConfig({env,config}){
 if(!env.STUDIO_CAPTION_POLICY_FILE)return {enabled:false};
 const root=await fs.realpath(config.dataRoot),filename=path.resolve(env.STUDIO_CAPTION_POLICY_FILE),stat=await fs.lstat(filename),actual=await fs.realpath(filename);
 requireThat(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.size<16384&&actual.startsWith(root+path.sep)&&!actual.startsWith(path.resolve(config.workspace)+path.sep),'INVALID_CAPTION_POLICY','Keep policy approval and dispatch credentials in a private file outside editorial backups.');
 return JSON.parse(await fs.readFile(actual,'utf8'));
}
export class CaptionPilot{
 constructor({research,engine,loadConfig=async()=>({enabled:false}),createClient=options=>new EditorialEngineClient({...options,apiKey:engine?.client?.apiKey}),now=()=>Date.now()}){
  this.research=research;this.engine=engine;this.loadConfig=loadConfig;this.createClient=createClient;this.now=now;this.config={enabled:false};this.workerReady=false;
  research.db.exec(`CREATE TABLE IF NOT EXISTS studio_generation_actions(id TEXT PRIMARY KEY,idempotency_key TEXT UNIQUE NOT NULL,story_id TEXT NOT NULL,created_at TEXT NOT NULL,confirmed_at TEXT,day_key TEXT,data_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS studio_generation_control(id INTEGER PRIMARY KEY CHECK(id=1),disabled INTEGER NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS studio_generation_policy_events(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,event TEXT NOT NULL,data_json TEXT NOT NULL);`);
 }
 disabled(){return this.research.db.prepare('SELECT disabled FROM studio_generation_control WHERE id=1').get()?.disabled===1;}
 async inspect(){
  this.workerReady=false;this.validPolicy=false;
  try{const c=await this.loadConfig();this.config=c;
   requireThat(policyApprovalValid(c,this.now()),'CAPTION_POLICY_DISABLED','AI operations need an approved server-side policy.');
   requireThat(c.connection&&['jobsTableId','candidatesTableId','editorialWorkerId'].every(k=>c.connection[k]===OBSERVED_RESEARCH_CONNECTION[k])&&c.connection.headerName==='X-Mildincident-Development-Key'&&typeof c.connection.token==='string'&&c.connection.token.length>=32&&!/[\r\n]/.test(c.connection.token),'INVALID_CAPTION_POLICY','The pilot requires the existing private development connection.');
   this.validPolicy=true;const worker=await this.engine.client.api('/workflows/'+c.connection.editorialWorkerId);
   const projection=Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,worker[k]]));
   this.workerReady=worker.active===true&&worker.versionId===c.workerVersion&&worker.activeVersionId===c.workerVersion&&sha(projection)===c.graphSha256;
   this.issue=this.workerReady?null:'The reviewed caption worker is inactive or differs from the approved version.';
  }catch(error){this.issue=error.code==='CAPTION_POLICY_DISABLED'?'Caption improvements need a separately approved pilot policy.':'The private caption policy or connection needs review.';}
  return this.policyState();
 }
 counts(){const key=day(this.now()),used=new Map();
  for(const row of this.research.db.prepare('SELECT id,day_key,data_json FROM studio_generation_actions WHERE confirmed_at IS NOT NULL').all())if(row.day_key===key)used.set(row.id,JSON.parse(row.data_json).operation||'caption');
  for(const row of this.research.db.prepare("SELECT request_id,data_json,created_at FROM research_engine_events WHERE state='dispatching'").all())if(day(row.created_at)===key){const data=JSON.parse(row.data_json);used.set(row.request_id,data.captionTarget||data.editorialContext?.captionImprovement?'caption':'story');}
  return {caption:[...used.values()].filter(k=>k==='caption').length,story:[...used.values()].filter(k=>k==='story').length};
 }
 result(p,job){return ['ready_to_review','needs_research','approved'].includes(job?.state)?job.candidates?.find(c=>{
  if(p.operation==='story')return c.id==='DEV-'+p.id+'-1'&&c.jobId===p.id&&c.provenance?.executionId===job.executionId&&c.captionDraft?.trim()&&c.status!=='rejected'&&!c.recovery&&job.requestHash===p.requestHash;
  const r=c.recovery,source=p.packet.source;return c.id==='DEV-'+p.id+'-1'&&c.provenance?.executionId===job.executionId&&c.jobId===p.id&&c.captionDraft?.trim()&&c.status!=='rejected'&&r?.mode==='draft_only'&&r.direction===p.direction&&r.sourceJobId===source.sourceJobId&&r.sourceCandidateId===source.sourceCandidateId&&r.sourceExecutionId===source.sourceExecutionId&&r.evidenceSha256===p.packet.evidenceSha256&&r.sourceRevision===p.sourceRevision&&r.workingVersion===p.workingVersion;
 }):null;}
 busy(exceptId=null){
  for(const row of this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE confirmed_at IS NOT NULL').all()){if(row.id===exceptId)continue;const j=this.research.engineJob(row.id);if(!j||!terminal.has(j.state)||j.lastError==='ENGINE_RESULT_MISSING'||['ready_to_review','needs_research','approved'].includes(j.state)&&!this.result(this.raw(row.id),j))return true;}
  return this.research.db.prepare("SELECT request_id,state FROM research_engine_jobs").all().some(j=>j.request_id!==exceptId&&!terminal.has(j.state));
 }
 usageReview({allTime=false}={}){
  const key=day(this.now()),ids=new Set(this.research.db.prepare('SELECT id,day_key FROM studio_generation_actions WHERE confirmed_at IS NOT NULL').all().filter(r=>allTime||r.day_key===key).map(r=>r.id));
  for(const row of this.research.db.prepare("SELECT request_id,created_at FROM research_engine_events WHERE state='dispatching'").all())if(allTime||day(row.created_at)===key)ids.add(row.request_id);
  let estimate=0,unmeasured=0;
  for(const id of ids){const job=this.research.engineJob(id),usage=Object.values(job?.evidence||{})[0]?.usage;
   if(!Number.isFinite(usage?.inputTokens)||!Number.isFinite(usage?.outputTokens)){unmeasured++;continue;}
   estimate+=usage.inputTokens*2.5/1e6+usage.outputTokens*15/1e6;
   for(const m of usage.models||[])if(Number.isFinite(m.toolCalls))estimate+=m.toolCalls*.01;
  }
  return {estimatedUsd:Math.round(estimate*10000)/10000,operations:ids.size,thresholdUsd:perUsePolicy(this.config)?null:2,state:perUsePolicy(this.config)?unmeasured?'partially_measured':'measured':estimate>=2?'review_threshold_reached':unmeasured?'partially_measured':'below_review_threshold',unmeasuredOperations:unmeasured,verifiedBill:false,hardBillingCap:false,pricingBasis:'Assumed $2.50/M input, $15/M output and $0.01 per recorded search; account pricing and hidden usage unverified.'};
 }
 policyState(operation='caption'){const c=this.config,counts=this.counts(),persistent=perUsePolicy(c),enabled=this.validPolicy===true&&policyApprovalValid(c,this.now())&&!this.disabled();
  const state=!enabled?'disabled':persistent&&!c.operations[operation]?'not_authorized':!this.workerReady?'inactive':this.busy()?'busy':!persistent&&counts[operation]>=(operation==='caption'?c.dailyCaptionLimit:c.dailyStoryLimit)?'limit_reached':'available';
  if(persistent)return {state,enabled,mode:'founder_confirmed',canPrepare:true,message:state==='available'?'Review each request, then confirm. Pay per use; one operation at a time.':state==='disabled'?'AI starts are disabled. Editing and saved work remain available.':state==='not_authorized'?'This operation is not included in the installed approval.':state==='inactive'?'The reviewed AI worker is inactive or needs review.':state==='busy'?'An operation is running or needs reconciliation. Check its result before starting another.':'AI starts need review.',operations:{...c.operations},dailyCounts:counts,limits:null,reviewThresholdUsd:null,usageReview:this.usageReview(),hardBillingCap:false};
  return {state,enabled,canPrepare:true,message:state==='available'?'Choose an improvement, review it, then confirm one draft.':state==='disabled'?'AI caption improvements are disabled until the pilot policy is approved.':state==='inactive'?(this.issue||'The reviewed worker is inactive. Saved drafts remain available.'):state==='busy'?'Another operation is running or needs reconciliation. No new draft will start.':'Today’s approved caption allowance is used.',dailyCounts:counts,limits:{caption:c.dailyCaptionLimit||6,story:c.dailyStoryLimit??3},reviewThresholdUsd:2,usageReview:this.usageReview(),hardBillingCap:false};
 }
 raw(id){const row=this.research.db.prepare('SELECT * FROM studio_generation_actions WHERE id=?').get(id);return row?{...JSON.parse(row.data_json),confirmedAt:row.confirmed_at}:null;}
 proposal(p){if(!p)return null;const j=this.research.engineJob(p.id),candidate=this.result(p,j),policy=this.policyState(p.operation||'caption');
  const state=!p.confirmedAt?(Date.parse(p.expiresAt)>this.now()?'prepared':'expired'):candidate?'completed':j?.state==='failed'||j?.state==='rejected'?'failed':['dispatch_uncertain','queue_uncertain'].includes(j?.state)||!j||['ready_to_review','needs_research','approved'].includes(j?.state)&&!candidate?'uncertain':j?.state==='dispatching'&&!j.executionId?'dispatching':['dispatching','generating'].includes(j?.state)?'running':'queued';
  const usage=j?.evidence?.[candidate?.id]?.usage||null,story=p.operation==='story';
  const preliminary=story&&candidate&&(candidate.status==='needs_research'||candidate.photographicStage==='needs_research');
  const sourceClaims=(candidate?.claims||[]).filter((c,i,all)=>c.url&&all.findIndex(s=>s.url===c.url)===i);
  const preview=story&&candidate?{title:candidate.title,caption:candidate.captionDraft,claims:(candidate.claims||[]).map(c=>({text:c.claim,url:c.url})),sources:sourceClaims.slice(0,6).map(c=>({url:c.url,label:c.sourceName||c.url,claim:c.claim})),gaps:(candidate.gaps||[]).slice(0,6)}:null;
  return {id:p.id,jobId:p.id,operation:story?'story':'caption',storyId:p.storyId,sourceRevision:p.sourceRevision,workingVersion:p.workingVersion,direction:p.direction,sourceLabel:p.sourceLabel,createdAt:p.createdAt,expiresAt:p.expiresAt,state,...(story&&candidate?{editorialStatus:preliminary?'preliminary':'drafted',preview,message:preliminary?'A preliminary draft is saved. Sources, photographs and permissions still need review.':'A new draft is saved for editorial review.'}:{}),...(state==='failed'?{message:researchFailureMessage(j?.failure),failureCode:j?.failure?.code||j?.lastError||null}:{}),canConfirm:!p.confirmedAt&&policy.state==='available'&&Date.parse(p.expiresAt)>this.now(),limits:{maxDraftOutputTokens:1800,maxResearchCalls:story?1:0,maxResearchOutputTokens:story?3500:0,maxResearchToolCalls:story?2:0},estimatedCost:story?'Approximately $0.15–$0.25; account pricing and hidden retries may differ. This is not a hard cap.':'Approximately $0.04–$0.08; account pricing and hidden retries may differ. This is not a hard cap.',...(candidate?{resultCandidateId:candidate.id,versionId:'generated:'+candidate.id,resultStoryId:story?'CON-DEV-'+p.id:p.storyId}:{}),...(j?.executionId?{executionId:j.executionId}:{}),usage,estimatedUsd:usageEstimate(usage)};
 }
 usageSummary(){return {today:this.usageReview(),allTime:this.usageReview({allTime:true}),recent:this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE confirmed_at IS NOT NULL ORDER BY rowid DESC LIMIT 20').all().map(r=>this.proposal(this.raw(r.id)))};}
 storyStatus(id){const p=this.raw(id);return p?.operation==='story'?this.proposal(p):null;}
 status(story){const row=this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE story_id=? ORDER BY rowid DESC LIMIT 1').get(story.id);return {...this.policyState(),proposal:row?this.proposal(this.raw(row.id)):null};}
 validateStory(story,input){requireThat(story&&story.origin==='n8n_development'&&!story.localDraft?.stale&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','Save and reload the story before requesting a draft.');}
 validateStoredPacket(packet){
  // Qualify the frozen server-held research again; the review placeholder is never stored or dispatched.
  const copy=structuredClone(packet);copy.authorization={id:copy.requestId,jobId:copy.requestId,maxRuns:1,expiresAt:new Date(this.now()+20*60000).toISOString()};
  const context={captionImprovement:copy},request={kind:'brief',prompt:'Review retained caption evidence.',sourceUrl:'',editorialContext:context},hash=requestFingerprint(request),lease='00000000-0000-4000-8000-000000000001';
  validateCaptionImprovementJob({job_id:copy.requestId,request_hash:hash,kind:request.kind,prompt:request.prompt,source_url:'',editorial_context_json:JSON.stringify(context),status:'generating',lease_token:lease},{job_id:copy.requestId,request_hash:hash,dispatch_id:lease},{workerId:OBSERVED_RESEARCH_CONNECTION.editorialWorkerId,now:this.now()});return packet;
 }
 storedPacket(story,input,id){
  for(const row of this.research.db.prepare('SELECT data_json FROM studio_generation_actions WHERE story_id=? AND confirmed_at IS NOT NULL ORDER BY rowid DESC').all(story.id)){
   const base=JSON.parse(row.data_json).packet,origin=base?.source;
   if(origin?.sourceRevision!==story.revision||origin.sourceJobId!==story.engineJobId||origin.sourceCandidateId!==story.engineCandidateId||origin.sourceExecutionId!==story.engineProvenance?.executionId)continue;
   const packet=structuredClone(base);packet.requestId=id;packet.direction=input.direction;packet.workingCaption=story.localDraft?.caption??story.caption??'';packet.source.workingVersion=input.workingVersion;packet.authorization=null;
   return this.validateStoredPacket(packet);
  }
  return null;
 }
 async prepare(story,input){
  requireThat(input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','direction','idempotencyKey'].includes(k))&&uuid(input.idempotencyKey)&&Object.hasOwn(CAPTION_DIRECTIONS,input.direction)&&input.direction!=='initial','INVALID_CAPTION_REQUEST','Choose a supported caption improvement.');this.validateStory(story,input);
  const existing=this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE idempotency_key=?').get(input.idempotencyKey);
  if(existing){const p=this.raw(existing.id);requireThat(p.storyId===story.id&&p.sourceRevision===input.sourceRevision&&p.workingVersion===input.workingVersion&&p.direction===input.direction,'EDIT_CONFLICT','This request identity belongs to another writing context.');await this.inspect();return this.proposal(p);}
  requireThat(this.engine?.client,'ENGINE_NOT_CONFIGURED','A read connection is needed to reuse the original research.');
  const id=randomUUID(),now=this.now(),stored=this.storedPacket(story,input,id),execution=stored?null:await this.engine.client.executionDetails(story.engineProvenance.executionId);
  const {packet}=stored?{packet:stored}:prepareCaptionImprovementPacket({workerId:OBSERVED_RESEARCH_CONNECTION.editorialWorkerId,execution,requestId:id,sourceRevision:story.revision,direction:input.direction,workingCaption:story.localDraft?.caption??story.caption??'',workingVersion:input.workingVersion,authorization:null,now});
  requireThat(packet.source.sourceJobId===story.engineJobId&&packet.source.sourceCandidateId===story.engineCandidateId&&packet.source.sourceExecutionId===story.engineProvenance.executionId,'CAPTION_EVIDENCE_REQUIRED','Captured research must match this exact original story.');
  const p={id,storyId:story.id,sourceRevision:story.revision,workingVersion:input.workingVersion,direction:input.direction,sourceLabel:story.title,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+20*60000).toISOString(),evidenceBasis:stored?'stored_packet':'native_execution',packet};
  this.research.db.prepare('INSERT OR IGNORE INTO studio_generation_actions VALUES(?,?,?,?,NULL,NULL,?)').run(id,input.idempotencyKey,story.id,p.createdAt,JSON.stringify(p));
  await this.inspect();const row=this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE idempotency_key=?').get(input.idempotencyKey),saved=this.raw(row.id);requireThat(saved.storyId===story.id&&saved.sourceRevision===input.sourceRevision&&saved.workingVersion===input.workingVersion&&saved.direction===input.direction,'EDIT_CONFLICT','This request identity belongs to another writing context.');return this.proposal(saved);
 }
 disable(){const time=new Date(this.now()).toISOString();this.research.db.exec('BEGIN IMMEDIATE');try{this.research.db.prepare('INSERT INTO studio_generation_control VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET disabled=1,updated_at=excluded.updated_at').run(time);this.research.db.prepare('INSERT INTO studio_generation_policy_events(created_at,event,data_json) VALUES(?,?,?)').run(time,'disabled','{}');this.research.db.exec('COMMIT');}catch(e){this.research.db.exec('ROLLBACK');throw e;}return this.policyState();}
 assertStart(id){const p=this.raw(id),operation=p?.operation||'caption',a=p?.authorization||p?.packet?.authorization;requireThat(p?.policyId===this.config.id&&Date.parse(a?.expiresAt)>this.now(),'CAPTION_POLICY_DISABLED','The exact action approval expired or changed.');requireThat(this.policyState(operation).enabled&&this.workerReady&&(!perUsePolicy(this.config)||this.config.operations[operation]),'CAPTION_POLICY_DISABLED','Future AI starts are disabled or the reviewed worker is unavailable.');requireThat(!this.busy(id),'GENERATION_BUSY','Another operation needs completion or reconciliation.');}
 guardLegacyStart(id){
  requireThat(!this.disabled(),'CAPTION_POLICY_DISABLED','Future AI starts were disabled.');
  // This check runs inside the existing durable dispatch-claim transaction.
  if(!this.config.enabled&&!this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE confirmed_at IS NOT NULL LIMIT 1').get())return;
  requireThat(!this.busy(id),'GENERATION_BUSY','Another operation needs completion or reconciliation.');
  if(perUsePolicy(this.config)){requireThat(this.raw(id)?.confirmedAt,'CAPTION_NOT_AUTHORIZED','Review and confirm this operation through Studio first.');return this.assertStart(id);}
  const job=this.research.engineJob(id);if(job?.editorialContext?.captionImprovement)return this.assertStart(id);
  if(this.config.enabled){const counts=this.counts(),kind=job?.captionTarget?'caption':'story';requireThat(this.policyState().enabled&&counts[kind]<(kind==='caption'?this.config.dailyCaptionLimit:this.config.dailyStoryLimit),'CAPTION_POLICY_DISABLED','The approved daily generation allowance is unavailable.');}
 }
 async captureUsage(){
  for(const row of this.research.db.prepare('SELECT id FROM studio_generation_actions WHERE confirmed_at IS NOT NULL').all()){
   const p=this.raw(row.id),job=this.research.engineJob(row.id);if(p.usageAttempted||!job?.candidates?.length||!job.executionId)continue;
   p.usageAttempted=true;this.research.db.prepare('UPDATE studio_generation_actions SET data_json=? WHERE id=?').run(JSON.stringify(p),p.id);
   try{const saved=await this.engine.captureEvidence(p.id);this.research.db.prepare('INSERT INTO studio_generation_policy_events(created_at,event,data_json) VALUES(?,?,?)').run(new Date(this.now()).toISOString(),'usage_recorded',JSON.stringify({proposalId:p.id,usage:saved.evidence?.[job.candidates[0].id]?.usage||null}));}catch{ /* A missing usage read remains unknown; never regenerate or release a claim. */ }
  }
 }
 async confirm(story,input,{readStory=()=>story}={}){
  requireThat(input&&Object.keys(input).every(k=>['proposalId','sourceRevision','workingVersion','confirm'].includes(k))&&uuid(input.proposalId)&&input.confirm===true,'INVALID_CAPTION_REQUEST','Confirm one reviewed draft request.');
  let p=this.raw(input.proposalId);requireThat(p?.storyId===story.id,'INVALID_CAPTION_REQUEST','Open this story’s prepared request.');if(p.confirmedAt)return this.proposal(p);
  const validateCurrentStory=()=>{const current=readStory();requireThat(!current?.then,'EDIT_CONFLICT','Use the current synchronous Studio snapshot before starting.');this.validateStory(current,input);requireThat(p.sourceRevision===current.revision&&p.workingVersion===(current.localDraft?.version||0)&&p.packet.workingCaption===(current.localDraft?.caption??current.caption??''),'EDIT_CONFLICT','The reviewed caption changed. Prepare a fresh request.');};
  this.validateStory(story,input);await this.inspect();
  const fresh=await readStory();this.validateStory(fresh,input);requireThat(p.sourceRevision===fresh.revision&&p.workingVersion===(fresh.localDraft?.version||0)&&p.packet.workingCaption===(fresh.localDraft?.caption??fresh.caption??''),'EDIT_CONFLICT','The reviewed caption changed. Prepare a fresh request.');
  const original=p.evidenceBasis==='stored_packet'?null:await this.engine.client.executionDetails(p.packet.source.sourceExecutionId);
  const rebuilt=p.evidenceBasis==='stored_packet'?this.validateStoredPacket(p.packet):prepareCaptionImprovementPacket({workerId:OBSERVED_RESEARCH_CONNECTION.editorialWorkerId,execution:original,requestId:p.id,sourceRevision:p.sourceRevision,direction:p.direction,workingCaption:p.packet.workingCaption,workingVersion:p.workingVersion,authorization:null,now:this.now()}).packet;
  requireThat(sha(rebuilt)===sha(p.packet),'CAPTION_EVIDENCE_CHANGED','The captured evidence changed; review a new request.');this.validateStory(await readStory(),input);
  await this.inspect();this.validateStory(await readStory(),input);
  this.research.db.exec('BEGIN IMMEDIATE');try{
   p=this.raw(p.id);if(p.confirmedAt){this.research.db.exec('COMMIT');return this.proposal(p);}
   validateCurrentStory();
   requireThat(this.policyState().state==='available'&&Date.parse(p.expiresAt)>this.now(),'CAPTION_NOT_AUTHORIZED',this.policyState().message);requireThat(!this.busy(p.id),'GENERATION_BUSY','Another operation needs reconciliation.');
   p.packet.authorization={id:randomUUID(),jobId:p.id,maxRuns:1,expiresAt:new Date(this.now()+20*60000).toISOString()};p.policyId=this.config.id;
   const time=new Date(this.now()).toISOString();this.research.db.prepare('UPDATE studio_generation_actions SET confirmed_at=?,day_key=?,data_json=? WHERE id=?').run(time,day(time),JSON.stringify(p),p.id);this.research.db.prepare('INSERT INTO studio_generation_policy_events(created_at,event,data_json) VALUES(?,?,?)').run(time,'confirmed',JSON.stringify({proposalId:p.id,policyId:p.policyId,direction:p.direction}));this.research.db.exec('COMMIT');
  }catch(e){this.research.db.exec('ROLLBACK');throw e;}
  try{
   const request=this.research.create({idempotencyKey:p.id,kind:'brief',prompt:'Improve the retained editorial caption: '+CAPTION_DIRECTIONS[p.direction]+'. Preserve source support and attribution.',sourceUrl:''},[]),editorialContext={captionImprovement:p.packet},requestHash=requestFingerprint({...request,editorialContext});
   const client=this.createClient({connection:{...this.config.connection,mode:'standard',generationEnabled:true,approvedWorkerVersion:this.config.workerVersion,approvedGraphSha256:this.config.graphSha256,executionScope:'caption_policy',authorization:p.packet.authorization,captionAction:{jobId:p.id,requestHash}}});
   const actionEngine=new EditorialEngineService({research:this.research,client});this.assertStart(p.id);
   await actionEngine.queue(p.id,{editorialContext,captionTarget:{storyId:p.storyId,sourceRevision:p.sourceRevision,workingVersion:p.workingVersion,sourceJobId:p.packet.source.sourceJobId,sourceCandidateId:p.packet.source.sourceCandidateId,sourceExecutionId:p.packet.source.sourceExecutionId,evidenceSha256:p.packet.evidenceSha256,direction:p.direction}});
   await this.inspect();this.validateStory(await readStory(),input);this.assertStart(p.id);
   await actionEngine.start(p.id,this.research.engineJob(p.id).version,{beforeClaim:()=>{this.assertStart(p.id);validateCurrentStory();}});
  }catch(error){const j=this.research.engineJob(p.id);if(j&&j.state==='queued')this.research.recordEngineState(p.id,'dispatch_uncertain',{lastError:error.code||'CAPTION_START_UNCERTAIN'});return this.proposal(this.raw(p.id));}
  return this.proposal(this.raw(p.id));
 }

 // Full-story actions reuse the same ledger, private worker, grants and dispatch boundary.
 // The immutable review freezes the existing editorial preset/feedback context, not a second engine.
 storyBinding(request){return sha({kind:request.kind,prompt:request.prompt,sourceUrl:request.sourceUrl,preset:request.preset||null,continuation:request.continuation||null});}
 async prepareStory(id,input={}){
  requireThat(Object.keys(input).length===0&&uuid(id),'INVALID_RESEARCH_REQUEST','Review one saved discovery request.');
  const existing=this.raw(id);if(existing){requireThat(existing.operation==='story','EDIT_CONFLICT','This identity belongs to another action.');await this.inspect();return this.proposal(existing);}
  const request=this.research.get(id);requireThat(request&&!request.engineJob&&!request.linkedStoryId&&!request.continuation,'ENGINE_ALREADY_DISPATCHED','Use a new saved direction; existing or uncertain operations are never resent.');
  const editorialContext=this.engine.editorialContext(request),now=this.now();
  const p={id,operation:'story',storyId:'request:'+id,sourceLabel:request.preset?.name||(request.kind==='discovery'?'Surprise Me — current editorial direction':request.prompt),createdAt:new Date(now).toISOString(),expiresAt:new Date(now+20*60000).toISOString(),requestBinding:this.storyBinding(request),editorialContext,requestHash:requestFingerprint({...request,editorialContext})};
  this.research.db.prepare('INSERT OR IGNORE INTO studio_generation_actions VALUES(?,?,?,?,NULL,NULL,?)').run(id,'story:'+id,p.storyId,p.createdAt,JSON.stringify(p));
  const saved=this.raw(id);requireThat(saved.operation==='story'&&saved.requestBinding===p.requestBinding,'EDIT_CONFLICT','The saved direction changed.');await this.inspect();return this.proposal(saved);
 }
 async confirmStory(id,input={}){
  requireThat(Object.keys(input).length===1&&input.confirm===true&&uuid(id),'INVALID_RESEARCH_REQUEST','Explicitly confirm one reviewed story request.');
  let p=this.raw(id);requireThat(p?.operation==='story','INVALID_RESEARCH_REQUEST','Review this saved direction first.');if(p.confirmedAt)return this.proposal(p);
  await this.inspect();
  const validate=()=>{const request=this.research.get(id);requireThat(request&&this.storyBinding(request)===p.requestBinding&&(!request.engineJob||request.engineJob.requestHash===p.requestHash),'EDIT_CONFLICT','The reviewed direction or context changed. Prepare a fresh request.');};
  this.research.db.exec('BEGIN IMMEDIATE');try{
   p=this.raw(id);if(p.confirmedAt){this.research.db.exec('COMMIT');return this.proposal(p);}
   validate();requireThat(!this.research.engineJob(id),'ENGINE_ALREADY_DISPATCHED','This request already has execution activity.');
   requireThat(this.policyState('story').state==='available'&&Date.parse(p.expiresAt)>this.now(),'CAPTION_NOT_AUTHORIZED',this.policyState('story').message);
   p.authorization={id:randomUUID(),jobId:id,maxRuns:1,expiresAt:new Date(this.now()+20*60000).toISOString()};p.policyId=this.config.id;
   const time=new Date(this.now()).toISOString();this.research.db.prepare('UPDATE studio_generation_actions SET confirmed_at=?,day_key=?,data_json=? WHERE id=?').run(time,day(time),JSON.stringify(p),id);
   this.research.db.prepare('INSERT INTO studio_generation_policy_events(created_at,event,data_json) VALUES(?,?,?)').run(time,'confirmed',JSON.stringify({proposalId:id,policyId:p.policyId,operation:'story'}));this.research.db.exec('COMMIT');
  }catch(error){this.research.db.exec('ROLLBACK');throw error;}
  try{
   const client=this.createClient({connection:{...this.config.connection,mode:'standard',generationEnabled:true,approvedWorkerVersion:this.config.workerVersion,approvedGraphSha256:this.config.graphSha256,executionScope:'founder_policy',authorization:p.authorization,captionAction:{jobId:id,requestHash:p.requestHash,operation:'story'}}});
   const actionEngine=new EditorialEngineService({research:this.research,client});this.assertStart(id);
   await actionEngine.queue(id,{editorialContext:p.editorialContext});
   await this.inspect();validate();this.assertStart(id);
   await actionEngine.start(id,this.research.engineJob(id).version,{beforeClaim:()=>{this.assertStart(id);validate();}});
  }catch(error){const j=this.research.engineJob(id);if(j?.state==='queued')this.research.recordEngineState(id,'dispatch_uncertain',{lastError:error.code||'ENGINE_START_UNCERTAIN'});}
  return this.proposal(this.raw(id));
 }
}
