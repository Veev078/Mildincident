import {planStoryPhotos,photoFileKeys,photoRelevance,storyPhotoIdentity} from "./story-intelligence.js";
import {PhotoResearch} from './store.js';import {fetchPhotoPage} from './sources.js';import {browserUrl} from '../workspace/model.js';
import {randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {makePhotoPacket,validatePhotoReceipt,photoDigest,targetPhotoPacket} from './native-contract.js';
import {captureTargetedPhotoResult} from '../n8n/studio-photo-adapter.js';
export class PhotographyService extends PhotoResearch {
 constructor(research,{retrieve=fetchPhotoPage}={}){super(research);this.retrieve=retrieve;this.db.exec('CREATE TABLE IF NOT EXISTS photo_page_cache(source TEXT,query TEXT,page INTEGER,data_json TEXT,cached_at TEXT,PRIMARY KEY(source,query,page))');}
 async page(source,query,page){const prior=this.db.prepare('SELECT * FROM photo_page_cache WHERE source=? AND query=? AND page=?').get(source,query,page);if(prior&&Date.now()-Date.parse(prior.cached_at)<86400000)return JSON.parse(prior.data_json);const photos=await this.retrieve(source,query,page);this.db.prepare('INSERT INTO photo_page_cache VALUES(?,?,?,?,?) ON CONFLICT(source,query,page) DO UPDATE SET data_json=excluded.data_json,cached_at=excluded.cached_at').run(source,query,page,JSON.stringify(photos),new Date().toISOString());return photos;}
 indexNative(snapshot){const photos=(snapshot?.records?.media||[]).filter(m=>m.asset_id).map(m=>({id:'native:'+m.asset_id,source:'saved',nativeStoryId:m.concept_id,title:m.title||'',creator:m.creator||'',description:(snapshot?.records?.stories||[]).find(s=>s.concept_id===m.concept_id)?.subject||'',contextBasis:'linked_story_metadata_not_image_identity',series:'',date:'',foundAt:m.found_date||'',sourceUrl:browserUrl(m.source_page_url),previewUrl:browserUrl(m.thumb_url),fileUrl:browserUrl(m.file_url),rightsLabel:m.license||'Unknown',rightsStatus:m.rights_status||'unreviewed',sourceConfidence:'existing_native_metadata',technicalStatus:'reference_not_decoded',publicationApproved:false,rightsGranted:false,retrievedAt:snapshot.observedAt}));this.put(photos);}
 resume(id,pages=1){return this.run(id,pages,h=>h.source==='saved'?Promise.resolve(this.searchPage(h.query,h.mode,h.page)):this.page(h.source,h.query,h.page));}

 storyTables(){this.db.exec('CREATE TABLE IF NOT EXISTS photo_story_requests(request_id TEXT PRIMARY KEY,story_id TEXT NOT NULL,state TEXT NOT NULL,data_json TEXT NOT NULL,created_at TEXT NOT NULL)');}
 storyRequest(id){this.storyTables();const row=this.db.prepare('SELECT * FROM photo_story_requests WHERE request_id=?').get(id);return row?{...JSON.parse(row.data_json),id:row.request_id,storyId:row.story_id,state:row.state}:null;}
 photoContextMatches(story,target){return story?.id===target.storyId&&story.revision===target.sourceRevision&&!story.localDraft?.stale&&(story.localDraft?.version||0)===target.workingVersion&&story.media?.some(m=>m.id===target.assetId&&(m.localPreview?.sha256||null)===target.previewSha256);}
 prepareStoryRequest(story,request,{source='commons',direction='series',custom='',parentId=null}={}){
  this.storyTables();const continuation=request?.continuation,target=continuation?.origin;
  requireThat(['commons','loc','aic'].includes(source)&&target&&this.photoContextMatches(story,target),'INVALID_PHOTO_TARGET','Use the unchanged story, photograph and saved direction.');
  const parent=parentId?this.storyRequest(parentId):null;
  if(parentId)requireThat(parent?.storyId===story.id&&parent.state==='complete'&&parent.receipt?.hasMore&&parent.packet.payload.target.sourceRevision===story.revision&&parent.packet.payload.direction.source===source,'INVALID_PHOTO_QUERY','Continue a completed search on the same story and source.');
  const plan=parent?{...parent.plan,page:parent.packet.payload.direction.page+1,query:parent.packet.payload.direction.query,source}:planStoryPhotos(story,{source,direction,custom});
  const prior=this.storyRequest(request.id);if(prior){requireThat(prior.packet.payload.direction.source===source&&prior.packet.payload.direction.query===plan.query&&prior.packet.payload.direction.page===plan.page&&JSON.stringify(prior.packet.payload.target)===JSON.stringify({storyId:target.storyId,sourceRevision:target.sourceRevision,workingVersion:target.workingVersion,assetId:target.assetId,previewSha256:target.previewSha256}),'EDIT_CONFLICT','This photograph request already belongs to another context.');return this.storyRequestView(prior);}
  const query=plan.query,hunt=this.create({query,mode:'image',source,idempotencyKey:request.id}),photo=continuation.photograph;
  const packet=targetPhotoPacket(makePhotoPacket(hunt,[{id:target.assetId,title:photo.title,creator:photo.creatorReported,date:'',description:photo.caption,sourceUrl:photo.sourceUrl,previewUrl:'',nativeStoryId:story.id}],{page:plan.page}),continuation);
  const data={packet,plan,parentId,createdAt:request.createdAt,executionVerified:false,receipt:null};this.db.prepare('INSERT INTO photo_story_requests VALUES(?,?,?,?,?)').run(request.id,story.id,'prepared',JSON.stringify(data),data.createdAt);return this.storyRequestView(this.storyRequest(request.id));
 }
 storyRequestView(p){const messages={prepared:'Review the direction, then search one archive page. No AI or native workflow starts.',fetching:'One source request is in progress. It will not be repeated automatically.',complete:'Photograph references are saved to this story. Preview, identity and rights review remain separate.',unavailable:'The source could not be reached or its response was unusable. No automatic retry was made.',review_required:'Results are retained, but the story changed during retrieval. Review the saved context before using them.'};
  return {id:p.id,state:p.state==='fetching'&&!this.running.has(p.id)?'uncertain':p.state,source:p.packet.payload.direction.source,query:p.packet.payload.direction.query,createdAt:p.createdAt,sourceRevision:p.packet.payload.target.sourceRevision,workingVersion:p.packet.payload.target.workingVersion,photoCount:p.receipt?.photos?.length||0,newPhotoCount:p.displayPhotoIds?.length??p.receipt?.photos?.length??0,duplicateCount:p.duplicateCount||0,relevanceCounts:p.relevanceCounts||null,page:p.packet.payload.direction.page,hasMore:p.state==='complete'&&p.receipt?.hasMore===true,plan:p.plan||null,executionVerified:p.executionVerified===true,executionId:p.receipt?.executionId||null,errorCode:p.errorCode||null,message:p.errorCode?.match(/^ARCHIVE_HTTP_(401|403)$/)?'The archive denied access ('+p.errorCode.replace('ARCHIVE_HTTP_','HTTP ')+'). Review source access before a new request. No automatic retry was made.':p.state==='fetching'&&!this.running.has(p.id)?'The source request outcome needs checking after restart. It will not be resent.':messages[p.state]||'Outcome needs checking; do not resend this request.',sourceCalls:p.sourceCalls||0,paidCalls:0,rightsGranted:false};
 }
 storyRequestsFor(story){this.storyTables();return this.db.prepare('SELECT request_id FROM photo_story_requests WHERE story_id=? ORDER BY rowid DESC').all(story.id).map(r=>this.storyRequestView(this.storyRequest(r.request_id)));}
 async searchStoryRequest(story,id,input,{readStory=()=>story}={}){
  const p=this.storyRequest(id);requireThat(p&&p.storyId===story.id&&input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','confirm'].includes(k))&&input.confirm===true,'INVALID_PHOTO_TARGET','Confirm one saved story-specific archive request.');
  if(p.state!=='prepared')return this.storyRequestView(p); // Read-only reconciliation, never a second source request.
  requireThat(input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0)&&this.photoContextMatches(readStory(),p.packet.payload.target),'EDIT_CONFLICT','The story or selected photograph changed. Prepare a fresh request.');
  const d=p.packet.payload.direction,cached=this.db.prepare('SELECT cached_at FROM photo_page_cache WHERE source=? AND query=? AND page=?').get(d.source,d.query,d.page);p.sourceCalls=cached&&Date.now()-Date.parse(cached.cached_at)<86400000?0:1;
  p.startedAt=new Date().toISOString();const claim=this.db.prepare("UPDATE photo_story_requests SET state='fetching',data_json=? WHERE request_id=? AND state='prepared'").run(JSON.stringify(p),id);if(!claim.changes)return this.storyRequestView(this.storyRequest(id));
  this.running.add(id);let receipt;
  try{const found=await this.page(d.source,d.query,d.page);receipt={schemaVersion:1,purpose:'private_photographic_research_result',requestId:id,inputDigest:p.packet.digest,target:p.packet.payload.target,source:d.source,query:d.query,page:d.page,status:'ok',photos:Array.isArray(found)?found:found.photos,hasMore:Array.isArray(found)?found.length>0:found.hasMore===true,observedAt:new Date().toISOString(),executionId:null,remoteWrites:0,paidCalls:0,rightsGranted:false};validatePhotoReceipt(receipt,p.packet);}
  catch(error){p.errorCode=/^ARCHIVE_[A-Z0-9_]+$/.test(error.message||'')?error.message:'SOURCE_UNAVAILABLE';this.db.prepare("UPDATE photo_story_requests SET state='unavailable',data_json=? WHERE request_id=?").run(JSON.stringify(p),id);this.running.delete(id);return this.storyRequestView(this.storyRequest(id));}
  try{return this.storeStoryReceipt(p,receipt,{readStory,executionVerified:false});}finally{this.running.delete(id);}
 }
 storeStoryReceipt(p,receipt,{readStory,executionVerified}){
  validatePhotoReceipt(receipt,p.packet);const state=this.photoContextMatches(readStory(),p.packet.payload.target)?'complete':'review_required';
  this.put(receipt.photos.map(photo=>({...photo,rightsStatus:'unreviewed',rightsGranted:false,publicationApproved:false,sourceConfidence:'source_metadata_not_identity_verification',technicalStatus:photo.previewUrl?'reference_not_decoded':'no_preview_reference',contextBasis:'story_bound_archive_receipt',nativeExecutionId:executionVerified?receipt.executionId:null})),p.id);
  const current=readStory(),known=new Set([...(current?.media||[]),...this.storyMedia(current||{id:p.storyId})].flatMap(photoFileKeys)),displayPhotoIds=[];let duplicateCount=0;for(const photo of receipt.photos){const keys=photoFileKeys(photo),duplicate=keys.some(k=>known.has(k));keys.forEach(k=>known.add(k));if(duplicate){duplicateCount++;continue;}displayPhotoIds.push(photo.id);}
  const relevanceCounts={direct:0,context:0,unconfirmed:0},identity=storyPhotoIdentity(current||{});for(const photo of receipt.photos)if(displayPhotoIds.includes(photo.id))relevanceCounts[photoRelevance({...photo,sourceCaption:photo.description,photoExplorationDirection:p.plan?.direction},identity).category]++;
  this.db.prepare('UPDATE photo_hunts SET page=?,state=? WHERE id=?').run(receipt.page+1,receipt.hasMore?'paused':'complete',p.id);
  const data={...p,receipt,displayPhotoIds,duplicateCount,relevanceCounts,executionVerified:executionVerified===true};this.db.prepare('UPDATE photo_story_requests SET state=?,data_json=? WHERE request_id=?').run(state,JSON.stringify(data),p.id);return this.storyRequestView(this.storyRequest(p.id));
 }
 acceptStoryNativeResult(id,execution,review,{readStory}){
  const p=this.storyRequest(id);requireThat(p&&review?.workflowId==='Zouc5I3MQwRJhfXG'&&review.requestId===id&&review.inputDigest===p.packet.digest,'INVALID_PHOTO_RECEIPT','Use the separately reviewed original sourcing request and exact execution.');
  const receipt=captureTargetedPhotoResult(execution,p.packet,review);if(p.receipt){requireThat(photoDigest(p.receipt)===photoDigest(receipt),'EDIT_CONFLICT','Another receipt is already retained for this request.');return this.storyRequestView(p);}
  return this.storeStoryReceipt(p,receipt,{readStory,executionVerified:true});
 }
 storyMedia(story){this.storyTables();const photos=[];
  for(const row of this.db.prepare("SELECT request_id FROM photo_story_requests WHERE story_id=? AND state='complete' ORDER BY rowid").all(story.id)){
   const p=this.storyRequest(row.request_id);if(p.packet.payload.target.sourceRevision!==story.revision)continue;
   for(const photo of p.receipt?.photos||[]){if(p.displayPhotoIds&&!p.displayPhotoIds.includes(photo.id))continue;photos.push({id:'photo:'+photoDigest({requestId:p.id,photoId:photo.id}).slice(0,32),title:photo.title,creator:photo.creator,sourceUrl:photo.sourceUrl,previewUrl:photo.previewUrl,fileUrl:photo.fileUrl,license:photo.rightsLabel,rightsStatus:'unreviewed',creatorVerified:false,sourceRelation:'not_inspected',sourceCaption:photo.description,photoRequestId:p.id,reportedWidth:photo.width||null,reportedHeight:photo.height||null,sourceRecordMedium:photo.recordMedium||'',photoExplorationDirection:p.plan?.direction||'series',photoExecutionId:p.executionVerified?p.receipt.executionId:null,receiptBasis:p.executionVerified?'verified_native_execution':'direct_archive_metadata',originalDownloadVerified:false,pixelAnalysisPerformed:false,rightsGranted:false});}
  }return photos;
 }

 nativeTables(){this.db.exec('CREATE TABLE IF NOT EXISTS photo_native_packets(digest TEXT PRIMARY KEY,hunt_id TEXT NOT NULL,packet_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS photo_native_receipts(digest TEXT PRIMARY KEY,input_digest TEXT NOT NULL,result_hunt_id TEXT NOT NULL,receipt_json TEXT NOT NULL)');}
 exportNative(id,{photoIds=[],source,page}={}){
  this.nativeTables();const hunt=this.get(id);requireThat(hunt&&Array.isArray(photoIds)&&photoIds.length<=20&&new Set(photoIds).size===photoIds.length,'INVALID_PHOTO_PACKET','Choose a trail and up to 20 references per packet; continue with further packets.');
  const photos=photoIds.map(id=>{const row=this.db.prepare('SELECT data_json FROM photo_candidates WHERE id=?').get(id);requireThat(row,'INVALID_PHOTO_PACKET','A chosen photograph is unavailable.');return {...JSON.parse(row.data_json),decision:this.db.prepare('SELECT decision,reason FROM photo_decisions WHERE photo_id=? ORDER BY rowid DESC LIMIT 1').get(id)||null};});
  const packet=makePhotoPacket(hunt,photos,{...(source?{source}:{}),...(page!==undefined?{page}:{})});this.db.prepare('INSERT OR IGNORE INTO photo_native_packets VALUES(?,?,?)').run(packet.digest,id,JSON.stringify(packet));return packet;
 }
 importNative(receipt){
  if(Array.isArray(receipt)){requireThat(receipt.length===1,'INVALID_PHOTO_RECEIPT','Import one returned n8n item, not an ambiguous batch.');receipt=receipt[0];}
  if(receipt?.json&&Object.keys(receipt).every(k=>['json','pairedItem'].includes(k)))receipt=receipt.json;
  this.nativeTables();const saved=this.db.prepare('SELECT * FROM photo_native_packets WHERE digest=?').get(receipt?.inputDigest||'');requireThat(saved,'INVALID_PHOTO_RECEIPT','Export the originating packet from this workspace first.');const packet=JSON.parse(saved.packet_json);validatePhotoReceipt(receipt,packet);const digest=photoDigest(receipt),prior=this.db.prepare('SELECT result_hunt_id FROM photo_native_receipts WHERE digest=?').get(digest);if(prior)return {hunt:this.get(prior.result_hunt_id),replayed:true,executionVerified:false,productionApplied:false};
  const childId=digest.slice(0,8)+'-'+digest.slice(8,12)+'-'+digest.slice(12,16)+'-'+digest.slice(16,20)+'-'+digest.slice(20,32);
  const d=packet.payload.direction;this.create({query:d.query,mode:d.mode,source:d.source,parent:saved.hunt_id,idempotencyKey:childId});
  const fields=['id','source','query','title','creator','date','description','series','sourceUrl','previewUrl','fileUrl','rightsLabel'];
  this.put(receipt.photos.map(p=>({...Object.fromEntries(fields.map(k=>[k,p[k]])),rightsStatus:'unreviewed',rightsGranted:false,publicationApproved:false,sourceConfidence:'imported_receipt_unverified',technicalStatus:p.previewUrl?'reference_not_decoded':'no_preview_reference',contextBasis:'native_research_receipt_metadata_not_verified',recordMedium:typeof p.recordMedium==='string'?p.recordMedium.slice(0,2000):'',creatorRole:p.source==='aic'?'source_record_creator_not_verified_as_photographer':'',receiptBasis:receipt.executionId?'reported_execution_unverified':'offline_replay',nativeExecutionId:receipt.executionId,retrievedAt:receipt.observedAt})),childId);
  this.db.prepare('UPDATE photo_hunts SET page=?,state=? WHERE id=?').run(receipt.page+(receipt.status==='ok'?1:0),receipt.status!=='ok'?'unavailable':receipt.hasMore?'paused':'complete',childId);this.db.prepare('INSERT INTO photo_native_receipts VALUES(?,?,?,?)').run(digest,packet.digest,childId,JSON.stringify(receipt));return {hunt:this.get(childId),replayed:false,executionVerified:false,productionApplied:false};
 }

 /** Save founder-supplied public references without fetching a page or manufacturing metadata. */
 saveReference(input) {
  const allowed=['idempotencyKey','huntId','title','sourceUrl','previewUrl','creator','date','context'];
  requireThat(input&&Object.keys(input).every(k=>allowed.includes(k)),'INVALID_PHOTO_REFERENCE','Save source metadata only; publication status cannot be supplied here.');
  for(const [key,max] of [['title',300],['creator',500],['date',200],['context',2000]])
   requireThat((input[key]===undefined||typeof input[key]==='string')&&String(input[key]||'').length<=max,'INVALID_PHOTO_REFERENCE','Source metadata is invalid or too long.');
  requireThat(typeof input.title==='string'&&input.title.trim().length>=2,'INVALID_PHOTO_REFERENCE','Add a title for this research reference.');
  const sourceUrl=safePhotoReference(input.sourceUrl),previewUrl=safePhotoReference(input.previewUrl);
  requireThat(sourceUrl&&(!input.previewUrl||previewUrl),'INVALID_PHOTO_REFERENCE','Use public HTTPS references without credentials; the preview is optional.');
  const ticket=input.idempotencyKey||randomUUID();
  requireThat(typeof ticket==='string'&&/^[a-f0-9-]{36}$/.test(ticket),'INVALID_PHOTO_REFERENCE','Use a valid request identity.');
  const id='manual:'+ticket;
  const record={id,source:'manual',title:input.title.trim(),creator:(input.creator||'').trim(),date:(input.date||'').trim(),description:(input.context||'').trim(),series:'',sourceUrl,previewUrl,fileUrl:'',contextBasis:'founder_supplied_reference_not_verified',rightsLabel:'Unknown — private research only',rightsStatus:'unreviewed',sourceConfidence:'founder_supplied_metadata_unverified',technicalStatus:'reference_not_decoded',editorialAssessment:'not_reviewed',publicationApproved:false,rightsGranted:false};
  const prior=this.db.prepare('SELECT data_json FROM photo_candidates WHERE id=?').get(id);
  if(prior){const old=JSON.parse(prior.data_json);requireThat(Object.entries(record).every(([k,v])=>old[k]===v),'EDIT_CONFLICT','This reference request was already saved with different metadata.');}
  const huntId=input.huntId||ticket;
  if(input.huntId)requireThat(this.get(huntId),'INVALID_PHOTO_REFERENCE','The selected research trail is unavailable.');
  else this.create({query:record.title,source:'saved',mode:'image',idempotencyKey:ticket});
  this.put([{...record,retrievedAt:prior?JSON.parse(prior.data_json).retrievedAt:new Date().toISOString()}],huntId);
  return {hunt:this.get(huntId),photoId:id,rightsGranted:false,productionApplied:false,networkRequests:0};
 }
}
