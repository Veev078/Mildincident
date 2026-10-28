import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRecords } from '../src/record-review.js';

test('relationship audit detects ambiguous packages, orphan media, missing IDs and preserves unknown Buffer associations', () => {
  const result = reviewRecords({ stories: [{ concept_id: 'existing', title: 'Story' }],
    packages: [{ concept_id: 'existing', package_id: 'p' }, { concept_id: 'existing', package_id: 'p2' }],
    media: [{ asset_id: 'duplicate', concept_id: 'missing', rights_status: 'preview_unreviewed' }, { asset_id: 'duplicate', concept_id: 'existing', rights_status: 'preview_unreviewed' }],
    imports: [{ id: 1, concept_id: 'existing', state: 'draft_created', buffer_id: '' }], lifecycle: [],
    archives: [{ id: 10, package_id: 'not-found' }], soundtrack: [], soundSelections: [], imageArchives: [],
  }, { complete: true, observedAt: '2026-10-28T23:00:00Z', posts: [{ id: 'unmapped', status: 'sent' }] });
  assert.equal(result.readOnly, true);
  assert.equal(result.checks.duplicatePackageStories[0].count, 2);
  assert.equal(result.checks.orphanMediaCount, 1);
  assert.deepEqual(result.checks.orphanArchives, [10]);
  assert.deepEqual(result.checks.confirmedImportsWithoutIds, [1]);
  assert.equal(result.unmappedBufferPosts[0].id, 'unmapped');
  assert.ok(result.stories[0].blockers.includes('NO_PRODUCTION_PACKAGE'));
});
