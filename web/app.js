import { esc, date, human, storyUrl, effective, mediaFor, proposalContent } from './components.js';
import * as views from './views.js';
import { creativeBriefFor, emptyCreativeBrief, directionReviewSummary, directionSequenceObservations } from './direction.js';
import {photoComparison,photographicBrief} from './photography.js';

const state = { photoDeskOpen:sessionStorage.getItem('mi-photo-desk-open')==='true', workspace: null, search: '', pipelineGroup: 'all', librarySearch: '', libraryRights: 'all', compared: [], loading: true, error: null };
const pending = new Map();
const saving = new Set();
const inFlight = new Map();
const savePromises = new Map();
const history = new Map();
const timers = new Map();
const versions = new Map();
const nav = [['discovery', 'Discovery desk', '00'], ['home', 'Editorial home', '01'], ['pipeline', 'Story pipeline', '02'], ['library', 'Image library', '03'], ['publishing', 'Publishing', '04'], ['archive', 'Published archive', '05'], ['analytics', 'Performance', '06']];
let pollTimer;
let searchTimer;
let toastTimer;
let keyboardPrefix = false;
let drag = null;
let rehearsal = null;

function route() {
  const [view = 'home', encodedId, tab = 'overview'] = location.hash.replace(/^#\/?/, '').split('/');
  let id = encodedId;
  try { id = encodedId && decodeURIComponent(encodedId); } catch { id = ''; }
  return { view: ['discovery', 'home', 'pipeline', 'library', 'publishing', 'archive', 'analytics', 'story'].includes(view) ? view : 'home', id, tab };
}

const storyById = id => state.workspace?.stories?.find(story => story.id === id);
const announce = message => { document.querySelector('#announcement').textContent = message; };

function toast(message, { error = false, retryStory } = {}) {
  clearTimeout(toastTimer);
  const node = document.querySelector('#toast');
  node.hidden = false;
  node.classList.toggle('error', error);
  node.innerHTML = `<span>${esc(message)}</span>${retryStory ? `<button class="text-button" data-action="retry-save" data-story="${esc(retryStory)}">Retry local save</button>` : ''}<button class="toast-close" data-action="close-toast" aria-label="Dismiss notification">×</button>`;
  if (!error) toastTimer = setTimeout(() => { node.hidden = true; }, 6000);
}

async function api(url, options) {
  let response;
  try { response = await fetch(url, { cache: 'no-store', ...options }); } catch { throw Object.assign(new Error('The local workspace could not be reached. Your production records are unchanged.'), { code: 'NETWORK_UNAVAILABLE' }); }
  let data;
  try { data = await response.json(); } catch { throw new Error('The workspace returned an unreadable response.'); }
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'The operation did not complete.'), { code: data.error?.code || `HTTP_${response.status}` });
  return data;
}

function rememberFocus() {
  const active = document.activeElement;
  return active?.id ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
}

