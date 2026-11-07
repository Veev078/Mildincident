import {catalogueLinks} from './sources.js';
import {hashDistance} from './fingerprint.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
const text=v=>String(v||'').trim(),normal=v=>text(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains=(hay,needle)=>Boolean(needle)&&(' '+normal(hay)+' ').includes(' '+normal(needle)+' ');
export const PHOTO_DIRECTIONS={best:'Find the best ones',series:'More from this project',archive:'Rarer finds',candid:'More candid',striking:'Visually striking',behind:'Behind the scenes',surprise:'Surprise me',context:'Broader context',custom:'My own direction'};

/** Names are anchored in recorded source passages, never guessed from a library recommendation. */
export function storyPhotoIdentity(story){
 const sources=(story.research||[]).filter(r=>r.capturedAccess==='source_text_captured'&&r.capturedTextExcerpt),corpus=sources.map(r=>r.capturedTextExcerpt).join('\n');
 const subject=text(story.subject||story.title),parts=subject.split(/,|\s[—–]\s/),first=parts[0]?.replace(/\([^)]*\)/g,'').trim();
 let photographer='';
 for(const name of [...(story.media||[]).filter(m=>m.creatorBasis==='explicit_source_photo_credit').map(m=>m.creator),first])if(name&&name.split(/\s+/).length>=2&&name.split(/\s+/).length<=4&&contains(corpus,name)&&!/^unknown|not recorded/i.test(name)){photographer=name;break;}
 const possible=parts.slice(1).join(',').replace(/\([^)]*\)/g,'').trim();
 const series=photographer&&possible&&possible.split(/\s+/).length<=7&&!/^(?:ongoing|a |the |club |youth |photograph|work |project |born |london club)/i.test(possible)&&contains(corpus,possible)?possible:'';
 return {photographer,series,subject,sourceUrls:[...new Set(sources.map(r=>r.url).filter(Boolean))],basis:sources.length?'retained_source_passages':'recorded_story_only',independentlyVerified:false};
}
export function planStoryPhotos(story,{direction='series',custom='',source='commons',page=1}={}){
 if(!Object.hasOwn(PHOTO_DIRECTIONS,direction)||!['commons','loc','aic'].includes(source)||!Number.isInteger(page)||page<1||page>1000||typeof custom!=='string'||custom.length>300||direction==='custom'&&custom.trim().length<2)throw Object.assign(Error('Choose a supported photo direction, archive and page.'),{code:'INVALID_PHOTO_QUERY'});
 const identity=storyPhotoIdentity(story),quote=s=>'"'+s.replace(/["\r\n]/g,' ').trim()+'"';
 const anchor=[identity.photographer,identity.series].filter(Boolean).map(quote).join(' ')||quote(identity.subject.slice(0,180));
 const qualifiers={best:'',series:'',archive:'archive contact sheet',candid:'candid documentary',striking:'photographic composition',behind:'behind the scenes contact sheet',surprise:'outtakes alternate frames',context:'cultural context',custom:custom.trim()};
 const founderDirection=text(story.localDraft?.creativeBrief?.notes).slice(0,180);
 const query=[direction==='context'&&identity.photographer?quote(identity.photographer):anchor,qualifiers[direction],founderDirection].filter(Boolean).join(' ').slice(0,500);
 return {version:1,identity,direction,custom:direction==='custom'?custom.trim():'',label:PHOTO_DIRECTIONS[direction],source,page,query,founderDirection,scope:direction==='context'?'contextual_exploration':'project_first',basis:'source_named_anchors_plus_explicit_founder_direction',sourceLinks:identity.sourceUrls,projectTrails:story.recordedProjectLinks||[],catalogueLinks:catalogueLinks(query),aestheticInspectionPerformed:false,rightsGranted:false};
}
/** Follow no links: retain exact project-labelled anchors from already captured publisher HTML. */
export function recordedProjectTrails(html,sourceUrl,identity){
 if(typeof html!=='string'||!identity.photographer)return [];const out=[],seen=new Set();
 for(const a of html.slice(0,300000).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const label=a[2].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,300);
  if(!contains(label,identity.photographer)||identity.series&&!contains(label,identity.series))continue;
  const href=(a[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1];if(!href)continue;
  let url;try{url=safePhotoReference(new URL(href.replace(/&amp;/g,'&'),sourceUrl).href);}catch{continue;}
  if(!url||url===sourceUrl||seen.has(url))continue;seen.add(url);out.push({url,label,sourceUrl,basis:'project_named_anchor_in_recorded_publisher_html',destinationFetched:false,identityVerified:false,rightsGranted:false});if(out.length===8)break;
 }return out;
}
/** Caption correspondence is a relevance signal, never pixel or permission verification. */
export function photoRelevance(asset,identity){
 const caption=[asset.title,asset.sourceCaption,asset.description,asset.series].filter(Boolean).join(' '),named=contains(caption+' '+(asset.creator||''),identity.photographer),series=contains(caption,identity.series);
 const nonPhotographic=/oil on|painting|lithograph|etching|sculpture|watercolou?r|woodcut|drawing/i.test(asset.sourceRecordMedium||'')&&!/photo|gelatin|albumen|chromogenic|daguerre/i.test(asset.sourceRecordMedium||'');
 const direct=!nonPhotographic&&(identity.series?series&&(named||asset.sourceRelation==='subject_caption_match'):identity.photographer?named&&asset.sourceRelation!=='page_cover':asset.sourceRelation==='subject_caption_match');
 const category=direct?'direct':named||asset.photoExplorationDirection==='context'?'context':'unconfirmed';
 const width=asset.localPreview?.originalWidth||asset.reportedWidth||asset.width,height=asset.localPreview?.originalHeight||asset.reportedHeight||asset.height;
 const direction=asset.photoExplorationDirection||'best',hints={archive:/contact sheet|archive|unpublished|outtake/i,candid:/candid|unstaged|street|off.guard/i,behind:/behind.the.scenes|backstage|studio|contact sheet|making.of/i,striking:/composition|close.up|detail|contrast/i,surprise:/outtake|alternative|unpublished|rare|experiment/i},customWords=normal(asset.photoCustomDirection).split(' ').filter(t=>t.length>=4),directionMatch=direction==='custom'?customWords.some(t=>contains(caption,t)):Boolean(hints[direction]?.test(caption));
 return {category,label:direct?'Project reference':category==='context'?'Context / exploration':'Other project or unconfirmed',basis:nonPhotographic?'source_reports_nonphotographic_medium':direct?'image_caption_correspondence':named?'same_reported_creator_not_project_identity':category==='context'?'explicit_broader_context_search':'page_membership_is_not_story_evidence',score:(direct?100:named?35:0)+(asset.previewUrl?5:0)+(asset.localPreview?4:0)+(asset.localReview?.decision==='shortlist'?8:0)+(width>=1080&&height>=1350?3:0)+(directionMatch?12:0),directionMatch,directionBasis:directionMatch?'image_specific_source_description':'not_established',resolutionBasis:asset.localPreview?'decoded_private_file_dimensions':width&&height?'source_reported_dimensions':'not_recorded',pixelInspectionPerformed:false,identityVerified:false};
}
export function photoFileKeys(asset){
 const keys=[];if(asset.localPreview?.originalSha256)keys.push('sha256:'+asset.localPreview.originalSha256);
 for(const url of [asset.fileUrl,asset.sourcePreviewUrl||asset.previewUrl])try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(?:utm_|w$|h$|width$|height$|quality$|fit$)/i.test(k))u.searchParams.delete(k);if(u.hostname==='images-prod.dazeddigital.com'&&u.pathname.includes('/azure/'))u.pathname='/azure/'+u.pathname.split('/azure/')[1];if(!keys.includes(u.href))keys.push(u.href);}catch{}
 return keys.length?keys:['asset:'+asset.id];
}
export const photoFileKey=asset=>photoFileKeys(asset)[0];

