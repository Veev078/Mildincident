// Observational calculations only. Missing provider measurements remain null;
// Buffer 'sent' timestamps are not independent Instagram publication evidence.
const DEFAULT_METRICS = ['reach', 'views', 'impressions', 'likes', 'comments', 'shares', 'saves'];
const string = value => typeof value === 'string' ? value : '';
const slug = value => string(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
const finite = value => typeof value === 'number' && Number.isFinite(value);
export const isInternalAnalyticsPost = post => /INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(string(post.text));
const isTest = isInternalAnalyticsPost;

/** A caption or nearby send time is never sufficient evidence of post identity. */
export function instagramPublicationUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
    return match ? `https://www.instagram.com/p/${match[1]}/` : null;
  } catch { return null; }
}

function metricName(metric) {
  const aliases = { reactions: 'likes', likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves', reach: 'reach', views: 'views', impressions: 'impressions', follows: 'follows', engagementrate: 'engagement_rate', profilevisits: 'profile_visits' };
  return aliases[slug(metric.type).replace(/_/g, '')] || aliases[slug(metric.name).replace(/[_.]/g, '')] || slug(metric.name);
}

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
  const add = (metrics, source, fallbackMeasuredAt) => {
    if (!Array.isArray(metrics)) return;
    for (const metric of metrics) {
      if (!metric || !finite(metric.value)) continue;
      const name = metricName(metric);
      if (!name) continue;
      const measureUnit = unit(metric.unit);
      const key = `${name}|${measureUnit}`;
      // Direct provider values take precedence over duplicated imported observations.
      const measured = timestamp(metric.measuredAt || fallbackMeasuredAt);
      if (!result.has(key)) result.set(key, { name, unit: measureUnit, value: metric.value, source, sourcePostId: post.id, type: slug(metric.type), measuredAt: measured === null ? null : new Date(measured).toISOString() });
    }
  };
  add(post.metrics, 'buffer', post.metricsUpdatedAt);
  for (const row of performanceRows) {
    if ((row.postId || row.buffer_post_id || row.post_id) !== post.id) continue;
    add(row.metrics, 'performance_log', row.measuredAt || row.observedAt || row.measured_at);
  }
  return [...result.values()];
}

function publicationEntries(posts, performance) {
  const groups = new Map();
  // An imported mirror of a marked test is still a test even if its caption lost the marker.
  const testLinks = new Set(posts.filter(isTest).map(post => instagramPublicationUrl(post.externalLink)).filter(Boolean));
  for (const post of posts.filter(post => post.status === 'sent' && !isTest(post))) {
    const url = instagramPublicationUrl(post.externalLink);
    if (url && testLinks.has(url)) continue;
    const key = url || `buffer:${post.id}`;
    const entry = groups.get(key) || { post, key, externalLink: url, records: [], metrics: [], metricConflicts: [] };
    entry.records.push(post);
    groups.set(key, entry);
  }
  for (const entry of groups.values()) {
    const candidates = new Map();
    for (const post of entry.records) for (const metric of observations(post, performance)) {
      const key = `${metric.name}|${metric.unit}`;
      const values = candidates.get(key) || [];
      values.push(metric); candidates.set(key, values);
    }
    for (const [key, values] of candidates) {
      const sorted = values.sort((a,b) => String(b.measuredAt || '').localeCompare(String(a.measuredAt || '')));
      const latest = sorted[0];
      // Select a newer measured snapshot only when all conflicting values have dates.
      const conflicts = sorted.filter(value => value.value !== latest.value && (!value.measuredAt || !latest.measuredAt || value.measuredAt === latest.measuredAt));
      if (conflicts.length) entry.metricConflicts.push(key); else entry.metrics.push(latest);
    }
  }
  return [...groups.values()];
}

function measurementRange(observations) {
  const times = observations.map(metric => metric.measuredAt).filter(Boolean).sort();
  return { oldestAt: times[0] || null, newestAt: times.at(-1) || null,
    knownCount: times.length, unknownCount: observations.length - times.length };
}

