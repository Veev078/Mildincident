import {storyPhotoIdentity,photoFileKeys,photoRelevance} from './story-intelligence.js';
import {PROJECT_PAGE_HOSTS,projectPageReferences} from './project-sources.js';
import {createHash} from 'node:crypto';

const sameIdentity=(a,b)=>a&&b&&['subject','photographer','series'].every(k=>(a[k]||'')===(b[k]||''));
const eligible=(photo,identity,direction)=>{const c=photoRelevance({...photo,sourceCaption:photo.description,photoExplorationDirection:direction},identity).category;return c==='direct'||direction==='context'&&c==='context';};
/** Derived only from immutable receipts. Source reads, extraction and file acquisition
 * have independent progress: changing a direction does not require rereading HTML. */
export function sourceProgression(story,requests,{direction='best',custom='',now=Date.now(),hasPreview=a=>Boolean(a.localPreview)}={}){
 const identity=storyPhotoIdentity(story),groups=new Map(),states=[],reuse=[],suppressed=new Set();
 const current=requests.filter(p=>p.packet?.payload?.target?.sourceRevision===story.revision&&sameIdentity(p.plan?.identity,identity));
 for(const p of current){
  for(const a of p.imageAttempts||[])if(['unavailable','interrupted','fetching','unsupported_host','exact_duplicate'].includes(a.status)&&suppressed.size<120)suppressed.add(a.imageUrl);
  for(const c of (p.sourceCaptures?.length?p.sourceCaptures:[p.sourceCapture])){
   if(!c?.networkFetched||c.basis!=='fetched_project_page'||!sameIdentity(c.identity,identity))continue;
   if(!Number.isFinite(Date.parse(c.capturedAt)))continue;
   if(!groups.has(c.url))groups.set(c.url,{capture:c,request:p,windows:[]});
   const g=groups.get(c.url);if(c.sha256===g.capture.sha256&&p.plan.direction===direction&&(p.plan.custom||'')===custom)g.windows.push(c);
  }
 }
 for(const [url,g]of groups){
  const c=g.capture;
  if(typeof c.html!=='string'||createHash('sha256').update(c.html).digest('hex')!==c.sha256){states.push({url,state:'evidence_needs_review',requestId:g.request.id});continue;}
  const first=projectPageReferences(story,{url,html:c.html,direction}),coverage=first.sourceCapture.coverage||{};
  const total=coverage.referenceCount||0,ranges=[];
  for(const w of g.windows){
   if(typeof w.html!=='string'||createHash('sha256').update(w.html).digest('hex')!==c.sha256)continue;
   const start=w.coverage?.extractionOffset??0;
   if(!Number.isInteger(start)||start<0||start%40!==0||start>=total)continue;
   if(start){
    if(w.parserVersion!==first.sourceCapture.parserVersion||w.extractionInputCursor?.offset!==start)continue;
    try{const checked=projectPageReferences(story,{url,html:c.html,direction,cursor:w.extractionInputCursor});ranges.push({start,end:checked.sourceCapture.coverage.retainedThrough});}catch{continue;}
   }else if(Number.isInteger(w.coverage?.retainedCount)&&w.coverage.retainedCount>=Math.min(40,total))ranges.push({start:0,end:Math.min(40,total)});
  }
  ranges.sort((a,b)=>a.start-b.start);let through=0;for(const r of ranges)if(r.start<=through)through=Math.max(through,r.end);
  // New parser/context starts from zero; legacy first-window receipts still allow
  // the verified remainder to be examined without changing their old evidence.
  const nextOffset=through<total?through:null;
  const cursorFor=offset=>offset?{...first.sourceCapture.extractionCursor,offset}:null;
  let candidate=null,unseen=0,pending=0;
  const offsets=[...new Set([0,...ranges.map(r=>r.start)])];
  for(const offset of offsets){
   const parsed=offset?projectPageReferences(story,{url,html:c.html,direction,cursor:cursorFor(offset)}):first;
   let needs=false;
   for(const photo of parsed.photos.filter(a=>eligible(a,identity,direction))){
    if(suppressed.has(photo.previewUrl))continue;
    const keys=photoFileKeys(photo),asset=(story.media||[]).find(a=>photoFileKeys(a).some(k=>keys.includes(k)));
    if(!asset){unseen++;needs=true;}else if(!hasPreview(asset)){pending++;needs=true;}
   }
   if(needs&&!candidate)candidate={requestId:g.request.id,url,sha256:c.sha256,cursor:offset?cursorFor(offset):null,reason:'pending_images'};
  }
  if(nextOffset!==null)candidate={requestId:g.request.id,url,sha256:c.sha256,cursor:cursorFor(nextOffset),reason:through?'continue_scan':'unseen_references'};
  const bounded=coverage.pageTruncated===true||coverage.imageTagsFound!==coverage.imageTagsConsidered;
  const state=nextOffset!==null?'scan_remaining':unseen?'available_references':pending?'images_pending':bounded?'bounded_scan_no_additions':'checked_no_additions';
  if(!candidate&&now-Date.parse(c.capturedAt)>86400000)continue;
  states.push({url,state,requestId:g.request.id,captureSha256:c.sha256,checkedAt:c.capturedAt,completeScan:nextOffset===null&&!bounded,pendingImages:pending,unseenReferences:unseen,scanOffset:through,nextOffset,remainingReferences:Math.max(0,total-through),referenceCount:total});
  if(candidate)reuse.push(candidate);
 }
 for(const p of current)for(const a of p.sourceAttempts||[]){if(states.some(s=>s.url===a.url)||a.status!=='failed'||!Number.isFinite(Date.parse(p.startedAt)))continue;const denied=/^SOURCE_HTTP_(401|403|404|410)$/.test(a.errorCode||'');if(denied&&now-Date.parse(p.startedAt)>86400000)continue;states.push({url:a.url,state:denied?'source_unavailable':'outcome_unconfirmed',errorCode:a.errorCode,requestId:p.id});}
 return {version:2,states,reuse:reuse.slice(0,1),suppressedImageUrls:[...suppressed],projectExhausted:false};
}

/** Finish retained material before spending another source read. */
export function advancePhotoPlan(plan,progression,{refreshSources=false}={}){
 if(plan.source!=='project'||plan.route==='source_assisted')return plan;
 const state=new Map(progression.states.map(s=>[s.url,s])),all=plan.sourceCandidates.filter(url=>PROJECT_PAGE_HOSTS.includes(new URL(url).hostname));
 const remaining=refreshSources?all:all.filter(url=>!state.has(url)),reuse=refreshSources?[]:progression.reuse,hasNext=remaining.length>0;
 return {...plan,sourcePolicy:'source_progression_v1',sourceCandidates:remaining,sourceUrl:reuse[0]?.url||(hasNext?remaining[0]:plan.sourceUrl),route:reuse.length?'cached_project_evidence':hasNext?'retained_project_page':'sources_checked',sourceCalls:reuse.length?0:hasNext?2:0,sourceProgression:{...progression,reuse,suppressedImageUrls:refreshSources?[]:progression.suppressedImageUrls,refreshSources},reason:reuse.length?reuse[0].reason==='continue_scan'?'Continue the remaining saved page without reading it again.':'Finish useful image files from saved source evidence.':hasNext?'Check the next recorded project sources; previously checked sources stay in history.':'These sources have no further supported additions at present. Other project sources may still exist.'};
}
