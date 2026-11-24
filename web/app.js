import {finishPostDialog} from './finish-post.js';
import {postInspector} from './post-review.js';
import {postPreview} from './post-preview.js';
import {renderStudio} from './studio-render.js';
import {savedCopySelection,coverSelection} from './selection-actions.js';
import {bufferConfirmDialog,nativeReviewDialog} from './buffer-draft.js';
import {updateStoryGenerationReview,reconcileStoryProgress,updateAiUsagePanel,storyProposal} from './ai-operations.js';
import {previewFailureMessage} from './preview-state.js';
import {researchAccess} from './discovery-flow.js';
import {CAPTION_IMPROVEMENTS,captionRequestProposal,canConfirmCaption} from './caption-request-flow.js';
import {launchSavedResearch} from './research-launch.js';
import {editorialDiscoveryRequest} from './discovery-request.js';
import {photoOutcome} from './photo-requests.js';
import {visionProposal,visionPending} from './photo-vision.js';
import { esc, date, human, storyUrl, effective, mediaFor, proposalContent } from './components.js';
import * as views from './views.js';
import {navigation,resolveRoute,destination,libraryNavigation} from './navigation.js';
import { creativeBriefFor, emptyCreativeBrief, directionReviewSummary, directionSequenceObservations } from './direction.js';

function retainedComparison(){try{const value=JSON.parse(sessionStorage.getItem('mildincident-image-comparison')||'[]');return Array.isArray(value)?value.filter(c=>c&&typeof c.storyId==='string'&&c.storyId.length<=200&&typeof c.assetId==='string'&&c.assetId.length<=300).slice(0,3):[];}catch{return [];}}
function retainComparison(){try{sessionStorage.setItem('mildincident-image-comparison',JSON.stringify(state.compared));}catch{/* Keep the current in-memory comparison when browser storage is unavailable. */}}
const state = { workspace: null, search: '', pipelineGroup: 'all', librarySearch: '', libraryRights: 'all', compared: retainedComparison(), loading: true, error: null };
const pending = new Map();
const imageReviewDrafts=new Map(),imageReviewSaving=new Set();
const imageReviewKey=(story,asset)=>JSON.stringify([story,asset]);
const reviewValues=form=>({decision:form.elements.decision.value,basis:form.elements.basis?.value||'editorial_taste',reason:form.elements.reason.value});
const reviewContext=form=>Object.fromEntries(['version','revision','working','previewHash'].map(k=>[k,form.dataset[k]]));
const saving = new Set();
const saveFailures=new Set();
const inFlight = new Map();
const savePromises = new Map();
const captionRequestLocks=new Set();
const visionLocks=new Set();
const storyReads=new Map();
const history = new Map();
const timers = new Map();
const versions = new Map();
const nav = navigation;
let pollTimer;
let searchTimer;
let toastTimer;
let keyboardPrefix = false;
let drag = null;
let rehearsal = null;
let dialogReturnFocus=null,dialogReturnRoute=null;
state.lastStoryTabs={};
state.pendingRouteFocus=true;

function route() { return resolveRoute(location.hash); }

const storyById = id => state.workspace?.stories?.find(story => story.id === id);
const announce = message => { document.querySelector('#announcement').textContent = message; };

function toast(message, { error = false, retryStory, reviewFilter } = {}) {
  clearTimeout(toastTimer);
  const node = document.querySelector('#toast');
  node.hidden = false;
  node.classList.toggle('error', error);
  node.innerHTML = `<span>${esc(message)}</span>${retryStory ? `<button class="text-button" data-action="retry-save" data-story="${esc(retryStory)}">Retry save</button>` : ''}${reviewFilter?`<button class="text-button" data-action="open-review-view" data-value="${esc(reviewFilter)}">${reviewFilter==='saved'?'View saved':'View passed'}</button>`:''}<button class="toast-close" data-action="close-toast" aria-label="Dismiss notification">×</button>`;
  if (!error) toastTimer = setTimeout(() => { node.hidden = true; }, 6000);
}

async function api(url, options) {
  let response;
  try { response = await fetch(url, { cache: 'no-store', ...options }); } catch { throw Object.assign(new Error('The Studio could not be reached. Your production records are unchanged.'), { code: 'NETWORK_UNAVAILABLE' }); }
  let data;
  try { data = await response.json(); } catch { throw new Error('The workspace returned an unreadable response.'); }
  if(response.status===401&&data.error?.code==='LOGIN_REQUIRED'){if(!state.workspace)location.assign('/login');else{document.querySelector('#session-reauth')?.remove();const link=document.createElement('a');link.id='session-reauth';link.href='/login';link.target='_blank';link.rel='noopener';link.textContent='Session expired — sign in in a new tab. Pending edits remain here.';link.className='notice warning';document.querySelector('#app').prepend(link);}}
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'The operation did not complete.'), { code: data.error?.code || `HTTP_${response.status}`,delivery:data.delivery });
  return data;
}

function rememberFocus() {
  const active = document.activeElement;
  if(active?.id)return {id:active.id,start:active.selectionStart,end:active.selectionEnd};
  const keys=['action','story','asset','index','direction','photoShortlist','photoCover'];
  const attrs=keys.filter(k=>active?.dataset?.[k]!==undefined).map(k=>`[data-${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}="${CSS.escape(active.dataset[k])}"]`).join('');
  return attrs?{selector:attrs}:null;
}

function syncDialogControls(){
 const dialog=document.querySelector('#asset-dialog');if(!dialog?.open)return;
 const inspector=dialog.querySelector('[data-inspector]');if(inspector){const s=storyById(inspector.dataset.story);const status=inspector.querySelector('[data-inspector-selection]');if(s&&status)status.textContent=effective(s).selectedAssetIds.includes(inspector.dataset.asset)?'In your sequence':'Not selected';}
 for(const button of dialog.querySelectorAll('[data-action="toggle-asset"],[data-action="compare-asset"]')){
  const story=storyById(button.dataset.story);if(!story)continue;
  const selected=effective(story).selectedAssetIds.includes(button.dataset.asset),compare=button.dataset.action==='compare-asset';
  const pressed=compare?state.compared.some(c=>c.storyId===story.id&&c.assetId===button.dataset.asset):selected;
  button.setAttribute('aria-pressed',String(pressed));button.textContent=compare?(pressed?'✓ Compare':'Compare'):(selected?'Remove from sequence':'+ Add to sequence');
  if(!compare)button.disabled=Boolean(story.localDraft?.stale);
 }
 const form=dialog.querySelector('[data-image-review]');if(!form?._initialReview)return;
 if(imageReviewSaving.has(imageReviewKey(form.dataset.story,form.dataset.asset)))return;
 const story=storyById(form.dataset.story),asset=story?.media.find(a=>a.id===form.dataset.asset);if(!asset)return;
 const current={version:String(asset.localReview?.version||0),revision:story.revision,working:String(story.localDraft?.version||0),previewHash:asset.localPreview?.sha256||''};
 if(JSON.stringify(current)===JSON.stringify(form._currentContext))return;
 form._currentContext=current;
 const changed=Object.keys(current).filter(k=>form.dataset[k]!==current[k]);
 if(!changed.length)return;
 const dirty=JSON.stringify(reviewValues(form))!==JSON.stringify(form._initialReview);
 if(!dirty&&changed.every(k=>k==='working')){form.dataset.working=current.working;return;}
 const status=form.querySelector('[data-review-status]');status.textContent='The working context changed. Your note is preserved; confirm this version before saving it. ';
 const use=document.createElement('button');use.type='button';use.className='text-button';use.dataset.action='review-current-frame';use.textContent='Use note with this version';status.append(use);form.querySelector('button[type=submit]').disabled=true;rememberImageReview(form);
}

function render({ focusMain = false } = {}) {
  state.openDisclosures ||= {};
  for(const node of document.querySelectorAll('[data-remember-disclosure]')) state.openDisclosures[node.dataset.rememberDisclosure]=node.open;
  const focus = rememberFocus();
  const current = route();
  const comparisonVisible=state.compared.length&&(current.view==='library'||current.view==='story'&&current.tab==='build');
  if(current.view==='story'&&storyById(current.id))state.lastStoryTabs[current.id]=['build','refine','approve','overview','research','images','direction','caption','carousel','music','publishing'].includes(current.tab)?current.tab:'overview';
  const source = state.workspace?.source || {};
  const active = destination(current.view);
  const viewTitle = current.view === 'story' ? 'Posts' : ({home:'Editorial desk',library:'Photographs & sources',archive:'Published archive',analytics:'Insights'}[current.view] || nav.find(n => n[0] === current.view)?.[2]);
  const count = state.workspace?.stories?.filter(s=>!s.organization?.trashed).length || 0;
  let body;
  if (state.loading) body = `<div class="loading-state"><p class="eyebrow">Retrieving the existing source records</p><h1>Opening the editorial desk.</h1><p>Stories, selected photographs and publishing evidence are loading.</p><div class="loading-line" aria-hidden="true"></div></div>`;
  else if (state.error) body = `<div class="empty-state error-state"><p class="eyebrow">Connection needs attention</p><h1>The desk could not be loaded.</h1><p>${esc(state.error)}</p><button class="button button-dark" data-action="reload">Try again</button><p class="small muted">No example stories or invented publishing results are substituted.</p></div>`;
  else if (current.view === 'story') {
    const story = storyById(current.id);
    body = story&&!story.detailsLoaded ? `<div class="story-loading" role="status"><p class="eyebrow">Build your post</p><h1>${esc(story.title)}</h1>${state.storyReadErrors?.[story.id]?`<p role="alert">${esc(state.storyReadErrors[story.id])}</p><p>Your saved work is preserved.</p><button class="button button-light" data-load-story="${esc(story.id)}">Try again</button>`:'<p>Opening photographs and saved writing…</p><div class="loading-line"></div>'}</div>` : story ? views.storyWorkspace(state, story, current.tab) : `<div class="empty-state"><h1>Story not found in this snapshot.</h1><p>The existing ID may be unavailable or the source may have changed.</p><a class="button button-dark" href="#/pipeline">Back to Posts</a></div>`;
  } else body = views[current.view](state);
  const warnings = source.warnings || [];
  const connection = `<details class="connection-details"><summary><i class="status-dot ${source.stale||warnings.length?'stale':''}" aria-hidden="true"></i>Connection status${source.stale?' · cached':''}</summary><div class="connection-panel"><div class="source-bar"><span>${source.kind==='live_snapshot'?'Connected':source.kind?human(source.kind):'Connecting'}${source.observedAt?`<small>Updated ${esc(date(source.observedAt))} ET</small>`:''}</span><button class="text-button" data-action="refresh" ${source.refreshing?'disabled':''}>${source.refreshing?'Checking…':'Check for updates ↻'}</button></div>${warnings.length?`<ul class="source-warnings">${warnings.map(w=>`<li>${esc(typeof w==='string'?w:w.message||w.code)}</li>`).join('')}</ul>`:''}</div></details>`;
  renderStudio(document.querySelector('#app'), `<div class="app-shell ${comparisonVisible?'has-comparison':''}"><aside class="sidebar"><a class="masthead" href="#/discover" aria-label="MILDINCIDENT Discover">MILDINCIDENT<span>Independent visual culture</span></a><div class="sidebar-label">Your publication</div><nav class="primary-nav" aria-label="Main navigation">${nav.map(([id,url,label,num])=>`<a href="#/${url}" ${active===id?'aria-current="page"':''}><span aria-hidden="true">${num}</span><span class="nav-label">${label}</span>${id==='pipeline'?`<small>${count}</small>`:''}</a>`).join('')}</nav><div class="sidebar-foot"><details class="sidebar-tools"><summary>Studio tools</summary><a href="#/today">Editorial desk</a><a href="#/library">Photographs & sources</a><a href="#/archive">Published archive</a>${state.workspace?.hosted?`<button class="text-button" data-hosted-backup>Download private backup</button><p class="small">${state.workspace.backupStatus?.lastSuccess?'Backup verified '+esc(date(state.workspace.backupStatus.lastSuccess))+' ET':'First backup pending'}${state.workspace.backupStatus?.state==='failed'?' · backup needs attention':''}<br>Keep an offsite copy.</p>${state.workspace.backupStatus?.id?'<a class="text-link" href="/api/backups/latest/archive">Download last verified copy</a>':''}`:''}<div class="keyboard-hints"><kbd>/</kbd> Find a post<br><kbd>G</kbd> <kbd>H</kbd> Today</div><a href="https://rickywelch.app.n8n.cloud/webhook/founder-command-center" target="_blank" rel="noopener noreferrer">Original Founder Studio ↗</a></details>${state.workspace?.backupStatus?.state==='failed'?'<p class="error-text" role="status">Backup needs attention — open Studio tools.</p>':''}<span class="edition-mark">M / I</span></div></aside><div class="workspace-shell"><header class="topbar"><div class="breadcrumb"><span>MILDINCIDENT</span><span aria-hidden="true">/</span><strong>${esc(viewTitle)}</strong></div><label class="global-search"><span aria-hidden="true">⌕</span><input id="global-search" type="search" placeholder="Find a post…" value="${esc(state.search)}" aria-label="Find a post"><kbd>/</kbd></label>${connection}${state.workspace?.hosted?'<form method="post" action="/auth/logout" data-hosted-logout><button class="text-button" type="submit">Sign out</button></form>':''}</header>${libraryNavigation(current.view)}<main id="main-content" data-view="${esc(current.view)}" data-story-tab="${esc(current.tab||'')}" tabindex="-1">${body}</main><footer class="workspace-footer"><span>MILDINCIDENT · Independent visual culture</span><span>Editorial work saves privately · publishing requires approval</span></footer></div></div>${comparisonVisible?`<div class="compare-tray"><span>${state.compared.length} ${state.compared.length===1?'image · choose one more':'images to compare'}</span><button class="button button-dark" data-action="open-comparison" ${state.compared.length<2?'disabled':''}>Compare images →</button><button class="text-button" data-action="clear-comparison">Clear comparison</button></div>`:''}`);
  const curation=document.querySelector('#curation-dialog');if(curation&&!curation.open)curation.showModal();
  for(const node of document.querySelectorAll('[data-remember-disclosure]'))if(Object.hasOwn(state.openDisclosures,node.dataset.rememberDisclosure))node.open=state.openDisclosures[node.dataset.rememberDisclosure];
  resizeCaption();
  syncDialogControls();
  if(current.view==='story'){const s=storyById(current.id);if(saveFailures.has(current.id))showSaveStatus('Save failed · your changes remain in this browser',true);else if(pending.has(current.id)||saving.has(current.id)||inFlight.has(current.id))showSaveStatus('Saving…');else if(s?.localDraft?.updatedAt&&!s.localDraft.stale)showSaveStatus(`${state.workspace?.hosted?'Saved to private Studio':'Saved locally'} · ${date(s.localDraft.updatedAt)}`);}
  if(current.view==='discovery'&&state.focusDiscoverySetup){state.focusDiscoverySetup=false;document.querySelector('#research-direction')?.scrollIntoView({block:'start'});}
  document.title = current.view === 'story' && storyById(current.id) ? `${storyById(current.id).title} — MILDINCIDENT` : `${viewTitle} — MILDINCIDENT`;
  if ((focusMain||state.pendingRouteFocus)&&!state.loading) {state.pendingRouteFocus=false;focusStoryTask();}
  else if (focus) {
    const next = focus.id?document.getElementById(focus.id):document.querySelector(focus.selector);
    next?.focus({ preventScroll: true });
    if (typeof focus.start === 'number') { try { next?.setSelectionRange(focus.start, focus.end); } catch {} }
  }
}

