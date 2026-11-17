import {createHash} from 'node:crypto';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {inspectPhotoSourceWindow} from '../editorial-evidence.js';
import {storyPhotoIdentity,planStoryPhotos,photoRelevance,recordedProjectTrails} from './story-intelligence.js';
import {requireThat} from '../errors.js';
import {projectImageContext} from './project-image-context.js';
import {recordedPublisherAlternatives} from './publisher-alternatives.js';
import {sourcePageKey} from './project-identity.js';
import {readPublicSource} from './public-source-transport.js';

// Page readers, not an image proxy or arbitrary URL downloader. Only exact URLs
// already present in this story's retained research may be fetched.
export const PROJECT_PAGE_HOSTS=Object.freeze(['www.dazeddigital.com','www.life.com','life.com','thephotographersgallery.org.uk','www.thephotographersgallery.org.uk','www.booooooom.com','josharonson.us','www.josharonson.us','sophyrickett.com','www.sophyrickett.com','www.cobgallery.com','www.cheeriopublishing.com','www.climaxbooks.com','www.theguardian.com','www.artsy.net','www.windowseat.ph','windowseat.ph','www.gelitin.net','gelitin.net','www.itsnicethat.com']);
const digest=value=>createHash('sha256').update(value).digest('hex');
export const PROJECT_IMAGE_PARSER_VERSION='project-images-v4';
export const PUBLIC_SOURCE_CONNECTION_POLICY='evidence_bound_public_v1';
const restrictedHost=host=>/(?:^|\.)(?:linkedin\.com|instagram\.com|facebook\.com|fb\.com|tiktok\.com|pinterest\.com|twitter\.com|x\.com|accounts\.google\.com)$/.test(host);
const archiveHost=host=>/^(?:(?:www\.)?loc\.gov|(?:www\.|api\.)?artic\.edu|commons\.wikimedia\.org)$/.test(host);
export function supportedProjectPage(url,{connectionPolicy=PUBLIC_SOURCE_CONNECTION_POLICY}={}){
 if(!safePhotoReference(url))return false;const u=new URL(url);
 if(connectionPolicy!==PUBLIC_SOURCE_CONNECTION_POLICY)return PROJECT_PAGE_HOSTS.includes(u.hostname);
 if(restrictedHost(u.hostname)||archiveHost(u.hostname)||/^(?:staging|admin|internal|login|accounts)\./i.test(u.hostname))return false;
 return !/(?:^|\/)(?:search|category|categories|tags?)(?:\/|$)|\/(?:archives?|collections?)\/?$/i.test(u.pathname)&&![...u.searchParams.keys()].some(k=>/^(?:q|s|search|searchterm|query)$/i.test(k));
}
const sourceKind=(url,label='')=>/sophyrickett\.com|josharonson\.us|gelitin\.net/i.test(new URL(url).hostname)?'artist':/gallery|photographersgallery/i.test(new URL(url).hostname+' '+label)?'gallery':/publisher|publishing|climaxbooks|book/i.test(new URL(url).hostname+' '+label)?'book_publisher':/dazeddigital|booooooom|life\.com|theguardian|windowseat|itsnicethat/i.test(new URL(url).hostname)?'original_publisher':'project';
const knownPages=story=>[...recordedPublisherAlternatives(story).map(l=>l.url),...(story.recordedProjectLinks||[]).map(l=>l.url),...(story.research||[]).map(r=>r.url),...(story.media||[]).map(m=>m.sourceUrl)].filter(url=>safePhotoReference(url));
export function permittedProjectPage(story,url,options={}){return Boolean(supportedProjectPage(url,options)&&knownPages(story).includes(url));}