export function photoDesk(story){
 const identity=storyPhotoIdentity(story),selected=story.localDraft?.selectedAssetIds??story.selectedAssetIds??[],groups={direct:[],context:[],unconfirmed:[],rejected:[],duplicates:[]},seen=new Set(selected.flatMap(id=>photoFileKeys((story.media||[]).find(a=>a.id===id)||{id})));
 for(const asset of story.media||[])asset.photoRelevance=photoRelevance(asset,identity);
 const ordered=[...(story.media||[])].sort((a,b)=>b.photoRelevance.score-a.photoRelevance.score);
 for(const asset of ordered){if(selected.includes(asset.id))continue;if(asset.localReview?.decision==='reject'){groups.rejected.push(asset.id);continue;}const keys=photoFileKeys(asset),duplicate=keys.some(k=>seen.has(k));keys.forEach(k=>seen.add(k));if(duplicate){groups.duplicates.push(asset.id);continue;}groups[asset.photoRelevance.category].push(asset.id);}
 const similar=[];for(let a=0;a<ordered.length;a++)for(let b=a+1;b<ordered.length;b++){const x=ordered[a].localPreview?.fingerprint,y=ordered[b].localPreview?.fingerprint;if(!x||!y||x.version!==y.version)continue;const d=[hashDistance(x.dhash,y.dhash),hashDistance(x.phash,y.phash)].filter(n=>n!==null);if(d.length&&Math.min(...d)<=6)similar.push([ordered[a].id,ordered[b].id]);}
 return {identity,selected:[...selected],groups,similar,retainedCount:story.media?.length||0,plan:planStoryPhotos(story),matchingBasis:'recorded_image_metadata_not_pixel_or_identity_verification'};
}
