/** Review ordering from recorded evidence, never an aesthetic/performance score. */
export function buildDiscoveryDesk(stories) {
  const reviewStages = new Set(['awaiting_chief_review','awaiting_founder_approval','research_complete','idea','researching','development_review','development_needs_research']);
  const eligible = stories.filter(s => !['rejected','development_rejected'].includes(s.stage) && !['founder_rejected','rejected'].includes(s.approvalStatus) &&
    !['buffer_sent','instagram_posted_verified','buffer_scheduled','buffer_unscheduled_draft'].includes(s.publishing?.observed));
  const describe = story => {
    const draft = story.localDraft;
    const claims = story.research.filter(r=>r.url && r.claim);
    const sources = new Set(claims.map(r=>r.url));
    const previews = story.media.filter(m=>m.previewUrl);
    const gaps=[];
    const selected = draft?.selectedAssetIds ?? story.selectedAssetIds;
    const rejected = story.media.filter(m=>m.localReview?.decision==='reject');
    if(rejected.some(m=>selected.includes(m.id)))gaps.push('A locally rejected photograph remains in the selected carousel');
    if(sources.size<2)gaps.push('Fewer than two recorded source URLs');
    if(!previews.length)gaps.push('No image preview references recorded');
    if(!(draft?.caption ?? story.caption).trim())gaps.push('Caption needs development');
    if(!(draft?.selectedAssetIds ?? story.selectedAssetIds).length)gaps.push('Carousel sequence not selected');
    if(!(draft?.musicSelection ?? story.musicSelection))gaps.push('Music direction not selected');
    gaps.push('Human source, image identity and per-image rights review still required');
    return {storyId:story.id,sourceCount:sources.size,claimCount:claims.length,previewReferenceCount:previews.length,
      shortlistedCount:story.media.filter(m=>m.localReview?.decision==='shortlist').length,rejectedCount:rejected.length,
      gaps,orderingBasis:'recorded_evidence_coverage',pixelAnalysisPerformed:false,audiencePerformanceUsed:false};
  };
  const order = group => group.map(describe).sort((a,b)=>b.sourceCount-a.sourceCount||b.claimCount-a.claimCount||a.storyId.localeCompare(b.storyId)).slice(0,5);
  return {candidates:order(eligible.filter(s=>reviewStages.has(s.stage))),continuations:order(eligible.filter(s=>!reviewStages.has(s.stage))),
    generationPerformed:false,source:'existing_n8n_records',maximumSlateSize:5};
}
