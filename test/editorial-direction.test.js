import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditorialDirection, validateCreativeBrief, HOOK_TYPES, SOURCE_LANE_IDS } from '../src/editorial-direction.js';

const story = () => ({ id: 'existing-story', title: 'Portraits inside the Batcave', subject: 'London nightlife photography', format: 'carousel',
  selectedAssetIds: ['one', 'two'], media: [
    { id: 'one', title: 'Club portrait', creator: 'Derek Ridgers', rightsStatus: 'permission_required' },
    { id: 'two', title: 'The dance floor', creator: 'Derek Ridgers', rightsStatus: 'discovered_unverified' },
    { id: 'candidate', title: 'Unselected candidate', creator: 'Other photographer' },
  ] });

test('frontend empty direction is valid and normalization never mutates caller-owned notes', () => {
  const input = { hookType: '', angle: '  A scene through its people.  ', visualIntent: '', captionApproach: 'retain_source',
    sequenceRoles: [], ratings: { hook: null, visual: null, shareability: null, timelessness: null }, notes: '', sourceLaneIds: [] };
  const result = validateCreativeBrief(input, story());
  assert.equal(result.angle, 'A scene through its people.');
  assert.equal(input.angle, '  A scene through its people.  ');
  assert.equal(result.hookType, '');
  result.ratings.hook = 5;
  assert.equal(input.ratings.hook, null);
});

test('writes accept a current unselected candidate annotation without silently selecting it', () => {
  const input = { sequenceRoles: [{ assetId: 'candidate', role: 'evidence', note: 'Compare with the chosen portrait.' }] };
  const valid = validateCreativeBrief(input, story());
  const result = buildEditorialDirection(story(), { creativeBrief: valid });
  const annotation = result.sequence.roles.find(role => role.assetId === 'candidate');
  assert.equal(annotation.selected, false);
  assert.equal(annotation.position, null);
  assert.ok(result.sequence.issues.some(issue => issue.code === 'ANNOTATED_ASSET_NOT_SELECTED'));
  assert.deepEqual(story().selectedAssetIds, ['one', 'two']);
});

test('creative writes reject foreign/duplicate assets, unsupported fields, invalid hook/lane/role and nonnumeric scores', () => {
  const invalid = [
    { sequenceRoles: [{ assetId: 'foreign-story-image', role: 'evidence' }] },
    { sequenceRoles: [{ assetId: 'one', role: 'question' }, { assetId: 'one', role: 'payoff' }] },
    { sequenceRoles: [{ assetId: 'one', role: 'background' }] },
    { sequenceRoles: [{ assetId: 'one', role: 'question', automaticallyApproved: true }] },
    { hookType: ['hidden_connection', 'bizarre_fact'] },
    { hookType: 'guaranteed_viral' },
    { captionApproach: 'automatic_rewrite' },
    { sourceLaneIds: ['unknown-connected-provider'] },
    { sourceLaneIds: ['film_stills', 'film_stills'] },
    { ratings: { hook: 0 } }, { ratings: { hook: 6 } }, { ratings: { hook: 4.5 } }, { ratings: { hook: '4' } },
    { ratings: { hook: NaN } }, { ratings: { reachPrediction: 5 } },
    { publishAt: '2026-10-31T12:00:00Z' },
  ];
  for (const input of invalid) assert.throws(() => validateCreativeBrief(input, story()), { code: 'INVALID_CREATIVE_BRIEF' });
});

test('bounded notes preserve useful multiline text but reject controls and oversized payloads', () => {
  assert.equal(validateCreativeBrief({ notes: 'Context\nEvidence\tCredit' }, story()).notes, 'Context\nEvidence\tCredit');
  for (const input of [{ angle: 'x'.repeat(701) }, { visualIntent: 'x'.repeat(1201) }, { notes: 'x'.repeat(4001) },
    { notes: 'bad\u0000content' }, { sequenceRoles: [{ assetId: 'one', role: 'question', note: 'x'.repeat(501) }] }, null, []]) {
    assert.throws(() => validateCreativeBrief(input, story()), { code: 'INVALID_CREATIVE_BRIEF' });
  }
});

