import {esc,storyUrl,external} from './components.js';
import {refineWritingSuggestions} from './refine-assistance.js';

/** A source/visual-grounded bridge between the photographs and the writing.
 * It never replaces a caption or invents an AI judgment for metadata. */
export function editorialPackageSummary(story,{compact=false}={}){
 const p=story.editorialPackage;if(!p)return '';
 const c=p.captionContext||{},visual=c.pixelReviewPerformed===true,directions=c.hookDirections||[],gaps=p.gaps||[];
 const selected=c.selectedImages||[],writing=refineWritingSuggestions(story);
 return `<section class="editorial-package-summary ${compact?'is-compact':''}" aria-label="Story and photograph coherence"><p class="eyebrow">Make the pictures and writing work together</p><h3>${visual?'A story shaped by the photographs':'Build a coherent post'}</h3><p>${esc(p.summary)}</p><p class="small muted">${visual?'Uses a complete AI review bound to these saved image files.':'Source descriptions and your edit only. AI has not judged these photographs.'}</p>
 ${visual&&selected.length?`<details><summary>What the selected pictures show</summary>${selected.filter(i=>i.observations).map(i=>`<p><strong>${esc(story.media.find(a=>a.id===i.assetId)?.title||'Selected photograph')}</strong> · ${esc(i.observations)}</p>`).join('')}</details>`:''}
 ${directions.length?`<details ${compact?'':'open'}><summary>Possible openings, grounded in the pictures</summary><ul>${directions.map(d=>`<li>${esc(d.text)}</li>`).join('')}</ul><p class="small muted">Editorial directions, not verified factual claims or a new caption. Keep research beside the writing.</p></details>`:''}
 ${!directions.length&&writing.reference?`<div class="editorial-source-direction"><p class="eyebrow">${esc(writing.reference.label)}</p><blockquote>${esc(writing.reference.text.length>420?writing.reference.text.slice(0,417)+'…':writing.reference.text)}</blockquote><p class="small muted">${esc(writing.reference.detail)}</p>${writing.reference.url?external(writing.reference.url,writing.reference.sourceName||'Original source','text-link'):''}<p><a class="text-link" href="${storyUrl(story.id,'refine')}">Develop the opening →</a></p></div>`:''}
 ${gaps.length?`<details><summary>${gaps.length} ${gaps.length===1?'point':'points'} to resolve</summary><ul>${gaps.map(g=>`<li>${esc(g.message)}</li>`).join('')}</ul></details>`:''}
 <div class="editorial-package-links"><a class="text-link" href="${storyUrl(story.id,'images')}">Review photographs →</a><a class="text-link" href="${storyUrl(story.id,'carousel')}">Compare suggested sequence →</a></div><p class="small muted">Your caption and selections are preserved. Source accuracy, permissions and final approval remain yours to review.</p></section>`;
}
