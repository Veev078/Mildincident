import {safePhotoReference} from '../n8n/photo-url-guard.js';
export const photoWords=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const namesPhoto=(text,name)=>Boolean(name)&&(' '+photoWords(text)+' ').includes(' '+photoWords(name)+' ');

/** Comparison only: retain the exact original URL for capture/provenance/fetch.
 * Marketing fragments cannot make a checked page look like a new source. */
export function sourcePageKey(value){
 const safe=safePhotoReference(value);if(!safe)return null;const u=new URL(safe);u.hash='';
 for(const k of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/i.test(k))u.searchParams.delete(k);
 u.searchParams.sort();return u.href;
}

/** A recorded work/series URL can identify a project title already named in the
 * story. No guessed URL, creator attribution or inferred photographic identity. */
export function projectNameFromRecordedPath(subject,urls){
 const candidates=[];
 for(const value of urls){try{const u=new URL(value),segments=u.pathname.split('/').filter(Boolean),at=segments.findIndex(s=>/^(?:projects?|works?|series|exhibitions?)$/i.test(s));if(at<0||!segments[at+1])continue;
  let name=decodeURIComponent(segments[at+1]).replace(/[-_]+/g,' ').trim();const words=photoWords(name).split(' ');
  if(name.length<4||words.length>7||/^(?:archive|all|selected|recent|untitled|photography|index|works?|projects?|gallery|overview|images|photos|portfolio|exhibitions?|books?)$/.test(photoWords(name))||!namesPhoto(subject,name))continue;
  const normalized=photoWords(subject),start=normalized.indexOf(photoWords(name)),original=String(subject).split(/\s+/);
  for(let n=0;n<original.length;n++){const phrase=original.slice(n,n+words.length).join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');if(photoWords(phrase)===photoWords(name)){name=phrase;break;}}
  candidates.push({name,words:words.length,start});
 }catch{}}
 candidates.sort((a,b)=>b.words-a.words||a.start-b.start);return candidates[0]?.name||'';
}

/** Artist/project identity is independent of a photograph's credit or permission.
 * These are recorded names, never a claim that the pixels have been identified. */
export function recordedProjectIdentity(story,{photographer='',series=''}={}){
 const subject=String(story.subject||story.title||''),possessive=subject.match(/^(.{2,90}?)['’]s\s+(.+)$/u),parts=subject.split(/,|\s[—–]\s/);
 const sourceUrls=[...new Set([...(story.research||[]).map(r=>r.url),...(story.recordedProjectLinks||[]).map(r=>r.url)].filter(safePhotoReference))];
 const namedPath=projectNameFromRecordedPath(subject,sourceUrls);
 let maker=photographer||possessive?.[1]||parts.length>1&&parts[0].trim()||'';
 if(namedPath&&!photographer&&!possessive){const at=subject.indexOf(namedPath),prefix=at>0?subject.slice(0,at).replace(/[\s,;:—–-]+$/g,'').trim():'';if(prefix&&prefix.length<=120&&prefix.split(/\s+/).length<=6)maker=prefix;}
 let project=series||'';
 if(!project&&possessive){const tail=possessive[2],quoted=tail.match(/^[“"‘]([^”"’]{3,120})[”"’]/u);project=quoted?.[1]||tail.split(/\s+(?:giant|installation|photograph(?:ic|y|s)?|series|project|exhibition|textile)\b/i)[0];}
 if(!project&&parts.length>1)project=parts.slice(1).join(', ').replace(/\([^)]*\)/g,'').trim();
 project=project.replace(/[“”"‘’]/g,'').replace(/\s*\([^)]*\)\s*/g,' ').trim();
 if(project.length>120||project.split(/\s+/).length>7||!/^[\p{Lu}\p{N}]/u.test(project)||/^(?:a |the |ongoing|photograph|born |work |youth |scene |london club)/i.test(project))project='';
 if(namedPath)project=namedPath;
 return {maker:String(maker).slice(0,120),project,projectKind:/\b(?:installation|sculpture)\b/i.test(subject)?'installation':'photographic_project',recordedSourceUrls:sourceUrls,projectIdentityBasis:namedPath?'story_named_project_in_recorded_source_path':'recorded_story_and_source_metadata',photographerAttributionVerified:false};
}

/** An image-specific project name plus a recorded source is enough to REVIEW a
 * candidate. It grants neither identity verification, photographer credit nor rights. */
export function projectCorrespondence(asset,identity){
 const caption=[asset.title,asset.sourceCaption,asset.description,asset.series].filter(Boolean).join(' '),project=identity.project||identity.series||'',maker=identity.maker||identity.photographer||'';
 const sourceBound=(identity.recordedSourceUrls||identity.sourceUrls||[]).includes(asset.sourceUrl),named=namesPhoto(caption,project),makerNamed=namesPhoto(caption+' '+(asset.creator||''),maker);
 const boundContext=asset.projectContext?.relation==='subject_caption_match'&&(!project||namesPhoto(asset.projectContext.project,project));
 const explicit=asset.sourceRelation==='subject_caption_match'&&(!project||named||boundContext);
 const matched=explicit||boundContext||project.length>=4&&named&&(sourceBound||makerNamed);
 return {matched,projectNamed:named,makerNamed,sourceBound,basis:boundContext?asset.projectContext.basis:explicit?'image_caption_correspondence':matched?'named_project_and_recorded_source':'project_connection_not_established',attributionVerified:asset.creatorVerified===true,identityVerified:false};
}

export function websiteGraphic(asset){
 let file='';try{file=decodeURIComponent(new URL(asset.sourcePreviewUrl||asset.previewUrl||asset.fileUrl).pathname).split('/').at(-1)||'';}catch{}
 return /(?:^|[-_])(?:logo|icon|avatar|favicon|spinner|recite-me)(?:[-_.]|$)/i.test(file)||/launch.*assistive|recite me assistive|subscribe to.*newsletter/i.test(asset.sourceCaption||asset.title||'');
}
