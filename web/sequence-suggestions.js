import {esc,image,storyUrl,fieldDisabled} from './components.js';

const suggestion=plan=>plan.options.find(o=>o.id==='curated-sequence')||plan.options.find(o=>o.id==='source-sequence')||plan.options[0];
const basis=r=>r?.aiVisualAssessmentPerformed?'Uses AI observations of these saved photographs. Your edit remains decisive.':'Suggested from source context, saved files and your choices. AI has not reviewed these photographs.';
const title=a=>a?.title||'Project photograph';
function openingReason(candidate){
 const reason=candidate?.reasons?.[0]||'';
 return /shortlisted/.test(reason)?'You shortlisted this photograph.':/current opening/.test(reason)?'Keeps your current opening photograph.':/verified image-bound AI/.test(reason)?'Suggested by the image review.':'A project-linked starting point for your edit.';
}
export function sequenceSuggestionSummary(story){
 const plan=story.sourceSequencePlan,r=plan?.recommendation;if(!r?.openingCandidates?.length)return '';
 const id=suggestion(plan)?.slides[0]?.assetId||r.openingCandidates[0].assetId,a=story.media.find(m=>m.id===id),candidate=r.openingCandidates.find(c=>c.assetId===id);
 return `<details class="sequence-suggestions"><summary>Suggested opening & sequence</summary><p class="small">${esc(openingReason(candidate))}</p><button class="text-button" data-action="inspect" data-story="${esc(story.id)}" data-asset="${esc(id)}">${esc(title(a))}</button><p><a class="text-link" href="${storyUrl(story.id,'carousel')}">Review the suggested sequence →</a></p></details>`;
}
function optionView(story,plan,option,{recommended=false}={}){
 const label=recommended?'Start here':option.id==='single-source-frame'?'One photograph':'Keep the source order';
 const slides=option.slides.map((slide,index)=>{
  const a=story.media.find(m=>m.id===slide.assetId),previous=option.slides[index-1];let note=slide.note||'';
  if(index===0)note=openingReason(plan.recommendation?.openingCandidates?.find(c=>c.assetId===slide.assetId));
  else if(note===previous?.note)note='';
  else if(/Changes image format/.test(note))note='A change of shape for the next swipe.';
  else if(/source descriptions suggest/.test(note))note='The source describes a change in scale or context.';
  else if(/distinct project reference/.test(note))note='Review how this photograph follows the previous frame.';
  const position=index===0?'Opening photo':index===option.slides.length-1?'Closing photo':'Photo '+(index+1);
  return `<li>${image(a,{storyId:story.id})}<div><p class="eyebrow">${position}${a?.localPreview?' · saved photograph':' · reference only'}</p><p>${esc(slide.caption)}</p>${note?`<p class="small">${esc(note)}</p>`:''}<p class="small muted">${esc(slide.credit||'Photographer credit unverified')}${slide.years?.length?' · '+slide.years.join(', '):''}</p></div></li>`;
 }).join('');
 return `<details ${recommended?'open data-recommended-sequence':''}><summary>${esc(label)} · ${option.targetSlideCount} ${option.targetSlideCount===1?'photo':'photos'}</summary><ol class="source-sequence-slides">${slides}</ol><button type="button" class="${recommended?'button button-dark':'small-button'}" data-action="apply-source-sequence" data-story="${esc(story.id)}" data-option-id="${esc(option.id)}" data-plan-digest="${esc(plan.digest)}" ${fieldDisabled(story)}>Apply ${option.targetSlideCount}-photo ${option.targetSlideCount===1?'selection':'sequence'}</button></details>`;
}
export function sourceSequenceOptions(story){
 const plan=story.sourceSequencePlan;if(!plan?.options.length)return '';const main=suggestion(plan),r=plan.recommendation,others=plan.options.filter(o=>o!==main),opening=(r?.openingCandidates||[]).filter(c=>c.assetId!==main.slides[0]?.assetId);
 return `<section class="editorial-panel sequence-proposals" aria-label="Opening image and sequence proposals"><p class="eyebrow">A starting point for your edit</p><h2>Suggested sequence</h2><p class="small muted">${esc(basis(r))}</p><div class="source-sequence-options">${optionView(story,plan,main,{recommended:true})}</div><p class="small muted">Apply changes your working selection only. Your writing and earlier order stay in history. Check image identity, dates and permission before approval.</p>${opening.length?`<details class="sequence-alternatives"><summary>Other opening choices · ${opening.length}</summary><ol>${opening.map(c=>{const a=story.media.find(m=>m.id===c.assetId);return `<li><button class="text-button" data-action="inspect" data-story="${esc(story.id)}" data-asset="${esc(c.assetId)}">${esc(title(a))}</button><p class="small">${esc(openingReason(c))}</p></li>`;}).join('')}</ol></details>`:''}${others.length?`<details class="sequence-alternatives"><summary>Other ways to tell it</summary><div class="source-sequence-options">${others.map(o=>optionView(story,plan,o)).join('')}</div></details>`:''}${r?.withheld?.length?`<details class="sequence-alternatives"><summary>Similar frames kept for comparison · ${r.withheld.length}</summary><p class="small">These may repeat another frame in the suggestion. They remain in your gallery; compare before using both.</p>${r.withheld.map(w=>`<p class="small">${esc(title(story.media.find(a=>a.id===w.assetId)))}</p>`).join('')}</details>`:''}</section>`;
}
