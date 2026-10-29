import {recordedSourceEvidence} from './source-evidence.js';
import {createHash} from 'node:crypto';
import {requireThat} from './errors.js';
import {safePhotoReference} from './n8n/photo-url-guard.js';

/** Self-contained for the n8n Code sandbox. Metadata matching never implies pixel review or rights. */
export function photoEvidenceTools(publicReference) {
  const decode=value=>String(value||'').replace(/&(?:amp|quot|apos|lt|gt|nbsp|copy|ndash|mdash);|&#(?:x[0-9a-f]+|[0-9]+);/gi,entity=>{
    const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' ','&copy;':'©','&ndash;':'–','&mdash;':'—'};
    if(named[entity.toLowerCase()]!==undefined)return named[entity.toLowerCase()];
    const hex=/^&#x/i.test(entity);const n=parseInt(entity.slice(hex?3:2,-1),hex?16:10);return n>31&&n<=0x10ffff?String.fromCodePoint(n):'';
  });
  const attrs=tag=>{const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))out[m[1].toLowerCase()]=decode(m[2]??m[3]??'');return out;};
  const resolve=(value,page)=>{const raw=decode(value).trim();if(!raw)return '';if(raw.startsWith('//'))return publicReference('https:'+raw);if(/^https:\/\//i.test(raw))return publicReference(raw);
    if(/^[a-z][a-z0-9+.-]*:/i.test(raw)||raw.startsWith('#')||raw.startsWith('?'))return '';
    const match=page.match(/^(https:\/\/[^/?#]+)(\/[^?#]*)?/i);if(!match)return '';
    const path=raw.startsWith('/')?raw:(match[2]||'/').replace(/[^/]*$/,'')+raw;const segments=[];for(const part of path.split('/')){if(part==='..'){segments.pop();continue;}if(part&&part!=='.')segments.push(part);}return publicReference(match[1]+'/'+segments.join('/'));
  };
  const tokens=value=>[...new Set(String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>=4&&!/^\d+$/.test(x)))];
  const stop=new Set(['photograph','photography','photographer','photo','image','images','original','around','story','about','with','from','this','that','their','film','cinema','fashion','look','archive','collection','preview']);
  const fileKey=url=>{const clean=url.split('#')[0];const question=clean.indexOf('?');const base=(question<0?clean:clean.slice(0,question)).replace(/\/_gallery_\d+\//g,'/_gallery_variant/');
    const query=question<0?[]:clean.slice(question+1).split('&').filter(part=>{let key;try{key=decodeURIComponent(part.split('=')[0]).toLowerCase();}catch{return true;}return !['w','width','h','height','fit','crop','quality','q','format','auto','dpr'].includes(key);}).sort();return base+(query.length?'?'+query.join('&'):'');};
  const hash=value=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(36);};
  function inspect(html,page,story={}) {
    if(typeof html!=='string'||html.length>2500000||!publicReference(page))return [];
    const candidates=new Map();const body=html.slice(0,300000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
    const captionText=value=>decode(String(value||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim().slice(0,2000);
    const figures=[...body.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)].slice(0,260).map(m=>({start:m.index,end:m.index+m[0].length,html:m[0],images:[...m[0].matchAll(/<img\b/gi)].length,caption:captionText((m[0].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)||[])[1]||'')}));
    const referencedCaptions=new Map();for(const m of [...body.matchAll(/<(figcaption|p|span)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].slice(0,500)){const a=attrs(m[2]);if(a.id)referencedCaptions.set(a.id,captionText(m[3]));}
    const add=(url,caption,isCover,width,height,captionBasis='image_alt')=>{url=resolve(url,page);if(!url||/\/(?:logo|favicon|avatar|icon|sprite|pixel|spinner)[._/-]/i.test(url)||/\.svg(?:[?#]|$)/i.test(url))return;
      const key=fileKey(url);const previous=candidates.get(key);const referenceVariants=[...new Set([...(previous?.referenceVariants||[]),url])];if(previous&&!previous.isCover){previous.referenceVariants=referenceVariants;previous.duplicateBasis=referenceVariants.length>1?'source_file_reference_variant':'none';return;}
      candidates.set(key,{url,referenceVariants,duplicateBasis:referenceVariants.length>1?'source_file_reference_variant':'none',sameImageVerified:false,caption:String(caption||'').trim().slice(0,2000),captionBasis,isCover,reportedWidth:width||null,reportedHeight:height||null});};
    for(const tag of [...body.matchAll(/<meta\b[^>]*>/gi)].slice(0,250)){const a=attrs(tag[0]);if(['og:image','og:image:secure_url','twitter:image','twitter:image:src'].includes((a.property||a.name||'').toLowerCase()))add(a.content,'Page cover / social preview',true);}
    const bestResponsive=value=>String(value||'').split(',').map(part=>{const [url,size]=part.trim().split(/\s+/);return {url,width:/^\d+w$/.test(size||'')?parseInt(size,10):/^\d+(?:\.\d+)?x$/.test(size||'')?Number.parseFloat(size)*100:0};}).filter(x=>resolve(x.url,page)).sort((a,b)=>b.width-a.width)[0]?.url;
    for(const tag of [...body.matchAll(/<img\b[^>]*>/gi)].slice(0,260)){
      const a=attrs(tag[0]);const figure=figures.find(f=>tag.index>=f.start&&tag.index<f.end);let picture='';
      if(figure?.images===1){const source=[...figure.html.matchAll(/<source\b[^>]*>/gi)].map(m=>attrs(m[0])).find(s=>!s.type||/^image\/(jpeg|png|webp)$/i.test(s.type));if(source)picture=bestResponsive(source.srcset||source['data-srcset']);}
      const width=parseInt(a.width||'0',10)||0,height=parseInt(a.height||'0',10)||0;
      const direct=bestResponsive(a.srcset||a['data-srcset'])||a['data-src']||a['data-lazy-src']||a['data-original']||(resolve(a.src,page)?a.src:'');
      const url=((width&&width<100)||(height&&height<100))&&picture?picture:direct||picture;
      if(((width&&width<100)||(height&&height<100))&&!a['data-src']&&!a['data-lazy-src']&&!a['data-original']&&!a.srcset&&!a['data-srcset']&&!picture)continue;
      const referenced=String(a['aria-describedby']||'').split(/\s+/).map(id=>referencedCaptions.get(id)).filter(Boolean).join(' ');
      const nearby=referenced||(figure?.images===1?figure.caption:'');const alt=a.alt||a.title||'';
      let caption=alt,basis=a.alt?'image_alt':a.title?'image_title':'missing';
      if(nearby){caption=/^(?:©|copyright|photo(?:graph)?(?: by|:))/i.test(nearby)?[alt,nearby].filter(Boolean).join(' '):nearby;basis=referenced?'linked_caption':'figure_caption';}
      add(url,caption,false,width,height,basis);
      if(picture&&resolve(url,page)&&fileKey(resolve(picture,page))===fileKey(resolve(url,page)))add(picture,caption,false,width,height,basis);
    }
    const images=[...candidates.values()];const subject=tokens(`${story.subject||''} ${story.title||''}`).filter(t=>!stop.has(t));
    const captionTokens=images.map(m=>tokens(m.caption.replace(/©[\s\S]*$/,'')));
    const frequency=new Map(subject.map(t=>[t,captionTokens.filter(ts=>ts.includes(t)).length]));
    const distinctive=subject.filter(t=>(frequency.get(t)||0)>0&&(frequency.get(t)||0)<=Math.max(1,Math.floor(images.length/3)));
    const storyYears=[...new Set(String(story.subject||'').match(/\b(?:18|19|20)\d{2}\b/g)||[])].map(Number);
    return images.map((m,index)=>{const terms=captionTokens[index];const matched=subject.filter(t=>terms.includes(t));const anchors=distinctive.filter(t=>terms.includes(t));
      const related=!m.isCover&&distinctive.length>0&&anchors.length>=Math.min(2,distinctive.length);
      const credit=(m.caption.match(/©\s*(.+)$/)||[])[1]?.trim().replace(/[.\s]+$/,'')||'';const credited=credit.split(/\s*\/\s*/)[0].trim();const creator=/mus[ée]e|museum|foundation|archive|collection|library/i.test(credited)?'':credited;
      const years=[...new Set(m.caption.match(/\b(?:18|19|20)\d{2}\b/g)||[])].map(Number);
      return {...m,id:`${story.id||'source'}-${m.isCover?'og':'img'}-${hash(page+'|'+m.url)}`,creator,credit:credit?'© '+credit:'',sourceUrl:page,years,storyYears,dateContext:years.length&&storyYears.length&&!years.some(y=>storyYears.includes(y))?'different_year_context':'not_established',
        materialType:/croquis|sketch|drawing|costume design/i.test(m.caption)?'design_documentation':'photograph_reference',relation:m.isCover?'page_cover':related?'subject_caption_match':'context_only',matchedTerms:matched,distinctiveTerms:anchors,matchingBasis:'source_caption_metadata_only',pixelAnalysisPerformed:false,rightsGranted:false};
    }).slice(0,16);
  }
  return {inspect,decode};
}

const tools=photoEvidenceTools(safePhotoReference);
export const inspectPhotoSource=(html,url,story)=>tools.inspect(html,url,story);
export function readableSourceText(value) {
  return tools.decode(String(value||'').slice(0,2500000).replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
const nodeItems=(runData,name)=>(runData[name]||[]).flatMap(run=>run.data?.main?.flat()||[]).map(item=>item.json||{});
const digest=value=>createHash('sha256').update(value).digest('hex');

/** Read captured execution evidence, not a new external request. Never return webhook headers or raw workflow data. */
export function captureEditorialEvidence(execution,{workerId,jobId,requestHash,candidate}) {
  requireThat(String(execution.id)===String(candidate.provenance.executionId)&&execution.workflowId===workerId,'INVALID_ENGINE_RESULT','Captured execution does not match the generated result.');
  const data=execution.data?.resultData?.runData||{};
  const dispatch=nodeItems(data,'Validate Development Dispatch')[0];const claim=nodeItems(data,'Verify Development Claim')[0];
  requireThat(dispatch?.job_id===jobId&&claim?.request_hash===requestHash,'INVALID_ENGINE_RESULT','Execution dispatch/content identity does not match the request.');
  const requests=nodeItems(data,'Expand Claims for Link Check').filter(r=>r.url);const responses=nodeItems(data,'Check Source Links');
  const capturedAt=execution.stoppedAt||execution.startedAt;
  const sources=requests.slice(0,10).map((req,index)=>{const response=responses[index]||{};const body=response.body??response.data??'';const text=typeof body==='string'?readableSourceText(body):'';
    const packet=recordedSourceEvidence(response,tools.decode,candidate.claims[req.claim_index]?.claim||'',10000);
    return {...packet,url:safePhotoReference(req.url),claimIndex:req.claim_index,contentHash:digest(text),capturedAt,basis:'recorded_n8n_execution'};});
  const scan=nodeItems(data,'Prepare First-Party Page Scan')[0];const page=nodeItems(data,'Fetch First-Party Page Metadata')[0];
  const rawHtml=page?.body??page?.data??'';const context={id:'DEV-'+jobId,subject:candidate.subject,title:candidate.title};const images=scan?inspectPhotoSource(rawHtml,scan.source_page_url,context):[];
  for(let index=0;index<requests.length;index++){if(sources[index]?.access!=='source_text_captured')continue;const response=responses[index]||{};for(const image of inspectPhotoSource(response.body??response.data??'',requests[index].url,context)){if(!images.some(existing=>existing.url===image.url))images.push(image);}}
  const additionalMedia=[];
  for(const image of images){const existing=candidate.media.find(m=>m.previewUrl===image.url);if(existing)image.assetId=existing.id;
    else if(image.relation==='subject_caption_match'&&additionalMedia.length<7){image.assetId=image.id;image.additionalSourceReference=true;additionalMedia.push({id:image.id,title:image.caption.slice(0,180)||'Source image reference',creator:image.creator,sourceUrl:image.sourceUrl,previewUrl:image.url,provider:'captured_source_page_image',rightsStatus:'preview_unreviewed',license:'UNKNOWN — source visibility is not publication permission',width:null,height:null});}}

  const models=['Research Candidates','Draft Editorial Concept'].map(name=>{const runs=data[name]||[];const usages=runs.map(r=>r.metadata?.tokenUsage);const measurable=runs.length>0&&usages.every(u=>Number.isFinite(u?.inputTokens)&&Number.isFinite(u?.outputTokens));const output=nodeItems(data,name)[0];const fullResponse=Boolean(output?.usage||output?.object==='response');
    return {node:name,runs:runs.length,inputTokens:measurable?usages.reduce((n,u)=>n+u.inputTokens,0):null,outputTokens:measurable?usages.reduce((n,u)=>n+u.outputTokens,0):null,toolCalls:fullResponse?(output.output||[]).filter(x=>x.type==='web_search_call').length:null,usageSource:measurable?'n8n_execution_metadata':'unavailable'};});
  const measured=models.filter(m=>m.runs>0);const complete=measured.length>0&&measured.every(m=>m.inputTokens!==null&&m.outputTokens!==null);
  const related=images.filter(m=>m.relation==='subject_caption_match'&&m.assetId);
  const target=candidate.format==='single_image'?1:candidate.targetSlideCount||5;
  const selectionProposal={assetIds:related.slice(0,target).map(m=>m.assetId),basis:'source_caption_metadata_match',requiresHumanVisualReview:true};
  return {executionId:String(execution.id),capturedAt,sources,images,additionalMedia,selectionProposal,usage:{models,inputTokens:complete?measured.reduce((n,m)=>n+m.inputTokens,0):null,outputTokens:complete?measured.reduce((n,m)=>n+m.outputTokens,0):null,price:null,priceVerified:false},fingerprint:digest(JSON.stringify({executionId:execution.id,sourceHashes:sources.map(s=>s.contentHash),images,selectionProposal}))};
}

/** Source-independent writing checks; review signals, not an automatic author-quality score. */
export function captionReviewSignals(caption) {
  const text=String(caption||'');const issues=[];
  if(/for (?:a |the )?(?:younger|wider|modern) audience|the appeal is|target audience/i.test(text))issues.push({code:'AUDIENCE_PITCH_IN_CAPTION',message:'Move audience-positioning language out of the finished caption.'});
  if(!text.trim())issues.push({code:'MISSING_CAPTION',message:'A sourced working caption is still needed.'});
  if([...text].length>2200)issues.push({code:'CAPTION_TOO_LONG',message:'The working caption exceeds the Instagram text limit.'});
  return issues;
}

export function assessEditorialPackage(candidate,evidence) {
  const caption=candidate.captionDraft||'';const issues=captionReviewSignals(caption);
  const unconfirmed=candidate.claims.filter(c=>c.linkStatus!=='live');if(unconfirmed.length)issues.push({code:'UNCONFIRMED_CLAIM_SOURCES',message:`${unconfirmed.length} claim source${unconfirmed.length===1?' is':'s are'} not accessible enough to substantiate here.`});
  const imageEvidence=evidence?.images||candidate.media.map(m=>({assetId:m.id,relation:m.sourceRelation,dateContext:m.dateContext,years:m.sourceYears||[]}));
  const proposedIds=evidence?.selectionProposal.assetIds||candidate.proposedAssetIds||[];
  const scoped=imageEvidence.filter(m=>proposedIds.includes(m.assetId));
  if(scoped.some(m=>m.dateContext==='different_year_context'&&!m.years.every(year=>new RegExp('\\b'+year+'\\b').test(caption))))issues.push({code:'PHOTO_DATE_CONTEXT',message:'The proposed photograph is dated differently from the story subject. State the actual date; do not imply a film still or on-set photograph.'});
  if(scoped.some(m=>m.relation==='page_cover'))issues.push({code:'GENERIC_SOURCE_COVER',message:'A source-page cover is not automatically a suitable story image.'});
  const proposed=proposedIds.length;const target=candidate.format==='single_image'?1:candidate.targetSlideCount||5;
  if(proposed<target)issues.push({code:'INSUFFICIENT_RELATED_PHOTOGRAPHY',message:`Only ${proposed} existing image reference${proposed===1?' matches':'s match'} the subject through source captions; ${target} would be needed for the proposed format.`});
  return {status:issues.length?'needs_research':'ready_for_human_review',issues,factsVerifiedByHuman:false,rightsGranted:false,pixelAnalysisPerformed:false,assessmentBasis:'recorded_text_and_metadata_checks',accessibleSourceCount:evidence?.sources.filter(s=>s.access==='source_text_captured').length??null};
}
