import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAnalytics } from '../src/analytics.js';

const sent = (id, metrics, sentAt = '2026-10-28T20:00:00Z') => ({ id, status: 'sent', text: 'Editorial fixture caption', sentAt, metrics });
const metric = (name, value, unit = 'count') => ({ name, value, unit });

test('metric calculations distinguish measured zero, unavailable null and missing denominators', () => {
  const result = calculateAnalytics({ posts: [sent('one', [metric('reach', 0), metric('likes', 0)]), sent('two', [metric('reach', null), metric('likes', 4)])] });
  const reach = result.metrics.find(m => m.name === 'reach');
  assert.equal(reach.value, 0);
  assert.equal(reach.available, true);
  assert.equal(reach.sampleSize, 1);
  const likes = result.metrics.find(m => m.name === 'likes');
  assert.equal(likes.value, 4);
  assert.equal(likes.average, 2);
  assert.equal(likes.sampleSize, 2);
  const shares = result.metrics.find(m => m.name === 'shares');
  assert.equal(shares.value, null);
  assert.equal(shares.sampleSize, 0);
  assert.equal(shares.available, false);
  assert.equal(result.coverage.postsWithMetrics, 2);
  assert.ok(!result.metrics.some(m => m.name === 'engagement_rate'));
});

test('rates are averaged only from observations; incompatible units stay separate', () => {
  const result = calculateAnalytics({ posts: [sent('one', [metric('rate', 2, 'percent'), metric('watch_time', 10, 'seconds')]), sent('two', [metric('rate', 6, 'percent'), metric('watch_time', 1, 'minutes')])] });
  const rate = result.metrics.find(m => m.name === 'rate');
  assert.equal(rate.value, 4);
  assert.equal(rate.total, null);
  assert.equal(rate.aggregation, 'mean_of_observed_post_rates');
  assert.equal(result.metrics.filter(m => m.name === 'watch_time').length, 2);
});

test('unsent posts and marked internal tests do not contaminate editorial performance', () => {
  const result = calculateAnalytics({ posts: [
    sent('one', [metric('reach', 50)]),
    { ...sent('internal', [metric('reach', 1000)]), text: '[INTERNAL CAROUSEL TEST — DO NOT PUBLISH]' },
    { id: 'draft', status: 'draft', metrics: [metric('reach', 5000)] },
  ] });
  assert.equal(result.metrics.find(m => m.name === 'reach').value, 50);
  assert.equal(result.coverage.eligibleSentPosts, 1);
  assert.equal(result.publishing.sentCount, 2);
  assert.equal(result.publishing.internalTestSentCount, 1);
  assert.equal(result.publishing.draftCount, 1);
});

test('Buffer timestamps bucket in New York and never imply actual Instagram verification', () => {
  const result = calculateAnalytics({ observedAt: '2026-10-29T03:00:00Z', posts: [
    { ...sent('one', [], '2026-10-28T00:30:00Z'), externalLink: 'https://instagram.com/p/reported' },
    sent('two', [], '2026-10-29T01:30:00Z'),
    { id: 'missing-time', status: 'sent' },
  ] });
  assert.deepEqual(result.publishing.history.map(d => d.date), ['2026-10-27', '2026-10-28']);
  assert.equal(result.publishing.medianGapHours, 25);
  assert.equal(result.publishing.sentPostsWithoutTimestamp, 1);
  assert.equal(result.publishing.instagramVerifiedCount, 0);
  assert.equal(result.publishing.reportedInstagramLinkCount, 1);
  assert.equal(result.stageDurationsAvailable, false);
});

test('local bottlenecks count stories once, and category comparison requires unambiguous known mappings', () => {
  const result = calculateAnalytics({ posts: [sent('one', [metric('likes', 2)]), sent('unmapped', [metric('likes', 10)])], stories: [
    { id: 'a', territory: 'Photography', stage: 'production', blockers: ['RIGHTS_PENDING', 'RIGHTS_PENDING'], publishing: { postIds: ['one'] } },
    { id: 'b', territory: 'Fashion', stage: 'research', blockers: ['RIGHTS_PENDING'], publishing: { postIds: ['one'] } },
  ] });
  assert.equal(result.bottlenecks[0].count, 2);
  assert.equal(result.coverage.unmappedEditorialSentPosts, 1);
  assert.deepEqual(result.coverage.ambiguousPostMappings, ['one']);
  assert.ok(result.categories.every(category => category.sentPosts === 0));
  assert.equal(result.metrics.find(m => m.name === 'likes').value, 12); // Overall observed metrics remain valid.
});

test('explicit imported observations fill missing metrics without double-counting provider values', () => {
  const result = calculateAnalytics({ posts: [sent('one', [metric('likes', 0)])], performanceRows: [
    { postId: 'one', metrics: [metric('likes', 9), metric('reach', 20)] },
    { postId: 'not-observed', metrics: [metric('reach', 1000)] },
    null,
  ] });
  assert.equal(result.metrics.find(m => m.name === 'likes').value, 0);
  assert.equal(result.metrics.find(m => m.name === 'reach').value, 20);
  assert.deepEqual(result.metrics.find(m => m.name === 'reach').sources, ['performance_log']);
});

test('repeated identical post IDs do not double-count; conflicting snapshots are excluded', () => {
  const post = sent('one', [metric('likes', 4)]);
  const identical = calculateAnalytics({ posts: [post, structuredClone(post)] });
  assert.equal(identical.metrics.find(m => m.name === 'likes').value, 4);
  assert.equal(identical.coverage.duplicateRows, 1);
  const conflicting = calculateAnalytics({ posts: [post, { ...post, status: 'scheduled' }] });
  assert.deepEqual(conflicting.coverage.conflictingPostIds, ['one']);
  assert.equal(conflicting.metrics.find(m => m.name === 'likes').value, null);
  assert.equal(conflicting.publishing.sentCount, 0);
});

test('empty datasets expose unavailable values and no invented production timings', () => {
  const result = calculateAnalytics();
  assert.equal(result.coverage.metricCoverage, null);
  assert.ok(result.metrics.every(m => m.value === null && !m.available));
  assert.equal(result.publishing.activeDayShare, null);
  assert.equal(result.publishing.medianGapHours, null);
  assert.equal(result.observedAt, null);
  assert.equal(result.stageDurationsAvailable, false);
});

test('measurement recency remains separate from cache fetch time and missing timestamps are not invented', () => {
  const result = calculateAnalytics({ observedAt: '2026-10-29T01:34:00Z', posts: [
    { ...sent('measured', [metric('likes', 4)]), metricsUpdatedAt: '2026-10-28T23:13:00Z' },
    sent('unknown-time', [metric('likes', 0), metric('reach', 5)]),
  ] });
  assert.equal(result.observedAt, '2026-10-29T01:34:00.000Z');
  assert.equal(result.measurementRange.newestAt, '2026-10-28T23:13:00.000Z');
  assert.equal(result.measurementRange.unknownObservationCount, 2);
  const likes = result.metrics.find(m => m.name === 'likes');
  assert.equal(likes.value, 4);
  assert.equal(likes.measurement.knownCount, 1);
  assert.equal(likes.measurement.unknownCount, 1);
  assert.equal(result.metrics.find(m => m.name === 'reach').measurement.newestAt, null);
});