function focusStoryTask(){
 const current=route(),task=current.tab==='refine'||current.tab==='caption'||current.tab==='overview'?'caption':current.tab==='approve'||current.tab==='publishing'?'review':current.tab==='build'||current.tab==='images'||current.tab==='carousel'?'images':null;
 const target=current.view==='story'&&task?document.querySelector('[data-story-task="'+task+'"]'):null;
 if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});const offset=(document.querySelector('.story-stages')?.getBoundingClientRect().height||0)+18;window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset),behavior:'instant'});}
 else {document.querySelector('#main-content')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}

async function loadWorkspace({ quiet = false, renderView = true } = {}) {
  if (!quiet) { state.loading = true; render(); }
  try {
    const workspace = await api('/api/workspace?summary=1');
    const activeRoute=route();if(activeRoute.view==='story'){try{const full=await api('/api/stories/'+encodeURIComponent(activeRoute.id));const index=workspace.stories.findIndex(story=>story.id===full.id);if(index>=0)workspace.stories[index]=full;state.storyReadErrors ||= {};delete state.storyReadErrors[full.id];}catch(error){state.storyReadErrors ||= {};state.storyReadErrors[activeRoute.id]=error.message;}}
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
        invalidatePreparedApproval(story);
      }
    }
    for(const story of workspace.stories){
      if(story.photoVision?.proposal){state.visionProposals ||= {};state.visionProposals[story.id]=story.photoVision.proposal;}
      const proposal=story.captionGeneration?.pilot?.proposal;
      if(proposal?.state==='completed'&&state.captionRequestedProposals?.[proposal.id]&&state.captionTools?.[story.id]==='improve'){
        state.captionTools[story.id]='compare';state.captionChoices ||= {};
        const version=story.captionGeneration?.versions?.find(v=>v.id===proposal.versionId||v.jobId===proposal.jobId||v.candidateId===proposal.resultCandidateId);
        if(version)state.captionChoices[story.id]=version.id;
      }
    }
    const currentRoute=route(),currentStory=storyById(currentRoute.id);if(currentRoute.view==='story'&&currentStory&&!currentStory.detailsLoaded&&currentRoute.id!==activeRoute.id)await loadStory(currentRoute.id).catch(()=>{});
    state.loading = false; state.error = null; if(renderView)render();
    return workspace;
  } catch (error) {
    state.loading = false;
    if (!quiet || !state.workspace) { state.error = error.message; render(); }
    else toast(error.message, { error: true });
    throw error;
  }
}

function resizeCaption(){const editor=document.querySelector('#caption-editor');if(!editor||editor.closest('[hidden]'))return;editor.style.height='auto';editor.style.height=Math.min(620,Math.max(200,editor.scrollHeight+2))+'px';}

function showSaveStatus(message, isError = false) {
  for (const label of document.querySelectorAll('[data-save-status]')) { label.textContent = message; label.classList.toggle('error-text', isError); }
}

function invalidatePreparedApproval(story){
 if(story.nativePublishing)story.nativePublishing={...story.nativePublishing,preparedSlides:[],approveAvailable:false,finalFilesVerified:false};
 if(story.approvalRequest)story.approvalRequest={...story.approvalRequest,state:'changed',unchanged:false,nativePreflightAccepted:false,message:'The working copy changed. Your earlier review handoff is preserved; save and prepare the current version before handing it over.'};
}

function editDraft(id, changes, { rerender = false, immediate = false } = {}) {
  const story = storyById(id);
  if (!story || story.localDraft?.stale) { toast('The source changed. Review and export the existing local proposal before editing.', { error: true }); return; }
  const existing = story.localDraft || {};
  story.localDraft = { ...existing, ...changes, baseRevision: existing.baseRevision || story.revision, version: versions.get(id) || 0, updatedAt: new Date().toISOString() };
  invalidatePreparedApproval(story);
  pending.set(id, { ...(pending.get(id) || {}), ...changes });
  for (const control of document.querySelectorAll('[data-proposal-for]')) if (control.dataset.proposalFor === id) {
    control.innerHTML = proposalContent(story, control.dataset.proposalLabel, control.dataset.proposalClass);
  }
  clearTimeout(timers.get(id));
  showSaveStatus('Saving…');
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
  showSaveStatus('Saving…');
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
      if (result.readiness) current.readiness=result.readiness;
      if(result.productionDecisions)current.productionDecisions=result.productionDecisions;
      if(result.productionPreparation)current.productionPreparation=result.productionPreparation;
      if(Object.hasOwn(result,'approvalRequest'))current.approvalRequest=result.approvalRequest;
      if(pending.has(id))invalidatePreparedApproval(current);
      if (result.readiness) {const panel=document.querySelector('[data-readiness-panel]');if(panel&&route().id===id)panel.innerHTML=route().tab==='overview'?views.workingReviewSummary(current):views.readinessPanel(current,state);}
      if (result.sourceSequencePlan) current.sourceSequencePlan=result.sourceSequencePlan;
      if (result.editorialPackage) current.editorialPackage=result.editorialPackage;
      if (result.photoVision) {current.photoVision=result.photoVision;state.visionProposals ||= {};state.visionProposals[id]=result.photoVision.proposal;}
      const sequenceIssues = document.querySelector('[data-direction-sequence-issues]');
      if (sequenceIssues && route().id === id) sequenceIssues.innerHTML = directionSequenceObservations(current);
      const checks = document.querySelector('[data-caption-checks]');
      if (checks && route().id === id) checks.innerHTML = views.captionChecks(current);
    }
    saveFailures.delete(id);showSaveStatus(`${state.workspace?.hosted?'Saved to private Studio':'Saved locally'} · ${date(draft.updatedAt)}`);
    syncDialogControls();
    announce('Draft saved privately.');
    succeeded = true;
  } catch (error) {
    pending.set(id, { ...changes, ...(pending.get(id) || {}) });
    saveFailures.add(id);showSaveStatus('Save failed · your changes remain in this browser', true);
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
  if(!dialog.open){dialogReturnFocus=rememberFocus();dialogReturnRoute=location.hash;}
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('button')?.focus();
}

function rememberImageReview(form) {
 if(!form?._initialReview)return;
 const key=imageReviewKey(form.dataset.story,form.dataset.asset),values=reviewValues(form);
 if(JSON.stringify(values)===JSON.stringify(form._initialReview))imageReviewDrafts.delete(key);
 else imageReviewDrafts.set(key,{values,context:reviewContext(form)});
}
function showInspection(story,asset,{focusStep=null}={}) {
 openDialog(views.assetDialog(story,asset,{compared:state.compared.some(c=>c.storyId===story.id&&c.assetId===asset.id)}));
 const dialog=document.querySelector('#asset-dialog'),form=dialog.querySelector('[data-image-review]');
 form._initialReview=reviewValues(form);form._currentContext=reviewContext(form);
 const key=imageReviewKey(story.id,asset.id),draft=imageReviewDrafts.get(key);
 if(draft){
  for(const [field,value]of Object.entries(draft.values))form.elements[field].value=value;
  for(const [field,value]of Object.entries(draft.context))form.dataset[field]=value;
  if(JSON.stringify(draft.context)!==JSON.stringify(form._currentContext)){
   const status=form.querySelector('[data-review-status]');status.textContent='This material changed after you wrote the note. Review this frame before applying it here. ';
   const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.action='review-current-frame';button.textContent='Use note with this version';status.append(button);form.querySelector('button[type=submit]').disabled=true;
  }else form.querySelector('[data-review-status]').textContent='Your unsaved feedback is retained while you look through photographs.';
 }
 if(imageReviewSaving.has(key))for(const control of form.querySelectorAll('select,textarea,button'))control.disabled=true;
 dialog.scrollTop=0;
 if(focusStep)dialog.querySelector('[aria-label="'+focusStep+' photograph"]:not(:disabled)')?.focus({preventScroll:true});
}
async function copyCaption(story){
 if(!story)return;const text=effective(story).caption;
 if(!text.trim()){toast('Write a caption first, then copy it.');return;}
 try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);toast('Caption copied. This does not approve or publish it.');}
 catch{openDialog(`<div class="dialog-heading"><div><p class="eyebrow">Your working caption</p><h2>Copy your caption</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close caption copy">×</button></div><p>Automatic copy is unavailable here. The text is selected below; use Ctrl+C or ⌘C.</p><textarea class="caption-copy-fallback" aria-label="Caption ready to copy" readonly rows="10">${esc(text)}</textarea><p class="small muted">Copying does not approve or publish the post.</p>`);const editor=document.querySelector('[aria-label="Caption ready to copy"]');editor.focus();editor.select();announce('Caption selected for manual copying.');}
}