function render({ focusMain = false } = {}) {
  const focus = rememberFocus();
  const current = route();
  const source = state.workspace?.source || {};
  const active = current.view === 'story' ? 'pipeline' : current.view;
  const viewTitle = current.view === 'story' ? 'Story workspace' : nav.find(n => n[0] === current.view)?.[1];
  const count = state.workspace?.stories?.length || 0;
  let body;
  if (state.loading) body = `<div class="loading-state"><p class="eyebrow">Retrieving the existing source records</p><h1>Opening the editorial desk.</h1><p>Stories, selected photographs and publishing evidence are loading.</p><div class="loading-line" aria-hidden="true"></div></div>`;
  else if (state.error) body = `<div class="empty-state error-state"><p class="eyebrow">Connection needs attention</p><h1>The desk could not be loaded.</h1><p>${esc(state.error)}</p><button class="button button-dark" data-action="reload">Try the local connection again</button><p class="small muted">No example stories or invented publishing results are substituted.</p></div>`;
  else if (current.view === 'story') {
    const story = storyById(current.id);
    body = story ? views.storyWorkspace(state, story, current.tab) : `<div class="empty-state"><h1>Story not found in this snapshot.</h1><p>The existing ID may be unavailable or the source may have changed.</p><a class="button button-dark" href="#/pipeline">Return to the pipeline</a></div>`;
  } else body = views[current.view](state);
  const warnings = source.warnings || [];
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="masthead" href="#/home" aria-label="MILDINCIDENT editorial home">MILDINCIDENT<span>Independent visual culture</span></a><div class="sidebar-label">The editorial desk</div><nav class="primary-nav" aria-label="Main navigation">${nav.map(([id, label, num]) => `<a href="#/${id}" ${active === id ? 'aria-current="page"' : ''}><span>${num}</span>${label}${id === 'pipeline' ? `<small>${count}</small>` : ''}</a>`).join('')}</nav><div class="sidebar-foot"><span class="edition-mark">M / I</span><p>Unusual histories.<br>Original perspectives.</p><div class="keyboard-hints"><kbd>/</kbd> Find a story<br><kbd>G</kbd> <kbd>H</kbd> Editorial home</div><a href="https://rickywelch.app.n8n.cloud/webhook/founder-command-center" target="_blank" rel="noopener noreferrer">Existing Founder Studio ↗</a></div></aside><div class="workspace-shell"><header class="topbar"><div class="breadcrumb"><span>MILDINCIDENT</span><span aria-hidden="true">/</span><strong>${esc(viewTitle)}</strong></div><label class="global-search"><span aria-hidden="true">⌕</span><input id="global-search" type="search" placeholder="Find a story…" value="${esc(state.search)}" aria-label="Find a story"><kbd>/</kbd></label><span class="private-label">PRIVATE WORKSPACE</span></header><div class="source-bar"><span><i class="status-dot ${source.stale ? 'stale' : ''}" aria-hidden="true"></i>${source.kind === 'live_snapshot' ? 'Connected source snapshot' : source.kind ? human(source.kind) : 'Connecting to source'}${source.observedAt ? `<small>${esc(date(source.observedAt))} ET${source.stale ? ' · refresh recommended' : ''}</small>` : ''}</span><button class="text-button" data-action="refresh" ${source.refreshing ? 'disabled' : ''}>${source.refreshing ? 'Refreshing source…' : 'Refresh source ↻'}</button></div>${warnings.length ? `<details class="source-warnings"><summary>${warnings.length} source ${warnings.length === 1 ? 'notice' : 'notices'}</summary><ul>${warnings.map(warning => `<li>${esc(typeof warning === 'string' ? warning : warning.message || warning.code)}</li>`).join('')}</ul></details>` : ''}<main id="main-content" tabindex="-1">${body}</main><footer class="workspace-footer"><span>MILDINCIDENT · Source-led editorial production</span><span>Local edits stay private · n8n remains authoritative</span></footer></div></div>${state.compared.length ? `<div class="compare-tray"><span>${state.compared.length} image${state.compared.length === 1 ? '' : 's'} marked for comparison</span><button class="button button-dark" data-action="open-comparison" ${state.compared.length < 2 ? 'disabled' : ''}>Compare images →</button><button class="text-button" data-action="clear-comparison">Clear comparison</button></div>` : ''}`;
  document.title = current.view === 'story' && storyById(current.id) ? `${storyById(current.id).title} — MILDINCIDENT` : `${viewTitle} — MILDINCIDENT`;
  if (focusMain) document.querySelector('#main-content').focus({ preventScroll: true });
  else if (focus) {
    const next = document.getElementById(focus.id);
    next?.focus({ preventScroll: true });
    if (typeof focus.start === 'number') { try { next?.setSelectionRange(focus.start, focus.end); } catch {} }
  }
}

async function loadWorkspace({ quiet = false } = {}) {
  if (!quiet) { state.loading = true; render(); }
  try {
    const workspace = await api('/api/workspace');
    if (!Array.isArray(workspace.stories)) throw new Error('The source response does not contain a story collection.');
    const previous = new Map((state.workspace?.stories || []).map(story => [story.id, { draft: story.localDraft, revision: story.revision }]));
    state.workspace = workspace;await hydrateActivePhoto();
    for (const story of workspace.stories) {
      if (!saving.has(story.id)) versions.set(story.id, story.localDraft?.version || 0);
      const changes = { ...(inFlight.get(story.id) || {}), ...(pending.get(story.id) || {}) };
      if (Object.keys(changes).length) {
        const prior = previous.get(story.id);
        const baseRevision = prior?.draft?.baseRevision || prior?.revision || story.localDraft?.baseRevision;
        story.localDraft = { ...(story.localDraft || {}), ...(prior?.draft || {}), ...changes, baseRevision,
          version: versions.get(story.id) || 0, stale: !baseRevision || baseRevision !== story.revision };
      }
    }
    state.loading = false; state.error = null; render();
    return workspace;
  } catch (error) {
    state.loading = false;
    if (!quiet || !state.workspace) { state.error = error.message; render(); }
    else toast(error.message, { error: true });
    throw error;
  }
}

function showSaveStatus(message, isError = false) {
  for (const label of document.querySelectorAll('[data-save-status]')) { label.textContent = message; label.classList.toggle('error-text', isError); }
}

function editDraft(id, changes, { rerender = false, immediate = false } = {}) {
  const story = storyById(id);
  if (!story || story.localDraft?.stale) { toast('The source changed. Review and export the existing local proposal before editing.', { error: true }); return; }
  const existing = story.localDraft || {};
  story.localDraft = { ...existing, ...changes, baseRevision: existing.baseRevision || story.revision, version: versions.get(id) || 0, updatedAt: new Date().toISOString() };
  pending.set(id, { ...(pending.get(id) || {}), ...changes });
  for (const control of document.querySelectorAll('[data-proposal-for]')) if (control.dataset.proposalFor === id) {
    control.innerHTML = proposalContent(story, control.dataset.proposalLabel, control.dataset.proposalClass);
  }
  clearTimeout(timers.get(id));
  showSaveStatus('Saving locally…');
  if (rerender) render();
  if (immediate) flushDraft(id);
  else timers.set(id, setTimeout(() => flushDraft(id), 650));
}

function editCreativeBrief(id, transform, options = {}) {
  const story = storyById(id);
  if (!story) return;
  const brief = creativeBriefFor(story);
  transform(brief);
  editDraft(id, { creativeBrief: brief }, options);
  const summary = document.querySelector('[data-direction-review]');
  if (summary && route().id === id) summary.innerHTML = directionReviewSummary(story);
}

async function flushDraft(id) {
  clearTimeout(timers.get(id));
  if (saving.has(id)) return savePromises.get(id);
  if (!pending.has(id)) return true;
  const story = storyById(id);
  if (!story || story.localDraft?.stale) return false;
  const changes = pending.get(id);
  pending.delete(id); saving.add(id); inFlight.set(id, changes);
  let finish;
  savePromises.set(id, new Promise(resolve => { finish = resolve; }));
  showSaveStatus('Saving locally…');
  let succeeded = false;
  try {
    const result = await api(`/api/stories/${encodeURIComponent(id)}/draft`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Mildincident-Intent': 'local-edit' },
      body: JSON.stringify({ baseRevision: story.localDraft?.baseRevision || story.revision, expectedVersion: versions.get(id) || 0, ...changes }),
    });
    const draft = result.draft || result.localDraft || result.story?.localDraft || result;
    if (!Number.isInteger(draft.version)) throw new Error('The save response did not confirm a local draft version.');
    versions.set(id, draft.version);
    const current = storyById(id);
    if (current) {
      current.localDraft = { ...draft, ...(pending.get(id) || {}) };
      if (result.intelligence) current.intelligence = result.intelligence;
      if (result.musicRecommendations) current.musicRecommendations = result.musicRecommendations;
      if (result.editorialDirection) current.editorialDirection = result.editorialDirection;
      if (result.editorialAudit) { current.editorialAudit=result.editorialAudit;const notice=document.querySelector('[data-editorial-audit]');if(notice&&route().id===id)notice.innerHTML=views.editorialAuditNotice(current); }
      if (result.readiness) {current.readiness=result.readiness;const panel=document.querySelector('[data-readiness-panel]');if(panel&&route().id===id)panel.innerHTML=views.readinessPanel(current);}
      if(result.productionDecisions)current.productionDecisions=result.productionDecisions;
      if(result.productionPreparation){current.productionPreparation=result.productionPreparation;const panel=document.querySelector('[data-production-visibility]');if(panel&&route().id===id)panel.innerHTML=views.productionVisibility(current);}
      if (result.sourceSequencePlan) current.sourceSequencePlan=result.sourceSequencePlan;
      const sequenceIssues = document.querySelector('[data-direction-sequence-issues]');
      if (sequenceIssues && route().id === id) sequenceIssues.innerHTML = directionSequenceObservations(current);
      const checks = document.querySelector('[data-caption-checks]');
      if (checks && route().id === id) checks.innerHTML = views.captionChecks(current);
    }
    showSaveStatus(`Saved locally · ${date(draft.updatedAt)}`);
    announce('Local proposal saved. The n8n production record is unchanged.');
    succeeded = true;
  } catch (error) {
    pending.set(id, { ...changes, ...(pending.get(id) || {}) });
    showSaveStatus('Local save failed · changes are still in this browser', true);
    toast(`${error.message} Your production records are unchanged.`, { error: true, retryStory: id });
  } finally {
    saving.delete(id);
    inFlight.delete(id);
    finish(succeeded); savePromises.delete(id);
  }
  if (succeeded && pending.has(id)) return flushDraft(id);
  return succeeded;
}

async function flushAllDrafts() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const ids = [...new Set([...pending.keys(), ...saving])];
    if (!ids.length) return true;
    const results = await Promise.all(ids.map(flushDraft));
    if (results.some(result => result === false)) return false;
  }
  return !pending.size && !saving.size;
}

async function refreshSource() {
  if (state.workspace?.source?.refreshing) return;
  try {
    if (!await flushAllDrafts()) {
      await loadWorkspace({ quiet: true }).catch(() => {});
      toast('Source refresh paused: resolve the unsaved or stale local draft first. Download its proposal to preserve a separate copy.', { error: true });
      return;
    }
    await api('/api/refresh', { method: 'POST', headers: { 'X-Mildincident-Intent': 'local-edit' } });
    if (state.workspace?.source) state.workspace.source.refreshing = true;
    render(); announce('Refreshing read-only production snapshots.');
    let attempts = 0;
    clearTimeout(pollTimer);
    const poll = async () => {
      try {
        const workspace = await loadWorkspace({ quiet: true });
        if (workspace.source?.refreshing && ++attempts < 90) pollTimer = setTimeout(poll, 1200);
        else if (workspace.source?.refreshing) toast('Source refresh is still running. The last snapshot remains visible.', { error: true });
        else if (workspace.source?.refreshError) toast(`${workspace.source.refreshError.message || 'The source refresh failed.'} The previous source snapshot is preserved.`, { error: true });
        else toast('Read-only source refresh completed. Local proposals are preserved.');
      } catch { /* Last good snapshot remains visible. */ }
    };
    pollTimer = setTimeout(poll, 1000);
  } catch (error) { toast(error.message, { error: true }); }
}

function openDialog(html) {
  const dialog = document.querySelector('#asset-dialog');
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('button')?.focus();
}

function showRehearsal(story, index = 0, fit = 'frame') {
  if (!story) return;
  const count = mediaFor(story).length;
  if (!count) return;
  const focusAction = document.activeElement?.dataset.action;
  rehearsal = { storyId: story.id, index: Math.max(0, Math.min(count - 1, index)), fit };
  openDialog(views.carouselRehearsal(story, rehearsal.index, fit));
  const nextFocus = ['rehearse-step'].includes(focusAction) ? document.querySelector(`#asset-dialog [data-action="${focusAction}"]:not(:disabled)`) : null;
  nextFocus?.focus();
  announce(`Carousel rehearsal: slide ${rehearsal.index + 1} of ${count}.`);
}