/** Expand only exact maker/project links supported by the captured page context. */
export function projectSourceTrails(html,url,identity,images=[]){
 const anchor=identity.photographer||identity.maker||'',project=identity.series||identity.project||'';
 const markup=html.slice(0,300000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
 const found=recordedProjectTrails(markup,url,{...identity,photographer:anchor,series:project}).map(l=>({...l,sourceKind:sourceKind(l.url,l.label),readerSupported:supportedProjectPage(l.url)})),seen=new Set(found.map(l=>sourcePageKey(l.url))),lower=markup.toLowerCase();
 const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const has=(s,n)=>Boolean(n)&&(' '+norm(s)+' ').includes(' '+norm(n)+' '),text=s=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 const heading=[...markup.matchAll(/<(h1|title)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,4).map(m=>text(m[2])).join(' ');
 const pageNamesProject=has(heading,anchor)&&(!project||has(heading,project));
 const projectPresent=images.some(i=>i.sourceRelation==='subject_caption_match')||pageNamesProject;
 for(const match of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const label=text(match[2]).slice(0,200),href=match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];if(!href)continue;
  // A nearby heading may belong to the previous story in a roundup. Only the
  // anchor's own paragraph can establish local maker/project context.
  const before=markup.slice(Math.max(0,match.index-4000),match.index),opening=[...before.matchAll(/<p\b[^>]*>/gi)].at(-1),close=before.toLowerCase().lastIndexOf('</p>'),end=lower.indexOf('</p>',match.index+match[0].length);
  const paragraph=opening&&opening.index>close&&end>=0&&end-match.index<4000?before.slice(opening.index)+markup.slice(match.index,end+4):'',context=text(paragraph);
  const maker=projectPresent&&has(label,anchor),local=has(context,anchor)&&has(context,project)&&/book|publisher|gallery|exhibition|project|artist|photographer|here|website|official|visit|read|more/i.test(label);
  let target;try{target=safePhotoReference(new URL(href.replace(/&amp;/g,'&'),url).href);}catch{continue;}
  // Artist collectives can have one-word names. An exact maker-named anchor
  // and a project path named in the story establish a trail, never image identity.
  const segments=target?new URL(target).pathname.split('/').filter(Boolean):[];
  const makerName=label.replace(/^via\s+/i,'').trim(),makerHost=target?new URL(target).hostname.replace(/^www\./,'').split('.')[0]:'';
  const projectPath=segments.length>=2&&/^(projects?|works?)$/i.test(segments[0])&&segments.slice(1).some(part=>{try{return part.length>=4&&has(identity.subject,decodeURIComponent(part).replace(/[-_]/g,' '));}catch{return false;}});
  const collectiveTrail=projectPath&&norm(makerName).length>=4&&has(identity.subject,makerName)&&norm(makerName)===norm(makerHost);
  if(!maker&&!local&&!collectiveTrail)continue;
  if(!target||seen.has(sourcePageKey(target))||sourcePageKey(target)===sourcePageKey(url))continue;
  seen.add(sourcePageKey(target));found.push({url:target,label,sourceUrl:url,sourceKind:sourceKind(target,label),readerSupported:supportedProjectPage(target),basis:collectiveTrail?'maker_named_link_to_story_named_project':maker?'maker_named_link_from_project_page':'project_named_local_source_context',destinationFetched:false,identityVerified:false,rightsGranted:false});if(found.length>=8)break;
 }
 return found.slice(0,8);
}

export function automaticPhotoPlan(story,{direction='best',custom=''}={}){
 const base=planStoryPhotos(story,{direction,custom});
 const originals=[...new Map(knownPages(story).map(u=>[sourcePageKey(u),u])).values()],pages=originals.filter(url=>permittedProjectPage(story,url));
 const sourceConnections=originals.filter(url=>!supportedProjectPage(url)&&!archiveHost(new URL(url).hostname)).map(url=>({url,kind:(story.recordedProjectLinks||[]).find(l=>sourcePageKey(l.url)===sourcePageKey(url))?.sourceKind||sourceKind(url),status:'connection_needed',fetched:false}));
 const hints={behind:/contact|backstage|behind|studio|making/i,archive:/archive|contact|unpublished/i,candid:/candid|street/i,surprise:/outtake|alternative|experiment/i};
 if(hints[direction])pages.sort((a,b)=>Number(hints[direction].test(b))-Number(hints[direction].test(a)));
 // Prefer a named maker/project and image-led publisher before general factual
 // coverage or a marketplace record. Previously checked sources are still
 // removed by the existing progression ledger.
 const priority=u=>{const kind=(story.recordedProjectLinks||[]).find(l=>sourcePageKey(l.url)===sourcePageKey(u))?.sourceKind||sourceKind(u);if(kind==='artist')return 0;if(kind==='gallery')return 1;if(/windowseat\.ph|itsnicethat\.com/.test(new URL(u).hostname))return 2;if(/theguardian\.com/.test(new URL(u).hostname))return 5;if(/artsy\.net/.test(new URL(u).hostname))return 6;return 3;};pages.sort((a,b)=>priority(a)-priority(b));
 // A project-labelled link precedes a multi-project roundup. Directions alter
 // query and metadata ranking; they cannot invent an unrecorded source URL.
 const sourceUrl=pages[0]||originals[0]||null;
 const hosts=originals.map(url=>new URL(url).hostname),archive=hosts.some(h=>h==='www.loc.gov'||h==='loc.gov')?'loc':hosts.some(h=>h==='www.artic.edu'||h==='api.artic.edu')?'aic':hosts.some(h=>h==='commons.wikimedia.org')?'commons':null;
 const route=pages.length?'retained_project_page':archive?'archive_search':'source_assisted';
 return {...base,version:3,source:pages.length||!archive?'project':archive,sourceUrl,route,reason:pages.length?'Check exact retained project sources over verified public HTTPS. Capture only their embedded image files for private review.':archive?'Search the catalogue already identified in this story’s source evidence.':'The recorded websites need a source connection before Studio can read them. Changing the search direction will not fix this. Your saved photographs remain available.',sourceCandidates:pages.length?[...pages,...originals.filter(u=>!pages.includes(u))]:originals,sourceConnections,sourceConnectionPolicy:PUBLIC_SOURCE_CONNECTION_POLICY,connectionCandidates:pages.map(url=>({url,status:'public_source_candidate',binding:'exact_retained_story_url',fetched:false})),sourceCalls:route==='source_assisted'?0:pages.length?2:1,sourcePolicy:'recorded_fallback_v2',imageCalls:6,relevancePolicy:'project_evidence_v1',automaticRetries:0,paidCalls:0,engine:'existing_photo_request_ledger',modelPlanningPerformed:false};
}

export async function fetchProjectPage(story,url,{fetchImpl=fetch,withEvidence=false,...transportOptions}={}){
 requireThat(permittedProjectPage(story,url),'PHOTO_SOURCE_NOT_BOUND','Only an exact public project URL already retained on this story can be read.');
 const result=await readPublicSource(url,{...transportOptions,fetchImpl,accept:'text/html,application/xhtml+xml',maxBytes:2000000,allowedRedirectUrls:knownPages(story).filter(u=>supportedProjectPage(u))});
 requireThat(['text/html','application/xhtml+xml'].includes(result.contentType),'SOURCE_NOT_HTML','The source did not return HTML.');
 const html=result.bytes.toString('utf8');return withEvidence?{html,transport:result.transport}:html;
}

/** Inspect supplied markup as inert data. No scripts, assets, links or images are fetched. */
export function projectPageReferences(story,{url,html,direction='best',basis='fetched_project_page',cursor=null,transport=null}){
 requireThat(safePhotoReference(url)&&typeof html==='string'&&html.length>=20&&Buffer.byteLength(html)<=2000000,'INVALID_PHOTO_SOURCE','Supply a public original-page URL and a saved HTML page, up to 2 MB.');
 // The supplied page is the origin of this inert evidence. This classification
 // binding does not grant fetch permission: network readers still require an
 // exact retained source and the approved host/CDN relationship separately.
 const identity=storyPhotoIdentity({...story,recordedProjectLinks:[...(story.recordedProjectLinks||[]),{url}]}),captureSha256=digest(html),contextSha256=digest(JSON.stringify({storyId:story.id,sourceRevision:story.revision||null,subject:identity.subject,photographer:identity.photographer,series:identity.series,direction})),capturedAt=new Date().toISOString();
 requireThat(cursor===null||cursor&&typeof cursor==='object'&&!Array.isArray(cursor)&&Object.keys(cursor).length===6&&Object.keys(cursor).every(k=>['version','parserVersion','captureSha256','sourceUrl','contextSha256','offset'].includes(k))&&cursor.version===1&&cursor.parserVersion===PROJECT_IMAGE_PARSER_VERSION&&cursor.captureSha256===captureSha256&&cursor.sourceUrl===url&&cursor.contextSha256===contextSha256&&Number.isSafeInteger(cursor.offset)&&cursor.offset>0&&cursor.offset<=10000&&cursor.offset%40===0,'INVALID_PHOTO_CURSOR','Continue only the exact captured page and unchanged photo direction.');
 const baseUrl=transport?.finalUrl&&safePhotoReference(transport.finalUrl)?transport.finalUrl:url;
 const {images,coverage}=inspectPhotoSourceWindow(html,baseUrl,story,{offset:cursor?.offset||0});
 for(const image of images){const context=projectImageContext(identity,{url:image.url,sourceUrl:url,caption:image.caption,materialType:image.materialType,relation:image.relation});if(context){image.relation=context.relation;image.projectContext=context;if(context.materialType)image.materialType=context.materialType;}}
 requireThat(!cursor||cursor.offset<coverage.referenceCount,'INVALID_PHOTO_CURSOR','The captured page has no remaining reference window at this position.');
 const photos=images.map(m=>({id:'project:'+digest(url+'|'+m.url).slice(0,32),source:'project',query:identity.subject,title:m.caption||'Uncaptioned source-page reference',creator:m.creator||m.imageMetadata?.creatorReported||'',date:m.years.join(', '),description:m.caption,series:'',sourceUrl:url,previewUrl:m.url,fileUrl:'',rightsLabel:'Unknown — source reference only',rightsGranted:false,publicationApproved:false,sourceRelation:m.relation,projectContext:m.projectContext||null,creatorBasis:m.creatorBasis,sourceCredit:m.credit||m.imageMetadata?.creditReported||'',copyrightHolder:m.copyrightHolder||m.imageMetadata?.copyrightHolderReported||'',licenseUrl:m.imageMetadata?.licenseReportedUrl||'',sourceYears:m.years,sourceCaptionBasis:m.captionBasis,sourceResearchLinks:m.researchLinks,materialType:m.materialType,materialBasis:m.materialBasis,dateContext:m.dateContext,imageMetadata:m.imageMetadata,captureCoverage:m.captureCoverage,referenceVariants:m.referenceVariants,reportedWidth:m.reportedWidth,reportedHeight:m.reportedHeight,photoExplorationDirection:direction,sourceCaptureBasis:basis,sourceCaptureSha256:captureSha256,sourceParserVersion:PROJECT_IMAGE_PARSER_VERSION,sourceReferenceIndex:m.referenceIndex,pixelAnalysisPerformed:false,originalDownloadVerified:false}));
 const ranked=photos.sort((a,b)=>photoRelevance({...b,sourceCaption:b.description},identity).score-photoRelevance({...a,sourceCaption:a.description},identity).score);
 const extractionCursor=coverage.nextOffset===null?null:{version:1,parserVersion:PROJECT_IMAGE_PARSER_VERSION,captureSha256,sourceUrl:url,contextSha256,offset:coverage.nextOffset};
 return {photos:ranked,sourceCapture:{url,sha256:captureSha256,capturedAt,basis,html,identity,parserVersion:PROJECT_IMAGE_PARSER_VERSION,transport,projectTrails:projectSourceTrails(html,baseUrl,identity,ranked).map(link=>({...link,captureSha256,parserVersion:PROJECT_IMAGE_PARSER_VERSION})),coverage,extractionInputCursor:cursor,extractionCursor,networkFetched:basis==='fetched_project_page',pixelInspectionPerformed:false,rightsGranted:false}};
}
