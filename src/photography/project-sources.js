import {createHash} from 'node:crypto';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {inspectPhotoSource} from '../editorial-evidence.js';
import {storyPhotoIdentity,planStoryPhotos,photoRelevance} from './story-intelligence.js';
import {requireThat} from '../errors.js';

// Page readers, not an image proxy or arbitrary URL downloader. Only exact URLs
// already present in this story's retained research may be fetched.
export const PROJECT_PAGE_HOSTS=Object.freeze(['www.dazeddigital.com','thephotographersgallery.org.uk','www.thephotographersgallery.org.uk','www.booooooom.com','josharonson.us','www.josharonson.us']);
const digest=value=>createHash('sha256').update(value).digest('hex');
const knownPages=story=>[...(story.recordedProjectLinks||[]).map(l=>l.url),...(story.research||[]).map(r=>r.url)].filter(url=>safePhotoReference(url));
export function permittedProjectPage(story,url){return Boolean(safePhotoReference(url)&&PROJECT_PAGE_HOSTS.includes(new URL(url).hostname)&&knownPages(story).includes(url));}

export function automaticPhotoPlan(story,{direction='best',custom=''}={}){
 const base=planStoryPhotos(story,{direction,custom});
 const pages=[...new Set(knownPages(story))].filter(url=>permittedProjectPage(story,url));
 const hints={behind:/contact|backstage|behind|studio|making/i,archive:/archive|contact|unpublished/i,candid:/candid|street/i,surprise:/outtake|alternative|experiment/i};
 if(hints[direction])pages.sort((a,b)=>Number(hints[direction].test(b))-Number(hints[direction].test(a)));
 // A project-labelled link precedes a multi-project roundup. Directions alter
 // query and metadata ranking; they cannot invent an unrecorded source URL.
 const originals=[...new Set(knownPages(story))],sourceUrl=pages[0]||originals[0]||null;
 const hosts=originals.map(url=>new URL(url).hostname),archive=hosts.some(h=>h==='www.loc.gov'||h==='loc.gov')?'loc':hosts.some(h=>h==='www.artic.edu'||h==='api.artic.edu')?'aic':hosts.some(h=>h==='commons.wikimedia.org')?'commons':null;
 const route=pages.length?'retained_project_page':archive?'archive_search':'source_assisted';
 return {...base,version:2,source:pages.length||!archive?'project':archive,sourceUrl,route,reason:pages.length?'Follow the project page named in the retained research before searching a general archive.':archive?'Search the catalogue already identified in this story’s source evidence.':'This original source has no supported direct reader. Import a saved page; a generic archive is unlikely to hold this exact project.',sourceCandidates:originals,sourceCalls:route==='source_assisted'?0:1,automaticRetries:0,paidCalls:0,engine:'existing_photo_request_ledger',modelPlanningPerformed:false};
}

export async function fetchProjectPage(story,url,{fetchImpl=fetch}={}){
 requireThat(permittedProjectPage(story,url),'PHOTO_SOURCE_NOT_BOUND','Only a supported project URL already recorded on this story can be read.');
 const response=await fetchImpl(url,{method:'GET',redirect:'error',credentials:'omit',headers:{Accept:'text/html','User-Agent':'MILDINCIDENT/1.0 (private editorial source review)'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('SOURCE_HTTP_'+response.status);
 if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw Error('SOURCE_NOT_HTML');
 if(Number(response.headers.get('content-length')||0)>2000000)throw Error('SOURCE_TOO_LARGE');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>2000000){await response.body.cancel?.().catch(()=>{});throw Error('SOURCE_TOO_LARGE');}chunks.push(chunk);}
 return Buffer.concat(chunks).toString('utf8');
}

/** Inspect supplied markup as inert data. No scripts, assets, links or images are fetched. */
export function projectPageReferences(story,{url,html,direction='best',basis='fetched_project_page'}){
 requireThat(safePhotoReference(url)&&typeof html==='string'&&html.length>=20&&Buffer.byteLength(html)<=2000000,'INVALID_PHOTO_SOURCE','Supply a public original-page URL and a saved HTML page, up to 2 MB.');
 const identity=storyPhotoIdentity(story),images=inspectPhotoSource(html,url,story),capturedAt=new Date().toISOString();
 const photos=images.map(m=>({id:'project:'+digest(url+'|'+m.url).slice(0,32),source:'project',query:identity.subject,title:m.caption||'Uncaptioned source-page reference',creator:m.creator||m.imageMetadata?.creatorReported||'',date:m.years.join(', '),description:m.caption,series:'',sourceUrl:url,previewUrl:m.url,fileUrl:'',rightsLabel:'Unknown — source reference only',rightsGranted:false,publicationApproved:false,sourceRelation:m.relation,creatorBasis:m.creatorBasis,sourceCredit:m.credit||m.imageMetadata?.creditReported||'',copyrightHolder:m.copyrightHolder||m.imageMetadata?.copyrightHolderReported||'',licenseUrl:m.imageMetadata?.licenseReportedUrl||'',sourceYears:m.years,sourceCaptionBasis:m.captionBasis,sourceResearchLinks:m.researchLinks,materialType:m.materialType,dateContext:m.dateContext,imageMetadata:m.imageMetadata,captureCoverage:m.captureCoverage,referenceVariants:m.referenceVariants,reportedWidth:m.reportedWidth,reportedHeight:m.reportedHeight,photoExplorationDirection:direction,sourceCaptureBasis:basis,pixelAnalysisPerformed:false,originalDownloadVerified:false}));
 const ranked=photos.sort((a,b)=>photoRelevance({...b,sourceCaption:b.description},identity).score-photoRelevance({...a,sourceCaption:a.description},identity).score);
 return {photos:ranked,sourceCapture:{url,sha256:digest(html),capturedAt,basis,html,coverage:images[0]?.captureCoverage||null,networkFetched:basis==='fetched_project_page',pixelInspectionPerformed:false,rightsGranted:false}};
}
