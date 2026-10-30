// Observational projection only: this never changes source lifecycle rows or remote posts.
export function projectLifecycle({ manualStatus, posts, complete, instagramEvidence = [] }) {
  const ids = new Set(instagramEvidence.filter(e => e.verified === true && e.postId && e.url).map(e => e.postId));
  const statuses = posts.map(p => p.status);
  let observed = 'unknown';
  if (complete === true && !posts.length) observed = 'no_handoff_found';
  else if (posts.some(p => ids.has(p.id))) observed = 'instagram_posted_verified';
  else if (statuses.includes('sent')) observed = 'buffer_sent';
  else if (statuses.includes('sending')) observed = 'buffer_sending';
  else if (statuses.includes('scheduled')) observed = 'buffer_scheduled';
  else if (statuses.includes('error')) observed = 'buffer_error';
  else if (statuses.includes('needs_approval')) observed = 'buffer_needs_approval';
  else if (posts.length && posts.every(p => p.status === 'draft' && Object.hasOwn(p, 'dueAt') && p.dueAt === null && Object.hasOwn(p, 'sentAt') && p.sentAt === null)) observed = 'buffer_unscheduled_draft';
  return {
    manualStatus: manualStatus || 'active', observed, auditComplete: complete === true,
    postIds: posts.map(p => p.id), multipleHandoffs: posts.length > 1,
    instagramVerified: posts.some(p => ids.has(p.id)),
    // A permalink reported by Buffer is evidence to investigate, not an Instagram availability check.
    reportedInstagramLinks: posts.filter(p => p.externalLink).map(p => ({ postId: p.id, url: p.externalLink })),
    requiresReview: observed === 'unknown' || complete !== true || posts.length > 1 || statuses.includes('error') ||
      (statuses.includes('sent') && !posts.some(p => ids.has(p.id))) ||
      (manualStatus === 'posted' && !posts.some(p => ids.has(p.id))),
  };
}

export function editorialReadiness({ story, productionPackage, media, imports, posts, lifecycle, auditComplete }) {
  const issues = [];
  let selected = [];
  try { selected = JSON.parse(productionPackage?.slide_sequence_asset_ids || '[]'); } catch { issues.push('INVALID_SLIDE_SEQUENCE'); }
  if (!Array.isArray(selected)) { selected = []; issues.push('INVALID_SLIDE_SEQUENCE'); }
  if (!productionPackage) issues.push('NO_PRODUCTION_PACKAGE');
  if (!selected.length) issues.push('NO_CURATED_SLIDE_SEQUENCE');
  if (productionPackage && selected.length !== Number(productionPackage.target_slide_count)) issues.push('SEQUENCE_COUNT_MISMATCH');
  if (new Set(selected).size !== selected.length) issues.push('DUPLICATE_SELECTED_ASSET');
  const assets = selected.map(id => media.find(m => m.asset_id === id && m.concept_id === story.concept_id));
  if (assets.some(a => !a)) issues.push('MISSING_SELECTED_MEDIA');
  // Do not infer clearance from license labels; the existing per-image review state is authoritative.
  const pending = assets.filter(a => !a || a.rights_status !== 'cleared').length;
  if (pending) issues.push('PER_IMAGE_RIGHTS_PENDING');
  if (productionPackage?.rights_review_status !== 'complete') issues.push('PACKAGE_RIGHTS_REVIEW_INCOMPLETE');
  if (Number(productionPackage?.production_version) !== Number(productionPackage?.editorial_handoff_version)) issues.push('UNSAVED_CURRENT_HANDOFF');
  if (/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(productionPackage?.caption_draft || '')) issues.push('INTERNAL_TEST_CAPTION');
  if (/locate original production photographs|can anchor a .*photo essay|all photographic reuse requires|check rights before selecting/iu.test(productionPackage?.caption_draft || '')) issues.push('CAPTION_CONTAINS_PRODUCTION_NOTES');
  const rows = imports.filter(r => r.concept_id === story.concept_id && r.state !== 'abandoned');
  const postIds = new Set(rows.map(r => r.buffer_id).filter(Boolean));
  const matched = posts.filter(p => postIds.has(p.id));
  if (matched.length !== postIds.size) issues.push('UNRESOLVED_BUFFER_ID');
  const observation = projectLifecycle({ manualStatus: lifecycle?.lifecycle_status, posts: matched, complete: auditComplete });
  if(matched.length!==postIds.size||rows.some(r=>!r.buffer_id)){observation.observed='unknown';observation.requiresReview=true;}
  observation.postIds=[...postIds];observation.multipleHandoffs=rows.length>1||postIds.size>1;
  return { conceptId: story.concept_id, title: story.title, packageVersion: productionPackage?.production_version || null,
    selectedCount: selected.length, pendingRightsCount: pending, existingHandoffCount: rows.length,
    observation, blockers: [...new Set(issues)], publicationApproved: false };
}
