import {esc,effective,external,safeUrl,storyUrl,fieldDisabled} from './components.js';
import {musicRefinePanel} from './music.js';

const text=value=>typeof value==='string'?value.trim():'';
const captured=claim=>claim?.capturedAccess==='source_text_captured'&&text(claim.capturedTextExcerpt).length>=80&&Boolean(safeUrl(claim.url));

/** Existing source-bound proposals and current selected-image evidence only.
 * These are writing references, never a new generated caption or pixel judgment. */
export function refineWritingSuggestions(story){
 const current=effective(story),claims=story.research||[],selected=new Set(current.selectedAssetIds||[]),media=story.media||[],context=story.editorialPackage?.captionContext;
 const angles=(story.hookOptions||[]).map((option,index)=>{
  const indices=Array.isArray(option.claimIndices)?option.claimIndices:[],sources=indices.map(i=>claims[i]);
  if(!text(option.text)||!sources.length||sources.some(c=>!captured(c)))return null;
  return {kind:'angle',index,text:option.text,recommended:option.recommended===true,current:current.hook===option.text,interpretation:text(option.interpretation),sources:[...new Map(sources.map(c=>[c.url,{url:safeUrl(c.url),label:c.sourceName||'Recorded source'}])).values()],basis:'captured_sources'};
 }).filter(Boolean).sort((a,b)=>Number(b.recommended)-Number(a.recommended));
 const visual=context?.pixelReviewPerformed===true&&context.visualStatus==='verified_current'?(context.selectedImages||[]).find(item=>{
  const asset=media.find(a=>a.id===item.assetId);return selected.has(item.assetId)&&text(item.observations)&&item.pixelReviewPerformed===true&&item.basis==='verified_image_bound_observation'&&item.previewSha256&&asset?.localPreview?.sha256===item.previewSha256;
 }):null;
 if(visual)return {angles,reference:{kind:'visual',text:visual.observations,label:'From the assessed photograph',basis:'image_bound_ai_observation',assetId:visual.assetId,url:safeUrl(visual.sourceUrl),detail:'Use the visible detail as an entry point. Check names, dates and context against your sources.'}};
 const source=claims.find(c=>captured(c)&&c.claimType==='verified_fact');
 if(source)return {angles,reference:{kind:'source',text:source.claim,label:'A detail to open with',basis:'captured_source',url:safeUrl(source.url),sourceName:source.sourceName||'Recorded source',detail:'A recorded source claim to develop—not a new caption or a completed fact check.'}};
 const photo=media.find(a=>selected.has(a.id)&&text(a.sourceCaption)&&a.sourceRelation==='subject_caption_match'&&a.materialType!=='design_documentation'&&safeUrl(a.sourceUrl));
 return {angles,reference:photo?{kind:'source_photo',text:photo.sourceCaption,label:'From the photograph’s source',basis:'source_caption_metadata',assetId:photo.id,url:safeUrl(photo.sourceUrl),detail:'Source description only. Inspect the photograph before using a visual detail.'}:null};
}

function angleCard(story,angle){
 return `<article class="refine-angle-card"><p class="refine-angle-copy">${esc(angle.text)}</p><div class="refine-angle-action"><button class="small-button" data-action="choose-hook" data-story="${esc(story.id)}" data-index="${angle.index}" ${angle.current?'disabled':fieldDisabled(story)}>${angle.current?'Saved story angle':'Use as story angle'}</button><span>${angle.sources.map(s=>external(s.url,s.label)).join(' · ')}</span></div>${angle.interpretation?`<p class="small muted">Interpretation: ${esc(angle.interpretation)}</p>`:''}</article>`;
}

/** Refine keeps meaningful editorial choices beside writing, without commissioning AI. */
export function refineAssistance(state,story){
 if(state.captionTools?.[story.id]&&state.captionTools[story.id]!=='edit')return '';
 const {angles,reference}=refineWritingSuggestions(story),primary=angles[0],others=angles.slice(1,3),current=effective(story);
 return `<section class="refine-assistance" aria-label="Creative guidance"><div class="section-heading"><div><p class="eyebrow">Give the post a point of view</p><h3>Angle & sound</h3></div></div><div class="refine-assistance-grid"><section class="refine-angle"><div class="refine-mini-heading"><h4>The story angle</h4><span class="refine-basis">${reference?.kind==='visual'?'Image-bound AI + sources':'Source-based guidance'}</span></div>${primary?angleCard(story,primary):current.hook?`<p class="refine-angle-copy">${esc(current.hook)}</p><p class="small muted">Your current angle. Check it against the sources before publication.</p>`:''}${others.length?`<details class="refine-other-angles"><summary>Try another story angle</summary>${others.map(a=>angleCard(story,a)).join('')}</details>`:''}${reference?`<div class="refine-writing-reference"><p class="eyebrow">${esc(reference.label)}</p><blockquote>${esc(reference.text.length>420?reference.text.slice(0,417)+'…':reference.text)}</blockquote><p class="small muted">${esc(reference.detail)}</p>${reference.url?external(reference.url,reference.sourceName||'Original source','text-link'):''}</div>`:!primary?`<p class="small muted">Save source passages or inspect the selected photographs to develop a specific opening.</p><a class="text-link" href="${storyUrl(story.id,'research')}">Open the research →</a>`:''}<div class="refine-improve-actions"><button class="text-button" type="button" data-refine-improve="discovery_opening" data-story="${esc(story.id)}" ${fieldDisabled(story)}>Improve the opening →</button><button class="text-button" type="button" data-refine-improve="alternate_angle" data-story="${esc(story.id)}" ${fieldDisabled(story)}>Explore a different angle →</button></div><p class="small muted">Choosing an angle saves direction only. Your caption stays unchanged. New AI writing is reviewed and confirmed separately.</p></section>${musicRefinePanel(state,story)}</div></section>`;
}