function showRehearsal(story, index = 0, fit = 'frame') {
  if (!story) return;
  const count = mediaFor(story).length;
  if (!count) return;
  const focusAction = document.activeElement?.dataset.action;
  rehearsal = { storyId: story.id, index: Math.max(0, Math.min(count - 1, index)), fit };
  const captionOpen=Boolean(document.querySelector('#asset-dialog .rehearsal-caption[open]')),evidenceOpen=Boolean(document.querySelector('#asset-dialog .preview-evidence[open]'));
  openDialog(views.carouselRehearsal(story, rehearsal.index, fit,{captionOpen,evidenceOpen}));
  const nextFocus = ['rehearse-step'].includes(focusAction) ? document.querySelector(`#asset-dialog [data-action="${focusAction}"]:not(:disabled)`) : null;
  nextFocus?.focus();
  announce(`Slide ${rehearsal.index + 1} of ${count}.`);
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
    if(Object.hasOwn(result,'approvalRequest'))story.approvalRequest=result.approvalRequest;
    if(pending.has(story.id))invalidatePreparedApproval(story);
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

document.addEventListener('click', async event => {
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
    case 'retry-preview': {
      const photo = button.closest('.photo'); const img = photo.querySelector('img');
      photo.classList.remove('preview-failed'); button.hidden = true;
      photo.querySelector('.preview-status').textContent = 'Retrying preview…';
      const src = img.getAttribute('src'); img.removeAttribute('src'); img.setAttribute('src', src); break;
    }
    case 'apply-source-sequence': {
      if(!story||story.localDraft?.stale)break;
      const digest=button.dataset.planDigest,optionId=button.dataset.optionId;button.disabled=true;
      try{
       if(!await flushAllDrafts())throw Error('Save pending writing before applying a sequence.');
       const current=storyById(story.id);if(current.sourceSequencePlan?.digest!==digest)throw Error('The proposal changed after your edits. Review the current sequence.');
       await api('/api/stories/'+encodeURIComponent(story.id)+'/sequence-proposals/apply',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({planDigest:digest,optionId,sourceRevision:current.revision,workingVersion:current.localDraft?.version||0})});
       await loadWorkspace({quiet:true});announce('Sequence applied to your working copy. Earlier order and writing remain in history.');
      }catch(error){toast(error.message+' No automatic retry was made.',{error:true});await loadWorkspace({quiet:true}).catch(()=>{});button.disabled=false;}
      break;
    }
    case 'rehearse-story': showRehearsal(story); break;
    case 'rehearse-go': if(rehearsal)showRehearsal(storyById(rehearsal.storyId),Number(button.dataset.index),rehearsal.fit); break;
    case 'rehearse-step': if (rehearsal) showRehearsal(storyById(rehearsal.storyId), rehearsal.index + Number(button.dataset.step), rehearsal.fit); break;
    case 'prepare-discovery':
      button.disabled = true;
      createResearchRequest(editorialDiscoveryRequest(),{defaultDiscovery:true}).catch(error=>toast(error.message,{error:true})).finally(()=>{button.disabled=false;}); break;
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
    case 'open-review-view':
      if(['saved','passed'].includes(button.dataset.value)){state.reviewFilter=button.dataset.value;location.hash='#/discover';render();}break;
    case 'copy-caption': copyCaption(story); break;
    case 'review-current-frame': {
      const form=button.closest('[data-image-review]');if(!form?._currentContext)break;for(const [key,value]of Object.entries(form._currentContext))form.dataset[key]=value;form.querySelector('[data-review-status]').textContent='Note applied to this version. Save when your review is ready.';form.querySelector('button[type=submit]').disabled=false;rememberImageReview(form);break;
    }
    case 'inspect-step':
    case 'inspect': {
      const asset = story?.media?.find(item => item.id === button.dataset.asset);
      if(asset&&!story.detailsLoaded){loadStory(story.id).then(full=>showInspection(full,full.media.find(a=>a.id===asset.id))).catch(error=>toast(error.message,{error:true}));break;}
      if(asset){if(imageReviewSaving.size){toast('Your image review is saving. Try the next photograph in a moment.');break;}if(button.dataset.action==='inspect-step'&&document.querySelector('[data-preview-upload] input[type=file]')?.files.length){toast('Save or clear the selected preview file before changing photographs.',{error:true});break;}showInspection(story,asset,{focusStep:button.dataset.action==='inspect-step'?(button.textContent.includes('Next')?'Next':'Previous'):null});}
      break;
    }
    case 'compare-asset': {
      const existing = state.compared.findIndex(item => item.storyId === button.dataset.story && item.assetId === button.dataset.asset);
      if (existing >= 0) state.compared.splice(existing, 1);
      else if (state.compared.length >= 3) { toast('Compare up to three photographs at a time. Clear one to add another.'); return; }
      else state.compared.push({ storyId: button.dataset.story, assetId: button.dataset.asset });
      retainComparison();render(); announce(`${state.compared.length} photographs marked for comparison.`); break;
    }
    case 'clear-comparison': state.compared = [];retainComparison();render(); break;
    case 'open-comparison': if (state.compared.length >= 2) openDialog(views.compareDialog(state)); break;
    case 'toggle-asset': {
      if (!story) break;
      const selected = [...effective(story).selectedAssetIds];
      const replacement=state.finishReplacement,replaceIndex=replacement?.storyId===story.id?selected.indexOf(replacement.assetId):-1;
      if(replaceIndex>=0&&!selected.includes(button.dataset.asset)){selected[replaceIndex]=button.dataset.asset;state.finishReplacement=null;editDraft(story.id,{selectedAssetIds:selected},{rerender:true,immediate:true});announce('Photograph replaced in the same slide position. Earlier versions and image permissions are unchanged.');break;}
      const index = selected.indexOf(button.dataset.asset);
      if (index >= 0) selected.splice(index, 1);
      else if (selected.length >= 10) { toast('The local preparation limit is ten slides. Remove an image before adding another.', { error: true }); break; }
      else selected.push(button.dataset.asset);
      const format=effective(story).format;const adjusted=format==='single_image'&&selected.length>1?'carousel':format==='carousel'&&selected.length===1?'single_image':format;
      editDraft(story.id, { selectedAssetIds: selected,...(selected.length?{format:adjusted,targetSlideCount:selected.length}: {}) }, { rerender: true, immediate: true });
      announce(index >= 0 ? 'Image removed from local sequence.' : 'Image added to local sequence. Rights are unchanged.');
      break;
    }
    case 'save-direction': {
      if(!story||story.localDraft?.stale)break;
      button.disabled=true;
      flushAllDrafts().then(saved=>{
        if(saved){
          if(route().id===story.id){location.hash=storyUrl(story.id,'overview');render();}
          toast(effective(story).creativeBrief?.notes?.trim()?'Direction saved privately. No new material was generated.':'Continue editing the photographs and caption. No new material was generated.');
        }
      }).finally(()=>{button.disabled=false;});
      break;
    }
    case 'make-opening': {
      if(!story||story.localDraft?.stale)break;
      const selected=[...effective(story).selectedAssetIds],index=selected.indexOf(button.dataset.asset);
      if(index<=0)break;
      selected.unshift(...selected.splice(index,1));
      editDraft(story.id,{selectedAssetIds:selected},{rerender:true,immediate:true});
      announce('Cover changed. Image order saves privately.');break;
    }
    case 'move-slide': {
      if (!story) break;
      const selected = [...effective(story).selectedAssetIds];
      const index = Number(button.dataset.index), destination = index + Number(button.dataset.direction);
      if (index < 0 || destination < 0 || destination >= selected.length) break;
      [selected[index], selected[destination]] = [selected[destination], selected[index]];
      const format=effective(story).format;const adjusted=format==='single_image'&&selected.length>1?'carousel':format==='carousel'&&selected.length===1?'single_image':format;
      editDraft(story.id, { selectedAssetIds: selected,...(selected.length?{format:adjusted,targetSlideCount:selected.length}: {}) }, { rerender: true, immediate: true });
      announce(`Slide ${index + 1} moved to position ${destination + 1}.`); break;
    }
    case 'clear-track': editDraft(story.id,{musicSelection:null},{rerender:true,immediate:true});flushDraft(story.id).then(saved=>{if(saved&&route().id===story.id&&['music','refine'].includes(route().tab))render();});break;
    case 'choose-track': {
      const track = (story?.musicRecommendations || story?.intelligence?.musicRecommendations || [])[Number(button.dataset.index)];
      if (track) editDraft(story.id, { musicSelection: { track: track.track || track.title, artist: track.artist } }, { rerender: true, immediate: true });
      break;
    }
    case 'choose-hook': {
      const option=story?.hookOptions?.[Number(button.dataset.index)];if(!option)break;
      editDraft(story.id,{hook:option.text},{rerender:true,immediate:true});break;
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
  const imageForm=event.target.closest('[data-image-review]');if(imageForm)rememberImageReview(imageForm);
  const input = event.target;
  if (input.closest('[data-research-form]')&&['prompt','sourceUrl'].includes(input.name)) { state.briefRequestKey = null; state.researchDraft = { ...(state.researchDraft || {}), [input.name]: input.value }; }
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
  const trackForm=input.closest('[data-form="music"]');if(trackForm){state.musicTrackDrafts??={};state.musicTrackDrafts[trackForm.dataset.story]={track:trackForm.elements.track.value,artist:trackForm.elements.artist.value};}
  const soundForm=input.closest('[data-form="music-intent"]');
  if(soundForm){state.musicIntentDrafts??={};state.musicIntentDrafts[soundForm.dataset.story]=readMusicIntentForm(soundForm);}
  const setup=input.closest('[data-form="editorial-setup"]');
  if(setup){state.editorialSetupDrafts??={};state.editorialSetupDrafts[setup.dataset.story]={title:setup.elements.title.value,hook:setup.elements.hook.value,format:setup.elements.format.value,targetSlideCount:Number(setup.elements.targetSlideCount.value)};}
  if (input.dataset.draftField) {
    editDraft(input.dataset.story, { [input.dataset.draftField]: input.value });
    if (input.dataset.draftField === 'caption') {
      resizeCaption();
      const characters = [...input.value].length;
      const counter = document.querySelector('[data-caption-count]');
      if (counter) { counter.textContent = `${characters} / 2,200 characters`; counter.classList.toggle('error-text', characters > 2200); }
      const warning = document.querySelector('[data-caption-warning]');
      if (warning) warning.hidden = characters <= 2200 && !/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(input.value);
    }
  }
});

document.addEventListener('change', event => {
  const imageForm=event.target.closest('[data-image-review]');if(imageForm)rememberImageReview(imageForm);
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
  const trackForm=input.closest('[data-form="music"]');if(trackForm){state.musicTrackDrafts??={};state.musicTrackDrafts[trackForm.dataset.story]={track:trackForm.elements.track.value,artist:trackForm.elements.artist.value};}
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
 if(await flushDraft(story.id)&&route().id===story.id&&['music','refine'].includes(route().tab))render();
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
  if(state.musicTrackDrafts)delete state.musicTrackDrafts[form.dataset.story];
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
  if (status) status.textContent = previewFailureMessage(photo.dataset.previewKind,{compact:photo.classList.contains('compact-preview')});
  const retry = photo.querySelector('.preview-retry'); if (retry) retry.hidden = false;
}, true);

async function createResearchRequest(input, {start=false,defaultDiscovery=false}={}) {
  if(start&&!researchAccess(state.workspace?.engine).canReview)throw new Error(researchAccess(state.workspace?.engine).message);
  if(start&&state.workspace.engine?.founderPolicy?.mode!=='founder_confirmed'&&!window.confirm('Start one authorized research run? It may charge for one research and one draft call. Proceed only under a separately approved spend limit; the provider price is not shown here. It will not publish or grant rights.'))return false;
  const keyField = defaultDiscovery?'discoveryRequestKey':input.preset?'presetRequestKey':input.kind==='brief' ? 'briefRequestKey' : 'discoveryRequestKey';
  state[keyField] ||= crypto.randomUUID();
  const result = await api('/api/research/requests', {method:'POST', headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit',...(defaultDiscovery?{'X-Mildincident-Discovery':'founder-brief-v14'}:{})},body:JSON.stringify({...input,idempotencyKey:state[keyField]})});
  state[keyField] = null;
  if (input.kind==='brief'&&!input.preset&&!defaultDiscovery) state.researchDraft = {};
  if(route().view==='home')location.hash='#/discovery';
  const reused=state.workspace.researchRequests.some(r=>r.id===result.request.id);
  if (!reused) state.workspace.researchRequests.unshift(result.request);
  render();
  await loadWorkspace({quiet:true}).catch(()=>{});
  if(start){try{const launched=await launchSavedResearch(result.request,{engine:state.workspace.engine,api});if(launched.proposal)state.storyGenerationProposal=launched.proposal;toast(launched.proposal?'Review the plan, then confirm one story. No AI has started.':'Research start requested once. Progress and resulting ideas appear in Discover.');}catch(error){toast('Your brief is saved. '+error.message+' No automatic retry was made.',{error:true});}await loadWorkspace({quiet:true}).catch(()=>{});}
  else toast(reused?'Existing saved direction retained. Research has not started.':'Direction saved. Research has not started.');
  const observed=state.workspace.researchRequests.find(r=>r.id===result.request.id);
  const target=start&&observed?.engineJob?.candidates?.length?document.querySelector('.founder-inbox'):document.querySelector(`[data-request-id="${result.request.id}"]`);target?.scrollIntoView({block:'center'});
}
document.addEventListener('click', async event=>{
  const button=event.target.closest('[data-engine-action]');if(!button||button.disabled)return;
  button.disabled=true;
  try{
    const action=button.dataset.engineAction;if(!['refresh','evidence'].includes(action))return;
    if(action==='evidence'&&!await flushAllDrafts())throw new Error('Save or recover pending edits before reading recorded evidence.');
    await api(action==='refresh'?'/api/research/engine/refresh':`/api/research/requests/${button.dataset.request}/engine/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(action==='start'?{expectedVersion:Number(button.dataset.version)}:{})});
    await loadWorkspace({quiet:true});toast(action==='queue'?'Queued in isolated n8n development storage. No AI run was started.':action==='evidence'?'Captured execution evidence inspected without a new provider call.':action==='start'?'Bounded generation dispatched once. Refresh results to reconcile its status.':'Research results checked.');
  }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});
document.addEventListener('submit', async event => {
  const form=event.target.closest('[data-research-form]');if(!form)return;
  event.preventDefault();if(state.discoverySubmitting)return;state.discoverySubmitting=true;const button=form.querySelector('button[type="submit"]');button.disabled=true;
  const status=form.querySelector('[data-research-status]');status.textContent='Saving…';const fields=form.querySelector('[data-discovery-fields]');if(fields)fields.disabled=true;
  try {
    if(form.matches('[data-research-form]')) {
      const custom=!form.hasAttribute('data-discovery-setup')||form.dataset.mode==='custom';let input=custom?{kind:'brief',prompt:form.elements.prompt.value,sourceUrl:form.elements.sourceUrl.value}:editorialDiscoveryRequest();
      if(form.dataset.mode==='preset'){const option=form.elements.presetKey.selectedOptions[0],preset=state.workspace.researchPresets?.items.find(p=>p.key===option?.value&&p.version===option?.dataset.version);if(!preset)throw new Error('Choose an available recorded theme.');input={kind:'brief',prompt:preset.direction,sourceUrl:'',preset:{key:preset.key,version:preset.version}};}
      const result=await createResearchRequest(input,{start:event.submitter?.value==='start',defaultDiscovery:!custom&&form.dataset.mode!=='preset'});if(result===false)status.textContent='Nothing was started or saved.';
    }
  }catch(error){const current=document.querySelector('[data-research-status]');if(current)current.textContent=error.message;toast(error.message,{error:true});}finally{state.discoverySubmitting=false;button.disabled=false;const fields=document.querySelector('[data-discovery-fields]');if(fields)fields.disabled=false;}
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-image-review]'); if (!form) return;
  event.preventDefault(); const button = form.querySelector('button[type="submit"]'); const status = form.querySelector('[data-review-status]');
  const key=imageReviewKey(form.dataset.story,form.dataset.asset),controls=[...form.querySelectorAll('select,textarea,button')].map(control=>({control,disabled:control.disabled}));imageReviewSaving.add(key);for(const {control}of controls)control.disabled=true;status.textContent='Saving your editorial judgment…';
  try {
    const saved=await api(`/api/stories/${encodeURIComponent(form.dataset.story)}/assets/${encodeURIComponent(form.dataset.asset)}/review`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({expectedVersion:Number(form.dataset.version),sourceRevision:form.dataset.revision,workingVersion:Number(form.dataset.working),previewSha256:form.dataset.previewHash,decision:form.elements.decision.value,reason:form.elements.reason.value,...(form.elements.basis?{basis:form.elements.basis.value}:{})})});
    if(!Number.isSafeInteger(saved.review?.version))throw new Error('The Studio did not confirm the saved review version. Your note remains here.');
    const cachedAsset=storyById(form.dataset.story)?.media.find(a=>a.id===form.dataset.asset);if(cachedAsset)cachedAsset.localReview=saved.review;
    imageReviewDrafts.delete(key);let refreshFailed=false;try{await loadWorkspace({quiet:true});}catch{refreshFailed=true;}
    const story=storyById(form.dataset.story),asset=story?.media.find(a=>a.id===form.dataset.asset);
    imageReviewSaving.delete(key);if(form.isConnected&&asset)showInspection(story,asset);
    toast(refreshFailed?'Image feedback saved. The latest workspace could not be refreshed; your confirmed review is retained.':'Image feedback saved. Rights and selected slides are unchanged.',{error:refreshFailed});
  }catch(error){status.textContent=error.message;}finally{imageReviewSaving.delete(key);for(const {control,disabled}of controls)control.disabled=disabled;}
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
    if(form.isConnected&&asset)showInspection(story,asset);
    toast('Private preview saved. Source identity and publication rights remain unverified.');
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

document.addEventListener('keydown', event => {
  const input = event.target.closest('input,textarea,select,[contenteditable="true"]');
  if(!input&&document.querySelector('#asset-dialog[open] [data-inspector]')&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();document.querySelector('#asset-dialog [aria-label="'+(event.key==='ArrowRight'?'Next':'Previous')+' photograph"]:not(:disabled)')?.click();return;}
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
    const target = { h: 'today', p: 'stories', l: 'library', b: 'production', a: 'archive' }[event.key.toLowerCase()];
    if (target) { event.preventDefault(); location.hash = `#/${target}`; }
  } else if (event.key.toLowerCase() === 'g') { keyboardPrefix = true; setTimeout(() => { keyboardPrefix = false; }, 1000); }
});

document.querySelector('#asset-dialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); }
});
document.querySelector('#asset-dialog').addEventListener('close',()=>{
 if(dialogReturnRoute===location.hash&&dialogReturnFocus){const target=dialogReturnFocus.id?document.getElementById(dialogReturnFocus.id):document.querySelector(dialogReturnFocus.selector);target?.focus({preventScroll:true});}
 dialogReturnFocus=null;dialogReturnRoute=null;
});
window.addEventListener('hashchange', async () => { document.querySelector('#asset-dialog').close();state.curationStory=null;const next=route();if(next.view==='story'&&next.tab==='refine'){state.captionTools ||= {};state.captionTools[next.id]='edit';}state.pendingRouteFocus=true;render({focusMain:true});if(next.view==='story'){await flushAllDrafts();await loadStory(next.id).catch(error=>toast(error.message,{error:true}));} });
window.addEventListener('beforeunload', event => { if (pending.size || saving.size || imageReviewDrafts.size || Object.keys(state.editorialSetupDrafts||{}).length || Object.keys(state.musicIntentDrafts||{}).length || Object.keys(state.musicTrackDrafts||{}).length || state.researchDraft?.prompt?.trim()) { event.preventDefault(); event.returnValue = ''; } });

render();
loadWorkspace().catch(() => {});

// Founder review is private editorial preference, never a production approval.
document.addEventListener('click',event=>{const button=event.target.closest('[data-review-filter]');if(button){state.reviewFilter=button.dataset.reviewFilter;render();}});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-founder-review]');if(!form)return;event.preventDefault();const decision=event.submitter?.value;if(!decision)return;for(const b of form.querySelectorAll('button'))b.disabled=true;
 try{const fields=new FormData(form);const result=await api('/api/editorial/reviews/'+encodeURIComponent(form.dataset.founderReview),{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({decision,basis:fields.get('basis'),reason:fields.get('reason')||'',dimensions:fields.getAll('dimension'),...(fields.get('basis')==='individual_photograph'?{assetId:form.dataset.asset,previewSha256:form.dataset.previewHash}:{}),expectedVersion:Number(form.dataset.version),sourceRevision:form.dataset.revision,workingVersion:Number(form.dataset.working)})});
  await loadWorkspace({quiet:true});if(decision==='develop')location.hash='#/story/'+encodeURIComponent(form.dataset.founderReview)+'/overview';toast(result.followUp?'Decision and research direction saved. Research has not started.':({save:'Saved to Discover → Saved / developing.',pass:'Passed. You can reconsider it in Discover → Passed.',develop:'Saved. Continue developing the story.',reset:'Returned to the review queue.'}[decision]||'Editorial decision saved.'),{reviewFilter:decision==='save'?'saved':decision==='pass'?'passed':null});
 }catch(error){toast(error.message,{error:true});}finally{for(const b of form.querySelectorAll('button'))b.disabled=false;}
});

