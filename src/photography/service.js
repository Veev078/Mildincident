import {planStoryPhotos,photoFileKeys,photoRelevance,storyPhotoIdentity} from "./story-intelligence.js";
import {PhotoResearch} from './store.js';import {fetchPhotoPage} from './sources.js';import {browserUrl} from '../workspace/model.js';
import {randomUUID,createHash} from 'node:crypto';
import {requireThat} from '../errors.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {makePhotoPacket,validatePhotoReceipt,photoDigest,targetPhotoPacket} from './native-contract.js';
import {captureTargetedPhotoResult} from '../n8n/studio-photo-adapter.js';
import {acquireReceiptImage,permittedSourceImage} from './source-images.js';
import {automaticPhotoPlan,fetchProjectPage,projectPageReferences,permittedProjectPage} from './project-sources.js';
export class PhotographyService extends PhotoResearch {
 constructor(research,{retrieve=fetchPhotoPage,readProjectPage=fetchProjectPage,previews=null,fetchImage=fetch}={}){super(research);this.retrieve=retrieve;this.readProjectPage=readProjectPage;this.previews=previews;this.fetchImage=fetchImage;this.db.exec('CREATE TABLE IF NOT EXISTS photo_page_cache(source TEXT,query TEXT,page INTEGER,data_json TEXT,cached_at TEXT,PRIMARY KEY(source,query,page))');}
 async page(source,query,page){const prior=this.db.prepare('SELECT * FROM photo_page_cache WHERE source=? AND query=? AND page=?').get(source,query,page);if(prior&&Date.now()-Date.parse(prior.cached_at)<86400000)return JSON.parse(prior.data_json);const photos=await this.retrieve(source,query,page);this.db.prepare('INSERT INTO photo_page_cache VALUES(?,?,?,?,?) ON CONFLICT(source,query,page) DO UPDATE SET data_json=excluded.data_json,cached_at=excluded.cached_at').run(source,query,page,JSON.stringify(photos),new Date().toISOString());return photos;}
 indexNative(snapshot){const photos=(snapshot?.records?.media||[]).filter(m=>m.asset_id).map(m=>({id:'native:'+m.asset_id,source:'saved',nativeStoryId:m.concept_id,title:m.title||'',creator:m.creator||'',description:(snapshot?.records?.stories||[]).find(s=>s.concept_id===m.concept_id)?.subject||'',contextBasis:'linked_story_metadata_not_image_identity',series:'',date:'',foundAt:m.found_date||'',sourceUrl:browserUrl(m.source_page_url),previewUrl:browserUrl(m.thumb_url),fileUrl:browserUrl(m.file_url),rightsLabel:m.license||'Unknown',rightsStatus:m.rights_status||'unreviewed',sourceConfidence:'existing_native_metadata',technicalStatus:'reference_not_decoded',publicationApproved:false,rightsGranted:false,retrievedAt:snapshot.observedAt}));this.put(photos);}
 resume(id,pages=1){return this.run(id,pages,h=>h.source==='saved'?Promise.resolve(this.searchPage(h.query,h.mode,h.page)):this.page(h.source,h.query,h.page));}

 storyTables(){this.db.exec('CREATE TABLE IF NOT EXISTS photo_story_requests(request_id TEXT PRIMARY KEY,story_id TEXT NOT NULL,state TEXT NOT NULL,data_json TEXT NOT NULL,created_at TEXT NOT NULL)');}
 storyRequest(id){this.storyTables();const row=this.db.prepare('SELECT * FROM photo_story_requests WHERE request_id=?').get(id);return row?{...JSON.parse(row.data_json),id:row.request_id,storyId:row.story_id,state:row.state}:null;}
 storyProjectTrails(story){
  this.storyTables();const identity=storyPhotoIdentity(story),trails=[],seen=new Set();
  for(const row of this.db.prepare("SELECT request_id FROM photo_story_requests WHERE story_id=? AND state='complete' ORDER BY rowid DESC").all(story.id)){
   const p=this.storyRequest(row.request_id);
   if(p.packet.payload.target.sourceRevision!==story.revision)continue;
   for(const capture of p.sourceCaptures||[p.sourceCapture]){
    if(!capture?.identity||capture.identity.photographer!==identity.photographer||capture.identity.series!==identity.series)continue;
    for(const link of capture.projectTrails||[])if(!seen.has(link.url)){seen.add(link.url);trails.push(link);if(trails.length===8)return trails;}
   }
  }return trails;
 }
 photoContextMatches(story,target){return story?.id===target.storyId&&story.revision===target.sourceRevision&&!story.localDraft?.stale&&(story.localDraft?.version||0)===target.workingVersion&&(target.scope==='story_source'&&target.assetId===null||story.media?.some(m=>m.id===target.assetId&&(m.localPreview?.sha256||null)===target.previewSha256));}

