import {PhotoResearch} from './store.js';import {fetchPhotoPage} from './sources.js';import {browserUrl} from '../workspace/model.js';
import {randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {makePhotoPacket,validatePhotoReceipt,photoDigest} from './native-contract.js';
export class PhotographyService extends PhotoResearch {
 constructor(research,{retrieve=fetchPhotoPage}={}){super(research);this.retrieve=retrieve;this.db.exec('CREATE TABLE IF NOT EXISTS photo_page_cache(source TEXT,query TEXT,page INTEGER,data_json TEXT,cached_at TEXT,PRIMARY KEY(source,query,page))');}
 async page(source,query,page){const prior=this.db.prepare('SELECT * FROM photo_page_cache WHERE source=? AND query=? AND page=?').get(source,query,page);if(prior&&Date.now()-Date.parse(prior.cached_at)<86400000)return JSON.parse(prior.data_json);const photos=await this.retrieve(source,query,page);this.db.prepare('INSERT INTO photo_page_cache VALUES(?,?,?,?,?) ON CONFLICT(source,query,page) DO UPDATE SET data_json=excluded.data_json,cached_at=excluded.cached_at').run(source,query,page,JSON.stringify(photos),new Date().toISOString());return photos;}
 indexNative(snapshot){const photos=(snapshot?.records?.media||[]).filter(m=>m.asset_id).map(m=>({id:'native:'+m.asset_id,source:'saved',nativeStoryId:m.concept_id,title:m.title||'',creator:m.creator||'',description:(snapshot?.records?.stories||[]).find(s=>s.concept_id===m.concept_id)?.subject||'',contextBasis:'linked_story_metadata_not_image_identity',series:'',date:'',foundAt:m.found_date||'',sourceUrl:browserUrl(m.source_page_url),previewUrl:browserUrl(m.thumb_url),fileUrl:browserUrl(m.file_url),rightsLabel:m.license||'Unknown',rightsStatus:m.rights_status||'unreviewed',sourceConfidence:'existing_native_metadata',technicalStatus:'reference_not_decoded',publicationApproved:false,rightsGranted:false,retrievedAt:snapshot.observedAt}));this.put(photos);}
 resume(id,pages=1){return this.run(id,pages,h=>h.source==='saved'?Promise.resolve(this.searchPage(h.query,h.mode,h.page)):this.page(h.source,h.query,h.page));}

 nativeTables(){this.db.exec('CREATE TABLE IF NOT EXISTS photo_native_packets(digest TEXT PRIMARY KEY,hunt_id TEXT NOT NULL,packet_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS photo_native_receipts(digest TEXT PRIMARY KEY,input_digest TEXT NOT NULL,result_hunt_id TEXT NOT NULL,receipt_json TEXT NOT NULL)');}
 exportNative(id,{photoIds=[],source,page}={}){
  this.nativeTables();const hunt=this.get(id);requireThat(hunt&&Array.isArray(photoIds)&&photoIds.length<=20&&new Set(photoIds).size===photoIds.length,'INVALID_PHOTO_PACKET','Choose a trail and up to 20 references per packet; continue with further packets.');
  const photos=photoIds.map(id=>{const row=this.db.prepare('SELECT data_json FROM photo_candidates WHERE id=?').get(id);requireThat(row,'INVALID_PHOTO_PACKET','A chosen photograph is unavailable.');return {...JSON.parse(row.data_json),decision:this.db.prepare('SELECT decision,reason FROM photo_decisions WHERE photo_id=? ORDER BY rowid DESC LIMIT 1').get(id)||null};});
  const packet=makePhotoPacket(hunt,photos,{...(source?{source}:{}),...(page!==undefined?{page}:{})});this.db.prepare('INSERT OR IGNORE INTO photo_native_packets VALUES(?,?,?)').run(packet.digest,id,JSON.stringify(packet));return packet;
 }
 importNative(receipt){
  this.nativeTables();const saved=this.db.prepare('SELECT * FROM photo_native_packets WHERE digest=?').get(receipt?.inputDigest||'');requireThat(saved,'INVALID_PHOTO_RECEIPT','Export the originating packet from this workspace first.');const packet=JSON.parse(saved.packet_json);validatePhotoReceipt(receipt,packet);const digest=photoDigest(receipt),prior=this.db.prepare('SELECT result_hunt_id FROM photo_native_receipts WHERE digest=?').get(digest);if(prior)return {hunt:this.get(prior.result_hunt_id),replayed:true,executionVerified:false,productionApplied:false};
  const childId=digest.slice(0,8)+'-'+digest.slice(8,12)+'-'+digest.slice(12,16)+'-'+digest.slice(16,20)+'-'+digest.slice(20,32);
  const d=packet.payload.direction;this.create({query:d.query,mode:d.mode,source:d.source,parent:saved.hunt_id,idempotencyKey:childId});
  const fields=['id','source','query','title','creator','date','description','series','sourceUrl','previewUrl','fileUrl','rightsLabel'];
  this.put(receipt.photos.map(p=>({...Object.fromEntries(fields.map(k=>[k,p[k]])),rightsStatus:'unreviewed',rightsGranted:false,publicationApproved:false,sourceConfidence:'imported_receipt_unverified',technicalStatus:p.previewUrl?'reference_not_decoded':'no_preview_reference',contextBasis:'native_research_receipt_metadata_not_verified',receiptBasis:receipt.executionId?'reported_execution_unverified':'offline_replay',nativeExecutionId:receipt.executionId,retrievedAt:receipt.observedAt})),childId);
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