async function openHistory(story) {
  if (!story) return;
  try {
    const result = await api(`/api/stories/${encodeURIComponent(story.id)}/draft/history`);
    if (!Array.isArray(result.versions)) throw new Error('Local version history is unavailable.');
    history.set(story.id, result.versions);
    openDialog(views.draftHistoryDialog(story, result.versions));
  } catch (error) { toast(error.message, { error: true }); }
}

async function rebaseDraft(story) {
  if (!story?.localDraft?.stale) return;
  const saved = effective(story);
  const known = new Set((story.media || []).map(asset => asset.id));
  const selected = saved.selectedAssetIds;
  const retained = selected.filter(id => known.has(id));
  const removed = selected.length - retained.length;
  const reviewedBrief = saved.creativeBrief ? structuredClone(saved.creativeBrief) : null;
  const removedRoles = (reviewedBrief?.sequenceRoles || []).filter(item => !known.has(item.assetId)).length;
  const message = removed || removedRoles ? `Keep the local edits as a new revision and remove ${removed} unavailable image reference${removed === 1 ? '' : 's'} and ${removedRoles} unavailable narrative-role annotation${removedRoles === 1 ? '' : 's'}? The earlier version stays in local history. n8n will not change.` : 'Keep these local edits after comparing them with the current source? This creates a new local revision and does not change n8n.';
  if (!window.confirm(message)) return;
  if (reviewedBrief && removedRoles) reviewedBrief.sequenceRoles = reviewedBrief.sequenceRoles.filter(item => known.has(item.assetId));
  try {
    if (!(versions.get(story.id) || 0)) {
      story.localDraft = { ...story.localDraft, baseRevision: story.revision, stale: false };
      pending.set(story.id, { title:saved.title, hook:saved.hook, format:saved.format, targetSlideCount:saved.targetSlideCount, caption: saved.caption, notes: saved.notes, selectedAssetIds: retained, musicSelection: saved.musicSelection ?? null,
        ...(reviewedBrief ? { creativeBrief: reviewedBrief } : {}) });
      if (!await flushDraft(story.id)) return;
      document.querySelector('#asset-dialog').close(); render();
      toast('Previously unsaved local edits were saved against the explicitly reviewed source revision.');
      return;
    }
    const result = await api(`/api/stories/${encodeURIComponent(story.id)}/draft/rebase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mildincident-Intent': 'local-edit' },
      body: JSON.stringify({ expectedVersion: versions.get(story.id) || story.localDraft.version, previousRevision: story.localDraft.baseRevision, currentRevision: story.revision, confirm: 'keep_local_after_review', ...(removed ? { selectedAssetIds: retained } : {}), ...(removedRoles ? { creativeBrief: reviewedBrief } : {}) }),
    });
    const draft = result.draft || result;
    if (!Number.isInteger(draft.version)) throw new Error('The source review did not return a new local version.');
    versions.set(story.id, draft.version);
    story.localDraft = { ...draft, ...(pending.get(story.id) || {}) };
    if (result.intelligence) story.intelligence = result.intelligence;
    if (result.musicRecommendations) story.musicRecommendations = result.musicRecommendations;
    if (result.editorialDirection) story.editorialDirection = result.editorialDirection;
    if (removed) {
      story.localDraft.selectedAssetIds = retained;
      if (pending.get(story.id)?.selectedAssetIds) pending.get(story.id).selectedAssetIds = retained;
    }
    if (removedRoles) {
      story.localDraft.creativeBrief = reviewedBrief;
      if (pending.get(story.id)?.creativeBrief) pending.get(story.id).creativeBrief = reviewedBrief;
    }
    document.querySelector('#asset-dialog').close();
    render();
    if (pending.has(story.id)) flushDraft(story.id);
    toast('Local edits retained against the reviewed source revision. Earlier versions remain in history.');
  } catch (error) { toast(error.message, { error: true }); }
}

async function checkNativePacket(story){
 if(!story)return;
 if((pending.has(story.id)||saving.has(story.id))&&!story.localDraft?.stale)await flushDraft(story.id);
 if(pending.has(story.id)||saving.has(story.id)){toast('Save pending edits before checking the native packet.',{error:true});return;}
 try{const packet=await api(`/api/stories/${encodeURIComponent(story.id)}/production-packet`);const result=await api(`/api/stories/${encodeURIComponent(story.id)}/production-packet/check`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({packet})});const output=route().id===story.id?document.querySelector('[data-native-import-result]'):null;if(output)output.textContent=result.accepted?'Eligible for disposable development proof only. Production import remains disabled.':'Native import blocked: '+result.issues.map(i=>i.message).join(' ');}catch(error){toast(error.message,{error:true});}
}

async function downloadProductionPacket(story){
 if(!story)return;
 if((pending.has(story.id)||saving.has(story.id))&&!story.localDraft?.stale)await flushDraft(story.id);
 if(pending.has(story.id)||saving.has(story.id)){toast('Save or export your pending edits before preparing the production review packet.',{error:true});return;}
 try{const packet=await api(`/api/stories/${encodeURIComponent(story.id)}/production-packet`);const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`${story.id}-production-review.json`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Validated review packet downloaded with its import blockers. Production import remains disabled.');}catch(error){toast(error.message,{error:true});}
}

async function downloadProposal(story) {
  if (!story) return;
  let proposal;
  if ((pending.has(story.id) || saving.has(story.id)) && !story.localDraft?.stale) await flushDraft(story.id);
  if (pending.has(story.id) || saving.has(story.id) || (story.localDraft?.stale && !(versions.get(story.id) || 0))) {
    proposal = { schemaVersion: 1, kind: 'unsaved_local_editorial_proposal', storyId: story.id, title: story.title,
      baseRevision: story.localDraft?.baseRevision, currentSourceRevision: story.revision, localDraft: effective(story),
      productionApplied: false, savedToLocalServer: false, exportedAt: new Date().toISOString() };
  } else {
    try { proposal = await api(`/api/stories/${encodeURIComponent(story.id)}/proposal`); }
    catch (error) { toast(error.message, { error: true }); return; }
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(proposal, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `mildincident-${story.id.replace(/[^A-Za-z0-9_-]/g, '_')}-local-proposal.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Local proposal downloaded. No n8n data was changed.');
}

document.addEventListener('click', event => {
  if (event.target.closest('.skip-link')) { event.preventDefault(); document.querySelector('#main-content')?.focus(); return; }
  const proposalLink = event.target.closest('a[href]');
  if (proposalLink) {
    const url = new URL(proposalLink.href, location.origin);
    const packetMatch=url.origin===location.origin&&url.pathname.match(/^\/api\/stories\/([^/]+)\/production-packet$/);
    if(packetMatch){event.preventDefault();downloadProductionPacket(storyById(decodeURIComponent(packetMatch[1])));return;}
    const match = url.origin === location.origin && url.pathname.match(/^\/api\/stories\/([^/]+)\/proposal$/);
    if (match) { event.preventDefault(); downloadProposal(storyById(decodeURIComponent(match[1]))); return; }
  }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if(action==='check-native-packet'){checkNativePacket(storyById(button.dataset.story));return;}
  const story = storyById(button.dataset.story);
  switch (action) {
    case 'retry-preview': {
      const photo = button.closest('.photo'); const img = photo.querySelector('img');
      photo.classList.remove('preview-failed'); button.hidden = true;
      photo.querySelector('.preview-status').textContent = 'Retrying preview…';
      const src = img.getAttribute('src'); img.removeAttribute('src'); img.setAttribute('src', src); break;
    }
    case 'apply-source-sequence': {
      const option=story?.sourceSequencePlan?.options[Number(button.dataset.index)];
      if(!option||story.localDraft?.stale)break;
      const brief=creativeBriefFor(story);
      const roles=new Map(brief.sequenceRoles.map(role=>[role.assetId,role]));
      for(const slide of option.slides)if(!roles.has(slide.assetId))roles.set(slide.assetId,{assetId:slide.assetId,role:slide.role,note:slide.note});
      brief.sequenceRoles=[...roles.values()];
      editDraft(story.id,{format:option.format,targetSlideCount:option.targetSlideCount,selectedAssetIds:option.slides.map(slide=>slide.assetId),creativeBrief:brief},{rerender:true,immediate:true});
      break;
    }
    case 'rehearse-story': showRehearsal(story); break;
    case 'rehearse-step': if (rehearsal) showRehearsal(storyById(rehearsal.storyId), rehearsal.index + Number(button.dataset.step), rehearsal.fit); break;
    case 'prepare-discovery':
      button.disabled = true;
      createResearchRequest({kind:'discovery',prompt:'Discover fresh photographic cultural proposals under the actual n8n editorial preset. Explore independent photographers, contemporary editorial publications, fashion, music, nightlife, youth culture and original photographic series across current and historical contexts. Compare distinct source-supported leads. Do not recycle prior demonstration subjects or default to institutional archives; use archives selectively. Preserve source provenance, uncertainty and specific cultural payoff.',sourceUrl:''}).catch(error=>toast(error.message,{error:true})).finally(()=>{button.disabled=false;}); break;
    case 'reload': loadWorkspace().catch(() => {}); break;
    case 'refresh': refreshSource(); break;
    case 'close-toast': document.querySelector('#toast').hidden = true; break;
    case 'pipeline-filter': state.pipelineGroup = button.dataset.value; render(); break;
    case 'retry-save': flushDraft(button.dataset.story); break;
    case 'draft-history': openHistory(story); break;
    case 'review-stale': if (story) openDialog(views.staleDraftDialog(story)); break;
    case 'rebase-draft': rebaseDraft(story); break;
    case 'restore-local-version': {
      const draft = history.get(story?.id)?.[Number(button.dataset.index)];
      if (!story || !draft || story.localDraft?.stale) break;
      const known = new Set((story.media || []).map(asset => asset.id));
      const retained = (draft.selectedAssetIds || []).filter(id => known.has(id));
      const removed = (draft.selectedAssetIds || []).length - retained.length;
      const brief = structuredClone(draft.creativeBrief || emptyCreativeBrief());
      const removedRoles = (brief.sequenceRoles || []).filter(item => !known.has(item.assetId)).length;
      if (!window.confirm(`Use local version ${draft.version} as a new local draft?${removed ? ` ${removed} unavailable image reference${removed === 1 ? '' : 's'} will be removed from the new version.` : ''}${removedRoles ? ` ${removedRoles} unavailable narrative-role annotation${removedRoles === 1 ? '' : 's'} will also be removed.` : ''} Existing versions and n8n data are preserved.`)) break;
      if (removedRoles) brief.sequenceRoles = brief.sequenceRoles.filter(item => known.has(item.assetId));
      document.querySelector('#asset-dialog').close();
      editDraft(story.id, { title:draft.title ?? story.title, hook:draft.hook ?? story.hook, format:draft.format ?? story.format, targetSlideCount:draft.targetSlideCount ?? story.targetSlideCount, caption: draft.caption ?? story.caption ?? '', selectedAssetIds: draft.selectedAssetIds === undefined ? [...(story.selectedAssetIds || [])] : retained, notes: draft.notes || '', musicSelection: Object.hasOwn(draft, 'musicSelection') ? draft.musicSelection : story.musicSelection ?? null,
        creativeBrief: brief }, { rerender: true, immediate: true });
      break;
    }
    case 'close-dialog': document.querySelector('#asset-dialog').close(); break;
    case 'inspect': {
      const asset = story?.media?.find(item => item.id === button.dataset.asset);
      if (asset) openDialog(views.assetDialog(story, asset));
      break;
    }
    case 'compare-asset': {
      const existing = state.compared.findIndex(item => item.storyId === button.dataset.story && item.assetId === button.dataset.asset);
      if (existing >= 0) state.compared.splice(existing, 1);
      else if (state.compared.length >= 3) { toast('Compare up to three photographs at a time. Clear one to add another.'); return; }
      else state.compared.push({ storyId: button.dataset.story, assetId: button.dataset.asset });
      render(); announce(`${state.compared.length} photographs marked for comparison.`); break;
    }
    case 'clear-comparison': state.compared = []; render(); break;
    case 'open-comparison': if (state.compared.length >= 2) openDialog(views.compareDialog(state)); break;
    case 'toggle-asset': {
      if (!story) break;
      const selected = [...effective(story).selectedAssetIds];
      const index = selected.indexOf(button.dataset.asset);
      if (index >= 0) selected.splice(index, 1);
      else if (selected.length >= 10) { toast('The local preparation limit is ten slides. Remove an image before adding another.', { error: true }); break; }
      else selected.push(button.dataset.asset);
      editDraft(story.id, { selectedAssetIds: selected }, { rerender: true, immediate: true });
      announce(index >= 0 ? 'Image removed from local sequence.' : 'Image added to local sequence. Rights are unchanged.');
      break;
    }
    case 'move-slide': {
      if (!story) break;
      const selected = [...effective(story).selectedAssetIds];
      const index = Number(button.dataset.index), destination = index + Number(button.dataset.direction);
      if (index < 0 || destination < 0 || destination >= selected.length) break;
      [selected[index], selected[destination]] = [selected[destination], selected[index]];
      editDraft(story.id, { selectedAssetIds: selected }, { rerender: true, immediate: true });
      announce(`Slide ${index + 1} moved to position ${destination + 1}.`); break;
    }
    case 'clear-track': editDraft(story.id,{musicSelection:null},{rerender:true,immediate:true});flushDraft(story.id).then(saved=>{if(saved&&route().id===story.id&&route().tab==='music')render();});break;
    case 'choose-track': {
      const track = (story?.musicRecommendations || story?.intelligence?.musicRecommendations || [])[Number(button.dataset.index)];
      if (track) editDraft(story.id, { musicSelection: { track: track.track || track.title, artist: track.artist } }, { rerender: true, immediate: true });
      break;
    }
    case 'notes-template': {
      if (!story) break;
      const checklist = 'EDITORIAL REVIEW\n• Original source and the exact passage\n• Facts to verify / interpretation to label\n• Selected image, creator and provenance\n• Per-image permission evidence and credit\n• Opening photograph and narrative sequence\n• Caption edit and sound direction\n• Existing Buffer handoff to reconcile';
      const notes = [effective(story).notes.trim(), checklist].filter(Boolean).join('\n\n');
      editDraft(story.id, { notes }, { rerender: true, immediate: true }); break;
    }
  }
});

document.addEventListener('input', event => {
  const input = event.target;
  if (input.closest('[data-research-form]')) { state.briefRequestKey = null; state.researchDraft = { ...(state.researchDraft || {}), [input.name]: input.value }; }
  if (input.dataset.briefField && input.matches('textarea,input[type="text"]')) {
    editCreativeBrief(input.dataset.story, brief => { brief[input.dataset.briefField] = input.value; });
  }
  if (input.dataset.briefRoleNote) {
    editCreativeBrief(input.dataset.story, brief => {
      const annotation = brief.sequenceRoles.find(item => item.assetId === input.dataset.briefRoleNote);
      if (annotation) annotation.note = input.value;
    });
  }
  if (input.id === 'global-search') {
    state.search = input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (!['pipeline', 'publishing', 'archive'].includes(route().view)) location.hash = '#/pipeline'; else render(); }, 150);
  }
  if (input.id === 'library-search') { state.librarySearch = input.value; clearTimeout(searchTimer); searchTimer = setTimeout(render, 150); }
  const soundForm=input.closest('[data-form="music-intent"]');
  if(soundForm){state.musicIntentDrafts??={};state.musicIntentDrafts[soundForm.dataset.story]=readMusicIntentForm(soundForm);}
  const setup=input.closest('[data-form="editorial-setup"]');
  if(setup){state.editorialSetupDrafts??={};state.editorialSetupDrafts[setup.dataset.story]={title:setup.elements.title.value,hook:setup.elements.hook.value,format:setup.elements.format.value,targetSlideCount:Number(setup.elements.targetSlideCount.value)};}
  if (input.dataset.draftField) {
    editDraft(input.dataset.story, { [input.dataset.draftField]: input.value });
    if (input.dataset.draftField === 'caption') {
      const characters = [...input.value].length;
      const counter = document.querySelector('[data-caption-count]');
      if (counter) { counter.textContent = `${characters} / 2,200 characters`; counter.classList.toggle('error-text', characters > 2200); }
      const warning = document.querySelector('[data-caption-warning]');
      if (warning) warning.hidden = characters <= 2200 && !/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(input.value);
    }
  }
});