// Image-bound research preparation saves context only; dispatch remains a separate approved action.
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-photo-continuation]');if(!button)return;button.disabled=true;
 button.dataset.requestKey ||= crypto.randomUUID();
 try{if(!await flushAllDrafts())throw new Error('Save pending edits before preparing image research.');const currentStory=storyById(button.dataset.story),currentAsset=currentStory?.media.find(a=>a.id===button.dataset.asset);if(!currentAsset)throw Error('Reopen this photograph before searching.');const result=await api('/api/stories/'+encodeURIComponent(button.dataset.story)+'/photo-research',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({intent:button.dataset.photoContinuation,assetId:button.dataset.asset,sourceRevision:currentStory.revision,workingVersion:currentStory.localDraft?.version||0,previewSha256:currentAsset.localPreview?.sha256||'',idempotencyKey:button.dataset.requestKey,photoSource:state.photoSources?.[button.dataset.story]||'commons',photoDirection:state.photoDirections?.[button.dataset.story]||'series',photoCustom:state.photoCustom?.[button.dataset.story]||''})});
 document.querySelector('#asset-dialog')?.close();await loadWorkspace({quiet:true});announce('Photograph request prepared. Review the archive search on this story.');
 }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});

// Background UI reads never flush or replace pending editorial edits/forms.
let backgroundRead=false;
async function receiveResearchUpdates(){
 const active=storyProposal(state);
 if(!backgroundRead&&!document.hidden&&active&&(['dispatching','queued','running','uncertain'].includes(active.state)||state.storyResultPending===active.id)){
  backgroundRead=true;try{
   const result=await api('/api/research/requests/'+encodeURIComponent(active.id)+'/generation/status');
   result.proposal=reconcileStoryProgress(active,result.proposal);
   state.storyGenerationProposal=result.proposal;const request=state.workspace.researchRequests?.find(r=>r.id===active.id);if(request)request.generationProposal=result.proposal;
   const terminal=['completed','failed'].includes(result.proposal.state);
   if(terminal){state.storyResultPending=active.id;result.proposal.deliveryPending=true;updateStoryGenerationReview(document,result.proposal);try{await loadWorkspace({quiet:true,renderView:false});updateAiUsagePanel(document,state);state.storyResultPending=null;result.proposal.deliveryPending=false;}catch{/* Keep the recorded outcome and retry only its read-only Studio handoff. */}}
   updateStoryGenerationReview(document,{...result.proposal,deliveryPending:state.storyResultPending===active.id,readUnavailable:result.delivery?.state==='unavailable'||state.storyResultPending===active.id});
  }catch{updateStoryGenerationReview(document,{...active,deliveryPending:state.storyResultPending===active.id,readUnavailable:true});}finally{backgroundRead=false;}
  return;
 }
 if(state.discoverySubmitting||backgroundRead||document.hidden||!state.workspace?.engine?.delivery||pending.size||saving.size||document.querySelector('#asset-dialog')?.open||!['home','discovery','story'].includes(route().view)||document.activeElement?.matches('input,textarea,select')||document.querySelector('details[open]:not(.research-activity-row):not(.caption-request)')||[...document.querySelectorAll('form input:not([type=hidden]),form textarea')].some(el=>el.type==='checkbox'?el.checked!==el.defaultChecked:el.value!==el.defaultValue))return;
 backgroundRead=true;try{await loadWorkspace({quiet:true});}catch{}finally{backgroundRead=false;}
}
const researchUiTimer=setInterval(receiveResearchUpdates,15000);window.addEventListener('pagehide',()=>clearInterval(researchUiTimer));document.addEventListener('visibilitychange',()=>{if(!document.hidden)receiveResearchUpdates();});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-hosted-backup]');if(!button)return;button.disabled=true;try{if(!await flushAllDrafts())throw new Error('Save pending edits before creating a backup.');const result=await api('/api/backups',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});location.assign('/api/backups/'+encodeURIComponent(result.backup.id)+'/archive');toast('Verified private backup ready. Keep this copy private and off the hosting disk.');}catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}});

