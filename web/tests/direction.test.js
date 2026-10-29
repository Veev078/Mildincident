import test from 'node:test';
import assert from 'node:assert/strict';
import { creativeBriefFor, directionReviewSummary, directionSequenceObservations, directionView, creativeBriefSummary, emptyCreativeBrief } from '../direction.js';

function story(creativeBrief) {
  return { id: 'CON-FIXTURE-ONLY', title: 'Labeled local fixture', hook: 'Existing source hook', caption: 'Preserve this exact caption.',
    selectedAssetIds: ['fixture-image'], media: [{ id: 'fixture-image', title: 'Synthetic fixture preview', creator: 'Fixture generator', rightsStatus: 'preview_unreviewed' }],
    localDraft: creativeBrief ? { creativeBrief } : null,
    editorialDirection: { reference: { title: 'Historical user-supplied reference', date: '2026-10-28', metricsComparable: false, timingVerified: false },
      hooks: [{ id: 'hidden_connection', label: 'The hidden connection', prompt: 'Identify a documented connection.', evidenceNeeded: 'Check the original sources.' }],
      captionGuidance: ['Keep the evidence visible.'], sequence: { issues: [{ code: 'UNASSIGNED_SEQUENCE_ROLE', message: 'Choose a role for this image.' }] },
      sourceLanes: [{ id: 'photographer_portfolios', label: 'Photographer portfolios', description: 'Follow the credited original creator.', searchUrl: 'https://example.org/search', examples: [{ name: 'Original creator', url: 'https://example.org/creator' }] }] } };
}

test('manual taste average stays unavailable until all four ratings exist, and never grants publication approval', () => {
  const brief = emptyCreativeBrief();
  brief.ratings.hook = 5; brief.ratings.visual = 4; brief.ratings.shareability = 5;
  const partial = directionReviewSummary(story(brief));
  assert.match(partial, /3 <small>\/ 4 rated/);
  assert.doesNotMatch(partial, /4\.67/);
  brief.ratings.timelessness = 4;
  const complete = directionReviewSummary(story(brief));
  assert.match(complete, /4\.50/);
  assert.match(complete, /does not verify the facts, clear image rights, approve publication or schedule a post/);
});

test('Direction displays actual selected images and historical-source boundaries without rewriting the caption', () => {
  const s = story();
  const html = directionView({}, s);
  assert.match(html, /data-brief-role="fixture-image"/);
  assert.match(html, /No role is assigned automatically/);
  assert.match(html, /Posting windows are unverified/);
  assert.match(html, /not comparable performance metrics/);
  assert.match(html, /https:\/\/example.org\/creator/);
  assert.match(html, /maxlength="700"/);
  assert.match(html, /maxlength="1200"/);
  assert.match(html, /maxlength="4000"/);
  assert.equal(s.caption, 'Preserve this exact caption.');
});

test('creative direction escapes stored user input and preserves unselected role notes for review/history', () => {
  const brief = emptyCreativeBrief();
  brief.angle = '<script>fixture()</script>';
  brief.notes = 'Retained private proposal notes';
  brief.sequenceRoles = [{ assetId: 'existing-but-unselected', role: 'evidence', note: 'A prior narrative decision' }];
  const s = story(brief);
  const html = directionView({}, s);
  assert.match(html, /&lt;script&gt;fixture\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /earlier image-role annotation is retained outside the current selection/);
  assert.match(creativeBriefSummary(brief), /A prior narrative decision/);
  const editable = creativeBriefFor(s);
  editable.sequenceRoles[0].note = 'A new local decision';
  assert.equal(s.localDraft.creativeBrief.sequenceRoles[0].note, 'A prior narrative decision');
});

test('repeated metadata issues are grouped without claiming visual analysis', () => {
  const s = story();
  s.editorialDirection.sequence.issues.push({ code: 'UNASSIGNED_SEQUENCE_ROLE', message: 'Choose a role for this image.' });
  const html = directionSequenceObservations(s);
  assert.match(html, /2 image records/);
  assert.match(html, /not visual analysis/);
});
