/** Human decisions from current native records and saved local work. No rights/fact inference. */
export function productionDecisions(story){
 const working={...story,...(story.localDraft||{})},pkg=story.production?.package;
 const selected=working.selectedAssetIds||[];const assets=selected.map(id=>story.media.find(m=>m.id===id));const decisions=[];
 const add=(key,title,detail,tab,evidence=[])=>decisions.push({key,title,detail,tab,evidence});
 const pending=assets.filter(a=>!a||a.rightsStatus!=='cleared');
 if(pending.length)add('permissions','Resolve selected-photograph permissions',`${pending.length} selected photograph(s) lack native clearance. Identify the rightsholder, obtain permission or a documented reusable license, then record the evidence in n8n. Source metadata and private previews do not grant rights.`,'images',pending.map(a=>({assetId:a?.id||'missing',creator:a?.creator||'Photographer not recorded',url:a?.sourceUrl||'',status:a?.rightsStatus||'missing'})));
 if(!selected.length||selected.length!==working.targetSlideCount)add('sequence','Curate the actual image sequence',`${selected.length} selected of ${working.targetSlideCount||'unknown'} intended frames. Inspect actual photographs; choose a coherent order or intentionally change the format. Do not pad with unrelated images.`,'carousel');
 if(!pkg?.sourceClaimsReviewed)add('claims','Review the cited claims in the native package','Confirm each publishable claim against its source, record uncertainties and attribution, then save the native fact-review decision. AI verified_fact labels are not human fact checks.','research',(story.research||[]).map(c=>({claim:c.claim,url:c.url||''})));
 if(!pkg?.finalCaption)add('caption','Prepare the native final caption','The native package has no final caption. Complete working copy, credits and claim review, then use the existing native final-approval process.','caption');
 else if(pkg.finalCaption!==working.caption||pkg.finalApprovalStatus!=='approved')add('caption','Reconcile working copy with final approval','The working caption differs from native final copy, or native final approval is pending. Compare both before requesting approval; local edits do not carry native approval forward.','caption');
 const provider=story.production?.provider||[];if(story.production?.handoffs?.some(h=>h.state!=='abandoned')){
 const sent=provider.some(p=>p.status==='sent'),draft=provider.some(p=>p.status==='draft');
 add('handoff',sent?'Inspect the recorded sent post; do not resend':draft?'Review the existing Buffer draft; do not recreate it':'Resolve the earlier handoff before any new import',sent?'Preserve the recorded IDs. Buffer sent is not an independent Instagram availability check. Any lifecycle correction requires approval.':draft?'Reuse the existing mapped draft for human review. Scheduling or editing it is not authorized by this check.':'Retain reservations and any returned provider IDs. Resolve unknown outcomes read-only; never retry an ambiguous create.','publishing',provider.map(p=>({postId:p.id,status:p.status,observedAt:p.observedAt})));}
 return decisions;
}