document.addEventListener('submit',async event=>{const form=event.target.closest('[data-hosted-logout]');if(!form)return;event.preventDefault();if(await flushAllDrafts())form.submit();else toast('Save or recover pending edits before signing out.',{error:true});});

document.addEventListener('click',event=>{
 const choice=event.target.closest('[data-discovery-mode],[data-discovery-entry]');if(!choice)return;
 if(state.discoverySubmitting){event.preventDefault();return;}
 const mode=choice.dataset.discoveryMode||choice.dataset.discoveryEntry;
 if(!['surprise','preset','custom'].includes(mode))return;
 state.discoveryMode=mode;state.focusDiscoverySetup=true;
 if(route().view==='discovery'){event.preventDefault();render();document.querySelector('#research-direction')?.scrollIntoView({block:'start'});}
});
document.addEventListener('change',event=>{
 const select=event.target.closest('#discovery-preset');if(!select||state.discoverySubmitting)return;
 state.presetChoice={key:select.value,version:select.selectedOptions[0]?.dataset.version};state.presetRequestKey=null;render();document.querySelector('#discovery-preset')?.focus();
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-editorial-lens]');if(!button||state.discoverySubmitting)return;
 const lens=state.workspace?.editorialDirection?.lenses.find(l=>l.key===button.dataset.editorialLens),input=document.querySelector('#discovery-prompt');if(!lens||!input)return;
 const previous=input.value.trim(),value=previous&&previous!==state.lastEditorialLens?previous+'\n\n'+lens.brief:lens.brief;
 if(value.length>2000){toast('Your current direction is preserved. Make room before adding another starting point.',{error:true});return;}
 state.lastEditorialLens=lens.brief;state.briefRequestKey=null;state.researchDraft={...(state.researchDraft||{}),prompt:value};input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();announce('Editorial direction added. No research has started.');
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-start-saved-research]');if(!button||state.discoverySubmitting)return;
 const request=state.workspace.researchRequests.find(r=>r.id===button.dataset.startSavedResearch);if(!request)return;
 if(!researchAccess(state.workspace.engine).canReview){toast(researchAccess(state.workspace.engine).message,{error:true});return;}
 if(state.workspace.engine?.founderPolicy?.mode!=='founder_confirmed'&&!window.confirm('Start one authorized research run for this saved brief? It uses the approved provider budget and does not publish.'))return;
 state.discoverySubmitting=true;button.disabled=true;
 try{const launched=await launchSavedResearch(request,{engine:state.workspace.engine,api});if(launched.proposal)state.storyGenerationProposal=launched.proposal;await loadWorkspace({quiet:true});toast(launched.proposal?'Review the plan before confirming. No AI has started.':'Research start requested once. Check its recorded progress below.');}catch(error){toast(error.message+' Check results before retrying; no automatic retry was made.',{error:true});await loadWorkspace({quiet:true}).catch(()=>{});}finally{state.discoverySubmitting=false;button.disabled=false;const fields=document.querySelector('[data-discovery-fields]');if(fields)fields.disabled=false;}
});

// Library organization changes no caption, media, native approval or production record.
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-organize-story]');if(!button||button.disabled)return;
 const story=storyById(button.dataset.organizeStory),field=button.dataset.field;if(!story||!['pinned','archived','trashed'].includes(field))return;
 if(field==='trashed'&&!story.organization?.trashed&&!button.dataset.trashConfirmed){
  openDialog(`<div class="dialog-heading"><h2>Move this post to Trash?</h2><button class="icon-button" data-action="close-dialog" aria-label="Cancel">×</button></div><p>${esc(story.title)}</p><p>Your caption, photographs, sources, approvals and delivery history stay safe. You can restore this post from Posts → Trash.</p><div class="dialog-actions"><button class="button button-light" data-action="close-dialog">Keep post</button><button class="button button-dark" data-organize-story="${esc(story.id)}" data-field="trashed" data-trash-confirmed="true">Move to Trash</button></div>`);return;
 }
 const lock='organize:'+story.id;if(captionRequestLocks.has(lock))return;captionRequestLocks.add(lock);button.disabled=true;
 try{if(!await flushAllDrafts())throw new Error('Save pending edits first.');const value=!story.organization?.[field];
  const result=await api('/api/stories/'+encodeURIComponent(story.id)+'/organization',{method:'PATCH',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({baseRevision:story.revision,expectedVersion:story.organization?.version||0,[field]:value,...(field==='trashed'&&value?{confirm:'move_to_trash'}:{})})});
  story.organization=result.organization;if(button.dataset.trashConfirmed)document.querySelector('#asset-dialog')?.close();render();
  toast(field==='trashed'?(value?'Moved to Trash. Restore it from Posts → Trash.':result.organization.archived?'Post restored to Archived posts.':'Post restored.') :field==='archived'?(value?'Post archived.':'Post returned to drafts.'):(value?'Post pinned.':'Post unpinned.'));
 }catch(error){toast(error.message,{error:true});}finally{captionRequestLocks.delete(lock);button.disabled=false;}
});
document.addEventListener('change',event=>{if(event.target.id==='story-status'){state.pipelineGroup=event.target.value;render();}if(event.target.id==='story-sort'){state.storySort=event.target.value;render();}if(event.target.id==='story-archive'){state.storyArchive=event.target.value;render();}});

// Plans are unpaid; confirmation consumes one server-owned policy authorization.
// A local lock protects duplicate clicks; the durable server claim remains authoritative.
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-caption-request]');if(!button||button.disabled)return;
 const id=button.dataset.story,action=button.dataset.captionRequest;
 if(captionRequestLocks.has(id))return;
 captionRequestLocks.add(id);button.disabled=true;state.captionRequestBusy ||= {};state.captionRequestBusy[id]=true;
 state.captionErrors ||= {};delete state.captionErrors[id];
 try{
  if(action!=='disable'&&!await flushAllDrafts())throw new Error('Save pending edits before continuing.');
  const story=storyById(id);if(!story)throw new Error('Reload this story before continuing.');
  const path='/api/stories/'+encodeURIComponent(id)+'/caption/';
  const post=body=>({method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(body)});
  if(action==='prepare'){
   const direction=state.captionDirections?.[id]||captionRequestProposal(story,state)?.direction||'concise';
   if(!Object.hasOwn(CAPTION_IMPROVEMENTS,direction))throw new Error('Choose a supported improvement direction.');
   state.captionRequestKeys ||= {};const binding=JSON.stringify([id,story.revision,story.localDraft?.version||0,direction]);
   const previous=captionRequestProposal(story,state);if(['completed','failed','rejected','expired'].includes(previous?.state))delete state.captionRequestKeys[binding];
   const idempotencyKey=state.captionRequestKeys[binding] ||= crypto.randomUUID();
   const result=await api(path+'prepare',post({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,direction,idempotencyKey}));
   if(!result.proposal?.id)throw new Error('The request plan was not confirmed. No AI has been started.');
   state.captionProposals ||= {};state.captionProposals[id]=result.proposal;
   state.captionTools ||= {};state.captionTools[id]='improve';
   announce('Request prepared for review. No AI has started.');
  }else if(action==='confirm'){
   const proposal=captionRequestProposal(story,state);
   if(!proposal||proposal.id!==button.dataset.proposal||!canConfirmCaption(story,proposal))throw new Error('This request is no longer ready to confirm. Review a current plan first.');
   state.captionRequestedProposals ||= {};state.captionRequestedProposals[proposal.id]=true;
   state.captionProposals ||= {};state.captionProposals[id]={...proposal,state:'uncertain',canConfirm:false,message:'Confirmation sent. Waiting for its recorded outcome; do not submit again.'};
   render();
   const result=await api(path+'confirm',post({proposalId:proposal.id,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,confirm:true}));
   if(result.proposal)state.captionProposals[id]=result.proposal;
   await loadWorkspace({quiet:true});announce('Caption request confirmed once. Your working copy is preserved.');
  }else if(action==='compare'){
   const proposal=captionRequestProposal(story,state),result=await api(path+'versions');
   state.captionVersions ||= {};state.captionVersions[id]=result.versions;
   state.captionTools ||= {};state.captionTools[id]='compare';state.captionChoices ||= {};
   const version=result.versions?.find(v=>v.id===proposal?.versionId||v.jobId===proposal?.jobId||v.candidateId===proposal?.resultCandidateId);
   if(version)state.captionChoices[id]=version.id;
  }else if(action==='disable'){
   await api('/api/generation/disable',post({}));await loadWorkspace({quiet:true});
   state.captionProposals ||= {};delete state.captionProposals[id];announce('Future AI starts disabled. Accepted work may still finish.');
  }
 }catch(error){
  state.captionErrors[id]=action==='confirm'?error.message+' Check the recorded outcome; this request will not be resent automatically.':error.message;
 }finally{
  captionRequestLocks.delete(id);state.captionRequestBusy[id]=false;button.disabled=false;render();
 }
});

// Existing version selection is a private edit; new model calls use a separately approved binding.
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-caption-operation]');if(!button||button.disabled)return;button.disabled=true;
 try{
  if(!await flushAllDrafts())throw new Error('Save pending edits before continuing the caption.');
  const story=storyById(button.dataset.story);if(!story)throw new Error('Reload this story before continuing.');
  const operation=button.dataset.captionOperation,isVersion=operation==='use-version';
  await api('/api/stories/'+encodeURIComponent(story.id)+'/caption/'+(isVersion?'use':operation),{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,...(isVersion?{versionId:button.dataset.version,confirm:'replace_after_review'}:operation==='use'?{candidateId:story.captionGeneration?.result?.candidateId}:{direction:button.dataset.direction||'initial'})})});
  if(isVersion){state.captionTools ||= {};state.captionTools[story.id]='edit';}
  state.captionErrors ||= {};delete state.captionErrors[story.id];state.captionVersionLoaded ||= {};delete state.captionVersionLoaded[story.id];await loadWorkspace({quiet:true});announce(isVersion?'Caption version saved. Your earlier copy remains in history.':'One caption request sent. Your current caption and photographs are preserved.');
 }catch(error){state.captionErrors ||= {};state.captionErrors[button.dataset.story]=error.message;render();}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-caption-tool]');if(!button||button.disabled)return;
 const id=button.dataset.story;button.disabled=true;
 try{
  if(!await flushAllDrafts())throw new Error('Save your current edits before comparing or improving.');
  state.captionTools ||= {};state.captionTools[id]=button.dataset.captionTool;
  if(button.dataset.captionTool==='compare'){
   const result=await api('/api/stories/'+encodeURIComponent(id)+'/caption/versions');
   state.captionVersions ||= {};state.captionVersions[id]=result.versions;
  }
  state.captionErrors ||= {};delete state.captionErrors[id];render();
  document.querySelector(button.dataset.captionTool==='edit'?'#caption-editor':button.dataset.captionTool==='compare'?'.caption-comparison h3':'.caption-improvement h3')?.focus({preventScroll:true});
 }catch(error){state.captionErrors ||= {};state.captionErrors[id]=error.message;render();}finally{button.disabled=false;}
});
document.addEventListener('change',event=>{
 const select=event.target;if(select.matches('[data-caption-choice]')){state.captionChoices ||= {};state.captionChoices[select.dataset.captionChoice]=select.value;render();}
 if(select.matches('[data-caption-direction]')){state.captionDirections ||= {};state.captionDirections[select.dataset.captionDirection]=select.value;state.captionProposals ||= {};delete state.captionProposals[select.dataset.captionDirection];render();document.querySelector('#caption-improvement-direction')?.focus({preventScroll:true});}
});

