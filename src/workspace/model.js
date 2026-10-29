import { createHash } from 'node:crypto';
import { canonical } from '../package.js';
import { editorialReadiness } from '../reconciliation.js';
import { analyzeStory, findDuplicateStories } from '../editorial-intelligence.js';
import { calculateAnalytics } from '../analytics.js';
import { buildEditorialDirection } from '../editorial-direction.js';
import { analyzeImageCuration } from '../image-curation.js';

export const WORKSPACE_TABLES = Object.freeze({
  stories: '5AxSMHqi15TNwBZl', packages: 'cCFwaHyKVVTZvr5s', media: 'ARiuqg92GgVSpZMr',
  imports: 'qQgPtQvq3V0hyZia', lifecycle: 'xxm1mdsO2pukqQjE', archives: 'Mf1GWRTseSOioyV6',
  soundtrack: 'UogVP7r92OOTCXd8', soundSelections: 'BB5JIwLWNs13m2Tv', imageArchives: '0Jx83xL1evH0R8l2',
  performance: 'UQiRdrpUdp5czWRy', research: 'cbfqgjpt5gR4Ss2P',
});

export function browserUrl(value) {
  if (typeof value !== 'string' || value.length > 8000) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return '';
    if ([...url.searchParams.keys()].some(key => {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      return /token$|secret$|password$/.test(normalized) || /^(?:apikey|key|signature|sig|credential|credentials|authorization|auth|oauth)/.test(normalized) || /^(?:xamz|xgoog)/.test(normalized);
    })) return '';
    return url.href;
  } catch { return ''; }
}

function jsonArray(value) {
  if (Array.isArray(value)) return value;
  try { const result = JSON.parse(String(value || '[]')); return Array.isArray(result) ? result : []; }
  catch { return []; }
}

function researchFor(story, records) {
  const cited = jsonArray(story.citations).filter(c => c && typeof c === 'object');
  const urls = new Set(cited.map(c => c.source_url));
  // Subject similarity is not an authoritative story/dossier relationship.
  const extra = (records.research || []).filter(r => urls.has(r.source_url));
  return [...cited, ...extra].map(r => ({ claim: String(r.claim || ''), claimType: String(r.claim_type || 'unclassified'),
    sourceName: String(r.source_name || 'Source'), url: browserUrl(r.source_url) }));
}

