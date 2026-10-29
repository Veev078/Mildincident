import { WORKSPACE_TABLES } from '../../src/workspace/model.js';

export function workspaceSnapshot() {
  const records = Object.fromEntries(Object.keys(WORKSPACE_TABLES).map(k => [k, []]));
  records.stories = [{ concept_id: 'CON-EXISTING-01', title: 'An existing archival story', subject: 'Photography',
    stage: 'approved_for_sourcing', approval_status: 'concept_approved', format: 'carousel',
    review_token: 'never-expose-founder-token', citations: JSON.stringify([{ claim: 'A stored claim, not newly verified', claim_type: 'verified_fact', source_name: 'Archive', source_url: 'https://example.org/collection' }]) }];
  records.packages = [{ concept_id: 'CON-EXISTING-01', package_id: 'package', production_version: 1, editorial_handoff_version: 1,
    caption_draft: 'A sourced fixture caption for local editorial review.', target_slide_count: 2, rights_review_status: 'incomplete',
    slide_sequence_asset_ids: '["asset-1","asset-2"]', final_review_token: 'never-expose-final-token' }];
  records.media = [1, 2, 3].map(i => ({ concept_id: 'CON-EXISTING-01', asset_id: `asset-${i}`, title: `Archive photograph ${i}`, creator: 'Photographer',
    source_page_url: `https://example.org/images/${i}`, thumb_url: `https://example.org/thumb/${i}.jpg`, rights_status: 'preview_unreviewed', provider: 'archive', width: 1080, height: 1350 }));
  records.imports = [{ id: 1, concept_id: 'CON-EXISTING-01', state: 'draft_created', buffer_id: 'post-1', imported_on: '2026-10-28T20:00:00Z' }];
  records.imageArchives = [{ archive_key: 'archive', name: 'Source collection', active: true, home_url: 'https://example.org', rights_hint: 'Review per-image permissions' }];
  return { records, buffer: { complete: true, observedAt: '2026-10-28T20:00:00Z', posts: [{ id: 'post-1', channelId: 'channel', status: 'draft', dueAt: null, sentAt: null, assets: [], text: 'Private provider text' }] },
    observedAt: '2026-10-28T20:00:00Z', warnings: [] };
}