test('all seven hook choices ask for evidence; selecting one invents neither a claim nor publication approval', () => {
  const result = buildEditorialDirection(story(), { creativeBrief: { hookType: 'hidden_connection', angle: 'An editor-proposed angle.' } });
  assert.deepEqual(result.hooks.map(hook => hook.id), HOOK_TYPES);
  assert.equal(result.hooks.filter(hook => hook.selected).length, 1);
  assert.ok(result.hooks.every(hook => hook.prompt && hook.evidenceNeeded));
  assert.equal(result.sourceVerificationPerformed, false);
  assert.equal(result.review.publicationApproved, false);
  assert.equal(result.review.empiricalPerformanceScore, false);
});

test('source discovery spans independent visual culture and produces safe searches, not results or licensing decisions', () => {
  const result = buildEditorialDirection(story(), { creativeBrief: { sourceLaneIds: ['photographer_portfolios', 'independent_magazines'] } });
  assert.deepEqual(result.sourceLanes.map(lane => lane.id), SOURCE_LANE_IDS);
  assert.equal(result.sourceLanes.filter(lane => lane.selected).length, 2);
  const portfolios = result.sourceLanes.find(lane => lane.id === 'photographer_portfolios');
  assert.match(portfolios.query, /Derek Ridgers/);
  assert.doesNotMatch(portfolios.query, /Other photographer/);
  for (const lane of result.sourceLanes) {
    const url = new URL(lane.searchUrl);
    assert.equal(url.origin, 'https://search.brave.com');
    assert.equal(url.searchParams.get('q'), lane.query);
    assert.equal(lane.connection, 'not_connected');
    assert.equal(lane.resultStatus, 'search_suggestion_only');
    assert.match(lane.rightsNote, /grants no reuse rights/);
    assert.ok(lane.examples.every(example => new URL(example.url).protocol === 'https:'));
  }
  assert.ok(result.sourceLanes.some(lane => lane.id === 'contemporary_visuals'));
  assert.ok(result.sourceLanes.some(lane => lane.id === 'artist_studios'));
});

test('editorial score average exists only after all four human scores and never becomes a growth or ship score', () => {
  const partial = buildEditorialDirection(story(), { creativeBrief: { ratings: { hook: 5, visual: 5, shareability: 4 } } });
  assert.equal(partial.review.average, null);
  assert.equal(partial.review.complete, false);
  const complete = buildEditorialDirection(story(), { creativeBrief: { ratings: { hook: 5, visual: 5, shareability: 4, timelessness: 4 } } });
  assert.equal(complete.review.average, 4.5);
  assert.equal(complete.review.complete, true);
  assert.equal(complete.review.basis, 'editor_self_assessment');
  assert.equal(complete.review.publicationApproved, false);
  assert.equal(complete.reference.metricsComparable, false);
  assert.equal(complete.reference.timingVerified, false);
  assert.deepEqual(complete.timing.recommendedTimes, []);
});

test('read projection retains stale removed-image annotations while strict writes require explicit repair', () => {
  const saved = { hookType: 'secret_backstory', notes: 'Keep this context.', sequenceRoles: [{ assetId: 'removed', role: 'payoff', note: 'Earlier ending decision.' }] };
  const current = { ...story(), creativeBrief: saved };
  assert.throws(() => validateCreativeBrief(saved, current), { code: 'INVALID_CREATIVE_BRIEF' });
  const result = buildEditorialDirection(current);
  const retained = result.sequence.roles.find(role => role.assetId === 'removed');
  assert.equal(retained.available, false);
  assert.equal(retained.selected, false);
  assert.equal(retained.role, 'payoff');
  assert.equal(retained.note, 'Earlier ending decision.');
  assert.ok(result.sequence.issues.some(issue => issue.code === 'ANNOTATED_ASSET_REMOVED'));
  assert.equal(result.chosenHookType, 'secret_backstory');
  assert.deepEqual(current.creativeBrief, saved);
});

test('sparse and malformed stored direction cannot break workspace reads or ban a single-image story', () => {
  const sparse = buildEditorialDirection({ id: 'single', format: 'single_image', selectedAssetIds: ['one'], media: [{ id: 'one' }] });
  assert.equal(sparse.sequence.roles[0].role, null);
  assert.equal(sparse.sequence.visualAnalysisPerformed, false);
  assert.ok(sparse.sequence.supportedFormats.includes('single_image'));
  assert.equal(sparse.review.average, null);
  const malformed = buildEditorialDirection({ ...story(), creativeBrief: { ratings: { hook: 'bad' } } });
  assert.ok(malformed.issues.some(issue => issue.code === 'INVALID_STORED_CREATIVE_BRIEF'));
  assert.equal(malformed.review.average, null);
  assert.equal(buildEditorialDirection(null).sourceLanes.length, 7);
});
