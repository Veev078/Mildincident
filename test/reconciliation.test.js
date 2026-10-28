import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialReadiness, projectLifecycle } from '../src/reconciliation.js';

test('manual lifecycle, Buffer sent and Instagram confirmation remain separate', () => {
  const posts = [{ id: 'p1', status: 'sent', externalLink: 'https://www.instagram.com/p/reported' }];
  const result = projectLifecycle({ manualStatus: 'posted', posts, complete: true });
  assert.equal(result.observed, 'buffer_sent');
  assert.equal(result.instagramVerified, false);
  assert.equal(result.requiresReview, true);
  assert.equal(result.manualStatus, 'posted');
  const confirmed = projectLifecycle({ manualStatus: 'posted', posts, complete: true, instagramEvidence: [{ postId: 'p1', verified: true, url: posts[0].externalLink }] });
  assert.equal(confirmed.observed, 'instagram_posted_verified');
  assert.equal(confirmed.requiresReview, false);
});

test('incomplete scans never establish absence; multiple handoffs and missing schedule fields need review', () => {
  assert.equal(projectLifecycle({ posts: [], complete: false }).observed, 'unknown');
  assert.equal(projectLifecycle({ posts: [], complete: true }).observed, 'no_handoff_found');
  assert.equal(projectLifecycle({ posts: [{ id: '1', status: 'draft' }], complete: true }).observed, 'unknown');
  const result = projectLifecycle({ posts: [{ id: '1', status: 'sent' }, { id: '2', status: 'draft' }], complete: true });
  assert.equal(result.multipleHandoffs, true);
  assert.equal(result.requiresReview, true);
});

test('existing package readiness preserves pending rights and flags stale edits without granting publication approval', () => {
  const result = editorialReadiness({
    story: { concept_id: 'existing', title: 'Existing story' },
    productionPackage: { production_version: 4, editorial_handoff_version: 3, rights_review_status: 'incomplete', slide_sequence_asset_ids: '["a","b"]' },
    media: [{ concept_id: 'existing', asset_id: 'a', rights_status: 'license_metadata_public_domain_unreviewed' }],
    imports: [{ concept_id: 'existing', buffer_id: 'known', state: 'draft_created' }],
    posts: [{ id: 'known', status: 'draft', dueAt: null, sentAt: null }], auditComplete: true,
  });
  assert.equal(result.pendingRightsCount, 2);
  assert.equal(result.observation.observed, 'buffer_unscheduled_draft');
  assert.equal(result.publicationApproved, false);
  assert.ok(result.blockers.includes('MISSING_SELECTED_MEDIA'));
  assert.ok(result.blockers.includes('UNSAVED_CURRENT_HANDOFF'));
  assert.ok(result.blockers.includes('PER_IMAGE_RIGHTS_PENDING'));
});