document.addEventListener('change', event => {
  if (event.target.matches('[data-rehearsal-fit]') && rehearsal) {
    showRehearsal(storyById(rehearsal.storyId), rehearsal.index, event.target.value);
    document.querySelector('[data-rehearsal-fit]')?.focus(); return;
  }
  const input = event.target;
  if (input.matches('[data-format-control]')) {
    const target = input.form.elements.targetSlideCount;
    target.readOnly = input.value === 'single_image';
    target.min = input.value === 'carousel' ? '2' : '1';
    if (input.value === 'single_image') target.value = '1';
    else if (Number(target.value) < Number(target.min)) target.value = target.min;
    state.editorialSetupDrafts??={};state.editorialSetupDrafts[input.form.dataset.story]={title:input.form.elements.title.value,hook:input.form.elements.hook.value,format:input.value,targetSlideCount:Number(target.value)};
  }
  const soundForm=input.closest('[data-form="music-intent"]');
  if(soundForm){state.musicIntentDrafts??={};state.musicIntentDrafts[soundForm.dataset.story]=readMusicIntentForm(soundForm);}
  if (input.id === 'image-editorial-filter') { state.imageEditorialFilter = input.value; render(); }
  if (input.id === 'library-rights') { state.libraryRights = input.value; render(); }
  if (input.dataset.briefField && !input.matches('textarea,input[type="text"]')) {
    editCreativeBrief(input.dataset.story, brief => { brief[input.dataset.briefField] = input.value; }, { immediate: true });
    if (input.type === 'radio') for (const option of document.querySelectorAll('.direction-hook')) option.classList.toggle('chosen', Boolean(option.querySelector('input:checked')));
  }
  if (input.dataset.briefRating) {
    editCreativeBrief(input.dataset.story, brief => { brief.ratings[input.dataset.briefRating] = input.value === '' ? null : Number(input.value); }, { immediate: true });
  }
  if (input.dataset.briefLane) {
    editCreativeBrief(input.dataset.story, brief => {
      const lanes = new Set(brief.sourceLaneIds || []);
      if (input.checked) lanes.add(input.dataset.briefLane); else lanes.delete(input.dataset.briefLane);
      brief.sourceLaneIds = [...lanes];
    }, { immediate: true });
  }
  if (input.dataset.briefRole) {
    const story = storyById(input.dataset.story);
    const previous = creativeBriefFor(story).sequenceRoles.find(item => item.assetId === input.dataset.briefRole);
    if (!input.value && previous?.note && !window.confirm('Clear this local narrative role and its note? The prior saved version remains in local history.')) {
      input.value = previous.role; return;
    }
    editCreativeBrief(input.dataset.story, brief => {
      const earlier = brief.sequenceRoles.find(item => item.assetId === input.dataset.briefRole);
      brief.sequenceRoles = brief.sequenceRoles.filter(item => item.assetId !== input.dataset.briefRole);
      if (input.value) brief.sequenceRoles.push({ assetId: input.dataset.briefRole, role: input.value, ...(earlier?.note ? { note: earlier.note } : {}) });
    }, { rerender: true, immediate: true });
  }
});

