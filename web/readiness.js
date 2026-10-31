import {effective} from './components.js';

const requirements=[
 ['revision','Source changes','overview',/STALE_LOCAL|LOCAL_REVISION|SOURCE_REVISION/],
 ['handoff','Existing publishing activity','publishing',/HANDOFF_RECONCILIATION|UNRESOLVED_PROVIDER|MULTIPLE_HANDOFF|UNRESOLVED_BUFFER|PROVIDER_SNAPSHOT/],
 ['rights','Photograph permissions','images',/RIGHTS|PERMISSION/],
 ['facts','Facts and attribution','research',/CLAIMS|FACT/],
 ['caption','Caption and final approval','caption',/CAPTION|FINAL_APPROVAL|INTERNAL_TEST|LOCAL_CHANGES/],
 ['sequence','Image selection and sequence','images',/SELECTED|SEQUENCE|FORMAT|MEDIA/],
 ['files','Production files','publishing',/FILE|RENDER|EXPORT|PREFLIGHT/],
 ['package','Native production record','publishing',/PACKAGE|HANDOFF_VERSION|CURRENT_HANDOFF|EDITORIAL_HANDOFF/],
 ['source','Current source records','publishing',/SOURCE_SNAPSHOT|COVERAGE/],
];
const keyForDecision={permissions:'rights',claims:'facts',caption:'caption',sequence:'sequence',handoff:'handoff'};

/** A presentation of existing evidence, never an authorization or a new readiness gate. */
export function productionSummary(story){
 const current=effective(story),assets=story.media||[],selected=current.selectedAssetIds||[];
 const prepared=[];
 if(selected.length)prepared.push(`${selected.length} photograph${selected.length===1?'':'s'} selected`);
 if(current.caption?.trim())prepared.push('Working caption saved');
 if((story.research||[]).length)prepared.push(`${story.research.length} source reference${story.research.length===1?'':'s'}`);
 const codes=[...new Set([...(story.blockers||[]),...(story.production?.blockers||[]),...(story.productionPreparation?.blockers||[])].map(b=>typeof b==='string'?b:b.code||b.message).filter(Boolean))];
 const grouped=new Map();
 const add=(key,title,tab,code,decision)=>{
  if(!grouped.has(key))grouped.set(key,{key,title,tab,codes:[],decisions:[]});
  const group=grouped.get(key);if(code&&!group.codes.includes(code))group.codes.push(code);if(decision&&!group.decisions.some(d=>d.key===decision.key))group.decisions.push(decision);
 };
 for(const code of codes){const match=requirements.find(([, , , pattern])=>pattern.test(code));add(match?.[0]||'other',match?.[1]||'Additional production checks',match?.[2]||'publishing',code);}
 for(const decision of story.productionDecisions||[]){const key=keyForDecision[decision.key]||decision.key;const definition=requirements.find(r=>r[0]===key);add(key,definition?.[1]||decision.title,decision.tab,null,decision);}
 if(story.localDraft?.stale)add('revision','Source changes','overview','STALE_LOCAL_REVISION');
 const observed=story.publishing||{};
 if(observed.requiresReview||observed.multipleHandoffs)add('handoff','Existing publishing activity','publishing',null);
 // An empty code list does not prove permission, factual approval or publishing authority.
 const factRecorded=story.production?.package?.sourceClaimsReviewed===true;
 const selectedKnown=selected.length>0&&selected.every(id=>assets.some(a=>a.id===id));
 const rightsRecorded=selectedKnown&&selected.every(id=>{const a=assets.find(a=>a.id===id);return a.rightsStatus==='cleared'||a.nativeRightsReview?.kind==='recorded_human_clearance';})&&story.production?.package?.rightsStatus==='reviewed';
 const approvalRecorded=story.production?.package?.finalApprovalStatus==='approved'&&Boolean(story.production?.package?.finalCaption)&&story.production.package.finalCaption===current.caption;
 const requirementsState=[{key:'facts',label:'Factual review',recorded:factRecorded},{key:'rights',label:'Image permissions',recorded:rightsRecorded},{key:'approval',label:'Final native approval',recorded:approvalRecorded}];
 const groups=[...grouped.values()].sort((a,b)=>((a.key==='revision'?0:a.key==='handoff'?1:2)-(b.key==='revision'?0:b.key==='handoff'?1:2)));
 const next=groups[0];
 return {prepared,codes,groups,requirements:requirementsState,next,publicationApproved:false,productionApplied:false};
}
