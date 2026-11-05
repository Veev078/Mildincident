import {esc,sectionHeading} from './components.js';

// These modes map to existing kind/prompt contracts, never to invented native presets.
export function researchAccess(engine={}) {
 if(!engine.configured)return {canStart:false,code:'not_connected',message:'Research launch is not connected to this Studio. You can save a brief now; it will not run until an authorized research connection is available.'};
 if(engine.readOnly===true)return {canStart:false,code:'read_only',message:'This Studio receives research results but cannot start new research. A separately authorized launch connection is missing. Save your brief now; existing results can still be checked below.'};
 if(engine.readOnly!==false||!engine.generationApproved)return {canStart:false,code:'not_approved',message:'Research launch has not been authorized for this connection. Your brief can be saved without starting a run.'};
 if(!engine.workerActive||!engine.generationAvailable)return {canStart:false,code:'worker_unavailable',message:'The approved research worker is not available to run. Save your brief while its connection is checked.'};
 return {canStart:true,code:'available',message:'Research is available through the authorized development connection. One run prepares up to one proposal for review; saving alone does not start it.'};
}

export function discoverySetup(state) {
 const mode=['surprise','preset','custom'].includes(state.discoveryMode)?state.discoveryMode:'surprise';
 const access=researchAccess(state.workspace?.engine),draft=state.researchDraft||{};
 return `<section class="discovery-start" id="research-direction" aria-label="New discovery">${sectionHeading('Start a new discovery','Choose how you want to begin. Completed ideas will appear in Proposals to review below.')}
 <div class="discovery-modes" role="group" aria-label="Discovery approach">${[['surprise','Surprise Me','Follow the publication’s current research brief.'],['preset','Theme / preset','See what this connection supports.'],['custom','Custom direction','Bring a subject, question or source.']].map(([id,label,detail])=>`<button type="button" data-discovery-mode="${id}" aria-label="${label}" aria-pressed="${mode===id}"><strong>${label}</strong><span>${detail}</span></button>`).join('')}</div>
 <div class="discovery-mode-body">
 ${mode==='surprise'?'<p>Let research look for unexpected photographic and cultural connections using the current n8n preset.</p>':mode==='preset'?'<div class="preset-availability"><h3>Use the current n8n preset</h3><p>Preset selection is managed in n8n. This Studio connection does not expose a selectable preset catalog or a way to change it.</p><p>Saving here keeps the general discovery brief; it does not select or change a theme.</p><button class="text-button" data-discovery-mode="custom">Describe a theme in Custom direction →</button></div>':''}
 <form data-research-form data-discovery-setup data-mode="${mode}">
 <fieldset class="discovery-fields" data-discovery-fields ${state.discoverySubmitting?'disabled':''}><div class="custom-discovery-fields" ${mode==='custom'?'':'hidden'}><label class="field" for="discovery-prompt">Creative direction<textarea id="discovery-prompt" aria-label="Creative direction" name="prompt" minlength="12" maxlength="2000" ${mode==='custom'?'required':'disabled'} placeholder="Find the story behind…">${esc(draft.prompt||'')}</textarea></label><label class="field" for="discovery-source">Source link (optional)<input id="discovery-source" type="url" name="sourceUrl" ${mode==='custom'?'':'disabled'} value="${esc(draft.sourceUrl||'')}" placeholder="https://…"></label></div>
 <div class="carousel-actions"><button class="button button-dark" type="submit" name="intent" value="${access.canStart?'start':'save'}">${access.canStart?'Start research':mode==='custom'?'Save research direction':'Save general discovery brief'}</button>${access.canStart?'<button class="text-button" type="submit" name="intent" value="save">Save without starting</button>':''}</div><p data-research-status role="status" class="small"></p></fieldset></form>
 <p class="research-availability" data-research-availability="${access.code}">${esc(access.message)}</p>
 ${mode!=='custom'&&draft.prompt?.trim()?'<p class="small muted">Your unsaved custom direction is still here. Switch to Custom direction to continue it.</p>':''}
 </div></section>`;
}