function readMusicIntentForm(form){
  const split=value=>value.split(',').map(tag=>tag.trim()).filter(Boolean);
  return {mode:form.elements.mode.value,eraApproach:form.elements.eraApproach.value,moods:split(form.elements.moods.value),avoidTags:split(form.elements.avoidTags.value),notes:form.elements.notes.value};
}
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form="music-intent"]');if(!form)return;event.preventDefault();
 const story=storyById(form.dataset.story);if(!story)return;const intent=readMusicIntentForm(form);
 if(state.musicIntentDrafts)delete state.musicIntentDrafts[story.id];
 editCreativeBrief(story.id,brief=>{brief.musicIntent=intent;},{immediate:true});
 if(await flushDraft(story.id)&&route().id===story.id&&route().tab==='music')render();
});
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form="editorial-setup"]');
  if (!form) return;
  event.preventDefault();
  const changes={title:form.elements.title.value.trim(),hook:form.elements.hook.value,format:form.elements.format.value,targetSlideCount:Number(form.elements.targetSlideCount.value)};
  if(state.editorialSetupDrafts)delete state.editorialSetupDrafts[form.dataset.story];
  editDraft(form.dataset.story, changes, {rerender:true,immediate:true});
});
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form="music"]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  editDraft(form.dataset.story, { musicSelection: { track: String(data.get('track') || '').trim(), artist: String(data.get('artist') || '').trim() } }, { immediate: true, rerender: true });
});

