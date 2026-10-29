// Observational calculations only. Missing provider measurements remain null;
// Buffer 'sent' timestamps are not independent Instagram publication evidence.
const DEFAULT_METRICS = ['reach', 'impressions', 'likes', 'comments', 'shares', 'saves'];
const string = value => typeof value === 'string' ? value : '';
const slug = value => string(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const isTest = post => /INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(string(post.text));

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function day(time, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  const get = name => parts.find(part => part.type === name).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function unit(value) {
  const name = slug(value);
  if (['number', 'count', 'integer'].includes(name)) return 'count';
  if (['percent', 'percentage', '%'].includes(name)) return 'percent';
  return name || 'unknown';
}

function observations(post, performanceRows) {
  const result = new Map();
  const add = (metrics, source) => {
    if (!Array.isArray(metrics)) return;
    for (const metric of metrics) {
      if (!metric || !finite(metric.value)) continue;
      const name = slug(metric.name);
      if (!name) continue;
      const measureUnit = unit(metric.unit);
      const key = `${name}|${measureUnit}`;
      // Direct provider values take precedence over duplicated imported observations.
      if (!result.has(key)) result.set(key, { name, unit: measureUnit, value: metric.value, source, type: slug(metric.type) });
    }
  };
  add(post.metrics, 'buffer');
  for (const row of performanceRows) {
    if ((row.postId || row.buffer_post_id || row.post_id) !== post.id) continue;
    add(row.metrics, 'performance_log');
  }
  return [...result.values()];
}

function summarizeMetrics(entries, includeDefaults = true) {
  const groups = new Map();
  for (const entry of entries) for (const metric of entry.metrics) {
    const key = `${metric.name}|${metric.unit}`;
    const group = groups.get(key) || { name: metric.name, unit: metric.unit, values: [], postIds: [], sources: new Set(), ratio: false };
    group.values.push(metric.value);
    group.postIds.push(entry.post.id);
    group.sources.add(metric.source);
    group.ratio ||= ['percent', 'ratio', 'rate'].includes(metric.unit) || ['percentage', 'percent', 'ratio', 'rate'].includes(metric.type);
    groups.set(key, group);
  }
  const metrics = [...groups.values()].map(group => {
    const total = group.values.reduce((sum, value) => sum + value, 0);
    const average = total / group.values.length;
    return { name: group.name, label: group.name.replace(/_/g, ' '), unit: group.unit,
      value: group.ratio ? average : total, total: group.ratio ? null : total, average,
      sampleSize: group.values.length, available: true, aggregation: group.ratio ? 'mean_of_observed_post_rates' : 'sum_of_observed_post_values',
      postIds: group.postIds, sources: [...group.sources] };
  });
  if (includeDefaults) for (const name of DEFAULT_METRICS) if (!metrics.some(metric => metric.name === name)) metrics.push({ name, label: name, unit: 'count', value: null, total: null, average: null, sampleSize: 0, available: false, aggregation: null, postIds: [], sources: [] });
  return metrics.sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}

function publishingSummary(posts, timezone) {
  const sent = posts.filter(post => post.status === 'sent');
  const times = sent.map(post => ({ post, time: timestamp(post.sentAt) })).filter(entry => entry.time !== null).sort((a, b) => a.time - b.time);
  const days = new Map();
  for (const entry of times) {
    const date = day(entry.time, timezone);
    const item = days.get(date) || { date, count: 0, editorialCount: 0, internalTestCount: 0 };
    item.count++;
    if (isTest(entry.post)) item.internalTestCount++; else item.editorialCount++;
    days.set(date, item);
  }
  const gaps = times.slice(1).map((entry, index) => (entry.time - times[index].time) / 3_600_000).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median = gaps.length ? (gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2) : null;
  const history = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const calendarDays = history.length ? (Date.parse(history.at(-1).date) - Date.parse(history[0].date)) / 86_400_000 + 1 : 0;
  return { sentCount: sent.length, editorialSentCount: sent.filter(post => !isTest(post)).length,
    internalTestSentCount: sent.filter(isTest).length, draftCount: posts.filter(post => post.status === 'draft').length,
    scheduledCount: posts.filter(post => post.status === 'scheduled').length, errorCount: posts.filter(post => post.status === 'error').length,
    firstSentAt: times.length ? new Date(times[0].time).toISOString() : null,
    lastSentAt: times.length ? new Date(times.at(-1).time).toISOString() : null,
    sentPostsWithoutTimestamp: sent.length - times.length, timezone, history, activeDays: history.length,
    observedCalendarDays: calendarDays, activeDayShare: calendarDays ? history.length / calendarDays : null,
    medianGapHours: median, basis: 'buffer_sent_timestamps',
    instagramVerifiedCount: sent.filter(post => post.instagramVerified === true).length,
    reportedInstagramLinkCount: sent.filter(post => post.externalLink).length };
}

export function calculateAnalytics({ posts = [], stories = [], performanceRows = [], observedAt = null, timezone = 'America/New_York' } = {}) {
  const input = Array.isArray(posts) ? posts : [];
  const storyRows = (Array.isArray(stories) ? stories : []).filter(row => row && typeof row === 'object');
  const performance = (Array.isArray(performanceRows) ? performanceRows : []).filter(row => row && typeof row === 'object');
  // Caller-supplied timezone is validated once, including the empty-data case.
  new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  const byId = new Map();
  const conflicting = new Set();
  let duplicateRows = 0;
  for (const post of input) {
    if (!post || typeof post.id !== 'string' || !post.id) continue;
    if (!byId.has(post.id)) byId.set(post.id, post);
    else {
      duplicateRows++;
      const previous = byId.get(post.id);
      if (JSON.stringify(previous) !== JSON.stringify(post)) conflicting.add(post.id);
    }
  }
  const unique = [...byId.values()].filter(post => !conflicting.has(post.id));
  const eligible = unique.filter(post => post.status === 'sent' && !isTest(post));
  const entries = eligible.map(post => ({ post, metrics: observations(post, performance) }));
  const withMetrics = entries.filter(entry => entry.metrics.length);
  const metrics = summarizeMetrics(entries);
  const blockerMap = new Map();
  const stageMap = new Map();
  for (const story of storyRows) {
    const stage = string(story.stage).trim() || 'unknown';
    stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
    for (const blocker of new Set(Array.isArray(story.blockers) ? story.blockers : [])) {
      if (typeof blocker !== 'string' || !blocker) continue;
      const item = blockerMap.get(blocker) || { code: blocker, name: blocker.toLowerCase().replace(/_/g, ' '), count: 0, storyIds: [] };
      item.count++;
      if (story.id) item.storyIds.push(story.id);
      blockerMap.set(blocker, item);
    }
  }
  const categories = new Map();
  const owners = new Map();
  for (const story of storyRows) for (const id of Array.isArray(story.publishing?.postIds) ? story.publishing.postIds : []) {
    const set = owners.get(id) || new Set();
    set.add(story.id || story);
    owners.set(id, set);
  }
  const ambiguousPostMappings = [...owners].filter(([, set]) => set.size > 1).map(([id]) => id);
  for (const story of storyRows) {
    const name = string(story.territory || story.subject).trim() || 'Unclassified';
    const category = categories.get(name) || { name, stories: 0, sentPostIds: new Set() };
    category.stories++;
    const ids = Array.isArray(story.publishing?.postIds) ? story.publishing.postIds : [];
    for (const id of ids) if (owners.get(id)?.size === 1 && eligible.some(post => post.id === id)) category.sentPostIds.add(id);
    categories.set(name, category);
  }
  const limitations = [
    'Buffer sent is provider-reported state, not independent Instagram verification.',
    'Missing metrics remain unavailable; zero means the provider supplied a numeric zero.',
    'Metric totals use only measured editorial sent posts; internal tests and conflicting duplicate records are excluded.',
    'Reach totals sum post-level measurements and are not a deduplicated audience count.',
    'No engagement rate, causal performance recommendation, optimal posting time or stage duration is inferred from missing data.',
    'Production bottlenecks are current snapshot counts; elapsed time per stage requires transition history.',
  ];
  if (conflicting.size) limitations.push('Conflicting repeated post IDs were excluded from calculations until reconciled.');
  const unmapped = eligible.filter(post => !storyRows.some(story => story.publishing?.postIds?.includes(post.id))).length;
  return { observedAt: timestamp(observedAt) === null ? null : new Date(observedAt).toISOString(),
    coverage: { posts: unique.length, inputRows: input.length, duplicateRows, conflictingPostIds: [...conflicting],
      sentPosts: unique.filter(post => post.status === 'sent').length, eligibleSentPosts: eligible.length,
      postsWithMetrics: withMetrics.length, metricCoverage: eligible.length ? withMetrics.length / eligible.length : null,
      unmappedEditorialSentPosts: unmapped, ambiguousPostMappings, performanceRows: performance.length, metricSource: 'buffer_or_explicit_performance_observations' },
    metrics, publishing: publishingSummary(unique, timezone),
    bottlenecks: [...blockerMap.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    stages: [...stageMap].map(([name, count]) => ({ name, count })), stageDurationsAvailable: false,
    categories: [...categories.values()].map(category => {
      const included = entries.filter(entry => category.sentPostIds.has(entry.post.id));
      return { name: category.name, stories: category.stories, sentPosts: category.sentPostIds.size,
        postsWithMetrics: included.filter(entry => entry.metrics.length).length, metrics: summarizeMetrics(included, false) };
    }).sort((a, b) => b.stories - a.stories || a.name.localeCompare(b.name)),
    limitations };
}