 /** Same durable request/receipt ledger. Local page reading is explicitly distinct
  * from the separately reviewed archive-only native packet, which stays intact. */
 prepareDiscovery(story,input){
  this.storyTables();
  requireThat(input&&Object.keys(input).every(k=>['idempotencyKey','sourceRevision','workingVersion','direction','custom','sourceUrl','html'].includes(k))&&/^[a-f0-9-]{36}$/.test(input.idempotencyKey)&&input.sourceRevision===story?.revision&&input.workingVersion===(story.localDraft?.version||0)&&!story.localDraft?.stale,'INVALID_PHOTO_TARGET','Save your edits and use the current story before finding photographs.');
  const plan=automaticPhotoPlan({...story,recordedProjectLinks:[...(story.recordedProjectLinks||[]),...this.storyProjectTrails(story)]},{direction:input.direction||'best',custom:input.custom||''});
  const imported=input.html!==undefined;
  if(imported){requireThat(safePhotoReference(input.sourceUrl)&&typeof input.html==='string'&&Buffer.byteLength(input.html)<=2000000&&input.html.length>=20,'INVALID_PHOTO_SOURCE','Choose an original public URL and its saved HTML page, up to 2 MB.');Object.assign(plan,{source:'project',sourceUrl:input.sourceUrl,route:'saved_page',reason:'Inspect the saved page you supplied. Its origin and captions remain unverified; no network request is made.',sourceCalls:0});}
  else requireThat(input.sourceUrl===undefined,'PHOTO_SOURCE_NOT_BOUND','Automatic discovery follows only source URLs already retained on this story.');
  const target={storyId:story.id,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,assetId:null,previewSha256:null,scope:'story_source'};
  const payload={purpose:'private_story_photo_discovery',requestId:input.idempotencyKey,target,direction:{source:plan.source,query:plan.query,page:1,photographicDirection:plan.direction,custom:plan.custom},sourceUrl:plan.sourceUrl,route:plan.route,sourcePolicy:plan.sourcePolicy,sourceCandidates:plan.sourceCandidates,relevancePolicy:plan.relevancePolicy,htmlSha256:imported?createHash('sha256').update(input.html).digest('hex'):null,budget:{sourceCalls:plan.sourceCalls,imageCalls:imported?0:plan.imageCalls,automaticRetries:0,paidCalls:0,remoteWrites:0},rightsGranted:false};
  const packet={schemaVersion:2,payload,digest:photoDigest(payload)},prior=this.storyRequest(input.idempotencyKey);
  if(prior){requireThat(prior.packet.digest===packet.digest,'EDIT_CONFLICT','This request is already bound to another source or story version.');return this.storyRequestView(prior);}
  requireThat(!this.db.prepare("SELECT request_id FROM photo_story_requests WHERE story_id=? AND state='fetching'").get(story.id),'EDIT_CONFLICT','A photograph request is already in progress or needs reconciliation. It will not be repeated.');
  this.create({query:plan.query,source:'saved',mode:'image',idempotencyKey:input.idempotencyKey});
  const data={packet,plan,createdAt:new Date().toISOString(),executionVerified:false,receipt:null,...(imported?{savedHtml:input.html}:{})};
  this.db.prepare('INSERT INTO photo_story_requests VALUES(?,?,?,?,?)').run(input.idempotencyKey,story.id,'prepared',JSON.stringify(data),data.createdAt);return this.storyRequestView(this.storyRequest(input.idempotencyKey));
 }
 async searchDiscovery(story,p,input,{readStory}){
  requireThat(input.confirm===true&&Object.keys(input).every(k=>['sourceRevision','workingVersion','confirm'].includes(k)),'INVALID_PHOTO_TARGET','Confirm the saved photographic request.');
  if(p.state!=='prepared')return this.storyRequestView(p);
  requireThat(input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0)&&this.photoContextMatches(readStory(),p.packet.payload.target),'EDIT_CONFLICT','The story changed. Save it before a new photograph request.');
  const payload=p.packet.payload;
  requireThat(photoDigest(payload)===p.packet.digest&&payload.requestId===p.id&&payload.purpose==='private_story_photo_discovery'&&payload.direction.source===p.plan.source&&payload.direction.query===p.plan.query&&payload.direction.photographicDirection===p.plan.direction&&payload.direction.custom===p.plan.custom&&payload.sourceUrl===p.plan.sourceUrl&&payload.route===p.plan.route&&payload.relevancePolicy===p.plan.relevancePolicy&&payload.budget.sourceCalls===p.plan.sourceCalls&&payload.budget.paidCalls===0&&payload.budget.automaticRetries===0&&payload.budget.remoteWrites===0&&payload.rightsGranted===false,'INVALID_PHOTO_RECEIPT','The saved photo request changed. No source request was made.');
  if(payload.sourcePolicy)requireThat(payload.sourcePolicy==='recorded_fallback_v2'&&payload.sourcePolicy===p.plan.sourcePolicy&&JSON.stringify(payload.sourceCandidates)===JSON.stringify(p.plan.sourceCandidates)&&payload.budget.imageCalls===(p.plan.route==='saved_page'?0:6),'INVALID_PHOTO_RECEIPT','The saved source and image budgets changed.');
  if(p.plan.route==='saved_page')requireThat(typeof p.savedHtml==='string'&&createHash('sha256').update(p.savedHtml).digest('hex')===payload.htmlSha256,'INVALID_PHOTO_RECEIPT','The saved page differs from the reviewed request.');
  p.startedAt=new Date().toISOString();const cache=p.plan.source!=='project'&&this.db.prepare('SELECT cached_at FROM photo_page_cache WHERE source=? AND query=? AND page=1').get(p.plan.source,p.plan.query);p.sourceCalls=p.plan.source==='project'||cache&&Date.now()-Date.parse(cache.cached_at)<86400000?0:p.plan.sourceCalls;
  if(!this.db.prepare("UPDATE photo_story_requests SET state='fetching',data_json=? WHERE request_id=? AND state='prepared'").run(JSON.stringify(p),p.id).changes)return this.storyRequestView(this.storyRequest(p.id));
  this.running.add(p.id);
  try{
   if(p.plan.route==='source_assisted')throw Error('SOURCE_READER_UNAVAILABLE');
   let found,sourceCapture=null;
   if(p.plan.source==='project'){
    const captures=[],visited=new Set();
    const read=async(context,url)=>{
     requireThat(permittedProjectPage(context,url),'PHOTO_SOURCE_NOT_BOUND','Only an exact recorded project link on a supported source can be followed.');
     requireThat(!visited.has(url)&&p.sourceCalls<payload.budget.sourceCalls&&this.photoContextMatches(readStory(),payload.target),'INVALID_PHOTO_TARGET','The source budget or story changed. No further page was read.');
     visited.add(url);p.sourceCalls++;p.sourceAttempts=[...(p.sourceAttempts||[]),{url,startedAt:new Date().toISOString()}];
     this.db.prepare("UPDATE photo_story_requests SET data_json=? WHERE request_id=?").run(JSON.stringify(p),p.id);
     const html=await this.readProjectPage(context,url),result=projectPageReferences(story,{url,html,direction:p.plan.direction});captures.push(result.sourceCapture);p.sourceCaptures=[...captures];p.sourceCapture=result.sourceCapture;p.sourceAttempts.at(-1).status='captured';
     this.db.prepare("UPDATE photo_story_requests SET data_json=? WHERE request_id=?").run(JSON.stringify(p),p.id);return result;
    };
    const initialContext={...story,recordedProjectLinks:[...(story.recordedProjectLinks||[]),...this.storyProjectTrails(story)]};
    if(p.plan.route==='saved_page'){
     const result=projectPageReferences(story,{url:p.plan.sourceUrl,html:p.savedHtml,direction:p.plan.direction,basis:'founder_supplied_saved_page'});found=result.photos;sourceCapture=result.sourceCapture;
    }else if(payload.sourcePolicy==='recorded_fallback_v2'){
     let context=initialContext,next=p.plan.sourceUrl,lastError;found=[];
     while(next&&p.sourceCalls<payload.budget.sourceCalls){
      try{
       const result=await read(context,next);sourceCapture=result.sourceCapture;found.push(...result.photos);
       context={...initialContext,recordedProjectLinks:[...(initialContext.recordedProjectLinks||[]),...captures.flatMap(c=>c.projectTrails||[])]};
      }catch(error){
       lastError=error;const attempt=p.sourceAttempts.at(-1);attempt.status='failed';attempt.errorCode=/^SOURCE_[A-Z0-9_]+$/.test(error.message||'')?error.message:'SOURCE_UNAVAILABLE';p.failedSourceUrl=next;
       this.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(p),p.id);
       // Only known denied/missing pages can fall through to a DIFFERENT source.
       // Uncertain transport failures stop; no URL is ever automatically retried.
       if(!/^SOURCE_HTTP_(401|403|404|410)$/.test(error.message||''))throw error;
      }
      next=[...captures.flatMap(c=>c.projectTrails||[]).map(l=>l.url),...(payload.sourceCandidates||[])].find(u=>!visited.has(u)&&permittedProjectPage(context,u));
     }
     if(!captures.length)throw lastError||Error('SOURCE_NOT_FOUND');
     found=[...new Map(found.map(photo=>[photo.id,photo])).values()].sort((a,b)=>photoRelevance(b,p.plan.identity).score-photoRelevance(a,p.plan.identity).score).slice(0,40);
    }else{
     let result=await read(initialContext,p.plan.sourceUrl);found=result.photos;sourceCapture=result.sourceCapture;
     if(p.sourceCalls<payload.budget.sourceCalls){const context={...initialContext,recordedProjectLinks:[...(initialContext.recordedProjectLinks||[]),...(sourceCapture.projectTrails||[])]},link=sourceCapture.projectTrails?.find(link=>!visited.has(link.url)&&permittedProjectPage(context,link.url));if(link){result=await read(context,link.url);found=[...new Map([...found,...result.photos].map(photo=>[photo.id,photo])).values()].slice(0,40);sourceCapture=result.sourceCapture;}}
    }
   }else{const page=await this.page(p.plan.source,p.plan.query,1);found=Array.isArray(page)?page:page.photos;}
   requireThat(Array.isArray(found)&&found.length<=40,'INVALID_PHOTO_RECEIPT','The source result exceeds the bounded reference count.');
   const receipt={schemaVersion:2,purpose:'private_story_photo_result',requestId:p.id,inputDigest:p.packet.digest,target:p.packet.payload.target,source:p.plan.source,query:p.plan.query,page:1,status:'ok',photos:found,hasMore:false,observedAt:new Date().toISOString(),executionId:null,remoteWrites:0,paidCalls:0,rightsGranted:false};
   const acquiring=Boolean(this.previews&&payload.budget.imageCalls>0&&sourceCapture?.networkFetched);
   this.storeStoryReceipt({...p,sourceCapture,savedHtml:undefined},receipt,{readStory,executionVerified:false,pendingAcquisition:acquiring});
   if(acquiring)await this.acquireStoryImages(story,p.id,{readStory});
   return this.storyRequestView(this.storyRequest(p.id));
  }catch(error){
   p.errorCode=/^(?:SOURCE|ARCHIVE)_[A-Z0-9_]+$/.test(error.message||'')?error.message:'SOURCE_UNAVAILABLE';
   const pending=p.sourceAttempts?.find(attempt=>!attempt.status);if(pending){pending.status='failed';pending.errorCode=p.errorCode;p.failedSourceUrl=pending.url;}
   this.db.prepare("UPDATE photo_story_requests SET state='unavailable',data_json=? WHERE request_id=?").run(JSON.stringify(p),p.id);return this.storyRequestView(this.storyRequest(p.id));
  }
  finally{this.running.delete(p.id);}
 }
 async acquireStoryImages(story,id,{readStory}){
  const p=this.storyRequest(id);if(p.state!=='fetching')return;
  const save=()=>this.db.prepare('UPDATE photo_story_requests SET data_json=? WHERE request_id=?').run(JSON.stringify(p),id);
  const assertCurrent=()=>requireThat(this.photoContextMatches(readStory(),p.packet.payload.target),'EDIT_CONFLICT','The story changed while photographs were being retrieved.');
  const known=new Set((readStory().media||[]).map(asset=>this.previews.get(story.id,asset.id)?.originalSha256).filter(Boolean));
  p.imageAttempts=[];p.pixelDuplicateIds=[];
  for(const photo of p.receipt.photos){
   const existing=(readStory().media||[]).find(a=>photoFileKeys(a).some(k=>photoFileKeys(photo).includes(k)));
   if(!p.displayPhotoIds.includes(photo.id)&&!existing)continue;
   if(existing&&this.previews.get(story.id,existing.id))continue;
   if(p.imageAttempts.filter(a=>a.networkAttempted).length>=p.packet.payload.budget.imageCalls)break;
   const attempt={photoId:photo.id,sourceUrl:photo.sourceUrl,imageUrl:photo.previewUrl,networkAttempted:false,status:'unsupported_host'};
   p.imageAttempts.push(attempt);save();
   if(!permittedSourceImage(photo.sourceUrl,photo.previewUrl))continue;
   try{
    assertCurrent();attempt.networkAttempted=true;attempt.status='fetching';save();
    const acquired=await acquireReceiptImage({story,request:p,photo,store:this.previews,existingAssetId:existing?.id||null,fetchImpl:this.fetchImage,assertCurrent});
    Object.assign(attempt,{status:'decoded',bytes:acquired.bytes,contentType:acquired.contentType,sha256:acquired.preview.sha256,originalSha256:acquired.preview.originalSha256});
    if(existing){attempt.status='cached_existing';}else if(known.has(acquired.preview.originalSha256)){attempt.status='exact_duplicate';p.pixelDuplicateIds.push(photo.id);p.displayPhotoIds=p.displayPhotoIds.filter(id=>id!==photo.id);}else known.add(acquired.preview.originalSha256);
    known.add(acquired.preview.originalSha256);
   }catch(error){attempt.status='unavailable';attempt.errorCode=/^[A-Z_0-9]+$/.test(error.code||error.message||'')?(error.code||error.message):'SOURCE_CONNECTION_FAILED';save();if(!/^SOURCE_HTTP_\d+$/.test(attempt.errorCode))break;}
   save();
  }
  p.relevanceCounts={direct:0,context:0,unconfirmed:0};for(const photo of p.receipt.photos)if(p.displayPhotoIds.includes(photo.id))p.relevanceCounts[photoRelevance({...photo,sourceCaption:photo.description},p.plan.identity).category]++;
  save();this.db.prepare('UPDATE photo_story_requests SET state=? WHERE request_id=?').run(this.photoContextMatches(readStory(),p.packet.payload.target)?'complete':'review_required',id);
 }
 closeInterruptedDiscovery(story,id,input){
  const p=this.storyRequest(id);
  requireThat(p?.storyId===story.id&&p.packet.schemaVersion===2&&p.packet.payload.budget.paidCalls===0&&input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','confirm'].includes(k))&&input.confirm==='close_interrupted_search'&&input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'INVALID_PHOTO_TARGET','Close only this story’s interrupted free photo search.');
  if(p.state==='unavailable'&&p.errorCode==='SOURCE_INTERRUPTED_NO_RESULT')return this.storyRequestView(p);
  requireThat(p.state==='fetching'&&!this.running.has(id),'EDIT_CONFLICT','This request is still running or already has a recorded result.');
  p.errorCode=p.receipt?'SOURCE_INTERRUPTED_IMAGE_REVIEW':'SOURCE_INTERRUPTED_NO_RESULT';p.closedAt=new Date().toISOString();if(p.receipt){for(const a of p.imageAttempts||[])if(a.status==='fetching')a.status='interrupted';this.db.prepare("UPDATE photo_story_requests SET state=?,data_json=? WHERE request_id=? AND state='fetching'").run(this.photoContextMatches(story,p.packet.payload.target)?'complete':'review_required',JSON.stringify(p),id);return this.storyRequestView(this.storyRequest(id));}
  this.db.prepare("UPDATE photo_story_requests SET state='unavailable',data_json=? WHERE request_id=? AND state='fetching'").run(JSON.stringify(p),id);return this.storyRequestView(this.storyRequest(id));
 }
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
  const denied=p.errorCode?.match(/^(?:SOURCE|ARCHIVE)_HTTP_(401|403)$/);
  const captureView=c=>({url:c.url,sha256:c.sha256,basis:c.basis,capturedAt:c.capturedAt,networkFetched:c.networkFetched,coverage:c.coverage,projectTrails:c.projectTrails||[]});
  const filtered=p.plan?.relevancePolicy==='project_evidence_v1',newCount=p.displayPhotoIds?.length??p.receipt?.photos?.length??0,excludedCount=p.excludedPhotoIds?.length||0;
  const kind=p.plan?.direction==='context'?'context':'project',excluded=`${excludedCount} unrelated or unconfirmed reference${excludedCount===1?'':'s'} kept out of suggestions.`;
  const completionMessage=newCount?`${newCount} new ${kind} reference${newCount===1?'':'s'}. ${excluded} Visual review and permissions still need checking.`:`No new ${kind} references. ${excluded} No visual review has run.`;
  return {id:p.id,state:p.state==='fetching'&&!this.running.has(p.id)?'uncertain':p.state,source:p.packet.payload.direction.source,query:p.packet.payload.direction.query,createdAt:p.createdAt,sourceRevision:p.packet.payload.target.sourceRevision,workingVersion:p.packet.payload.target.workingVersion,photoCount:p.receipt?.photos?.length||0,newPhotoCount:newCount,duplicateCount:p.duplicateCount||0,excludedCount,relevanceCounts:p.relevanceCounts||null,page:p.packet.payload.direction.page,hasMore:p.state==='complete'&&p.receipt?.hasMore===true,plan:p.plan||null,sourceCapture:p.sourceCapture?captureView(p.sourceCapture):null,sourcePages:(p.sourceCaptures||[]).map(captureView),executionVerified:p.executionVerified===true,executionId:p.receipt?.executionId||null,errorCode:p.errorCode||null,failedSourceUrl:p.failedSourceUrl||null,message:p.errorCode==='SOURCE_READER_UNAVAILABLE'?'No supported original source is recorded for this story. Keep editing with your saved photographs, or add a source through advanced tools. No AI call was made.':denied?'The source denied access (HTTP '+denied[1]+'). Your existing photographs are unchanged. Review the original link or try a different direction; advanced source assistance is optional.':p.state==='fetching'&&!this.running.has(p.id)?'The source request outcome needs checking after restart. It will not be resent.':p.state==='complete'&&filtered?completionMessage:p.state==='complete'&&p.sourceCapture?.projectTrails?.length&&!p.plan?.projectTrails?.length?'A more specific project page was recovered. Find more photos will follow it on your next request. Your caption and carousel are unchanged.':p.state==='complete'&&newCount===0?'No new references found. Repeated files stay in the receipt; try a different direction or bring an original page.':p.state==='prepared'&&p.packet.schemaVersion===2?`Read up to ${p.packet.payload.budget.sourceCalls} recorded source page(s). No AI call.`:messages[p.state]||'Outcome needs checking; do not resend this request.',sourceCalls:p.sourceCalls||0,sourceAttempts:(p.sourceAttempts||[]).map(a=>({url:a.url,status:a.status,errorCode:a.errorCode||null})),imageAttempts:p.imageAttempts||[],decodedImageCount:(p.imageAttempts||[]).filter(a=>a.status==='decoded').length,cachedExistingCount:(p.imageAttempts||[]).filter(a=>a.status==='cached_existing').length,pixelDuplicateCount:p.pixelDuplicateIds?.length||0,visualAnalysisPerformed:false,paidCalls:0,rightsGranted:false};
 }
 storyRequestsFor(story){this.storyTables();return this.db.prepare('SELECT request_id FROM photo_story_requests WHERE story_id=? ORDER BY rowid DESC').all(story.id).map(r=>this.storyRequestView(this.storyRequest(r.request_id)));}
 async searchStoryRequest(story,id,input,{readStory=()=>story}={}){
  const p=this.storyRequest(id);requireThat(p&&p.storyId===story.id&&input&&Object.keys(input).every(k=>['sourceRevision','workingVersion','confirm'].includes(k))&&input.confirm===true,'INVALID_PHOTO_TARGET','Confirm one saved story-specific archive request.');
  if(p.packet.schemaVersion===2)return this.searchDiscovery(story,p,input,{readStory});
  if(p.state!=='prepared')return this.storyRequestView(p); // Read-only reconciliation, never a second source request.
  requireThat(input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0)&&this.photoContextMatches(readStory(),p.packet.payload.target),'EDIT_CONFLICT','The story or selected photograph changed. Prepare a fresh request.');
  const d=p.packet.payload.direction,cached=this.db.prepare('SELECT cached_at FROM photo_page_cache WHERE source=? AND query=? AND page=?').get(d.source,d.query,d.page);p.sourceCalls=cached&&Date.now()-Date.parse(cached.cached_at)<86400000?0:1;
  p.startedAt=new Date().toISOString();const claim=this.db.prepare("UPDATE photo_story_requests SET state='fetching',data_json=? WHERE request_id=? AND state='prepared'").run(JSON.stringify(p),id);if(!claim.changes)return this.storyRequestView(this.storyRequest(id));
  this.running.add(id);let receipt;
  try{const found=await this.page(d.source,d.query,d.page);receipt={schemaVersion:1,purpose:'private_photographic_research_result',requestId:id,inputDigest:p.packet.digest,target:p.packet.payload.target,source:d.source,query:d.query,page:d.page,status:'ok',photos:Array.isArray(found)?found:found.photos,hasMore:Array.isArray(found)?found.length>0:found.hasMore===true,observedAt:new Date().toISOString(),executionId:null,remoteWrites:0,paidCalls:0,rightsGranted:false};validatePhotoReceipt(receipt,p.packet);}
  catch(error){p.errorCode=/^ARCHIVE_[A-Z0-9_]+$/.test(error.message||'')?error.message:'SOURCE_UNAVAILABLE';this.db.prepare("UPDATE photo_story_requests SET state='unavailable',data_json=? WHERE request_id=?").run(JSON.stringify(p),id);this.running.delete(id);return this.storyRequestView(this.storyRequest(id));}
  try{return this.storeStoryReceipt(p,receipt,{readStory,executionVerified:false});}finally{this.running.delete(id);}
 }
 storeStoryReceipt(p,receipt,{readStory,executionVerified,pendingAcquisition=false}){
  if(p.packet.schemaVersion===1)validatePhotoReceipt(receipt,p.packet);
  else requireThat(receipt.schemaVersion===2&&receipt.inputDigest===p.packet.digest&&receipt.requestId===p.id&&JSON.stringify(receipt.target)===JSON.stringify(p.packet.payload.target)&&receipt.source===p.plan.source&&receipt.query===p.plan.query&&receipt.photos.length<=40&&receipt.rightsGranted===false&&receipt.remoteWrites===0&&receipt.paidCalls===0&&receipt.executionId===null&&!executionVerified,'INVALID_PHOTO_RECEIPT','Local page references cannot change their originating context or claim native execution.');
  const state=this.photoContextMatches(readStory(),p.packet.payload.target)?pendingAcquisition?'fetching':'complete':'review_required';
  this.put(receipt.photos.map(photo=>({...photo,rightsStatus:'unreviewed',rightsGranted:false,publicationApproved:false,sourceConfidence:p.sourceCapture?.basis==='founder_supplied_saved_page'?'founder_supplied_saved_page_unverified':'source_metadata_not_identity_verification',technicalStatus:photo.previewUrl?'reference_not_decoded':'no_preview_reference',contextBasis:p.sourceCapture?'story_bound_source_page':'story_bound_archive_receipt',nativeExecutionId:executionVerified?receipt.executionId:null})),p.id);
  const current=readStory(),known=new Set([...(current?.media||[]),...this.storyMedia(current||{id:p.storyId})].flatMap(photoFileKeys)),displayPhotoIds=[],excludedPhotoIds=[],identity=storyPhotoIdentity(current||{});
  const relevanceCounts={direct:0,context:0,unconfirmed:0},observedRelevanceCounts={direct:0,context:0,unconfirmed:0};let duplicateCount=0;
  for(const photo of receipt.photos){
   const category=photoRelevance({...photo,sourceCaption:photo.description,photoExplorationDirection:p.plan?.direction},identity).category;observedRelevanceCounts[category]++;
   const keys=photoFileKeys(photo),duplicate=keys.some(k=>known.has(k));keys.forEach(k=>known.add(k));if(duplicate){duplicateCount++;continue;}
   // Only new reviewed-policy requests are filtered. Earlier receipts, native
   // contracts, founder selections and their authorization history stay intact.
   if(p.packet.schemaVersion===2&&p.plan?.relevancePolicy==='project_evidence_v1'&&category!=='direct'&&p.plan.direction!=='context'){excludedPhotoIds.push(photo.id);continue;}
   displayPhotoIds.push(photo.id);relevanceCounts[category]++;
  }
  this.db.prepare('UPDATE photo_hunts SET page=?,state=? WHERE id=?').run(receipt.page+1,receipt.hasMore?'paused':'complete',p.id);
  const data={...p,receipt,displayPhotoIds,excludedPhotoIds,duplicateCount,relevanceCounts,observedRelevanceCounts,executionVerified:executionVerified===true};this.db.prepare('UPDATE photo_story_requests SET state=?,data_json=? WHERE request_id=?').run(state,JSON.stringify(data),p.id);return this.storyRequestView(this.storyRequest(p.id));
 }
 acceptStoryNativeResult(id,execution,review,{readStory}){
  const p=this.storyRequest(id);requireThat(p?.packet.schemaVersion===1&&review?.workflowId==='Zouc5I3MQwRJhfXG'&&review.requestId===id&&review.inputDigest===p.packet.digest,'INVALID_PHOTO_RECEIPT','Use the separately reviewed original sourcing request and exact execution.');
  const receipt=captureTargetedPhotoResult(execution,p.packet,review);if(p.receipt){requireThat(photoDigest(p.receipt)===photoDigest(receipt),'EDIT_CONFLICT','Another receipt is already retained for this request.');return this.storyRequestView(p);}
  return this.storeStoryReceipt(p,receipt,{readStory,executionVerified:true});
 }
 storyMedia(story){this.storyTables();const photos=[];
  for(const row of this.db.prepare("SELECT request_id FROM photo_story_requests WHERE story_id=? AND state='complete' ORDER BY rowid").all(story.id)){
   const p=this.storyRequest(row.request_id);if(p.packet.payload.target.sourceRevision!==story.revision)continue;
   for(const photo of p.receipt?.photos||[]){if(p.displayPhotoIds&&!p.displayPhotoIds.includes(photo.id))continue;photos.push({id:'photo:'+photoDigest({requestId:p.id,photoId:photo.id}).slice(0,32),title:photo.title,creator:photo.creator,creatorBasis:photo.creatorBasis||'not_recorded',sourceCredit:photo.sourceCredit||'',copyrightHolder:photo.copyrightHolder||'',licenseUrl:photo.licenseUrl||'',sourceYears:photo.sourceYears||[],sourceCaptionBasis:photo.sourceCaptionBasis||'',sourceResearchLinks:photo.sourceResearchLinks||[],materialType:photo.materialType||'',dateContext:photo.dateContext||'not_established',imageMetadata:photo.imageMetadata||null,captureCoverage:photo.captureCoverage||null,sourceUrl:photo.sourceUrl,previewUrl:photo.previewUrl,fileUrl:photo.fileUrl,license:photo.rightsLabel,rightsStatus:'unreviewed',creatorVerified:false,sourceRelation:photo.sourceRelation||'not_inspected',sourceCaption:photo.description,photoRequestId:p.id,reportedWidth:photo.reportedWidth||photo.width||null,reportedHeight:photo.reportedHeight||photo.height||null,sourceRecordMedium:photo.recordMedium||'',photoExplorationDirection:p.plan?.direction||'series',photoCustomDirection:p.plan?.custom||'',photoExecutionId:p.executionVerified?p.receipt.executionId:null,receiptBasis:p.sourceCapture?.basis||(p.executionVerified?'verified_native_execution':'direct_archive_metadata'),originalDownloadVerified:false,pixelAnalysisPerformed:false,rightsGranted:false});}
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
