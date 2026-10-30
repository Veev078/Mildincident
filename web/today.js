import {esc, date, workingStory, stateLabel, storyCard, storyUrl, nextAction, effective, empty, sectionHeading} from './components.js';
import {proposalReviewState} from './review.js';

export function lastSavedAt(story,reviews={}) {
 const current=proposalReviewState(story,reviews),values=[story.localDraft?.updatedAt,...(!current.stale&&['save','develop'].includes(current.decision)?[current.review?.createdAt]:[])];
 return values.filter(value=>value&&Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
}

export function todaySelection(workspace = {}) {
  const stories=(workspace.stories||[]).map(workingStory),reviews=workspace.founderReviews||{};
  const decision=s=>proposalReviewState(s,reviews).decision;
  const active=stories.filter(s=>stateLabel(s).group!=='archive'&&decision(s)!=='pass');
  const fresh=active.filter(s=>s.origin==='n8n_development'&&!s.recoveredHistory&&!s.continuationOf&&decision(s)==='reset');
  const continuing=active.filter(s=>['save','develop'].includes(decision(s))||Boolean(s.localDraft)).sort((a,b)=>(Date.parse(lastSavedAt(b,reviews))||0)-(Date.parse(lastSavedAt(a,reviews))||0));
  const attention=active.filter(s=>s.localDraft?.stale||s.publishing?.requiresReview||s.publishing?.multipleHandoffs);
  return {stories,active,fresh,continuing,attention};
}

export function home(state) {
  const {stories,active,fresh,continuing,attention}=todaySelection(state.workspace);
  const reviewCards=fresh.slice(0,3);
  const desk=(continuing.length?continuing:active).filter(s=>!reviewCards.some(r=>r.id===s.id)).slice(0,4);
  const reviewSteps=active.filter(s=>s.productionDecisions?.length&&!attention.some(a=>a.id===s.id)).slice(0,3);
  return `<section class="today-intro"><div><p class="eyebrow">Your editorial desk</p><h1>The next edit.</h1><p class="intro-deck">Photographs to consider. Stories to make your own.</p></div><a class="button button-dark" href="#/discover">Find your next story →</a></section>
  <section class="today-section founder-inbox">${sectionHeading('Needs your eye',fresh.length?`${fresh.length} new ${fresh.length===1?'proposal':'proposals'} awaiting your judgment.`:'',fresh.length?'<a class="text-link" href="#/discover">Review ideas →</a>':'')}
  ${fresh.length?`<div class="today-story-grid">${reviewCards.map(s=>storyCard(s,{compact:true})).join('')}</div>`:`<div class="today-empty"><p><strong>No new ideas yet.</strong> ${stories.length?'Your existing stories are ready below.':'Save a research direction to begin.'}</p><a class="text-link" href="#/discover">Save a research direction →</a></div>`}
  ${attention.length?`<ul class="today-attention-list">${attention.slice(0,3).map(s=>`<li><div><a href="${storyUrl(s.id,nextAction(s).tab)}"><strong>${esc(s.title)}</strong></a><span>${s.localDraft?.stale?'Source changed — compare your saved edits.':'Existing publishing activity needs checking.'}</span></div><a class="text-link" href="${storyUrl(s.id,nextAction(s).tab)}">${esc(nextAction(s).label)} →</a></li>`).join('')}</ul>`:''}</section>
  <section class="today-section">${sectionHeading(continuing.length?'Continue working':'On your desk',continuing.length?'Your latest private saves and editorial decisions.':'Existing stories, ready to pick up.','<a class="text-link" href="#/stories">All stories →</a>')}
  <div class="today-story-grid">${desk.map(s=>storyCard(s,{compact:true,...(continuing.length?{continueTab:state.lastStoryTabs?.[s.id],savedAt:lastSavedAt(s,state.workspace.founderReviews)}:{})})).join('')||empty('Your desk is clear',stories.length?'Browse your stories or review a new idea above.':'No stories have been returned by the connected source.','<a class="text-link" href="#/stories">Open Stories →</a>')}</div></section>
  ${reviewSteps.length?`<section class="today-section">${sectionHeading('Next review','A specific decision to move each story forward.')}<ul class="today-attention-list">${reviewSteps.map(s=>{const d=s.productionDecisions[0];return `<li><div><a href="${storyUrl(s.id,d.tab)}"><strong>${esc(effective(s).title)}</strong></a><span>${esc(d.title)}</span></div><a class="text-link" href="${storyUrl(s.id,d.tab)}">Continue →</a></li>`;}).join('')}</ul></section>`:''}
  ${(state.workspace.activity||[]).length?`<details class="today-activity"><summary>Recent activity</summary><ol class="activity-list">${state.workspace.activity.slice(0,5).map(item=>`<li><div>${item.storyId?`<a href="${storyUrl(item.storyId)}">${esc(item.summary)}</a>`:`<strong>${esc(item.summary)}</strong>`}<small>${esc(date(item.at))} ET</small></div></li>`).join('')}</ol></details>`:''}`;
}
