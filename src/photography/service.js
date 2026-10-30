import {PhotoResearch} from './store.js';import {fetchPhotoPage} from './sources.js';import {browserUrl} from '../workspace/model.js';
import {randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
export class PhotographyService extends PhotoResearch {
 constructor(research,{retrieve=fetchPhotoPage}={}){super(research);this.retrieve=retrieve;this.db.exec('CREATE TABLE IF NOT EXISTS photo_page_cache(source TEXT,query TEXT,page INTEGER,data_json TEXT,cached_at TEXT,PRIMARY KEY(source,query,page))');}
 async page(source,query,page){const prior=this.db.prepare('SELECT * FROM photo_page_cache WHERE source=? AND query=? AND page=?').get(source,query,page);if(prior&&Date.now()-Date.parse(prior.cached_at)<86400000)return JSON.parse(prior.data_json);const photos=await this.retrieve(source,query,page);this.db.prepare('INSERT INTO photo_page_cache VALUES(?,?,?,?,?) ON CONFLICT(source,query,page) DO UPDATE SET data_json=excluded.data_json,cached_at=excluded.cached_at').run(source,query,page,JSON.stringify(photos),new Date().toISOString());return photos;}
 indexNative(snapshot){const photos=(snapshot?.records?.media||[]).filter(m=>m.asset_id).map(m=>({id:'native:'+m.asset_id,source:'saved',nativeStoryId:m.concept_id,title:m.title||'',creator:m.creator||'',description:(snapshot?.records?.stories||[]).find(s=>s.concept_id===m.concept_id)?.subject||'',contextBasis:'linked_story_metadata_not_image_identity',series:'',date:'',foundAt:m.found_date||'',sourceUrl:browserUrl(m.source_page_url),previewUrl:browserUrl(m.thumb_url),fileUrl:browserUrl(m.file_url),rightsLabel:m.license||'Unknown',rightsStatus:m.rights_status||'unreviewed',sourceConfidence:'existing_native_metadata',technicalStatus:'reference_not_decoded',publicationApproved:false,rightsGranted:false,retrievedAt:snapshot.observedAt}));this.put(photos);}
 resume(id,pages=1){return this.run(id,pages,h=>h.source==='saved'?Promise.resolve(this.searchPage(h.query,h.mode,h.page)):this.page(h.source,h.query,h.page));}

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
