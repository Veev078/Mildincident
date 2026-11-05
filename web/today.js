import {esc,workingStory,stateLabel,storyUrl,nextAction,effective,empty,sectionHeading,image,leadPhoto} from './components.js';
import {proposalReviewState} from './review.js';

export function lastSavedAt(story,reviews={}) {
 const current=proposalReviewState(story,reviews),values=[story.localDraft?.updatedAt,...(!current.stale&&['save','develop'].includes(current.decision)?[current.review?.createdAt]:[])];
 return values.filter(value=>value&&Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
}

export function todaySelection(workspace = {}) {
 const stories=(workspace.stories||[]).filter(s=>!s.organization?.archived&&(!s.recoveryOfStoryId||s.localDraft||workspace.founderReviews?.[s.id]||s.organization?.pinned)).map(workingStory),reviews=workspace.founderReviews||{};
 const decision=s=>proposalReviewState(s,reviews).decision;
 const active=stories.filter(s=>stateLabel(s).group!=='archive'&&decision(s)!=='pass');
 const fresh=active.filter(s=>s.origin==='n8n_development'&&!s.recoveredHistory&&!s.continuationOf&&!s.localDraft&&decision(s)==='reset');
 const continuing=active.filter(s=>['save','develop'].includes(decision(s))||Boolean(s.localDraft)).sort((a,b)=>Number(Boolean(b.organization?.pinned))-Number(Boolean(a.organization?.pinned))||(Date.parse(lastSavedAt(b,reviews))||0)-(Date.parse(lastSavedAt(a,reviews))||0));
 const attention=stories.filter(s=>s.localDraft?.stale||s.publishing?.multipleHandoffs||(stateLabel(s).group!=='archive'&&s.publishing?.requiresReview));
 return {stories,active,fresh,continuing,attention};
}

export function home(state) {
 const {stories,active,fresh,continuing,attention}=todaySelection(state.workspace);
 const priorities=[...attention,...continuing,...active.filter(s=>!fresh.some(f=>f.id===s.id))].filter((s,i,all)=>all.findIndex(other=>other.id===s.id)===i).slice(0,3);
 const ideas=fresh.filter(s=>!priorities.some(p=>p.id===s.id)).slice(0,2);
 const card=(story,idea=false)=>{
  const current=effective(story),action=nextAction(story),remembered=state.lastStoryTabs?.[story.id],resume=!story.localDraft?.stale&&story.localDraft&&['caption','overview','images','carousel'].includes(remembered);
  const tab=idea?'overview':resume?remembered:action.tab;
  const label=idea?'Develop story':resume?'Continue editing':action.label;
  return `<article class="today-focus-card" data-today-story="${esc(story.id)}"><div class="today-focus-photo">${image(leadPhoto(story),{compact:true})}</div><div class="today-focus-copy"><p class="eyebrow">${esc(idea?'Idea to select':story.localDraft?.stale?'Source changed':stateLabel(story).label)}</p><h2>${esc(current.title)}</h2><p class="small">${esc(current.hook||story.subject||'Review the recorded story and its sources.')}</p><a class="button ${idea?'button-light':'button-dark'}" href="${storyUrl(story.id,tab)}">${esc(label)} →</a></div></article>`;
 };
 return `<section class="today-intro"><div><p class="eyebrow">Your editorial desk</p><h1>What should we work on next?</h1></div><a class="button button-light" href="#/discover" data-discovery-entry="surprise">Discover stories →</a></section>
 <section class="today-section">${sectionHeading(continuing.length?'Continue working':'On your desk','Choose one story to move forward.','<a class="text-link" href="#/stories">All stories →</a>')}${priorities.length?`<div class="today-focus-list">${priorities.map(s=>card(s)).join('')}</div>`:empty('Your desk is clear',stories.length?'Choose an idea below or browse your stories.':'No stories have been returned by the connected source.')}</section>
 ${ideas.length?`<section class="today-section">${sectionHeading('Ideas to select',fresh.length+' new '+(fresh.length===1?'proposal':'proposals')+' awaiting your judgment.','<a class="text-link" href="#/discover">All ideas →</a>')}<div class="today-idea-list">${ideas.map(s=>card(s,true)).join('')}</div></section>`:''}`;
}
