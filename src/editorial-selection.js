/** Serializable editorial triage. Completeness and source support are not objective taste scores. */
export function editorialSelectionTools(){
 const clean=v=>typeof v==='string'?v.trim():'';
 const normal=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const words=v=>new Set(normal(v).split(' ').filter(w=>w.length>=4&&!['photograph','photography','portrait','image','photo','source','archive','beautiful','strong','visually','iconic','subject','cultural','story','original','about','with','from','this','that','their','there','which'].includes(w)));
 const meaningful=v=>words(v).size>1;
 const caseOf=c=>c.editorialCase||c.editorial_case||{};
 function assess(c,{phase='research',feedback=[],photos=[],sources=[]}={}){
  const reasons=[];const add=(code,message)=>reasons.push({code,message});const ec=caseOf(c);
  const rejection=feedback.find(f=>f.reviewer==='founder'&&f.basis==='editorial_taste'&&f.decision==='rejected'&&normal(f.subject)===normal(c.subject));
  if(rejection)add('FOUNDER_TASTE_PASS','Founder declined this specific editorial selection. Preserve its research; this is not a factual or attractiveness finding.');
  if(['hold','reject'].includes(ec.recommendation))add('RESEARCH_EDITOR_DISPOSITION',clean(ec.comparison_reason)||'The research response holds this lead on editorial grounds; do not spend drafting tokens to rescue it.');
  if(c.prechecks_passed===false)add('RESEARCH_PRECHECK_FAILED','Existing duplicate/source prechecks did not pass.');
  const text=[c.subject,c.hook_fact,c.why_interesting,c.visual?.notes].filter(Boolean).join(' ');
  const puzzle=ec.primary_appeal==='identification_puzzle'||/mystery photo|identification (?:puzzle|story)|unidentified.{0,70}(?:actress|face|portrait)|recognition and misrecognition/i.test(text);
  const fields=['cultural_payoff','visual_detail','image_story_connection','preset_connection','familiarity_risk'];
  const missing=fields.filter(key=>!meaningful(ec[key]));if(missing.length)add('EDITORIAL_CASE_INCOMPLETE','Supply a specific cultural payoff, visual detail, image/story connection, preset fit and familiarity check; adjectives or an archive name are insufficient.');
  const indices=Array.isArray(ec.supporting_claim_indices)?[...new Set(ec.supporting_claim_indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<(c.claims||[]).length):[];
  if(!indices.length)add('UNANCHORED_CULTURAL_CASE','The cultural payoff must cite actual claim indices, not an invented dramatic explanation.');
  const supporting=indices.map(i=>c.claims[i]);
  if(puzzle&&(!supporting.length||supporting.every(claim=>/identif|unidentified|mystery|name.*(?:woman|actress|face)|woman.*name/i.test(claim.claim||''))))add('IDENTIFICATION_WITHOUT_INDEPENDENT_PAYOFF','An identification puzzle alone does not establish cultural or photographic payoff. An archival puzzle can qualify when a separate, evidenced cultural story and specific visual material warrant it.');
  let visualSupport='not_checked';
  if(phase==='sources'){
   if(indices.some(i=>!sources.some(s=>s.claimIndex===i&&s.access==='source_text_captured')))add('CULTURAL_SOURCE_SUPPORT_OPEN','A source passage for the claims carrying the editorial case is unavailable.');
   const related=photos.filter(p=>(p.source_relation||p.relation)==='subject_caption_match');const detail=words(ec.visual_detail);
   const matching=related.some(p=>{const caption=words((p.source_caption||p.caption||'').replace(/©[\s\S]*$/,''));return [...detail].filter(w=>caption.has(w)).length>=2;});
   visualSupport=matching?'caption_detail_correspondence':'not_established';
   if(!matching)add('VISUAL_CASE_UNSUPPORTED','Source captions do not yet substantiate the proposed visual detail. A valid URL, recognized institution or self-described beautiful portrait cannot establish visual strength.');
  }
  const decision=rejection||c.prechecks_passed===false||ec.recommendation==='reject'?'reject':reasons.length?'hold':'advance';
  const rationale=decision==='advance'?[{code:phase==='sources'?'SOURCE_LED_CASE_READY_FOR_DRAFT':'CASE_READY_FOR_SOURCE_REVIEW',message:phase==='sources'?'The cultural case has captured claim sources and its specific visual detail corresponds to source captions. Advance provisionally to drafting for human review; aesthetic quality remains unverified.':'A specific cultural/visual case and claim references are supplied. Advance only to source review; this is still a model proposal.'}]:[];
  return {decision,reasons,rationale,basis:phase==='sources'?'source_text_and_caption_correspondence':'model_case_completeness_only',visualSupport,pixelInspectionPerformed:false,tasteVerified:false,rightsGranted:false,primaryAppeal:clean(ec.primary_appeal)||'unexplained'};
 }
 function select(candidates,context={}){
  const bounded=candidates.slice(0,3);const considered=bounded.map((candidate,index)=>({candidate,index,review:assess(candidate,context)}));const priority={advance:0,hold:1,reject:2};
  const counts=new Map();for(const territory of context.recentTerritories||[])counts.set(territory,(counts.get(territory)||0)+1);
  const ordered=[...considered].sort((a,b)=>priority[a.review.decision]-priority[b.review.decision]||(a.review.decision==='advance'&&b.review.decision==='advance'?Number(caseOf(b.candidate).recommendation==='preferred'&&meaningful(caseOf(b.candidate).comparison_reason))-Number(caseOf(a.candidate).recommendation==='preferred'&&meaningful(caseOf(a.candidate).comparison_reason)):0)||(a.review.decision==='advance'&&b.review.decision==='advance'?(counts.get(a.candidate.territory)||0)-(counts.get(b.candidate.territory)||0):0)||a.index-b.index);
  const selected=ordered[0];if(!selected)return null;
  return {candidate:selected.candidate,review:selected.review,comparison:considered.map(item=>({subject:clean(item.candidate.subject).slice(0,300),territory:clean(item.candidate.territory).slice(0,100),decision:item.review.decision,reasons:item.review.reasons,selected:item.index===selected.index})),orderingBasis:'source_case_eligibility_then_reasoned_preference_then_territory_diversity_not_popularity',alternativesVerified:false};
 }
 function responseCandidates(response){const msg=(response.output||[]).find(o=>o.type==='message');const content=msg?.content?.find(c=>c.type==='output_text')?.text;try{const parsed=typeof content==='string'?JSON.parse(content.replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim()):content;return Array.isArray(parsed?.candidates)?parsed.candidates.slice(0,3):[];}catch{return [];}}
 return {assess,select,responseCandidates};
}
export const assessEditorialSelection=(candidate,context)=>editorialSelectionTools().assess(candidate,context);
