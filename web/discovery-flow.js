import {esc,sectionHeading} from './components.js';

// These modes map to existing kind/prompt contracts, never to invented native presets.
export function researchAccess(engine={}) {
 const canStart=engine.configured===true&&engine.readOnly===false&&engine.generationApproved===true&&engine.workerActive===true&&engine.generationAvailable===true;
 const code=canStart?'available':engine.readOnly?'read_only':engine.configured?'not_approved':'not_connected';
 return {canStart,code,message:canStart?'':engine.authorizedRunsRemaining===0?'The approved run is used or expired. Existing results remain available.':'Story generation is not connected yet. You can keep a direction for later.'};
}

export function discoverySetup(state) {
 const mode=['surprise','preset','custom'].includes(state.discoveryMode)?state.discoveryMode:'surprise';
 const access=researchAccess(state.workspace?.engine),draft=state.researchDraft||{};
 const catalog=state.workspace?.researchPresets,items=catalog?.items||[],choice=state.presetChoice||items.find(p=>p.nativeSelected)||items[0];
 const preset=items.find(p=>p.key===choice?.key&&p.version===choice?.version);
 return `<section class="discovery-start" id="research-direction" aria-label="New discovery">${sectionHeading('Generate stories','Choose an approach.')}
 <div class="discovery-modes" role="group" aria-label="Discovery approach">${[['surprise','Surprise Me','Follow the publication’s current research brief.'],['preset','Choose a Theme','Choose a saved editorial direction.'],['custom','Custom Direction','Bring a subject, question or source.']].map(([id,label,detail])=>`<button type="button" data-discovery-mode="${id}" aria-label="${label}" aria-pressed="${mode===id}"><strong>${label}</strong><span>${detail}</span></button>`).join('')}</div>
 <div class="discovery-mode-body">
 ${mode==='surprise'?'<p>Let research look for unexpected photographic and cultural connections using the current editorial preset.</p>':''}
 <form data-research-form data-discovery-setup data-mode="${mode}">
 <fieldset class="discovery-fields" data-discovery-fields ${state.discoverySubmitting?'disabled':''}><div class="custom-discovery-fields" ${mode==='custom'?'':'hidden'}><label class="field" for="discovery-prompt">Creative direction<textarea id="discovery-prompt" aria-label="Creative direction" name="prompt" minlength="12" maxlength="2000" ${mode==='custom'?'required':'disabled'} placeholder="Find the story behind…">${esc(draft.prompt||'')}</textarea></label><label class="field" for="discovery-source">Source link (optional)<input id="discovery-source" type="url" name="sourceUrl" ${mode==='custom'?'':'disabled'} value="${esc(draft.sourceUrl||'')}" placeholder="https://…"></label></div>
 ${mode==='preset'?`<div class="preset-availability">${items.length?`<label class="field" for="discovery-preset">Choose a theme<select id="discovery-preset" aria-label="Choose a theme" name="presetKey" required><option value="" ${preset?'':'selected'} disabled>Choose a saved theme</option>${items.map(p=>`<option value="${esc(p.key)}" data-version="${esc(p.version)}" ${p===preset?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:'<h3>Themes are unavailable</h3><p>The recorded themes have not been read from this connection. Check for updates or describe a theme in Custom direction.</p><button type="button" class="text-button" data-discovery-mode="custom">Describe a theme →</button>'}</div>`:''}
 <div class="carousel-actions"><button class="button button-dark" type="submit" name="intent" value="start" ${!access.canStart||mode==='preset'&&!preset?'disabled':''}>Generate Stories</button><button class="text-button" type="submit" name="intent" value="save" ${mode==='preset'&&!preset?'disabled':''}>Save direction</button></div><p data-research-status role="status" class="small"></p></fieldset></form>
 ${access.message?`<p class="research-availability" data-research-availability="${access.code}">${esc(access.message)}</p>`:''}
 ${mode!=='custom'&&draft.prompt?.trim()?'<p class="small muted">Your unsaved custom direction is still here. Switch to Custom direction to continue it.</p>':''}
 </div></section>`;
}