// Download only after all pending edits have saved; this packet does not import or approve anything.
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-approval-packet]');if(!button||button.disabled)return;button.disabled=true;
 try{if(!await flushAllDrafts())throw new Error('Save pending edits before preparing the review copy.');location.assign('/api/stories/'+encodeURIComponent(button.dataset.approvalPacket)+'/production-packet');toast('Exact review copy prepared. No material was transferred to the approval workflow.');}catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});

// Private founder themes use the existing brief/preset snapshot contract.
const themeByKey=key=>[...(state.workspace?.researchPresets?.items||[]),...(state.workspace?.studioThemes||[])].find(t=>t.key===key);
document.addEventListener('submit',async event=>{const form=event.target.closest('[data-theme-form]');if(!form)return;event.preventDefault();const fields=new FormData(form),status=form.parentElement.querySelector('[data-theme-status]');try{const result=await api('/api/research/themes',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({...(fields.get('key')?{key:fields.get('key')}:{}),expectedRevision:Number(fields.get('revision')),name:fields.get('name'),direction:fields.get('direction')})});state.presetChoice=result.theme;await loadWorkspace({quiet:true});announce('Private theme saved. Research has not started.');}catch(error){status.textContent=error.message;}});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-theme-edit],[data-theme-copy],[data-theme-archive]');if(!button)return;const key=button.dataset.themeEdit||button.dataset.themeCopy||button.dataset.themeArchive,theme=themeByKey(key),form=document.querySelector('[data-theme-form]');if(!theme)return;if(button.dataset.themeArchive){try{await api('/api/research/themes',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({key,expectedRevision:theme.revision,archived:!theme.archived})});await loadWorkspace({quiet:true});}catch(error){toast(error.message,{error:true});}return;}form.elements.name.value=button.dataset.themeCopy?theme.name.slice(0,115)+' copy':theme.name;form.elements.direction.value=theme.direction;form.elements.key.value=button.dataset.themeEdit?key:'';form.elements.revision.value=button.dataset.themeEdit?theme.revision:0;form.elements.name.focus();});

// A reviewed story uses the same durable founder action ledger as caption improvements.
document.addEventListener('click',async event=>{
 const confirm=event.target.closest('[data-story-generation-confirm]'),disable=event.target.closest('[data-ai-disable]');if((!confirm&&!disable)||state.storyConfirmBusy||confirm?.disabled)return;
 const p=storyProposal(state);if(confirm&&(!p||p.id!==confirm.dataset.storyGenerationConfirm||p.state!=='prepared'||!p.canConfirm))return;
 state.storyConfirmBusy=true;if(confirm)state.storyGenerationProposal={...p,state:'uncertain',canConfirm:false};render();
 try{
  const result=await api(disable?'/api/generation/disable':`/api/research/requests/${encodeURIComponent(p.id)}/generation/confirm`,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(disable?{}:{confirm:true})});
  if(result.proposal)state.storyGenerationProposal=result.proposal;
  await loadWorkspace({quiet:true});toast(disable?'Future AI starts disabled. Accepted work may still finish.':'Story request confirmed once. Check its recorded progress.');
 }catch(error){toast(error.message+(confirm?' Check results; no automatic resubmission was made.':''),{error:true});}
 finally{state.storyConfirmBusy=false;render();receiveResearchUpdates();}
});

document.addEventListener('change',event=>{const select=event.target.closest('[data-photo-source]');if(!select)return;state.photoSources ||= {};state.photoSources[select.dataset.photoSource]=select.value;});
function watchPhotoProgress(id){
 let stopped=false,reading=false;
 const tick=async()=>{if(stopped||reading||!state.photoSearchBusy?.[id])return;reading=true;
  try{
   const detail=await api('/api/stories/'+encodeURIComponent(id));if(stopped||!state.photoSearchBusy?.[id])return;
   const current=storyById(id),fingerprint=s=>(s?.media||[]).map(a=>[a.id,a.localPreview?.sha256,a.savedCopy?.sha256].join(':')).join('|'),changed=fingerprint(current)!==fingerprint(detail);
   mergeStoryDetail(id,detail);
   // Show newly saved photographs while the bounded source scan continues.
   // Reuse decoded image elements and never disturb writing on another tab.
   if(changed&&route().id===id&&route().tab==='build')render();
   const p=detail.photoRequests?.[0],status=document.getElementById('photo-action-status-'+id),pages=p?.sourceAttempts?.filter(a=>a.status==='captured').length||0,files=p?.imageAttempts?.filter(a=>['decoded','cached_existing','exact_duplicate'].includes(a.status)).length||0;
   if(status)status.textContent=pages||files?`${pages} source page(s) read · ${files} image file(s) checked. Saved photographs appear as they arrive.`:'Checking project sources. Your selection stays in place.';
  }catch{/* Preserve the last visible result; the final receipt reports errors. */}finally{reading=false;}
 };
 const timer=setInterval(tick,1500);return()=>{stopped=true;clearInterval(timer);};
}
async function discoverStoryPhotos(id,button,sourcePage=null){
 state.photoSearchBusy ||= {};if(state.photoSearchBusy[id])return;state.photoSearchBusy[id]=true;button.disabled=true;
 button.dataset.requestKey ||= crypto.randomUUID();button.textContent=sourcePage?'Importing references…':'Finding photographs…';const stopProgress=watchPhotoProgress(id);
 try{
  if(!await flushAllDrafts())throw Error('Save pending edits before finding photographs.');
  const story=storyById(id),input={sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:button.dataset.requestKey,direction:state.photoDirections?.[id]||'best',custom:state.photoCustom?.[id]||'',...(state.photoRefresh?.[id]&&!sourcePage?{refreshSources:true}:{}),...(sourcePage||{})};
  const result=await api('/api/stories/'+encodeURIComponent(id)+'/photo-discovery',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(input)});
  await loadWorkspace({quiet:true});announce(photoOutcome(result.photoRequest));
 }catch(error){toast(error.message+' Check the recorded result before another request. No automatic repeat was made.',{error:true});await loadWorkspace({quiet:true}).catch(()=>{});}
 finally{stopProgress();state.photoSearchBusy[id]=false;render();}
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-photo-discover]');if(button&&!button.disabled)discoverStoryPhotos(button.dataset.photoDiscover,button);});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-photo-close]');if(!button||button.disabled)return;button.disabled=true;
 try{if(!await flushAllDrafts())throw Error('Save pending edits before closing this search.');const story=storyById(button.dataset.story);await api('/api/stories/'+encodeURIComponent(story.id)+'/photo-research/'+button.dataset.photoClose+'/close-interrupted',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,confirm:'close_interrupted_search'})});await loadWorkspace({quiet:true});toast('Interrupted search closed. No source request was repeated.');}
 catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-photo-page-import]');if(!form)return;event.preventDefault();const button=form.querySelector('button[type=submit]');if(button.disabled)return;
 try{const file=form.elements.pageFile.files[0];if(file&&file.size>2000000)throw Error('Choose a saved HTML page up to 2 MB.');const html=file?await file.text():form.elements.html.value;if(html.trim().length<20)throw Error('Choose a saved HTML page or paste its original HTML.');await discoverStoryPhotos(form.dataset.photoPageImport,button,{sourceUrl:form.elements.sourceUrl.value.trim(),html});}
 catch(error){toast(error.message,{error:true});}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-photo-search]');if(!button||button.disabled)return;const id=button.dataset.story;
 state.photoSearchBusy ||= {};if(state.photoSearchBusy[id])return;state.photoSearchBusy[id]=true;button.disabled=true;
 try{if(!await flushAllDrafts())throw new Error('Save pending edits before searching.');const story=storyById(id);
  const result=await api('/api/stories/'+encodeURIComponent(id)+'/photo-research/'+button.dataset.photoSearch+'/search',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,confirm:true})});
  await loadWorkspace({quiet:true});toast(result.photoRequest.state==='complete'?'Photograph references saved to this story. Review identity and permissions before selecting.':result.photoRequest.message,{error:result.photoRequest.state!=='complete'});
 }catch(error){toast(error.message+' No automatic repeat was made.',{error:true});await loadWorkspace({quiet:true}).catch(()=>{});}
 finally{state.photoSearchBusy[id]=false;render();}
});

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-approval-prepare]');if(!button||button.disabled)return;const id=button.dataset.approvalPrepare;if(captionRequestLocks.has('approval:'+id))return;captionRequestLocks.add('approval:'+id);button.disabled=true;
 try{if(!await flushAllDrafts())throw new Error('Save pending edits before preparing approval review.');const story=storyById(id);state.approvalKeys ||= {};const binding=JSON.stringify([id,story.revision,story.localDraft?.version||0,story.productionPreparation?.digest]);const key=state.approvalKeys[binding] ||= crypto.randomUUID();
  const result=await api('/api/stories/'+encodeURIComponent(id)+'/approval-requests',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:key,confirm:'prepare_review_only'})});
  story.approvalRequest=result.approvalRequest;render();toast('Exact review handoff saved privately. Native approval and publishing remain separate.');
 }catch(error){toast(error.message,{error:true});}finally{captionRequestLocks.delete('approval:'+id);button.disabled=false;}
});

document.addEventListener('change',event=>{const select=event.target.closest('[data-photo-direction]');if(!select)return;state.photoDirections ||= {};state.photoDirections[select.dataset.photoDirection]=select.value;render();});
document.addEventListener('change',event=>{const input=event.target.closest('[data-photo-refresh]');if(!input)return;state.photoRefresh ||= {};state.photoRefresh[input.dataset.photoRefresh]=input.checked;});
document.addEventListener('input',event=>{const input=event.target.closest('[data-photo-custom]');if(!input)return;state.photoCustom ||= {};state.photoCustom[input.dataset.photoCustom]=input.value;});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-photo-more]');if(!button||button.disabled)return;button.disabled=true;
 try{if(!await flushAllDrafts())throw Error('Save pending edits first.');const story=storyById(button.dataset.story),parent=story.photoRequests.find(p=>p.id===button.dataset.photoMore),anchor=story.media.find(a=>a.id===effective(story).selectedAssetIds[0])||story.media[0];if(!parent||!anchor)throw Error('Reopen this story before continuing.');button.dataset.requestKey ||= crypto.randomUUID();
 await api('/api/stories/'+encodeURIComponent(story.id)+'/photo-research',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({intent:'alternatives',assetId:anchor.id,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,previewSha256:anchor.localPreview?.sha256||'',idempotencyKey:button.dataset.requestKey,photoSource:parent.source,photoParent:parent.id})});await loadWorkspace({quiet:true});announce('Next page prepared. Review before searching; no source request has started.');
 }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-photo-shortlist],[data-photo-cover]');if(!button||button.disabled)return;button.disabled=true;
 try{if(!await flushAllDrafts())throw Error('Save pending edits first.');const story=storyById(button.dataset.story),asset=story.media.find(a=>a.id===(button.dataset.photoShortlist||button.dataset.photoCover));if(!asset)throw Error('Reopen this photograph.');
 if(button.dataset.photoCover){const ids=effective(story).selectedAssetIds;if(!ids.includes(asset.id))throw Error('Add the photograph before making it the cover.');editDraft(story.id,{selectedAssetIds:[asset.id,...ids.filter(id=>id!==asset.id)]},{rerender:true,immediate:true});await flushDraft(story.id);announce('Cover changed. The previous sequence remains in history.');}
 else{await api('/api/stories/'+encodeURIComponent(story.id)+'/assets/'+encodeURIComponent(asset.id)+'/review',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({expectedVersion:asset.localReview?.version||0,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,previewSha256:asset.localPreview?.sha256||'',decision:'shortlist',reason:'Shortlisted for closer photographic inspection.',basis:'story_potential'})});await loadWorkspace({quiet:true});announce('Shortlisted for this story. Source identity and rights remain separate.');}
 }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});

