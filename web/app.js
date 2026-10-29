import { esc, date, human, storyUrl, effective, proposalContent } from './components.js';
import * as views from './views.js';

const state = { workspace: null, search: '', pipelineGroup: 'all', librarySearch: '', libraryRights: 'all', compared: [], loading: true, error: null };
const pending = new Map();
const saving = new Set();
const inFlight = new Map();
const savePromises = new Map();
const history = new Map();
const timers = new Map();
const versions = new Map();
const nav = [['home', 'Editorial home', '01'], ['pipeline', 'Story pipeline', '02'], ['library', 'Image library', '03'], ['publishing', 'Publishing', '04'], ['archive', 'Published archive', '05'], ['analytics', 'Performance', '06']];
let pollTimer;
let searchTimer;
let toastTimer;
let keyboardPrefix = false;
let drag = null;

function route() {
  const [view = 'home', encodedId, tab = 'overview'] = location.hash.replace(/^#\/?/, '').split('/');
  let id = encodedId;
  try { id = encodedId && decodeURIComponent(encodedId); } catch { id = ''; }
  return { view: ['home', 'pipeline', 'library', 'publishing', 'archive', 'analytics', 'story'].includes(view) ? view : 'home', id, tab };
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
  document.querySelector('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="masthead" href="#/home" aria-label="MILDINCIDENT editorial home">MILDINCIDENT<span>Independent archival publication</span></a><div class="sidebar-label">The editorial desk</div><nav class="primary-nav" aria-label="Main navigation">${nav.map(([id, label, num]) => `<a href="#/${id}" ${active === id ? 'aria-current="page"' : ''}><span>${num}</span>${label}${id === 'pipeline' ? `<small>${count}</small>` : ''}</a>`).join('')}</nav><div class="sidebar-foot"><span class="edition-mark">M / I</span><p>Unusual histories.<br>Original perspectives.</p><div class="keyboard-hints"><kbd>/</kbd> Find a story<br><kbd>G</kbd> <kbd>H</kbd> Editorial home</div><a href="https://rickywelch.app.n8n.cloud/webhook/founder-command-center" target="_blank" rel="noopener noreferrer">Existing Founder Studio ↗</a></div></aside><div class="workspace-shell"><header class="topbar"><div class="breadcrumb"><span>MILDINCIDENT</span><span aria-hidden="true">/</span><strong>${esc(viewTitle)}</strong></div><label class="global-search"><span aria-hidden="true">⌕</span><input id="global-search" type="search" placeholder="Find a story…" value="${esc(state.search)}" aria-label="Find a story"><kbd>/</kbd></label><span class="private-label">PRIVATE WORKSPACE</span></header><div class="source-bar"><span><i class="status-dot ${source.stale ? 'stale' : ''}" aria-hidden="true"></i>${source.kind === 'live_snapshot' ? 'Connected source snapshot' : source.kind ? human(source.kind) : 'Connecting to source'}${source.observedAt ? `<small>${esc(date(source.observedAt))} ET${source.stale ? ' · refresh recommended' : ''}</small>` : ''}</span><button class="text-button" data-action="refresh" ${source.refreshing ? 'disabled' : ''}>${source.refreshing ? 'Refreshing source…' : 'Refresh source ↻'}</button></div>${warnings.length ? `<details class="source-warnings"><summary>${warnings.length} source ${warnings.length === 1 ? 'notice' : 'notices'}</summary><ul>${warnings.map(warning => `<li>${esc(typeof warning === 'string' ? warning : warning.message || warning.code)}</li>`).join('')}</ul></details>` : ''}<main id="main-content" tabindex="-1">${body}</main><footer class="workspace-footer"><span>MILDINCIDENT · Source-led editorial production</span><span>Local edits stay private · n8n remains authoritative</span></footer></div></div>${state.compared.length ? `<div class="compare-tray"><span>${state.compared.length} image${state.compared.length === 1 ? '' : 's'} marked for comparison</span><button class="button button-dark" data-action="open-comparison" ${state.compared.length < 2 ? 'disabled' : ''}>Compare images →</button><button class="text-button" data-action="clear-comparison">Clear comparison</button></div>` : ''}`;
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
    state.workspace = workspace;
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
  const known = new Set((story.media || []).map(asset => asset.id));
  const selected = effective(story).selectedAssetIds;
  const retained = selected.filter(id => known.has(id));
  const removed = selected.length - retained.length;
  const message = removed ? `Keep the local edits as a new revision and remove ${removed} unavailable image reference${removed === 1 ? '' : 's'}? The earlier version stays in local history. n8n will not change.` : 'Keep these local edits after comparing them with the current source? This creates a new local revision and does not change n8n.';
  if (!window.confirm(message)) return;
  try {
    if (!(versions.get(story.id) || 0)) {
      const saved = effective(story);
      story.localDraft = { ...story.localDraft, baseRevision: story.revision, stale: false };
      pending.set(story.id, { caption: saved.caption, notes: saved.notes, selectedAssetIds: retained, musicSelection: saved.musicSelection ?? null });
      if (!await flushDraft(story.id)) return;
      document.querySelector('#asset-dialog').close(); render();
      toast('Previously unsaved local edits were saved against the explicitly reviewed source revision.');
      return;
    }
    const result = await api(`/api/stories/${encodeURIComponent(story.id)}/draft/rebase`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mildincident-Intent': 'local-edit' },
      body: JSON.stringify({ expectedVersion: versions.get(story.id) || story.localDraft.version, previousRevision: story.localDraft.baseRevision, currentRevision: story.revision, confirm: 'keep_local_after_review', ...(removed ? { selectedAssetIds: retained } : {}) }),
    });
    const draft = result.draft || result;
    if (!Number.isInteger(draft.version)) throw new Error('The source review did not return a new local version.');
    versions.set(story.id, draft.version);
    story.localDraft = { ...draft, ...(pending.get(story.id) || {}) };
    if (result.intelligence) story.intelligence = result.intelligence;
    if (result.musicRecommendations) story.musicRecommendations = result.musicRecommendations;
    if (removed) {
      story.localDraft.selectedAssetIds = retained;
      if (pending.get(story.id)?.selectedAssetIds) pending.get(story.id).selectedAssetIds = retained;
    }
    document.querySelector('#asset-dialog').close();
    render();
    if (pending.has(story.id)) flushDraft(story.id);
    toast('Local edits retained against the reviewed source revision. Earlier versions remain in history.');
  } catch (error) { toast(error.message, { error: true }); }
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
    const match = url.origin === location.origin && url.pathname.match(/^\/api\/stories\/([^/]+)\/proposal$/);
    if (match) { event.preventDefault(); downloadProposal(storyById(decodeURIComponent(match[1]))); return; }
  }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  const story = storyById(button.dataset.story);
  switch (action) {
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
      if (!window.confirm(`Use local version ${draft.version} as a new local draft?${removed ? ` ${removed} unavailable image reference${removed === 1 ? '' : 's'} will be removed from the new version.` : ''} Existing versions and n8n data are preserved.`)) break;
      document.querySelector('#asset-dialog').close();
      editDraft(story.id, { caption: draft.caption ?? story.caption ?? '', selectedAssetIds: draft.selectedAssetIds === undefined ? [...(story.selectedAssetIds || [])] : retained, notes: draft.notes || '', musicSelection: Object.hasOwn(draft, 'musicSelection') ? draft.musicSelection : story.musicSelection ?? null }, { rerender: true, immediate: true });
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
  if (input.id === 'global-search') {
    state.search = input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (!['pipeline', 'publishing', 'archive'].includes(route().view)) location.hash = '#/pipeline'; else render(); }, 150);
  }
  if (input.id === 'library-search') { state.librarySearch = input.value; clearTimeout(searchTimer); searchTimer = setTimeout(render, 150); }
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
  if (event.target.id === 'library-rights') { state.libraryRights = event.target.value; render(); }
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

document.addEventListener('error', event => {
  if (event.target.tagName !== 'IMG' || !event.target.closest('.photo')) return;
  event.target.closest('.photo').classList.add('preview-failed');
  event.target.alt = 'Preview unavailable. Original source record is still available.';
}, true);

document.addEventListener('keydown', event => {
  const input = event.target.closest('input,textarea,select,[contenteditable="true"]');
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
window.addEventListener('beforeunload', event => { if (pending.size || saving.size) { event.preventDefault(); event.returnValue = ''; } });

render();
loadWorkspace().catch(() => {});
