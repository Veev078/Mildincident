import {storyPhotoIdentity,photoFileKeys,photoRelevance} from './story-intelligence.js';
import {PROJECT_PAGE_HOSTS,projectPageReferences} from './project-sources.js';
import {createHash} from 'node:crypto';

const sameIdentity=(a,b)=>a&&b&&['subject','photographer','series'].every(k=>(a[k]||'')===(b[k]||''));
const complete=c=>Boolean(c&&c.pageTruncated===false&&Number.isInteger(c.referenceCount)&&c.retainedCount===c.referenceCount&&c.imageTagsFound===c.imageTagsConsidered);
/** Derive source memory from existing immutable receipts; never re-fetch or mutate them. */
export function sourceProgression(story,requests,{direction='best',custom='',now=Date.now(),hasPreview=a=>Boolean(a.localPreview)}={}){
 const identity=storyPhotoIdentity(story),states=new Map(),reuse=[];
 for(const p of requests){
  if(p.packet?.payload?.target?.sourceRevision!==story.revision||!sameIdentity(p.plan?.identity,identity)||p.plan.direction!==direction||(p.plan.custom||'')!==custom)continue;
  for(const c of (p.sourceCaptures?.length?p.sourceCaptures:[p.sourceCapture])){
   if(!c?.networkFetched||c.basis!=='fetched_project_page'||!sameIdentity(c.identity,identity)||states.has(c.url))continue;
   if(!Number.isFinite(Date.parse(c.capturedAt))||now-Date.parse(c.capturedAt)>86400000)continue;
   if(typeof c.html!=='string'||createHash('sha256').update(c.html).digest('hex')!==c.sha256){states.set(c.url,{url:c.url,state:'evidence_needs_review',requestId:p.id});continue;}
   const photos=projectPageReferences(story,{url:c.url,html:c.html,direction}).photos.filter(a=>photoRelevance({...a,sourceCaption:a.description,photoExplorationDirection:direction},identity).category==='direct');
   let unseen=0,pending=0;
   for(const photo of photos){const keys=photoFileKeys(photo),asset=(story.media||[]).find(a=>photoFileKeys(a).some(k=>keys.includes(k)));if(!asset)unseen++;else if(!hasPreview(asset))pending++;}
   const state=unseen?'available_references':pending?'images_pending':complete(c.coverage)?'checked_no_additions':'bounded_scan_no_additions';
   const entry={url:c.url,state,requestId:p.id,captureSha256:c.sha256,checkedAt:c.capturedAt,completeScan:complete(c.coverage),pendingImages:pending,unseenReferences:unseen};states.set(c.url,entry);
   if((pending||unseen)&&reuse.length<2)reuse.push({requestId:p.id,url:c.url,sha256:c.sha256});
  }
  for(const a of p.sourceAttempts||[]){if(states.has(a.url)||a.status!=='failed'||!Number.isFinite(Date.parse(p.startedAt))||now-Date.parse(p.startedAt)>86400000)continue;states.set(a.url,{url:a.url,state:/^SOURCE_HTTP_(401|403|404|410)$/.test(a.errorCode||'')?'source_unavailable':'outcome_unconfirmed',errorCode:a.errorCode,requestId:p.id});}
 }
 return {version:1,states:[...states.values()],reuse,projectExhausted:false};
}

/** Prefer an unvisited exact source. A bounded scan/denial never exhausts a project. */
export function advancePhotoPlan(plan,progression,{refreshSources=false}={}){
 if(plan.source!=='project'||plan.route==='source_assisted')return plan;
 const state=new Map(progression.states.map(s=>[s.url,s])),all=plan.sourceCandidates.filter(url=>PROJECT_PAGE_HOSTS.includes(new URL(url).hostname));
 const remaining=refreshSources?all:all.filter(url=>!state.has(url));
 const hasNext=remaining.length>0,reuse=refreshSources?[]:progression.reuse;
 return {...plan,sourcePolicy:'source_progression_v1',sourceCandidates:remaining,sourceUrl:hasNext?remaining[0]:reuse[0]?.url||plan.sourceUrl,route:hasNext?'retained_project_page':reuse.length?'cached_project_evidence':'sources_checked',sourceCalls:hasNext?2:0,sourceProgression:{...progression,reuse,refreshSources},reason:hasNext?'Check the next recorded project sources; previously checked sources stay in history.':reuse.length?'Use captured source evidence to acquire remaining image files without reading the page again.':'These recorded sources were checked recently. No page will be repeated; the project may have other sources.'};
}
