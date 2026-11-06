import {captionGenerationPanel} from './caption-generation.js';
import {generationReceipt} from './generation-receipt.js';
import {hookOptionsView} from './editorial-options.js';
import {esc,effective,mediaFor,image,external,safeUrl,storyUrl} from './components.js';

export function captionEditor(state,story,{rows=10}={}){
 const caption=effective(story).caption,count=[...caption].length,warning=count>2200||/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(caption);
 return `<section class="caption-writing-surface" data-story-task="caption"><div class="caption-editor-heading"><h2>Caption</h2><button class="text-button" type="button" title="Copying does not approve or publish" data-action="copy-caption" data-story="${esc(story.id)}">Copy</button></div>${captionGenerationPanel(story,{state})}<label class="sr-only" for="caption-editor">Caption draft</label><textarea class="caption-editor" id="caption-editor" aria-label="Local caption draft" data-draft-field="caption" data-story="${esc(story.id)}" rows="${rows}" ${story.localDraft?.stale?'disabled':''}>${esc(caption)}</textarea><div class="caption-toolbar"><span data-caption-count class="${count>2200?'error-text':''}">${count} / 2,200 characters</span><span>Autosaves privately</span></div><p data-caption-warning class="inline-warning" ${warning?'':'hidden'}>Review caption length or internal-test markers before any handoff.</p>${hookOptionsView(story,{editable:true})}</section>`;
}

/** The existing versioned caption editor, with its selected photographs and sources kept close. */
export function captionWorkspace(state,story,{renderChecks=()=>''}={}) {
 const working=effective(story),selected=mediaFor(story),shown=selected.slice(0,4);
 const sources=[],seen=new Set();
 for(const claim of story.research||[]){const url=safeUrl(claim.url);if(url&&!seen.has(url)){seen.add(url);sources.push({...claim,url});}}
 return `<div class="workspace-main caption-workbench">${captionEditor(state,story,{rows:13})}${generationReceipt(story,{canRead:state.workspace?.engine?.configured===true})}
 <details class="caption-check-details"><summary>Caption checks & source comparison</summary><div data-caption-checks>${renderChecks(story)}</div></details></div>
 <aside class="workspace-aside caption-context"><section class="aside-block"><div class="section-heading"><h3>Your photographs</h3><a class="text-link" href="${storyUrl(story.id,'carousel')}">Edit sequence →</a></div>${shown.length?`<div class="caption-contact-sheet">${shown.map((asset,index)=>`<div class="caption-context-frame">${image(asset,{index,storyId:story.id,compact:true})}</div>`).join('')}</div><p class="small muted">${selected.length} selected${selected.length>shown.length?' · first '+shown.length+' shown':''}, in your saved order. Preview availability does not establish identity or image rights.</p>`:'<p class="muted">No photographs selected yet.</p><a class="text-link" href="'+storyUrl(story.id,'images')+'">Choose your images →</a>'}</section>
 <details class="aside-block caption-context-angle" open><summary>Angle & sources</summary><section><h3>The angle</h3><p>${esc(working.hook||'Give the story a specific angle to guide your caption.')}</p><a class="text-link" href="${storyUrl(story.id,'direction')}">Refine the angle →</a></section>
 <section class="caption-context-sources"><h3>Keep sources close</h3>${sources.length?`<ul>${sources.slice(0,3).map(source=>`<li>${external(source.url,source.sourceName||'Original source')}${source.capturedAccess==='source_text_captured'&&source.capturedTextExcerpt?`<details class="caption-source-excerpt"><summary>Read saved excerpt</summary><blockquote class="small">${esc(source.capturedTextExcerpt)}</blockquote><p class="small muted">Captured source text; check support for the exact wording.</p></details>`:''}</li>`).join('')}</ul><p class="small muted">Source links support checking; they are not a completed fact check.</p>`:'<p class="muted">No usable source links are recorded here yet.</p>'}<a class="text-link" href="${storyUrl(story.id,'research')}">Review ${(story.research||[]).length} recorded ${(story.research||[]).length===1?'claim':'claims'} →</a></section></details></aside>`;
}
