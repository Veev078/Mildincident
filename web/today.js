import {esc,date,workingStory,stateLabel,storyCard,storyUrl,nextAction,effective,empty,sectionHeading,image,leadPhoto} from './components.js';
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
 const attention=stories.filter(s=>s.localDraft?.stale||s.publishing?.multipleHandoffs||(stateLabel(s).group!=='archive'&&s.publishing?.requiresReview));
 return {stories,active,fresh,continuing,attention};
}

export function home(state) {
 const {stories,active,fresh,continuing,attention}=todaySelection(state.workspace);
 const reviewCards=fresh.slice(0,3);
 const desk=(continuing.length?continuing:active).filter(s=>!reviewCards.some(r=>r.id===s.id)).slice(0,3);
 const decisions=[...attention,...active.filter(s=>s.productionDecisions?.length)].filter((s,i,all)=>all.findIndex(item=>item.id===s.id)===i).slice(0,3);
 const card=story=>storyCard(story,{compact:true,...(continuing.length?{continueTab:state.lastStoryTabs?.[story.id],savedAt:lastSavedAt(story,state.workspace.founderReviews)}:{})});
 return `<section class="today-intro"><div><p class="eyebrow">Your editorial desk</p><h1>The next edit.</h1><p class="intro-deck">Photographs to consider. Stories to make your own.</p></div><a class="button button-dark" href="#/discover">Find your next story →</a></section>
 ${fresh.length?`<section class="today-section founder-inbox">${sectionHeading('Needs your eye',`${fresh.length} new ${fresh.length===1?'proposal':'proposals'} awaiting your judgment.`,'<a class="text-link" href="#/discover">Review ideas →</a>')}<div class="today-story-grid">${reviewCards.map(s=>storyCard(s,{compact:true})).join('')}</div></section>`:`<div class="today-quiet-inbox"><span><strong>No new ideas yet.</strong> ${stories.length?'Continue your existing work below.':'Save a research direction in Discover; saving alone does not start research.'}</span><a class="text-link" href="#/discover">Open Discover →</a></div>`}
 <section class="today-section">${sectionHeading(continuing.length?'Continue working':'On your desk',continuing.length?'Your most recent private saves and editorial decisions.':'Existing work, ready for a closer look.','<a class="text-link" href="#/stories">All stories →</a>')}
 ${desk.length?`<div class="today-editorial-lead">${card(desk[0])}${desk.length>1?`<div class="today-desk-rest">${desk.slice(1).map(card).join('')}</div>`:''}</div>`:empty('Your desk is clear',stories.length?'Browse your stories or review a new idea above.':'No stories have been returned by the connected source.','<a class="text-link" href="#/stories">Open Stories →</a>')}</section>
 ${decisions.length?`<section class="today-section today-decisions">${sectionHeading('Decisions to make','One next step for each story.')}<ul class="today-attention-list">${decisions.map(story=>{
  const action=nextAction(story),decision=story.productionDecisions?.find(d=>d.key==='handoff')||story.productionDecisions?.[0];
  const tab=story.localDraft?.stale?'overview':decision?.tab||action.tab;
  const title=story.localDraft?.stale?'Source changed — compare your saved edits.':decision?.title||action.reason;
  return `<li><a href="${storyUrl(story.id,tab)}" aria-label="Review ${esc(story.title)}">${image(leadPhoto(story),{compact:true})}</a><div><a href="${storyUrl(story.id,tab)}"><strong>${esc(effective(story).title)}</strong></a><span>${esc(title)}</span></div><a class="text-link" href="${storyUrl(story.id,tab)}">${story.localDraft?.stale?'Compare changes':decision?.key==='handoff'?'Review existing activity':'Continue review'} →</a></li>`;
 }).join('')}</ul></section>`:''}
 ${(state.workspace.activity||[]).length?`<details class="today-activity"><summary>Recent activity</summary><ol class="activity-list">${state.workspace.activity.slice(0,5).map(item=>`<li><div>${item.storyId?`<a href="${storyUrl(item.storyId)}">${esc(item.summary)}</a>`:`<strong>${esc(item.summary)}</strong>`}<small>${esc(date(item.at))} ET</small></div></li>`).join('')}</ol></details>`:''}`;
}