document.addEventListener('dragstart', event => {
  const slide = event.target.closest('[data-slide-index]');
  if (!slide || slide.draggable !== true) return;
  drag = { storyId: slide.dataset.story, index: Number(slide.dataset.slideIndex) };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(drag.index));
  slide.classList.add('dragging');
});
document.addEventListener('dragover', event => {
  if (drag && event.target.closest('[data-slide-index]')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
});
document.addEventListener('drop', event => {
  const slide = event.target.closest('[data-slide-index]');
  if (!drag || !slide || drag.storyId !== slide.dataset.story) return;
  event.preventDefault();
  const story = storyById(drag.storyId);
  const sequence = [...effective(story).selectedAssetIds];
  const [moved] = sequence.splice(drag.index, 1);
  sequence.splice(Number(slide.dataset.slideIndex), 0, moved);
  editDraft(story.id, { selectedAssetIds: sequence }, { rerender: true, immediate: true });
  announce('Local carousel order updated.'); drag = null;
});
document.addEventListener('dragend', () => { drag = null; for (const slide of document.querySelectorAll('.dragging')) slide.classList.remove('dragging'); });

document.addEventListener('load', event => {
  const photo = event.target.tagName === 'IMG' && event.target.closest('.photo');
  if (!photo) return;
  photo.classList.remove('preview-failed');
  photo.querySelector('.preview-status')?.replaceChildren();
  const retry = photo.querySelector('.preview-retry'); if (retry) retry.hidden = true;
}, true);
document.addEventListener('error', event => {
  const photo = event.target.tagName === 'IMG' && event.target.closest('.photo');
  if (!photo) return;
  photo.classList.add('preview-failed');
  const status = photo.querySelector('.preview-status');
  if (status) status.textContent = 'This browser could not load the preview. Open the source record or attach a private file.';
  const retry = photo.querySelector('.preview-retry'); if (retry) retry.hidden = false;
}, true);

async function createResearchRequest(input) {
  const keyField = input.kind==='brief' ? 'briefRequestKey' : 'discoveryRequestKey';
  state[keyField] ||= crypto.randomUUID();
  const result = await api('/api/research/requests', {method:'POST', headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({...input,idempotencyKey:state[keyField]})});
  state[keyField] = null;
  if (input.kind==='brief') state.researchDraft = {};
  if(route().view==='home')location.hash='#/discovery';
  if (!state.workspace.researchRequests.some(r=>r.id===result.request.id)) state.workspace.researchRequests.unshift(result.request);
  render();
  await loadWorkspace({quiet:true}).catch(()=>{});
  toast(state.workspace.engine?.readOnly?'Saved locally for discovery review. A new generation needs separate cost approval.':state.workspace.engine?.configured?'Saved locally. Queue this request in the development engine below. Queueing does not start a paid generation.':'Saved locally. Open the n8n form and submit there to start research.');
  document.querySelector(`[data-request-id="${result.request.id}"]`)?.scrollIntoView({block:'center'});
}
document.addEventListener('click', async event=>{
  const button=event.target.closest('[data-engine-action]');if(!button||button.disabled)return;
  button.disabled=true;
  try{
    const action=button.dataset.engineAction;
    await api(action==='refresh'?'/api/research/engine/refresh':`/api/research/requests/${button.dataset.request}/engine/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(action==='start'?{expectedVersion:Number(button.dataset.version)}:{})});
    await loadWorkspace({quiet:true});toast(action==='queue'?'Queued in isolated n8n development storage. No AI run was started.':action==='evidence'?'Captured execution evidence inspected without a new provider call.':action==='start'?'Bounded generation dispatched once. Refresh results to reconcile its status.':'Development engine results refreshed.');
  }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-engine-review]');if(!form)return;event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{await api(`/api/research/requests/${form.dataset.request}/engine/review`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({candidateId:form.dataset.candidate,expectedVersion:Number(form.dataset.version),decision:form.elements.decision.value,reason:form.elements.reason.value,...(form.elements.basis?{basis:form.elements.basis.value}:{})})});await loadWorkspace({quiet:true});toast('Development editorial decision saved. Production and rights remain unchanged.');}catch(error){form.querySelector('[data-engine-status]').textContent=error.message;}finally{button.disabled=false;}
});

document.addEventListener('click', event => {
  const link=event.target.closest('[data-research-handoff]'); if(!link)return;
  api(`/api/research/requests/${link.dataset.researchHandoff}/events`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({event:'handoff_requested',expectedVersion:Number(link.dataset.version)})})
    .then(()=>loadWorkspace({quiet:true})).catch(error=>toast(error.message,{error:true}));
});
document.addEventListener('submit', async event => {
  const form=event.target.closest('[data-research-form],[data-research-link]');if(!form)return;
  event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
  const status=form.querySelector('[data-research-status]');status.textContent='Saving locally…';
  try {
    if(form.matches('[data-research-form]')) await createResearchRequest({kind:'brief',prompt:form.elements.prompt.value,sourceUrl:form.elements.sourceUrl.value});
    else {
      await api(`/api/research/requests/${form.dataset.request}/events`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({event:'story_linked',storyId:form.elements.storyId.value,expectedVersion:Number(form.dataset.version)})});
      await loadWorkspace({quiet:true});toast('Existing source story linked locally. Production records are unchanged.');
    }
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-image-review]'); if (!form) return;
  event.preventDefault(); const button = form.querySelector('button[type="submit"]'); const status = form.querySelector('[data-review-status]');
  button.disabled=true; status.textContent='Saving your editorial judgment…';
  try {
    await api(`/api/stories/${encodeURIComponent(form.dataset.story)}/assets/${encodeURIComponent(form.dataset.asset)}/review`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({expectedVersion:Number(form.dataset.version),decision:form.elements.decision.value,reason:form.elements.reason.value,...(form.elements.basis?{basis:form.elements.basis.value}:{})})});
    await loadWorkspace({quiet:true});const story=storyById(form.dataset.story);const asset=story?.media.find(a=>a.id===form.dataset.asset);
    if(form.isConnected&&asset)openDialog(views.assetDialog(story,asset));
    toast('Editorial review saved locally. Image rights and carousel selection are unchanged.');
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-preview-upload]'); if (!form) return;
  event.preventDefault();
  const status = form.querySelector('[data-upload-status]'); const button = form.querySelector('button[type="submit"]');
  const file = form.elements.preview.files[0];
  if (!file || !form.elements.declaration.checked) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 25 * 1024 * 1024) {
    status.textContent = 'Choose a still JPG, PNG or WebP of at most 25 MiB.'; return;
  }
  button.disabled = true; status.textContent = 'Decoding and saving privately…';
  try {
    await api(`/api/stories/${encodeURIComponent(form.dataset.story)}/assets/${encodeURIComponent(form.dataset.asset)}/preview`, {
      method: 'POST', headers: { 'Content-Type': file.type, 'X-Mildincident-Intent': 'local-edit',
        'X-Mildincident-Preview-Declaration': 'private_review_only', 'X-Mildincident-Filename': encodeURIComponent(file.name) }, body: file });
    await loadWorkspace({ quiet: true });
    const story = storyById(form.dataset.story); const asset = story?.media.find(a => a.id === form.dataset.asset);
    if (form.isConnected && asset) openDialog(views.assetDialog(story, asset));
    toast('Private preview saved. Source identity and publication rights remain unverified.');
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

document.addEventListener('keydown', event => {
  const input = event.target.closest('input,textarea,select,[contenteditable="true"]');
  if (!input && document.querySelector('#asset-dialog[open] [data-rehearsal]') && rehearsal && !event.metaKey && !event.ctrlKey && !event.altKey && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();
    const story = storyById(rehearsal.storyId);
    const index = event.key==='Home'?0:event.key==='End'?mediaFor(story).length-1:rehearsal.index+(event.key==='ArrowRight'?1:-1);
    showRehearsal(story,index,rehearsal.fit); return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && route().view === 'story') {
    event.preventDefault(); flushDraft(route().id); return;
  }
  if (input || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('#asset-dialog').open) return;
  if (event.key === '/') { event.preventDefault(); document.querySelector('#global-search')?.focus(); return; }
  if (keyboardPrefix) {
    keyboardPrefix = false;
    const target = { h: 'home', p: 'pipeline', l: 'library', b: 'publishing', a: 'archive' }[event.key.toLowerCase()];
    if (target) { event.preventDefault(); location.hash = `#/${target}`; }
  } else if (event.key.toLowerCase() === 'g') { keyboardPrefix = true; setTimeout(() => { keyboardPrefix = false; }, 1000); }
});

document.querySelector('#asset-dialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); }
});
window.addEventListener('hashchange', () => { document.querySelector('#asset-dialog').close(); render({ focusMain: true }); window.scrollTo({ top: 0, behavior: 'instant' }); });
window.addEventListener('beforeunload', event => { if (pending.size || saving.size || Object.keys(state.editorialSetupDrafts||{}).length || Object.keys(state.musicIntentDrafts||{}).length || state.researchDraft?.prompt?.trim()) { event.preventDefault(); event.returnValue = ''; } });

render();
loadWorkspace().catch(() => {});

// Private photographic research, independent of paid generation and publication.
document.addEventListener('submit',async event=>{const form=event.target.closest('[data-photo-hunt],[data-photo-decision]');if(!form)return;event.preventDefault();const button=form.querySelector('button');button.disabled=true;const fields=Object.fromEntries(new FormData(form));try{if(form.matches('[data-photo-hunt]')){const result=await api('/api/photography/hunts',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({...fields,parent:fields.parent||null,idempotencyKey:state.photoRequestKey||=crypto.randomUUID()})});state.photoRequestKey=null;state.activePhotoHunt=result.hunt.id;state.photoOffset=0;await api('/api/photography/hunts/'+result.hunt.id,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({pages:1})});}else await api('/api/photography/decisions/'+encodeURIComponent(form.dataset.photoDecision),{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(fields)});state.workspace=await api('/api/workspace');await hydrateActivePhoto();render();}catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}});
document.addEventListener('input',event=>{if(event.target.closest('[data-photo-hunt]'))state.photoRequestKey=null;});
document.addEventListener('change',async event=>{if(event.target.matches('[data-photo-trail]')){state.activePhotoHunt=event.target.value;state.photoOffset=0;try{await hydrateActivePhoto();render();}catch(error){toast(error.message,{error:true});}}});
document.addEventListener('click',async event=>{const expand=event.target.closest('[data-photo-expand]');if(expand){state.photoParent=expand.dataset.parent;state.photoRequestKey=null;const form=document.querySelector('[data-photo-hunt]');form.elements.query.value=expand.dataset.photoExpand;form.elements.mode.value=expand.dataset.mode;form.elements.parent.value=state.photoParent;form.scrollIntoView({behavior:'smooth'});return;}const resume=event.target.closest('[data-photo-resume]');if(resume){resume.disabled=true;try{await api('/api/photography/hunts/'+resume.dataset.photoResume,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({pages:1})});state.workspace=await api('/api/workspace');await hydrateActivePhoto();render();}catch(error){toast(error.message,{error:true});}finally{resume.disabled=false;}}});