/** Browser contract is built by allowlist. Never serialize raw n8n rows or founder tokens. */
export function buildWorkspace(snapshot, drafts = new Map()) {
  const { records, buffer } = snapshot;
  const stories = records.stories.map(row => {
    const packages = records.packages.filter(p => p.concept_id === row.concept_id);
    const p = packages.length === 1 ? packages[0] : null;
    const selectedAssetIds = jsonArray(p?.slide_sequence_asset_ids).filter(id => typeof id === 'string');
    const media = records.media.filter(m => m.concept_id === row.concept_id).map(m => ({
      id: String(m.asset_id || ''), title: String(m.title || 'Archival image'), creator: String(m.creator || ''),
      sourceUrl: browserUrl(m.source_page_url), previewUrl: browserUrl(m.thumb_url),
      license: String(m.license || ''), rightsStatus: String(m.rights_status || 'unreviewed'),
      provider: String(m.provider || ''), width: Number(m.width) || null, height: Number(m.height) || null,
      selected: selectedAssetIds.includes(m.asset_id),
    }));
    const lifecycle = records.lifecycle.find(l => l.concept_id === row.concept_id);
    const readiness = editorialReadiness({ story: row, productionPackage: p, media: records.media, imports: records.imports,
      posts: buffer.posts, lifecycle, auditComplete: buffer.complete });
    const sound = records.soundSelections.find(s => s.concept_id === row.concept_id);
    const story = {
      id: String(row.concept_id), title: String(row.title || 'Untitled story'), subject: String(row.subject || ''),
      hook: String(row.hook || ''), format: String(row.format || p?.format || 'carousel'),
      stage: String(row.stage || 'unclassified'), approvalStatus: String(row.approval_status || 'unreviewed'),
      caption: String(p?.caption_draft || row.caption || ''), packageVersion: p?.production_version || null,
      sourceNotes: String(p?.founder_notes || row.founder_feedback || ''),
      productionNotes: String(p?.designer_notes || ''), sourceReviewNotes: String(p?.source_claims_review_notes || ''),
      selectedAssetIds, targetSlideCount: Number(p?.target_slide_count) || (row.format === 'single_image' ? 1 : 5),
      rightsStatus: String(p?.rights_review_status || 'unreviewed'), sourceClaimsReviewed: p?.source_claims_reviewed === true,
      blockers: [...readiness.blockers, ...(packages.length > 1 ? ['AMBIGUOUS_PRODUCTION_PACKAGE'] : [])],
      research: researchFor(row, records), media,
      musicSelection: sound ? { track: String(sound.track || ''), artist: String(sound.artist || '') } : null,
      publishing: { ...readiness.observation, reportedInstagramLinks: readiness.observation.reportedInstagramLinks
        .map(link => ({ postId: link.postId, url: browserUrl(link.url) })).filter(link => link.url) },
      updatedAt: p?.updatedAt || row.updatedAt || null,
    };
    story.revision = createHash('sha256').update(canonical({
      title: story.title, hook: story.hook, subject: story.subject, stage: story.stage, caption: story.caption, packageVersion: story.packageVersion,
      format: story.format, approvalStatus: story.approvalStatus, targetSlideCount: story.targetSlideCount, sourceClaimsReviewed: story.sourceClaimsReviewed,
      sourceNotes: story.sourceNotes, productionNotes: story.productionNotes, sourceReviewNotes: story.sourceReviewNotes,
      selectedAssetIds, rightsStatus: story.rightsStatus, research: story.research, musicSelection: story.musicSelection,
      availableMedia: [...media].sort((a, b) => a.id.localeCompare(b.id)),
    })).digest('hex');
    for (const asset of media) { asset.sourcePreviewUrl = asset.previewUrl; asset.previewOrigin = 'source'; asset.localPreview = null; }
    const draft = drafts.get(story.id);
    story.localDraft = draft ? { ...draft, stale: draft.baseRevision !== story.revision } : null;
    const effective = draft && !story.localDraft.stale ? { ...story, ...draft } : story;
    story.intelligence = analyzeStory(effective, { catalog: records.soundtrack });
    story.musicRecommendations = story.intelligence.musicRecommendations;
    story.editorialDirection = buildEditorialDirection(effective, { creativeBrief: draft?.creativeBrief });
    story.imageCuration = analyzeImageCuration({ ...story, creativeBrief: draft?.creativeBrief }, { selectedAssetIds: draft?.selectedAssetIds || story.selectedAssetIds });
    return story;
  });
  const activityLabels = { draft_created: 'Draft creation recorded at transfer', reserved: 'Draft handoff reserved', review_needed: 'Handoff needs reconciliation', abandoned: 'Transfer stopped before Buffer' };
  const activity = records.imports.map(r => ({ id: `handoff-${r.id}`, type: 'handoff', storyId: r.concept_id,
    summary: activityLabels[r.state] || `Handoff state recorded: ${String(r.state || 'unknown').replace(/_/g, ' ')}`, at: r.imported_on || r.createdAt || null }))
    .filter(r => r.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  return {
    source: { kind: 'live_snapshot', observedAt: snapshot.observedAt,
      stale: Date.now() - Date.parse(snapshot.observedAt) > 15 * 60_000,
      warnings: [...(snapshot.warnings || [])], bufferObservedAt: buffer.observedAt, productionMutationsEnabled: false },
    stories,
    imageArchives: records.imageArchives.filter(a => a.active !== false).map(a => ({ id: String(a.archive_key || a.id),
      name: String(a.name || ''), url: browserUrl(a.home_url), searchDomain: String(a.search_domain || ''), rightsHint: String(a.rights_hint || '') })),
    activity,
    analytics: calculateAnalytics({ posts: buffer.posts, stories, performanceRows: records.performance || [], observedAt: snapshot.observedAt }),
    intelligence: { duplicates: findDuplicateStories(stories) },
    publishingPosts: buffer.posts.map(p => ({ id: p.id, channelId: p.channelId, status: p.status,
      imageCount: p.assets?.length || 0, sentAt: p.sentAt, dueAt: p.dueAt, externalLink: browserUrl(p.externalLink), instagramVerified: false })),
  };
}