function summarizeMetrics(entries, includeDefaults = true) {
  const groups = new Map();
  for (const entry of entries) for (const metric of entry.metrics) {
    const key = `${metric.name}|${metric.unit}`;
    const group = groups.get(key) || { name: metric.name, unit: metric.unit, values: [], postIds: [], sources: new Set(), observations: [], ratio: false };
    group.values.push(metric.value);
    group.postIds.push(entry.post.id);
    group.sources.add(metric.source);
    group.observations.push(metric);
    group.ratio ||= ['percent', 'ratio', 'rate'].includes(metric.unit) || ['percentage', 'percent', 'ratio', 'rate'].includes(metric.type);
    groups.set(key, group);
  }
  const metrics = [...groups.values()].map(group => {
    const total = group.values.reduce((sum, value) => sum + value, 0);
    const average = total / group.values.length;
    return { name: group.name, label: group.name.replace(/_/g, ' '), unit: group.unit,
      value: group.ratio ? average : total, total: group.ratio ? null : total, average,
      sampleSize: group.values.length, available: true, aggregation: group.ratio ? 'mean_of_observed_post_rates' : 'sum_of_observed_post_values',
      postIds: group.postIds, sources: [...group.sources], measurement: measurementRange(group.observations) };
  });
  if (includeDefaults) for (const name of DEFAULT_METRICS) if (!metrics.some(metric => metric.name === name)) metrics.push({ name, label: name, unit: 'count', value: null, total: null, average: null, sampleSize: 0, available: false, aggregation: null, postIds: [], sources: [], measurement: measurementRange([]) });
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
  const entries = publicationEntries(unique, performance);
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
  for (const entry of entries) {
    const ids = new Set(entry.records.flatMap(post => [...(owners.get(post.id) || [])]));
    for (const story of storyRows) if (entry.externalLink && story.publishing?.reportedInstagramLinks?.some(link => instagramPublicationUrl(link.url) === entry.externalLink)) ids.add(story.id || story);
    entry.storyIds = [...ids].filter(id => typeof id === 'string');
    entry.story = ids.size === 1 ? storyRows.find(story => ids.has(story.id)) : null;
  }
  for (const story of storyRows) {
    const name = string(story.territory || story.subject).trim() || 'Unclassified';
    const category = categories.get(name) || { name, stories: 0, sentPostIds: new Set() };
    category.stories++;
    for (const entry of entries) if (entry.story?.id === story.id) category.sentPostIds.add(entry.post.id);
    categories.set(name, category);
  }
  const limitations = [
    'Buffer sent is provider-reported state, not independent Instagram verification.',
    'Missing metrics remain unavailable; zero means the provider supplied a numeric zero.',
    'Metric totals use only measured editorial sent posts; internal tests and conflicting duplicate records are excluded.',
    'Reach totals sum post-level measurements and are not a deduplicated audience count.',
    'No engagement rate, causal performance recommendation, optimal posting time or stage duration is inferred from missing data.',
    'Production bottlenecks are current snapshot counts; elapsed time per stage requires transition history.',
    'Snapshot fetch time is separate from provider measurement time. Measurements without reported timestamps have unknown recency.',
    'Instagram mirrors are combined only when the exact Instagram post link matches. Matching captions or nearby send times do not establish identity.',
    'An Instagram link is a provider-reported identity reference, not an independent publication or account-ownership verification.',
  ];
  if (conflicting.size) limitations.push('Conflicting repeated post IDs were excluded from calculations until reconciled.');
  const unmapped = entries.filter(entry => !entry.storyIds.length).length;
  const publications = entries.map(entry => {
    const measurements = measurementRange(entry.metrics);
    return { id: entry.post.id, bufferPostIds: entry.records.map(post => post.id), externalLink: entry.externalLink,
      identityBasis: entry.externalLink ? 'exact_instagram_permalink' : 'buffer_post_id',
      storyId: entry.story?.id || null, storyTitle: entry.story?.title || null,
      storyMatch: entry.story ? 'exact' : entry.storyIds.length > 1 ? 'ambiguous' : 'unmatched',
      captionPreview: string(entry.post.text).slice(0, 160), sentAt: entry.post.sentAt || null,
      metrics: entry.metrics, metricConflicts: entry.metricConflicts, measurement: measurements,
      recency: !measurements.newestAt || measurements.unknownCount || timestamp(observedAt) === null || timestamp(observedAt) < timestamp(measurements.newestAt) ? 'unknown' : timestamp(observedAt) - timestamp(measurements.oldestAt) > 72 * 3_600_000 ? 'older_than_72_hours' : 'recent',
    };
  }).sort((a,b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')) || a.id.localeCompare(b.id));
  const editorialFeedback = entries.filter(entry => entry.story?.revision && entry.metrics.length && timestamp(observedAt) !== null).map(entry => {
    const recent = entry.metrics.filter(metric => metric.measuredAt && timestamp(observedAt) - timestamp(metric.measuredAt) >= 0 && timestamp(observedAt) - timestamp(metric.measuredAt) <= 7 * 86_400_000);
    const newestAt = measurementRange(recent).newestAt;
    return { kind: 'publication_observation', reviewer: 'provider', basis: 'measured_publication',
      storyId: entry.story.id, sourceRevision: entry.story.revision, createdAt: newestAt,
      publication: { bufferPostIds: entry.records.map(post => post.id), externalLink: entry.externalLink, identityBasis: entry.externalLink ? 'exact_instagram_permalink' : 'buffer_post_id' },
      observations: recent.map(({name,unit,value,measuredAt}) => ({name,unit,value,measuredAt})),
      reason: `Provider observation, not founder feedback. Observed audience measurements for ${string(entry.story.title).slice(0,120) || 'this post'}: ${recent.map(metric => `${metric.name} ${metric.value} ${metric.unit}`).join('; ')}. Descriptive evidence only; do not infer what caused it, recommend a genre ban, or claim the current caption or image version produced it.`,
    };
  }).filter(note => note.observations.length).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  return { observedAt: timestamp(observedAt) === null ? null : new Date(observedAt).toISOString(),
    coverage: { posts: unique.length, inputRows: input.length, duplicateRows, conflictingPostIds: [...conflicting],
      sentPosts: unique.filter(post => post.status === 'sent').length, eligibleSentPosts: eligible.length,
      eligiblePublications: entries.length, combinedMirrorRecords: entries.reduce((n,entry) => n + entry.records.length - 1, 0),
      postsWithMetrics: withMetrics.length, metricCoverage: entries.length ? withMetrics.length / entries.length : null,
      storyMatchedPublications: entries.filter(entry => entry.story).length,
      unmatchedMeasuredPublications: entries.filter(entry => entry.metrics.length && !entry.story).length,
      ambiguousPublicationMappings: entries.filter(entry => entry.storyIds.length > 1).map(entry => entry.post.id),
      metricConflicts: entries.reduce((n,entry) => n + entry.metricConflicts.length, 0),
      unmappedEditorialSentPosts: unmapped, ambiguousPostMappings, performanceRows: performance.length,
      unlinkedPerformanceRows: performance.filter(row => !unique.some(post => (row.postId || row.buffer_post_id || row.post_id) === post.id)).length,
      metricSource: 'buffer_or_explicit_performance_observations' },
    publications, editorialFeedback,
    metrics, measurementRange: (() => { const range = measurementRange(entries.flatMap(entry => entry.metrics)); return {
      oldestAt: range.oldestAt, newestAt: range.newestAt, knownObservationCount: range.knownCount, unknownObservationCount: range.unknownCount,
    }; })(), publishing: publishingSummary(unique, timezone),
    bottlenecks: [...blockerMap.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    stages: [...stageMap].map(([name, count]) => ({ name, count })), stageDurationsAvailable: false,
    categories: [...categories.values()].map(category => {
      const included = entries.filter(entry => category.sentPostIds.has(entry.post.id));
      return { name: category.name, stories: category.stories, sentPosts: category.sentPostIds.size,
        postsWithMetrics: included.filter(entry => entry.metrics.length).length, metrics: summarizeMetrics(included, false) };
    }).sort((a, b) => b.stories - a.stories || a.name.localeCompare(b.name)),
    limitations };
}
