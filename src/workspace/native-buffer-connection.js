import fs from 'node:fs/promises';
import path from 'node:path';
import {createHmac,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {canonical,sha256} from '../package.js';
import {requireThat,HandoffError} from '../errors.js';
import {readAllPages} from '../production-audit.js';
import {publishingGraphSha} from '../n8n/buffer-handoff-security.js';
import {STUDIO_PUBLISHING_PATH,STUDIO_PUBLISHING_AUDIENCE} from '../n8n/buffer-gateway-patch.js';
import {PUBLISHING_TABLES as T} from '../n8n/buffer-release-patch.js';
import {buildWorkspace} from './model.js';

export const BUFFER_CHANNEL_ID='6adfbc112f1f5ed648dee51f';
const REQUIRED_GRAPHS=['BzMqQS8lfkwN7peQ','Q02tRHMtZ90Kib18','YdW8V9Qxl2qn5mC8','f0LkxPxzvqh3zyUQ','rhZU4CyF5t0kYMzz','v5ThKs5ZYP3RhZop'];
const COORDINATOR='v5ThKs5ZYP3RhZop',ORIGIN='https://rickywelch.app.n8n.cloud';
const running=e=>['new','running','waiting'].includes(e?.status);
export const nativePostDigest=story=>sha256(canonical([story.id,story.production?.package?.version,story.localDraft?.caption??story.caption,story.localDraft?.selectedAssetIds??story.selectedAssetIds,(story.production?.finalFiles||[]).map(f=>({assetId:f.assetId,sha256:f.sha256}))]));
export function publishingRequestId(key){const h=sha256(key);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
export function publishingJwt(body,secret,now=Date.now()){
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),iat=Math.floor(now/1000),parts=encode({alg:'HS256',typ:'JWT'})+'.'+encode({iss:'mildincident-studio',aud:STUDIO_PUBLISHING_AUDIENCE,sub:'founder',iat,exp:iat+300,jti:body.requestId,bodySha256:sha256(canonical(body))});
 return parts+'.'+createHmac('sha256',secret).update(parts).digest('base64url');
}
export async function readNativeBufferPolicy({env=process.env,config}){
 if(!env.STUDIO_BUFFER_POLICY_FILE)return {version:1,enabled:false,approved:false};
 const root=await fs.realpath(config.dataRoot),file=await fs.realpath(env.STUDIO_BUFFER_POLICY_FILE),relative=path.relative(root,file),stat=await fs.stat(file);
 requireThat(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&stat.isFile()&&(stat.mode&0o077)===0&&stat.size<32000,'BUFFER_POLICY_INVALID','Keep the private publishing policy inside Studio storage with mode 0600.');
 let p;try{p=JSON.parse(await fs.readFile(file,'utf8'));}catch{throw new HandoffError('BUFFER_POLICY_INVALID','The private publishing policy is unreadable.');}
 requireThat(p.version===1,'BUFFER_POLICY_INVALID','Use the reviewed publishing policy version.');
 if(p.enabled&&p.approved)requireThat(p.channelId===BUFFER_CHANNEL_ID&&/^[a-f0-9]{64}$/.test(p.jwtSecret||'')&&Array.isArray(p.graphs)&&p.graphs.length>=4,'BUFFER_POLICY_INVALID','The approved private policy needs its exact graph bindings and dedicated authentication.');
 return p;
}

/** Fixed native coordinator client. No Buffer mutation or generic webhook
 * executor exists here. Creation always uses the existing guarded native path. */
export class NativeBufferConnection {
 #policy=null;#checkedPolicy=null;#checkedAt=0;#loadPolicy;#read;#fetch;#reader;#contexts=new Map();
 constructor({loadPolicy,read,bufferReader,source,drafts,previews,workspace,fetchImpl=fetch}){
  this.#loadPolicy=loadPolicy;this.#read=read;this.#reader=bufferReader;this.#fetch=fetchImpl;Object.assign(this,{source,drafts,previews,workspace,channelId:BUFFER_CHANNEL_ID});
  this.readOnlyAvailable=Boolean(read&&bufferReader);this.singleWriterVerified=false;this.draftOnlyContractReviewed=false;this.reviewAvailable=false;
  this.adapter={nativeCoordinator:true,createUnscheduledDraft:r=>this.createNativeDraft(r),readPost:id=>this.readPost(id),observeNativeExecution:a=>this.observeNativeExecution(a)};
 }
 async inspect({force=false}={}){
  try{const p=await this.#loadPolicy(),identity=sha256(canonical(p));if(!force&&identity===this.#checkedPolicy&&Date.now()-this.#checkedAt<15000)return;this.#checkedPolicy=identity;this.#checkedAt=Date.now();}catch{this.#checkedAt=0;}
  this.reviewAvailable=false;this.singleWriterVerified=false;this.draftOnlyContractReviewed=false;
  try{this.#policy=await this.#loadPolicy();const p=this.#policy;if(!p.enabled||!p.approved)return;requireThat(p.graphs?.length===REQUIRED_GRAPHS.length&&REQUIRED_GRAPHS.every(id=>p.graphs.filter(g=>g.id===id&&/^[-a-f0-9]{36}$/.test(g.version||'')&&/^[a-f0-9]{64}$/.test(g.sha256||'')).length===1),'BUFFER_POLICY_INVALID','Pin all existing publishing paths before enabling the connection.');
   for(const pin of p.graphs){const w=await this.#read('/api/v1/workflows/'+pin.id);requireThat(w.active&&w.versionId===pin.version&&w.activeVersionId===pin.version&&publishingGraphSha(w)===pin.sha256,'BUFFER_WORKFLOW_CHANGED','The reviewed publishing workflow differs. Future starts are blocked.');}
   const guarded=p.graphs.find(g=>g.id==='Q02tRHMtZ90Kib18');requireThat(p.claimProof?.verified===true&&p.claimProof.graphSha256===guarded?.sha256&&p.providerProof?.verified===true&&p.providerProof.channelId===BUFFER_CHANNEL_ID,'BUFFER_READINESS_UNPROVEN','Complete the approved native claim/authentication proof before enabling publishing.');
   this.singleWriterVerified=true;this.draftOnlyContractReviewed=p.draftOnlyContractReviewed===true;this.reviewAvailable=p.operations?.nativeReview===true;this.issue=null;
  }catch(error){this.#checkedAt=0;this.issue=error.code||'BUFFER_CONNECTION_UNAVAILABLE';}
 }
 canCreateDraft(story){const p=this.#policy,a=p?.acceptance;return Boolean(this.singleWriterVerified&&p.enabled&&p.approved&&p.operations?.bufferDraft===true&&a?.storyId===story.id&&a.packageVersion===story.production?.package?.version&&a.contentDigest===nativePostDigest(story)&&Date.parse(a.expiresAt)>Date.now());}
 status(story){
  const p=story.production?.package,files=story.production?.finalFiles||[],slides=files.map(f=>{const saved=this.previews?.get(story.id,'native-final:'+f.fileRecordId);return saved?.originalSha256===f.sha256?{...f,previewUrl:'/api/stories/'+encodeURIComponent(story.id)+'/buffer-draft/files/'+encodeURIComponent(f.fileRecordId)+'?hash='+f.sha256,previewId:'native-final:'+f.fileRecordId}:null;});
  const sameCaption=!story.localDraft?.stale&&(story.localDraft?.caption??story.caption)===story.caption&&['title','hook','format','targetSlideCount'].every(k=>!Object.hasOwn(story.localDraft||{},k)||story.localDraft[k]===story[k]),complete=files.length>0&&slides.every(Boolean)&&canonical(files.map(f=>f.assetId))===canonical(story.localDraft?.selectedAssetIds??story.selectedAssetIds);
  const selected=story.localDraft?.selectedAssetIds??story.selectedAssetIds,rights=selected?.length&&selected.every(id=>story.media.find(a=>a.id===id)?.nativeRightsReview?.reviewed===true);
  return {enabled:this.reviewAvailable,reviewAvailable:this.reviewAvailable&&!story.organization?.trashed&&story.origin!=='n8n_development',approveAvailable:Boolean(this.singleWriterVerified&&this.#policy?.operations?.finalApproval&&rights&&p?.finalApprovalStatus!=='approved'&&p?.finalAssetsVerified&&sameCaption&&complete),preparedSlides:sameCaption&&complete?slides:[],finalFilesVerified:Boolean(sameCaption&&complete),finalPostDigest:nativePostDigest(story),message:this.issue?'The native publishing connection needs verification.':'Native preparation keeps rights, facts and final approval separate.'};
 }
 async #active(operation,story=null){await this.inspect({force:true});const p=this.#policy;requireThat(this.singleWriterVerified&&p?.enabled&&p.approved,'BUFFER_POLICY_DISABLED','Native publishing is not enabled.');requireThat(p.operations?.[operation]===true,'BUFFER_POLICY_DISABLED','This publishing action is not authorised.');if(operation==='bufferDraft')requireThat(story&&this.canCreateDraft(story),'BUFFER_DRAFT_NOT_AUTHORIZED','Only the separately approved post can create one unscheduled Buffer draft.');return p;}
 async #call(input,{readOnly=false}={}){
  const p=readOnly?await this.#loadPolicy():this.#policy;requireThat(/^[a-f0-9]{64}$/.test(p?.jwtSecret||''),'BUFFER_POLICY_DISABLED','Dedicated native publishing authentication is unavailable.');
  if(readOnly){const ids=[COORDINATOR,input.action==='file'?'YdW8V9Qxl2qn5mC8':'Q02tRHMtZ90Kib18'];for(const id of ids){const pin=p.graphs?.find(g=>g.id===id),w=pin?await this.#read('/api/v1/workflows/'+id):null;requireThat(w?.active&&w.activeVersionId===pin.version&&w.versionId===pin.version&&publishingGraphSha(w)===pin.sha256,'BUFFER_WORKFLOW_CHANGED','The read-only native publishing path is not the reviewed version.');}}
  const body=JSON.parse(JSON.stringify({version:1,...input,requestId:input.requestId||randomUUID()}));let response;
  try{response=await this.#fetch(ORIGIN+'/webhook/'+STUDIO_PUBLISHING_PATH,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+publishingJwt(body,p.jwtSecret)},body:JSON.stringify(body),signal:AbortSignal.timeout(readOnly?45000:30000)});}catch{throw new HandoffError('NATIVE_PUBLISHING_UNCERTAIN','The native reply was not confirmed. Do not resubmit.');}
  requireThat(response.ok,'NATIVE_PUBLISHING_UNCERTAIN','The native publishing action was not confirmed; response details are private.');
  const chunks=[];let size=0;for await(const b of response.body){size+=b.byteLength;requireThat(size<=12*1024*1024,'NATIVE_PUBLISHING_UNCERTAIN','The native reply exceeded its reviewed size.');chunks.push(b);}
  let reply;try{reply=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HandoffError('NATIVE_PUBLISHING_UNCERTAIN','The native reply was unreadable. Do not resubmit.');}
  if(response.status===202)requireThat(reply.state==='native_accepted'&&reply.requestId===body.requestId&&/^\d{1,30}$/.test(String(reply.executionId||'')),'NATIVE_PUBLISHING_UNCERTAIN','The native dispatch receipt did not match.');
  return reply;
 }
 async #rows(table){return readAllPages(this.#read,'/api/v1/data-tables/'+table+'/rows');}
 async context(storyId){
  const names={stories:T.stories,packages:T.packages,media:T.media,files:T.files,manual:T.manual,guarded:T.guarded,staging:T.staging,finalReviews:'Jiows2tODEIIOFa3'},out={};
  const results=await Promise.all(Object.entries(names).map(async([name,table])=>[name,(await this.#rows(table)).filter(r=>r.concept_id===storyId)]));for(const [name,rows]of results)out[name]=rows;
  requireThat(out.stories.length===1&&out.packages.length===1,'NATIVE_POST_NOT_LINKED','Use one canonical native story and production package.');out.story=out.stories[0];out.pkg=out.packages[0];this.#contexts.set(storyId,out);return out;
 }
 #freshStory(ctx){const cached=this.source.snapshot;requireThat(cached,'SOURCE_UNAVAILABLE','Refresh the source records first.');return buildWorkspace({...cached,records:{...cached.records,stories:ctx.stories,packages:ctx.packages,media:ctx.media,files:ctx.files,finalReviews:ctx.finalReviews,imports:ctx.manual,guardedHandoffs:ctx.guarded,staging:ctx.staging},observedAt:new Date().toISOString()},this.drafts.all(),{storyId:ctx.story.concept_id}).stories[0];}
 #files(ctx){let ids;try{ids=JSON.parse(ctx.pkg.slide_sequence_asset_ids||'[]');}catch{}const p=ctx.pkg,files=ctx.files.filter(f=>f.package_id===p.package_id&&f.package_version===p.production_version&&f.render_batch_id===p.render_batch_id).sort((a,b)=>a.slide_number-b.slide_number);requireThat(p.final_assets_verified===true&&Array.isArray(ids)&&files.length===ids.length&&files.every((f,i)=>f.source_asset_id===ids[i]&&f.slide_number===i+1&&f.storage_verified===true&&f.render_quality_status==='passed'&&f.mime_type==='image/jpeg'&&f.pixel_width===1080&&f.pixel_height===1350&&/^[a-f0-9]{64}$/.test(f.checksum_sha256||'')),'FINAL_JPEGS_REQUIRED','The exact final JPEG sequence is not ready.');return files;}
 async preparePreview(story,context=null){
  const ctx=context||await this.context(story.id),files=this.#files(ctx);
  for(const f of files){const id='native-final:'+f.file_record_id,existing=this.previews.get(story.id,id);if(existing?.originalSha256===f.checksum_sha256){await this.previews.readOriginal(story.id,id,existing.sha256);continue;}
   const result=await this.#call({action:'file',storyId:story.id,packageVersion:ctx.pkg.production_version,fileRecordId:f.file_record_id,assetId:f.source_asset_id,sha256:f.checksum_sha256},{readOnly:true}),bytes=Buffer.from(result.data||'','base64');
   requireThat(result.state==='verified_private_file'&&result.storyId===story.id&&result.assetId===f.source_asset_id&&result.packageVersion===ctx.pkg.production_version&&bytes.length===f.size_bytes&&bytes.length<=8*1024*1024&&sha256(bytes)===f.checksum_sha256,'NATIVE_FILE_CHANGED','The private final JPEG did not match its native record.');
   const m=await sharp(bytes,{failOn:'warning'}).metadata();await sharp(bytes,{failOn:'warning'}).raw().toBuffer();requireThat(m.format==='jpeg'&&m.width===1080&&m.height===1350,'NATIVE_FILE_CHANGED','The final file is not a decoded 4:5 JPEG.');
   await this.previews.save({storyId:story.id,assetId:id,bytes,contentType:'image/jpeg',originalName:f.file_record_id+'.jpg',declaration:'private_review_only'});
  }
  return this.status(story);
 }
 async verifyExistingProviderConnection(story){const r=await this.#call({action:'connection',storyId:story.id,packageVersion:story.production.package.version},{readOnly:true});requireThat(r.verified===true&&r.channelId===BUFFER_CHANNEL_ID&&r.isDisconnected===false&&r.isLocked===false,'BUFFER_CHANNEL_UNAVAILABLE','The existing native Buffer credential was not verified.');return r;}
 async submitReview(packet){await this.#active('nativeReview');return this.#call({action:'review',requestId:packet.requestId,storyId:packet.expected.storyId,packageVersion:packet.expected.packageVersion,confirm:'submit_exact_post_for_native_review',packet});}
 async approvePost(story,{requestId,contentDigest,factsReviewed,slidesReviewed}){
  await this.#active('finalApproval');const state=this.status(story);requireThat(state.approveAvailable&&factsReviewed===true&&slidesReviewed===true,'FINAL_REVIEW_REQUIRED','Inspect the exact final JPEGs and confirm facts and credits before approval.');
  return this.#call({action:'approve',requestId,contentDigest,storyId:story.id,packageVersion:story.production.package.version,caption:story.localDraft?.caption??story.caption,selectedAssetIds:story.localDraft?.selectedAssetIds??story.selectedAssetIds,fileManifest:state.preparedSlides.map(f=>({fileRecordId:f.fileRecordId,assetId:f.assetId,sha256:f.sha256})),confirm:'approve_exact_native_post',factsReviewed:true,slidesReviewed:true});
 }
 async #operation(executionId){
  const summary=await this.#read('/api/v1/executions/'+executionId+'?includeData=false');if(running(summary))return {state:'running',executionId};
  const full=await this.#read('/api/v1/executions/'+executionId+'?includeData=true'),runs=full.data?.resultData?.runData||{},result=runs['Store Studio Operation Result']?.at(-1)?.data?.main?.[0]?.[0]?.json;
  requireThat(full.workflowId===COORDINATOR,'NATIVE_REVIEW_UNCERTAIN','The recorded execution belongs to another workflow.');
  return {state:result?'complete':'unconfirmed',executionId,result,runs};
 }
 async #locate(requestId,createdAt){
  const list=await this.#read('/api/v1/executions?workflowId='+COORDINATOR+'&limit=50'),cutoff=Date.parse(createdAt||'')-60000;
  const candidates=(list.data||[]).filter(e=>!Number.isFinite(cutoff)||Date.parse(e.startedAt)>=cutoff);
  requireThat(Array.isArray(list.data)&&!list.nextCursor&&candidates.length<=25,'NATIVE_REVIEW_UNCERTAIN','The receipt search is incomplete. Inspect existing native history without resubmitting.');
  const matches=[];for(const e of candidates){const full=await this.#read('/api/v1/executions/'+e.id+'?includeData=true'),r=full.data?.resultData?.runData?.['Read Authenticated Studio Publishing Envelope']?.[0]?.data?.main?.[0]?.[0]?.json?.studio_request;if(full.workflowId===COORDINATOR&&r?.requestId===requestId)matches.push(String(e.id));}
  requireThat(matches.length===1,'NATIVE_REVIEW_UNCERTAIN','No unique native execution was found. Keep the saved intent; do not resend.');return matches[0];
 }
 async readReviewReceipt({storyId,requestId,contentDigest,executionId,createdAt,approval=false}){
  executionId ||= await this.#locate(requestId,createdAt);
  requireThat(/^\d+$/.test(String(executionId||'')),'NATIVE_REVIEW_UNCERTAIN','The accepted native execution must be reconciled; do not resubmit.');const observed=await this.#operation(executionId);if(observed.state==='running')return observed;
  const r=observed.result;requireThat(r?.storyId===storyId&&r.requestId===requestId&&r.contentDigest===contentDigest&&(!approval?['native_review_saved','unchanged'].includes(r.state):r.state==='native_post_approved'),'NATIVE_REVIEW_UNCERTAIN','Native execution completed without an exact editorial receipt.');return r;
 }
 async #manifest(ctx){
  const story=this.#freshStory(ctx),p=ctx.pkg,files=this.#files(ctx);requireThat(p.final_approval_status==='approved'&&p.source_claims_reviewed===true&&p.rights_review_status==='reviewed'&&p.final_caption===story.caption,'FINAL_REVIEW_REQUIRED','The exact native caption and photographs still need final approval.');
  const review=ctx.finalReviews.map(r=>{try{return{row:r,proof:JSON.parse(r.raw_submission_redacted||'{}')};}catch{return null;}}).filter(Boolean).find(({row,proof})=>row.decision==='Approve'&&row.validation_status==='validated_applied'&&proof.concept_id===story.id&&proof.production_version===p.production_version&&proof.render_batch_id===p.render_batch_id&&proof.founder_confirmed_assets===true&&Number.isFinite(Date.parse(proof.validatedAppliedAt)));
  requireThat(review,'FINAL_REVIEW_REQUIRED','A matching applied native final-review record is required.');
  const slides=files.map(f=>{const m=ctx.media.find(m=>m.asset_id===f.source_asset_id),note=String(m?.notes||''),snapshot=JSON.parse(f.rights_snapshot||'{}'),evidence=note.match(/\bevidence:\s*(https:\/\/[^\s|]+)/i)?.[1];requireThat(m&&m.source_page_url===f.source_url&&m.attribution_text===f.source_credit&&evidence&&snapshot.rights_evidence&&note.endsWith(snapshot.rights_evidence),'RIGHTS_EVIDENCE_MISSING','Live image credit or permission evidence differs from the final file.');
   const rights={status:m.rights_status==='reviewed_cleared'?'cleared':m.rights_status==='editorial_exception_authorized'?'editorial_exception_authorized':'pending',evidence:[evidence],reviewedBy:'Founder (applied native final post review)',reviewedAt:review.proof.validatedAppliedAt,credit:f.source_credit};
   if(rights.status==='editorial_exception_authorized'){requireThat(note.includes('HUMAN EDITORIAL EXCEPTION REVIEW')&&note.includes(' for '+story.id+' / '+m.asset_id+' |')&&f.rights_evidence_status==='founder_exception_reviewed','RIGHTS_EVIDENCE_MISSING','Retain the exact native editorial-exception scope.');rights.exception={storyId:story.id,assetId:m.asset_id,...Object.fromEntries(['purpose','nature','amount','market'].map(k=>[k,note.match(new RegExp('\\|\\s*'+k+':\\s*([^|]+)'))?.[1]?.trim()||'']))};}
   else requireThat(rights.status==='cleared'&&note.includes('HUMAN IMAGE REVIEW')&&f.rights_evidence_status==='human_cleared','RIGHTS_EVIDENCE_MISSING','The final photo needs its current native human clearance.');
   return {assetId:m.asset_id,file:f.checksum_sha256+'.original',sha256:f.checksum_sha256,source:{url:m.source_page_url,creator:m.creator},rights};});
  return {schemaVersion:1,storyId:story.id,packageVersion:p.production_version,sourceRevision:story.revision,channelId:BUFFER_CHANNEL_ID,caption:p.final_caption,slides};
 }
 async readFinalPackage(storyId){const ctx=await this.context(storyId),story=this.#freshStory(ctx);await this.preparePreview(story,ctx);return {manifest:await this.#manifest(ctx),inputRoot:path.join(this.previews.root,'blobs'),privateRoot:path.join(this.workspace,'exports','buffer'),preserveVerifiedJpeg:true};}
 async readCurrentPackage(storyId){return this.#manifest(await this.context(storyId));}
 async readExistingHandoffs({storyId,channelId}){
  requireThat(channelId===BUFFER_CHANNEL_ID&&this.#reader,'BUFFER_READ_CONNECTION_REQUIRED','The current Buffer account must be readable before sending.');const ctx=await this.context(storyId),account=await this.#reader.account(),matches=[];
  for(const org of account.organizations){const channels=await this.#reader.channels(org.id);if(channels.some(c=>c.id===channelId&&!c.isDisconnected&&!c.isLocked))matches.push(org.id);}requireThat(matches.length===1,'BUFFER_CHANNEL_UNAVAILABLE','Verify the existing MILDINCIDENT Instagram connection.');
  const provider=await this.#reader.posts({organizationId:matches[0],channelId});requireThat(provider.complete,'HANDOFF_AUDIT_INCOMPLETE','The all-status Buffer read did not complete.');
  const rows=[...ctx.manual,...ctx.guarded],active=rows.filter(r=>r.state!=='abandoned'&&r.status!=='abandoned'||r.buffer_id||r.buffer_post_id);requireThat(!active.some(r=>!r.buffer_id&&!r.buffer_post_id),'RECONCILIATION_REQUIRED','An earlier native handoff has no confirmed provider ID.');
  return {complete:true,storyId,channelId,postIds:[...new Set(active.map(r=>r.buffer_id||r.buffer_post_id).filter(Boolean))],observedAt:new Date().toISOString()};
 }
 async createNativeDraft(request){
  const ids=request.assets.map(a=>a.assetId),p=this.#policy,storyId=p?.acceptance?.storyId;requireThat(storyId,'BUFFER_DRAFT_NOT_AUTHORIZED','Approve one exact post before creating a Buffer draft.');const ctx=await this.context(storyId),story=this.#freshStory(ctx);await this.#active('bufferDraft',story);
  const manifest=await this.#manifest(ctx),files=this.#files(ctx);requireThat(request.channelId===BUFFER_CHANNEL_ID&&request.caption===manifest.caption&&canonical(ids)===canonical(manifest.slides.map(s=>s.assetId))&&request.assets.every((a,i)=>a.sha256===files[i].checksum_sha256),'EDIT_CONFLICT','The final native files differ from the confirmed post.');
  const requestId=publishingRequestId(request.idempotencyKey),reply=await this.#call({action:'send',requestId,storyId,packageVersion:manifest.packageVersion,caption:manifest.caption,selectedAssetIds:ids,fileManifest:files.map(f=>({fileRecordId:f.file_record_id,assetId:f.source_asset_id,sha256:f.checksum_sha256})),confirm:'create_one_unscheduled_buffer_draft'});
  if(reply.state==='native_accepted')return {...reply,executionId:String(reply.executionId)};
  requireThat(/^[a-f0-9]{24}$/i.test(reply.bufferPostId||''),'NATIVE_PUBLISHING_UNCERTAIN','No usable Buffer ID was returned. Do not resubmit.');return {id:reply.bufferPostId};
 }
 async observeNativeExecution(attempt){
  const requestId=attempt.native_request_id||publishingRequestId(attempt.request_key),executionId=attempt.native_execution_id||await this.#locate(requestId,attempt.created_at);
  const observed=await this.#operation(executionId);if(observed.state==='running')return {state:'running',executionId,requestId};
  const bound=observed.runs?.['Read Authenticated Studio Publishing Envelope']?.[0]?.data?.main?.[0]?.[0]?.json?.studio_request;requireThat(bound?.action==='send'&&bound.requestId===requestId&&bound.storyId===attempt.story_id&&bound.packageVersion===attempt.expected.packageVersion,'RECONCILIATION_REQUIRED','The native execution does not match this exact send.');
  const ctx=await this.context(attempt.story_id),rows=ctx.guarded.filter(r=>r.request_id==='STUDIO-'+requestId&&r.package_version===attempt.expected.packageVersion),ids=[...new Set(rows.map(r=>r.buffer_post_id).filter(Boolean))];
  requireThat(ids.length<=1,'RECONCILIATION_REQUIRED','Multiple native provider IDs require review.');return {state:'complete',executionId,requestId,postId:ids[0]||null,stoppedBeforeProvider:!observed.runs?.['Buffer Draft or Automatic Queue']};
 }
 async readPost(id){
  requireThat(this.#reader,'BUFFER_READ_CONNECTION_REQUIRED','Independent Buffer read access is required.');const post=await this.#reader.post(id),[manual,guarded]=await Promise.all([this.#rows(T.manual),this.#rows(T.guarded)]),matches=[...manual,...guarded].filter(r=>r.buffer_id===id||r.buffer_post_id===id),scopes=[...new Set(matches.map(r=>JSON.stringify([r.concept_id,r.package_version])))];requireThat(scopes.length===1,'UNVERIFIED_REMOTE','The provider ID has no unambiguous native handoff.');
  const [storyId,version]=JSON.parse(scopes[0]),ctx=await this.context(storyId),batches=[...new Set(matches.map(r=>r.render_batch_id).filter(Boolean))],batch=batches.length===1?batches[0]:ctx.pkg.production_version===version?ctx.pkg.render_batch_id:null;requireThat(batches.length<=1&&batch,'UNVERIFIED_REMOTE','The exact native render batch is unavailable or ambiguous.');const files=ctx.files.filter(f=>f.package_version===version&&f.render_batch_id===batch).sort((a,b)=>a.slide_number-b.slide_number),staged=ctx.staging.filter(s=>s.package_version===version&&s.render_batch_id===batch&&s.verification_status==='public_file_verified');
  requireThat(post.assets.length===files.length&&files.length>0&&files.every((f,i)=>staged.filter(s=>s.file_record_id===f.file_record_id&&s.render_batch_id===f.render_batch_id&&s.checksum_sha256===f.checksum_sha256&&s.public_image_url===post.assets[i].source).length===1),'REMOTE_MISMATCH','Buffer slide URLs/order do not match the verified native files.');
  return {id:post.id,channelId:post.channelId,status:post.status,...(Object.hasOwn(post,'dueAt')?{scheduledAt:post.dueAt}:{}),...(Object.hasOwn(post,'sentAt')?{sentAt:post.sentAt}:{}),caption:post.text,assetHashes:files.map(f=>f.checksum_sha256),verificationSource:'independent_buffer_read_and_native_staging_registry'};
 }
}
