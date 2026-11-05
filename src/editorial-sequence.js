/** Source-caption planning only. Proposals never assert visual quality or clearance. */
export function buildSourceSequencePlan(story) {
  const selected=story.localDraft?.selectedAssetIds??story.selectedAssetIds??[];
  const review=m=>m.localReview?.context&&Object.hasOwn(m.localReview.context,'previewSha256')&&(m.localReview.context.previewSha256||null)!==(m.localPreview?.sha256||null)?null:m.localReview;
  const related=(story.media||[]).filter(m=>m.sourceRelation==='subject_caption_match'&&m.sourceCaption&&review(m)?.decision!=='reject');
  related.sort((a,b)=>{
    const order=id=>selected.includes(id)?selected.indexOf(id):Number.MAX_SAFE_INTEGER;
    const preference=asset=>review(asset)?.decision==='shortlist'?0:review(asset)?.decision==='hold'?2:1;
    // An explicit sequence remains the founder’s order. Feedback ranks only remaining eligible references.
    return order(a.id)-order(b.id)||(selected.includes(a.id)?0:preference(a)-preference(b))||Number(a.materialType==='design_documentation')-Number(b.materialType==='design_documentation')||Number(!a.localPreview?.originalSha256)-Number(!b.localPreview?.originalSha256);
  });
  const seen=new Set();const distinct=related.filter(m=>{const key=m.localPreview?.originalSha256||m.sourcePreviewUrl||m.previewUrl||m.id;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
  const slide=(m,index,total)=>({assetId:m.id,caption:m.sourceCaption,credit:m.sourceCredit||m.creator||'',years:m.sourceYears||[],material:m.materialType||'source_reference',role:index===0?'question':index===total-1?'payoff':'context',note:`Source-caption proposal: ${m.sourceCaption}`.slice(0,500)});
  const options=[];
  if(distinct.length)options.push({id:'single-source-frame',label:'Let one frame carry the story',format:'single_image',targetSlideCount:1,slides:[slide(distinct[0],0,1)]});
  if(distinct.length>=2)options.push({id:'source-sequence',label:'A sequence from these source references',format:'carousel',targetSlideCount:distinct.length,slides:distinct.map((m,index)=>slide(m,index,distinct.length))});
  return {basis:'source_caption_metadata',pixelReviewPerformed:false,rightsGranted:false,options,gaps:distinct.length<2?['Fewer than two distinct subject-related source references; no padded carousel proposed.']:[]};
}
