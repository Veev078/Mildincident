import {lintCaption} from './editorial-intelligence.js';
export function imageEvidenceState(asset){
 const decoded=Boolean(asset.localPreview?.sha256&&asset.localPreview.width&&asset.localPreview.height);
 const sourceCopy=decoded&&Boolean(asset.localPreview.sourceInspection);
 const relevance=asset.sourceRelation==='page_cover'||asset.sourceRelation==='context_only'?'generic_or_unrelated':asset.materialType==='design_documentation'?'context_document':asset.sourceRelation==='subject_caption_match'?'subject_reference':'relevance_unreviewed';
 return {relevance,access:sourceCopy?'decoded_source_copy':decoded?'decoded_private_upload':asset.previewUrl?'reference_uninspected':'preview_unavailable',decodedPixels:decoded,sourceCopy,identityVerified:false,rightsGranted:false,aestheticAssessment:'not_performed'};
}
export function assessStudioReadiness(story){
 const draft=story.localDraft||{};const working={...story,...draft};const ids=working.selectedAssetIds||[];const assets=story.media||[];const selected=ids.map(id=>assets.find(m=>m.id===id)).filter(Boolean);
 const claims=story.research||[];const captured=claims.filter(c=>c.capturedAccess==='source_text_captured');const blocked=claims.filter(c=>c.capturedAccess==='access_unconfirmed'||c.linkStatus&& !['live','unknown'].includes(c.linkStatus));
 const caption=lintCaption(working.caption||'',{research:claims});const checks=[];
 const add=(id,label,status,detail,tab)=>checks.push({id,label,status,detail,tab});
 add('angle','Editorial angle',draft.creativeBrief?.angle?'recorded':'review',draft.creativeBrief?.angle?'A working angle is recorded. Distinctiveness remains an editorial judgment.':'Record the specific angle and judge whether it goes beyond a familiar association.','direction');
 add('sources','Source evidence',!captured.length||blocked.length?'needs_research':'review',`${captured.length} claims have captured source text; ${blocked.length} references have unconfirmed access. Captured text still needs claim-level fact checking.`,'research');
 const unrelated=selected.filter(m=>['generic_or_unrelated','relevance_unreviewed'].includes(imageEvidenceState(m).relevance));
 const undecoded=selected.filter(m=>!imageEvidenceState(m).decodedPixels);
 add('photography','Selected visual evidence',!selected.length||unrelated.length?'needs_research':undecoded.length?'review':'recorded',`${selected.length} selected references; ${unrelated.length} need a subject-relevance check; ${undecoded.length} have no decoded private copy. Context documents are not subject photographs.`,'images');
 const target=working.format==='single_image'?1:working.targetSlideCount;const coherent=ids.length===target&&ids.length===selected.length&&new Set(ids).size===ids.length;
 add('format','Format and sequence',coherent?'recorded':'needs_research',`${working.format||'Format unrecorded'}: ${ids.length} selected, ${target||'unknown'} planned. Selection is never padded or trimmed automatically.`,'carousel');
 const captionFlags=caption.issues.filter(i=>i.severity==='error'||i.severity==='warning');
 add('caption','Working caption',captionFlags.length?'needs_research':'review',captionFlags.length?captionFlags.map(i=>i.message).join(' '):'Text checks pass. Verify the exact wording, dates and credit against the sources.','caption');
 const music=Object.hasOwn(draft,'musicSelection')?draft.musicSelection:story.musicSelection;const silent=draft.creativeBrief?.musicIntent?.mode==='silent';
 add('sound','Optional sound direction',silent||music?'recorded':'optional',silent?'The working brief calls for silence.':music?'Track preference recorded; audition, availability and license are unverified.':'No track selected. Music is optional.','music');
 const rights=selected.filter(m=>m.rightsStatus!=='cleared').length;
 add('rights','Rights and delivery',rights||!selected.length?'review':'recorded',`${rights} selected references lack recorded clearance. Private previews are not production exports or permission evidence.`,'publishing');
 if(draft.stale)add('revision','Source revision','needs_research','Resolve the changed source before saving further local edits.','overview');
 if(story.developmentDecision)add('decision','Recorded editorial decision',story.developmentDecision.decision==='needs_research'?'needs_research':'recorded',`${story.developmentDecision.decision}: ${story.developmentDecision.reason}. This does not grant publication approval.`,'overview');
 return {status:checks.some(c=>c.status==='needs_research')?'needs_research':'ready_for_editorial_review',checks,automatedBasis:'text_records_and_decoded_private_files',tasteAssessed:false,factsVerified:false,publicationApproved:false,rightsGranted:false};
}