// Paid photo assessment has a separate private policy. Preparation is unpaid;
// refresh observes one existing operation and never dispatches or retries it.
document.addEventListener('change',event=>{
 const batch=event.target.closest('[data-vision-batch]');
 if(batch){const id=batch.dataset.visionBatch,story=storyById(id),next=story?.photoVision?.eligibleBatches?.find(b=>b.photoRequestId===batch.value);state.visionBatches ||= {};state.visionBatches[id]=batch.value;state.visionAssets ||= {};state.visionAssets[id]=next?.assetIds.slice(0,6)||[];render();return;}
 const checkbox=event.target.closest('[data-vision-asset]');if(!checkbox)return;
 const id=checkbox.dataset.story,story=storyById(id),batches=story?.photoVision?.eligibleBatches||[],selectedBatch=batches.find(b=>b.photoRequestId===state.visionBatches?.[id])||batches[0];
 const previous=state.visionAssets?.[id]||selectedBatch?.assetIds.slice(0,6)||[],chosen=new Set(previous);
 if(checkbox.checked)chosen.add(checkbox.dataset.visionAsset);else chosen.delete(checkbox.dataset.visionAsset);
 if(chosen.size>6){checkbox.checked=false;announce('Choose up to six photographs for one assessment.');return;}
 state.visionAssets ||= {};state.visionAssets[id]=[...chosen];render();
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-vision-action]');if(!button||button.disabled)return;
 const id=button.dataset.story,action=button.dataset.visionAction;if(visionLocks.has(id))return;
 visionLocks.add(id);button.disabled=true;state.visionBusy ||= {};state.visionBusy[id]=true;state.visionErrors ||= {};delete state.visionErrors[id];
 const post=body=>({method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(body)});
 try{
  if(action!=='disable'&&!await flushAllDrafts())throw Error('Save pending edits first.');
  // Refresh after saving: exact caption version and pixel bindings are checked
  // again server-side; an old browser plan cannot authorize changed inputs.
  await loadWorkspace({quiet:true,renderView:false});const story=storyById(id);if(!story)throw Error('Reload this story before continuing.');
  const path='/api/stories/'+encodeURIComponent(id)+'/vision/';
  if(action==='disable'){await api('/api/generation/disable',post({}));await loadWorkspace({quiet:true});announce('Future AI starts disabled. Accepted operations may still finish.');}
  else if(action==='prepare'||action==='reprepare'){
   const batches=story.photoVision?.eligibleBatches||[],batch=batches.find(b=>b.photoRequestId===state.visionBatches?.[id])||batches[0];if(!batch)throw Error('No saved photographs are eligible yet.');
   const chosen=state.visionAssets?.[id]||batch.assetIds.slice(0,6),assetIds=batch.assetIds.filter(a=>chosen.includes(a));if(!assetIds.length||assetIds.length>6)throw Error('Choose one to six saved photographs.');
   const binding=JSON.stringify([id,story.revision,story.localDraft?.version||0,batch.photoRequestId,assetIds]);state.visionKeys ||= {};if(action==='reprepare')delete state.visionKeys[binding];const key=state.visionKeys[binding] ||= crypto.randomUUID();
   const result=await api(path+'prepare',post({assetIds,photoRequestId:batch.photoRequestId,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:key}));
   state.visionProposals ||= {};state.visionProposals[id]=result.proposal;announce('Photo review prepared. No AI has started.');
  }else{
   const proposal=visionProposal(story,state);if(!proposal||proposal.id!==button.dataset.proposal)throw Error('Review the current recorded operation first.');
   if(action==='confirm'){
    if(!proposal.canConfirm)throw Error('This photo review is not ready to confirm.');
    state.visionProposals[id]={...proposal,state:'uncertain',canConfirm:false,message:'Confirmation sent. Waiting for its recorded outcome; do not submit again.'};render();
    const result=await api(path+'confirm',post({proposalId:proposal.id,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,confirm:true}));state.visionProposals[id]=result.proposal;announce('One photo assessment confirmed. Your current edit is preserved.');
   }else if(action==='refresh'){const result=await api(path+'refresh',post({proposalId:proposal.id}));state.visionProposals ||= {};state.visionProposals[id]=result.proposal;}
   await loadWorkspace({quiet:true,renderView:false});
  }
 }catch(error){state.visionErrors[id]=error.message+(action==='confirm'?' Check the recorded result; this operation will not be resent automatically.':'');}
 finally{visionLocks.delete(id);state.visionBusy[id]=false;button.disabled=false;render();}
});
// Poll only operations with a known queued/running state. Ambiguous operations
// wait for an explicit check; no timer may create or confirm a request.
setInterval(async()=>{
 if(document.hidden)return;const current=route();if(current.view!=='story')return;
 const story=storyById(current.id),proposal=story&&visionProposal(story,state);
 if(!proposal||!visionPending(proposal)||proposal.state==='uncertain'||visionLocks.has(story.id))return;
 visionLocks.add(story.id);
 try{await api('/api/stories/'+encodeURIComponent(story.id)+'/vision/refresh',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({proposalId:proposal.id})});await loadWorkspace({quiet:true,renderView:current.tab==='build'||current.tab==='images'||current.tab==='carousel'});}catch{/* The recorded operation is never resent. Manual check remains available. */}finally{visionLocks.delete(story.id);}
},5000);

function mergeStoryDetail(id,detail){
 const current=storyById(id);if(!current)return detail;
 const changes={...(inFlight.get(id)||{}),...(pending.get(id)||{})},prior=current.localDraft;
 Object.assign(current,detail);
 // A gallery progress read may have started before the latest autosave finished.
 // Never roll the editor/version counter back to that older read response.
 const savedAfterRead=prior?.baseRevision===detail.revision&&(prior.version||0)>(detail.localDraft?.version||0);
 if(Object.keys(changes).length||savedAfterRead){const baseRevision=prior?.baseRevision||detail.revision;current.localDraft={...(detail.localDraft||{}),...(prior||{}),...changes,baseRevision,stale:baseRevision!==detail.revision};}
 if(!saving.has(id))versions.set(id,current.localDraft?.version||0);
 return current;
}
async function loadStory(id){
 if(storyReads.has(id))return storyReads.get(id);
 state.storyReadErrors ||= {};delete state.storyReadErrors[id];
 const task=(async()=>{const detail=await api('/api/stories/'+encodeURIComponent(id)),current=mergeStoryDetail(id,detail);
  if(route().id===id)render();return current;
 })();storyReads.set(id,task);try{return await task;}catch(error){state.storyReadErrors[id]=error.message;if(route().id===id)render();throw error;}finally{storyReads.delete(id);}
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-show-selection]')){document.querySelector('.post-in-progress')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
 if(event.target.closest('[data-show-gallery]')){document.querySelector('.gallery-heading')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
 const retry=event.target.closest('[data-load-story]');if(retry){retry.disabled=true;loadStory(retry.dataset.loadStory).catch(error=>toast(error.message,{error:true}));return;}
 const filter=event.target.closest('[data-gallery-filter]');if(filter){state.galleryFilters ||= {};state.galleryFilters[filter.dataset.story]=filter.dataset.galleryFilter;render();return;}
 const more=event.target.closest('[data-gallery-more]');if(more){state.galleryLimits ||= {};state.galleryLimits[more.dataset.galleryMore]=(state.galleryLimits?.[more.dataset.galleryMore]||18)+18;render();return;}
 const open=event.target.closest('[data-curation-open]');if(open){state.curationStory=open.dataset.curationOpen;render();return;}
 if(event.target.closest('[data-curation-close]')){const id=state.curationStory;state.curationStory=null;render();document.querySelector('[data-curation-open="'+CSS.escape(id)+'"]')?.focus();}
});
document.addEventListener('cancel',event=>{if(event.target.id==='curation-dialog')state.curationStory=null;},true);
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-photo-saved-copy],[data-curation-cover]');if(!button||button.disabled)return;button.disabled=true;
 try{
  if(!await flushAllDrafts())throw Error('Save pending edits before changing the slides.');
  const story=storyById(button.dataset.story);if(!story||story.localDraft?.stale)throw Error('Review the source changes before editing this post.');
  const selectedAssetIds=button.dataset.photoSavedCopy?savedCopySelection(story,button.dataset.photoSavedCopy):coverSelection(story,button.dataset.curationCover);
  editDraft(story.id,{selectedAssetIds},{rerender:true,immediate:true});
  if(!await flushDraft(story.id))return;
  announce(button.dataset.photoSavedCopy?'Saved file selected. Your caption and earlier order remain in history.':'Cover selected. Your caption and earlier order remain in history.');
 }catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-refine-improve]');if(!button||button.disabled)return;
 if(!['discovery_opening','alternate_angle','supported_perspective'].includes(button.dataset.refineImprove))return;
 button.disabled=true;
 try{if(!await flushAllDrafts())throw Error('Save your caption before reviewing an AI request.');state.captionDirections ||= {};state.captionDirections[button.dataset.story]=button.dataset.refineImprove;state.captionTools ||= {};state.captionTools[button.dataset.story]='improve';render();document.querySelector('#caption-improvement-direction')?.focus({preventScroll:true});}
 catch(error){toast(error.message,{error:true});}finally{button.disabled=false;}
});

let previewTouch=null;
document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&event.target.closest('.instagram-slide'))previewTouch={x:event.clientX,y:event.clientY};});
document.addEventListener('pointerup',event=>{if(!previewTouch)return;const start=previewTouch;previewTouch=null;if(!rehearsal||!event.target.closest('.instagram-slide'))return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)showRehearsal(storyById(rehearsal.storyId),rehearsal.index+(dx<0?1:-1),rehearsal.fit);});
document.addEventListener('pointercancel',()=>{previewTouch=null;});
document.addEventListener('click',event=>{if(!event.target.closest('.post-options'))for(const menu of document.querySelectorAll('.post-options[open]'))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const menu of document.querySelectorAll('.post-options[open]'))menu.open=false;});
function positionPostMenus(){
 for(const menu of document.querySelectorAll('.post-options[open]')){
  const panel=menu.querySelector('div'),anchor=menu.querySelector('summary').getBoundingClientRect();
  menu.classList.toggle('opens-up',anchor.bottom+panel.offsetHeight>innerHeight-16&&anchor.top>panel.offsetHeight+16);
 }
}
document.addEventListener('toggle',event=>{if(event.target.matches('.post-options')&&event.target.open){for(const other of document.querySelectorAll('.post-options[open]'))if(other!==event.target)other.open=false;requestAnimationFrame(positionPostMenus);}},true);
window.addEventListener('resize',()=>requestAnimationFrame(positionPostMenus));