document.addEventListener('click',event=>{const button=event.target.closest('[data-photo-brief]');if(!button)return;const form=document.querySelector('[data-research-form]');const hunt=state.workspace.photoHunts.find(h=>h.id===state.activePhotoHunt)||state.workspace.photoHunts[0];const photo=hunt?.photos.find(p=>p.id===button.dataset.photoId);if(form&&photo){state.researchDraft=photographicBrief(photo);form.elements.prompt.value=state.researchDraft.prompt;form.elements.sourceUrl.value=state.researchDraft.sourceUrl;state.briefRequestKey=null;form.scrollIntoView({behavior:'smooth'});toast('Source-bound creative brief prepared for your editing. No AI call was made.');}});

document.addEventListener('change',event=>{if(event.target.matches('[data-photo-blind]')){state.photoBlind=event.target.checked;event.target.closest('.photo-research').dataset.blind=String(event.target.checked);}});

async function hydrateActivePhoto(){if(!state.activePhotoHunt||!state.workspace)return;const result=await api('/api/photography/hunts/'+state.activePhotoHunt+'?offset='+(state.photoOffset||0));if(!result.hunt)return;const index=state.workspace.photoHunts.findIndex(h=>h.id===result.hunt.id);if(index>=0)state.workspace.photoHunts[index]=result.hunt;else state.workspace.photoHunts.unshift(result.hunt);}
document.addEventListener('click',async event=>{const button=event.target.closest('[data-photo-page]');if(!button)return;state.activePhotoHunt=button.dataset.photoPage;state.photoOffset=Number(button.dataset.offset);try{await hydrateActivePhoto();render();}catch(error){toast(error.message,{error:true});}});

