import {safePhotoReference as safe} from '../n8n/photo-url-guard.js';
export const PHOTO_SOURCES={saved:{name:'Saved research + existing n8n photographs',live:true},commons:{name:'Wikimedia Commons',host:'commons.wikimedia.org',live:false},loc:{name:'Library of Congress photographs',host:'www.loc.gov',live:false},aic:{name:'Art Institute of Chicago',host:'api.artic.edu',live:false}};
const plain=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,2000);
export function photoRequestURL(source,query,page){
 if(!Number.isInteger(page)||page<1||page>1000)throw new Error('INVALID_PAGE');let base,params;
 if(source==='commons'){base='https://commons.wikimedia.org/w/api.php';params={action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrsearch:query,gsrlimit:'20',gsroffset:String((page-1)*20),prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'800'};}
 else if(source==='loc'){base='https://www.loc.gov/photos/';params={q:query,fo:'json',c:'20',sp:String(page)};}
 else if(source==='aic'){base='https://api.artic.edu/api/v1/artworks/search';params={q:query,page:String(page),limit:'20',fields:'id,title,image_id,artist_display,date_display,medium_display,is_public_domain'};}
 else throw new Error('UNKNOWN_PHOTO_SOURCE');return base+'?'+Object.entries(params).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
}
export const photoQueryURL=(source,query,page)=>new URL(photoRequestURL(source,query,page));
const textList=value=>(Array.isArray(value)?value:[value]).filter(v=>typeof v==='string').map(plain).join('; ');
function sourceRecords(source,data) {
 if(source==='commons'&&(data?.query?.pages||Object.hasOwn(data||{},'batchcomplete')))return Object.values(data.query?.pages||{});
 if(source==='loc'&&Array.isArray(data?.results))return data.results;
 if(source==='aic'&&Array.isArray(data?.data))return data.data;
 throw new Error('ARCHIVE_SCHEMA_UNVERIFIED');
}
export function normalizePhotos(source,data,query){
 const rows=sourceRecords(source,data).filter(r=>r&&typeof r==='object');
 let records=[];
 if(source==='commons')records=rows.filter(p=>p.pageid&&p.title).map(p=>{
  const i=p.imageinfo?.[0]||{},m=i.extmetadata||{};
  return {id:String(p.pageid),title:p.title,creator:plain(m.Artist?.value),date:plain(m.DateTimeOriginal?.value),sourceUrl:i.descriptionurl||'https://commons.wikimedia.org/?curid='+encodeURIComponent(p.pageid),previewUrl:i.thumburl||i.url,fileUrl:i.url,width:i.width,height:i.height,rightsLabel:plain(m.LicenseShortName?.value||m.UsageTerms?.value),description:plain(m.ImageDescription?.value),series:plain(m.ObjectName?.value)};
 });
 if(source==='loc')records=rows.filter(r=>r.id||r.url).map(r=>({id:r.id||r.url,title:r.title,creator:textList(r.contributor),date:r.date,sourceUrl:r.url||r.id,previewUrl:Array.isArray(r.image_url)?r.image_url[0]:r.image_url,fileUrl:'',description:textList(r.description),rightsLabel:textList(r.rights),series:(Array.isArray(r.partof)?r.partof:[]).slice(0,2).map(p=>typeof p==='string'?p:p?.title||'').join('; ')}));
 if(source==='aic')records=rows.filter(r=>r.id).map(r=>({id:String(r.id),title:r.title,creator:r.artist_display,date:r.date_display,sourceUrl:'https://www.artic.edu/artworks/'+r.id,previewUrl:r.image_id?'https://www.artic.edu/iiif/2/'+encodeURIComponent(r.image_id)+'/full/843,/0/default.jpg':'',description:r.medium_display,rightsLabel:r.is_public_domain?'Source reports public domain; human review required':'Rights not established',series:'',recordMedium:plain(r.medium_display),creatorRole:'source_record_creator_not_verified_as_photographer'}));
 return records.slice(0,20).map(r=>{
  const previewUrl=safe(r.previewUrl);
  return {...r,id:source+':'+r.id,source,query,title:plain(r.title)||'Untitled source record',creator:plain(r.creator),date:plain(r.date),description:plain(r.description),series:plain(r.series),sourceUrl:safe(r.sourceUrl),previewUrl,fileUrl:safe(r.fileUrl),rightsLabel:plain(r.rightsLabel)||'Unknown — private research only',rightsStatus:'unreviewed',sourceConfidence:'provider_metadata_unverified',technicalStatus:previewUrl?'reference_not_decoded':'no_preview_reference',editorialAssessment:'not_reviewed',publicationApproved:false,rightsGranted:false,retrievedAt:new Date().toISOString()};
 });
}
export async function fetchPhotoPage(source,query,page,{fetchImpl=fetch}={}){
 const response=await fetchImpl(photoQueryURL(source,query,page),{headers:{Accept:'application/json','User-Agent':'MILDINCIDENT/2.0 (https://github.com/Veev078/Mildincident; private editorial research)'},redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('ARCHIVE_HTTP_'+response.status);
 let size=0,chunks=[];for await(const c of response.body){size+=c.byteLength;if(size>2*1024*1024)throw new Error('ARCHIVE_RESPONSE_TOO_LARGE');chunks.push(c);}
 const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(raw?.error||raw?.status==='error')throw new Error('ARCHIVE_RESPONSE_ERROR');
 const records=sourceRecords(source,raw);
 // A page of incomplete/unusable metadata is not evidence that later pages are empty.
 return {photos:normalizePhotos(source,raw,query),hasMore:records.length>0,providerRecords:records.length};
}

/** The same normalizers/URL guard execute in a reviewed n8n Code node; no copied provider logic. */
export function photographyAdapterCode(){return `const safe=${safe.toString()};const plain=${plain.toString()};const textList=${textList.toString()};const sourceRecords=${sourceRecords.toString()};const normalizePhotos=${normalizePhotos.toString()};const photoRequestURL=${photoRequestURL.toString()};`;}
export function expansionQueries(photo){const credit=String(photo.creator||'').split(/\/|—/)[0].trim();const creator=/unknown|unverified|not recorded/i.test(credit)?'':credit;const terms=[['photographer',creator],['series',photo.series&&photo.series],['archive',photo.title+' original publication'],['adjacent',creator&&creator+' '+(photo.date||'')+' contact sheet'],['image',photo.sourceUrl]];return terms.filter(([,q])=>q).map(([mode,query])=>({mode,query:query.slice(0,500),basis:'research_direction_not_verified_relationship'}));}

/** Browser catalogue links only. No scraping, proxying or claims of source connectivity. */
export function catalogueLinks(query) {
 const commons=new URL('https://commons.wikimedia.org/w/index.php');
 commons.searchParams.set('title','Special:MediaSearch');commons.searchParams.set('type','image');commons.searchParams.set('search',query);
 const loc=new URL('https://www.loc.gov/photos/');loc.searchParams.set('q',query);
 const aic=new URL('https://www.artic.edu/collection');aic.searchParams.set('q',query);
 return [{label:'Wikimedia Commons',url:commons.href},{label:'LOC photographs (partial catalogue)',url:loc.href},{label:'Art Institute collection',url:aic.href}];
}