// Preparation is mechanical; final approval is one explicit exact-post consent.
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-post-inspector]');if(!b)return;
 const story=storyById(b.dataset.story);if(story)openDialog(postInspector(story,b.dataset.postInspector));
});
const completionCalls=new Set();
async function advanceCompletion(id){
 // Only invoked after a founder-confirmed intent, or its explicit Continue action.
 for(let i=0;i<12;i++){
  const r=await api('/api/stories/'+encodeURIComponent(id)+'/post-completion/advance',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});
  if(!r.pending){await loadWorkspace({quiet:true});toast(r.delivery?.message||'Check the recorded Buffer delivery.');return;}
  if(i<11)await new Promise(resolve=>setTimeout(resolve,1800));
 }
 await loadWorkspace({quiet:true});toast('The existing operation is still running. Its confirmation is saved.');
}
async function finishPost(id,checkOnly=false){
 const story=await loadStory(id),binding={sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:crypto.randomUUID()};
 state.completionReviews ||= {};delete state.completionReviews[id];if(state.bufferReviews)delete state.bufferReviews[id];
 openDialog(finishPostDialog(story,{pending:true}));
 let result;
 for(let i=0;i<12;i++){
  result=await api('/api/stories/'+encodeURIComponent(id)+'/post-completion/'+(checkOnly||i?'check':'finish'),{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(checkOnly||i?{}:binding)});
  const current=await loadStory(id);
  if(!document.querySelector('#asset-dialog[open] [data-finish-story="'+CSS.escape(id)+'"]')||route().id!==id)return;
  if(result.state==='ready'){
   const delivery={...result.delivery,finish:true};
   if(delivery.completion)state.completionReviews[id]={...delivery,sourceRevision:result.sourceRevision,workingVersion:result.workingVersion,idempotencyKey:crypto.randomUUID()};
   else{state.bufferReviews ||= {};state.bufferReviews[id]={...delivery,sourceRevision:result.sourceRevision,workingVersion:result.workingVersion};}
   openDialog(bufferConfirmDialog(current,delivery));return;
  }
  if(result.delivery){document.querySelector('#asset-dialog')?.close();await loadWorkspace({quiet:true});toast(result.delivery.message);return;}
  if(!document.querySelector('#asset-dialog')?.open)return; // Closing does not cancel/repeat native work.
  openDialog(finishPostDialog(current,result));
  if(!result.pending)return;
  if(i<11)await new Promise(resolve=>setTimeout(resolve,1800));
 }
 openDialog(finishPostDialog(storyById(id),{issue:{action:'check',message:'Preparation is still running. Its request is saved. Check it later without starting another.'}}));
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-post-completion]');if(!b||b.disabled)return;
 const id=b.dataset.story,action=b.dataset.postCompletion;if(completionCalls.has(id))return;completionCalls.add(id);b.disabled=true;
 try{
  if(!await flushAllDrafts())throw Error('Save your caption and slides first.');
  let story=storyById(id);state.completionReviews ||= {};
  if(action==='concept'){const current=await loadStory(id);await api('/api/stories/'+encodeURIComponent(id)+'/post-completion/concept',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({sourceRevision:current.revision,workingVersion:current.localDraft?.version||0,idempotencyKey:crypto.randomUUID(),confirm:'approve_concept_only'})});await finishPost(id);return;}
  if(action==='finish'||action==='finish-check'){await finishPost(id,action==='finish-check');return;}
  if(action==='advance'){await advanceCompletion(id);return;}
  if(action==='review'){
   delete state.completionReviews[id];if(state.bufferReviews)delete state.bufferReviews[id];
   story=await loadStory(id);
   if(!story.postCompletion?.available&&!story.bufferDraft?.canSend){openDialog(bufferConfirmDialog(story,{...story.bufferDraft,ready:false}));return;}
   const r=await api('/api/stories/'+encodeURIComponent(id)+'/post-completion/review',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:crypto.randomUUID()})});
   if(!r.delivery.ready){openDialog(bufferConfirmDialog(story,r.delivery));return;}
   if(!r.delivery.completion){state.bufferReviews ||= {};state.bufferReviews[id]={...r.delivery,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0};}
   else state.completionReviews[id]={...r.delivery,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:crypto.randomUUID()};
   openDialog(bufferConfirmDialog(story,r.delivery));return;
  }
  if(action==='confirm'){
   const r=state.completionReviews[id];
   if(!r?.finish&&!document.querySelector('[data-final-post-reviewed]')?.checked)throw Error('Confirm that you reviewed the facts, credits and finished post.');
   if(!r)throw Error('Open the final post review first.');
   const input={sourceRevision:r.sourceRevision,workingVersion:r.workingVersion,idempotencyKey:r.idempotencyKey,completionDigest:r.completionDigest,finalPostDigest:r.finalPostDigest,confirm:'approve_and_send_unscheduled_draft'};
   await api('/api/stories/'+encodeURIComponent(id)+'/post-completion/confirm',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(input)});
   document.querySelector('#asset-dialog')?.close();delete state.completionReviews[id];toast('Your final confirmation is saved. Preparing one Buffer draft.');await advanceCompletion(id);
  }
 }catch(error){if((action==='finish'||action==='finish-check'||action==='concept')&&route().id===id&&storyById(id))openDialog(finishPostDialog(storyById(id),{issue:{code:error.code,action:error.code==='CONCEPT_APPROVAL_DISABLED'?'connection':'check',message:error.message}}));else toast(error.message,{error:true});await loadWorkspace({quiet:true}).catch(()=>{});}
 finally{completionCalls.delete(id);b.disabled=false;}
});

// Sending is an explicit founder action. No polling, create retry or timed resend.
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-buffer-action]');if(!button||button.disabled)return;
 const id=button.dataset.story,action=button.dataset.bufferAction,lock='buffer:'+id;
 if(captionRequestLocks.has(lock))return;captionRequestLocks.add(lock);button.disabled=true;
 try{
  if(!await flushAllDrafts())throw Error('Save your caption and slides first.');
  const story=storyById(id);if(!story)throw Error('Open the original post.');
  state.bufferReviews ||= {};state.bufferReviewKeys ||= {};
  const binding=JSON.stringify([id,story.revision,story.localDraft?.version||0]);
  const review=state.bufferReviews[id];
  const input=action==='review'?{sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,idempotencyKey:state.bufferReviewKeys[binding] ||= crypto.randomUUID()}:action==='send'?{sourceRevision:review?.sourceRevision,workingVersion:review?.workingVersion,approvalRequestId:review?.approvalRequestId,reviewDigest:review?.reviewDigest,confirm:'send_unscheduled_buffer_draft'}:{};
  if(action==='send'&&!review?.reviewDigest)throw Error('Review this exact post before confirming.');
  const result=await api('/api/stories/'+encodeURIComponent(id)+'/buffer-draft/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(input)});
  story.bufferDraft=result.delivery;if(result.approvalRequest)story.approvalRequest=result.approvalRequest;
  if(action==='review'&&result.delivery.ready){state.bufferReviews[id]={...result.delivery,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0};openDialog(bufferConfirmDialog(story,result.delivery));}
  else{delete state.bufferReviews[id];if(action==='send')document.querySelector('#asset-dialog')?.close();render();toast(result.delivery.message);}
 }catch(error){
  if(action==='send'||action==='check'){delete state.bufferReviews?.[id];if(action==='send')document.querySelector('#asset-dialog')?.close();const story=storyById(id);if(story)story.bufferDraft=error.delivery||{state:'needs_reconciliation',canSend:false,canCheck:false,message:'Delivery was not confirmed. Do not send again. Check the saved delivery and Buffer before taking another action.'};render();}
  toast(error.message,{error:true});
 }finally{captionRequestLocks.delete(lock);button.disabled=false;}
});

// Each button performs one explicit action; checks only observe the recorded
// execution. Reload/restart never causes an automatic native resubmission.
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-native-review]');if(!b||b.disabled)return;
 const id=b.dataset.story,action=b.dataset.nativeReview,lock='native-review:'+id;
 if(captionRequestLocks.has(lock))return;captionRequestLocks.add(lock);b.disabled=true;
 try{
  if(!await flushAllDrafts())throw Error('Save your caption and slide order first.');
  const story=storyById(id);if(!story)throw Error('Reopen the post.');
  if(action==='review-transfer'||action==='review-approval'){openDialog(nativeReviewDialog(story,action==='review-approval'));return;}
  const common={sourceRevision:story.revision,workingVersion:story.localDraft?.version||0};let input={};
  if(action==='submit'){
   const a=await api('/api/stories/'+encodeURIComponent(id)+'/approval-requests',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify({...common,idempotencyKey:crypto.randomUUID(),confirm:'prepare_review_only'})});
   input={...common,approvalRequestId:a.approvalRequest.id,confirm:'submit_exact_post_for_native_review'};
  }else if(action==='approve'){
   if(!document.querySelector('[data-native-facts]')?.checked||!document.querySelector('[data-native-slides]')?.checked)throw Error('Confirm both the facts and the finished slides before approving.');
   input={...common,idempotencyKey:crypto.randomUUID(),finalPostDigest:story.nativePublishing?.finalPostDigest,confirm:'approve_exact_native_post',factsReviewed:true,slidesReviewed:true};
  }
  const r=await api('/api/stories/'+encodeURIComponent(id)+'/native-review/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(input)});
  document.querySelector('#asset-dialog')?.close();await loadWorkspace({quiet:true});
  if(action==='submit'&&['dispatching','running'].includes(r.operation.state)){
   for(let i=0;i<8;i++){await new Promise(resolve=>setTimeout(resolve,1800));const checked=await api('/api/stories/'+encodeURIComponent(id)+'/native-review/check',{method:'POST',headers:{'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:'{}'});if(!['dispatching','running'].includes(checked.operation.state))break;}
   await loadWorkspace({quiet:true});
  }
  toast(['dispatching','running'].includes(storyById(id)?.nativeReviewTransfer?.state)?'Preparation is still running. Your request is saved.':'Finished post checked.');
 }catch(error){toast(error.message,{error:true});await loadWorkspace({quiet:true}).catch(()=>{});}
 finally{captionRequestLocks.delete(lock);b.disabled=false;}
});

document.addEventListener('click',event=>{
 if(event.target.closest('[data-cancel-replacement]')){state.finishReplacement=null;render();return;}
 const b=event.target.closest('[data-finish-replace]');if(!b)return;
 state.finishReplacement={storyId:b.dataset.story,assetId:b.dataset.finishReplace};state.galleryFilters ||= {};state.galleryFilters[b.dataset.story]='saved';
 document.querySelector('#asset-dialog')?.close();
});

function movePostPreview(id,index){
 const story=storyById(id),slot=document.querySelector('#asset-dialog[open] [data-post-preview-slot]')||document.querySelector('[data-post-preview-slot]');if(!story||!slot)return;
 const count=mediaFor(story).length;state.postSlides ||= {};state.postSlides[id]=Math.max(0,Math.min(count-1,index));
 renderStudio(slot,postPreview(story,state.postSlides[id]));slot.querySelector('[data-post-preview]')?.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-post-step],[data-post-index]');if(button&&!button.disabled){const id=button.dataset.story;movePostPreview(id,button.dataset.postIndex===undefined?(state.postSlides?.[id]||0)+Number(button.dataset.postStep):Number(button.dataset.postIndex));}
 if(event.target.closest('[data-open-review-checks]')){const details=document.querySelector('[data-review-checks]');if(details){details.open=true;details.scrollIntoView({block:'nearest',behavior:'smooth'});}}
});
document.addEventListener('keydown',event=>{const preview=event.target.closest('[data-post-preview]');if(!preview||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();const id=preview.dataset.postPreview;movePostPreview(id,event.key==='Home'?0:event.key==='End'?mediaFor(storyById(id)).length-1:(state.postSlides?.[id]||0)+(event.key==='ArrowRight'?1:-1));});
let inlineSwipe=null;
document.addEventListener('pointerdown',event=>{const preview=event.target.closest('[data-post-preview] .instagram-slide');if(preview&&event.pointerType!=='mouse')inlineSwipe={id:preview.closest('[data-post-preview]').dataset.postPreview,x:event.clientX,y:event.clientY};});
document.addEventListener('pointerup',event=>{const start=inlineSwipe;inlineSwipe=null;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)movePostPreview(start.id,(state.postSlides?.[start.id]||0)+(dx<0?1:-1));});

// Explicit recovery for a completed failed read; never a timed retry or a paid action.
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-photo-recheck]');if(!b||b.disabled)return;const id=b.dataset.photoRecheck,story=storyById(id);
 if(story?.photoRequests?.[0]?.state!=='unavailable')return;
 state.photoRefresh ||= {};state.photoRefresh[id]=true;b.disabled=true;
 try{await discoverStoryPhotos(id,b);}finally{state.photoRefresh[id]=false;b.disabled=false;}
});