document.addEventListener('input',event=>{const form=event.target.closest('[data-photo-reference]');if(form){state.photoRefRequestKey=null;state.photoReferenceDraft=Object.fromEntries(new FormData(form));}});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-photo-reference]');if(!form)return;event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{const fields=Object.fromEntries(new FormData(form));if(!fields.huntId)delete fields.huntId;
  const result=await api('/api/photography/references',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({...fields,idempotencyKey:state.photoRefRequestKey||=crypto.randomUUID()})});
  state.photoRefRequestKey=null;state.photoReferenceDraft=null;state.activePhotoHunt=result.hunt.id;state.photoOffset=Math.floor((result.hunt.totalPhotos-1)/100)*100;
  await loadWorkspace({quiet:true});toast('Source reference saved privately. Credits, image identity and rights remain unverified.');
 }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});
document.addEventListener('click',event=>{
 const mark=event.target.closest('[data-photo-compare]'),inspect=event.target.closest('[data-photo-inspect]');
 if(mark||inspect){const id=mark?.dataset.photoCompare||inspect.dataset.photoInspect;const hunt=state.workspace.photoHunts.find(h=>h.id===state.activePhotoHunt)||state.workspace.photoHunts[0];const photo=hunt?.photos.find(p=>p.id===id);if(!photo)return;
  if(inspect){openDialog(photoComparison([photo]));return;}
  state.photoCompared||=[];const index=state.photoCompared.findIndex(p=>p.id===id);if(index<0)state.photoCompared.push(photo);else state.photoCompared.splice(index,1);render();return;
 }
 if(event.target.closest('[data-photo-open-comparison]')&&(state.photoCompared||[]).length>=2)openDialog(photoComparison(state.photoCompared));
});

// Explicit file handoff to inactive n8n development research; never an execution or production save.
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-photo-native],[data-photo-native-import]');if(!form)return;event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{if(form.matches('[data-photo-native]')){
  const fields=Object.fromEntries(new FormData(form));const result=await api('/api/photography/hunts/'+fields.huntId+'/n8n-packet',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({source:fields.source,photoIds:(state.photoCompared||[]).map(p=>p.id)})});
  const blob=new Blob([JSON.stringify(result.packet,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mildincident-private-research-'+result.packet.digest.slice(0,12)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Private research packet downloaded. No n8n execution was started.');
 }else{
  const file=form.elements.receipt.files[0];if(!file||file.size>512*1024)throw new Error('Choose a returned research JSON file under 512 KiB.');const receipt=JSON.parse(await file.text());const result=await api('/api/photography/n8n-results',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(receipt)});
  state.activePhotoHunt=result.hunt.id;state.photoOffset=0;await loadWorkspace({quiet:true});toast('Research result imported into a new private branch. Remote execution and image identity remain unverified.');
 }}catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});

// Founder review is private editorial preference, never a production approval.
document.addEventListener('click',event=>{const button=event.target.closest('[data-review-filter]');if(button){state.reviewFilter=button.dataset.reviewFilter;render();}});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-founder-review]');if(!form)return;event.preventDefault();const decision=event.submitter?.value;if(!decision)return;for(const b of form.querySelectorAll('button'))b.disabled=true;
 try{const fields=new FormData(form);const result=await api('/api/editorial/reviews/'+encodeURIComponent(form.dataset.founderReview),{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({decision,basis:fields.get('basis'),reason:fields.get('reason')||'',dimensions:fields.getAll('dimension'),expectedVersion:Number(form.dataset.version),sourceRevision:form.dataset.revision,workingVersion:Number(form.dataset.working)})});
  await loadWorkspace({quiet:true});if(decision==='develop')location.hash='#/story/'+encodeURIComponent(form.dataset.founderReview)+'/direction';toast(result.followUp?'Review and follow-up brief saved. No AI execution was started.':'Editorial decision saved privately. Publication and rights remain unchanged.');
 }catch(error){toast(error.message,{error:true});}finally{for(const b of form.querySelectorAll('button'))b.disabled=false;}
});

document.addEventListener('toggle',event=>{if(event.target.matches?.('[data-photo-desk]')){state.photoDeskOpen=event.target.open;sessionStorage.setItem('mi-photo-desk-open',String(event.target.open));}},true);

document.addEventListener('click',async event=>{const button=event.target.closest('[data-source-intake]');if(!button)return;button.disabled=true;try{const result=await api('/api/discovery/sources/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});state.workspace.sourceInputs=result.sourceInputs;render();toast('Publication intake updated. Source leads are not generated stories.');}catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}});
