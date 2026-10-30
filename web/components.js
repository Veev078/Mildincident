export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const human = value => String(value || 'Not recorded').replace(/_/g, ' ').replace(/^\w/, char => char.toUpperCase());
export const safeUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
};
export const date = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(value));
};
export const storyUrl = (id, tab = 'overview') => `#/story/${encodeURIComponent(id)}/${tab}`;
export const effective = story => ({
  title: story.localDraft?.title ?? story.title ?? '',
  hook: story.localDraft?.hook ?? story.hook ?? '',
  format: story.localDraft?.format ?? story.format ?? 'carousel',
  targetSlideCount: story.localDraft?.targetSlideCount ?? story.targetSlideCount ?? 5,
  caption: story.localDraft?.caption ?? story.caption ?? '',
  selectedAssetIds: story.localDraft?.selectedAssetIds ?? story.selectedAssetIds ?? [],
  notes: story.localDraft?.notes ?? '',
  musicSelection: story.localDraft && Object.hasOwn(story.localDraft, 'musicSelection') ? story.localDraft.musicSelection : story.musicSelection ?? null,
  creativeBrief: story.localDraft?.creativeBrief ?? null,
});
// Display local editorial choices without changing the source object or its revision.
export const workingStory = story => {
  const { title, hook, format, targetSlideCount } = effective(story);
  return { ...story, title, hook, format, targetSlideCount, sourceEditorial: story.sourceEditorial || {title:story.title,hook:story.hook,format:story.format,targetSlideCount:story.targetSlideCount} };
};
export const mediaFor = story => {
  const ids = effective(story).selectedAssetIds;
  return ids.map(id => (story.media || []).find(asset => asset.id === id)).filter(Boolean);
};
export function badge(text, tone = '') { return `<span class="badge ${esc(tone)}">${esc(text)}</span>`; }
export function stateLabel(story) {
  const observed = story.publishing?.observed;
  if (observed === 'instagram_posted_verified') return { label: 'Instagram verified', tone: 'good', group: 'archive' };
  if (observed === 'buffer_sent') return { label: 'Buffer reports sent', tone: 'quiet', group: 'archive' };
  if (observed === 'buffer_scheduled') return { label: 'Scheduled in Buffer', tone: 'quiet', group: 'publishing' };
  if (observed === 'buffer_unscheduled_draft') return { label: 'Buffer draft', tone: 'good', group: 'publishing' };
  if (observed === 'buffer_error' || story.publishing?.multipleHandoffs) return { label: 'Handoff review', tone: 'warn', group: 'publishing' };
  if ((story.blockers || []).length) return { label: 'In production', tone: 'quiet', group: 'production' };
  return { label: human(story.stage), tone: '', group: 'research' };
}
export function nextAction(story) {
  if (story.localDraft?.stale) return { label: 'Review source changes', tab: 'overview', reason: 'The source revision has changed since this local draft.' };
  if (story.publishing?.multipleHandoffs || story.publishing?.requiresReview) return { label: 'Review publishing evidence', tab: 'publishing', reason: 'Resolve the existing handoff before preparing another.' };
  if (['buffer_sent', 'instagram_posted_verified', 'buffer_scheduled'].includes(story.publishing?.observed)) return { label: 'Review publication history', tab: 'publishing', reason: 'This story already has provider activity.' };
  if (story.publishing?.observed === 'buffer_unscheduled_draft') return { label: 'Review existing Buffer draft', tab: 'publishing', reason: 'Continue the existing draft; image rights remain a separate decision.' };
  if (!story.packageVersion) return { label: 'Review research', tab: 'research', reason: 'An existing production package has not been recorded.' };
  if (!effective(story).selectedAssetIds.length) return { label: 'Choose the photographs', tab: 'images', reason: 'Build the story from its existing image candidates.' };
  if (story.rightsStatus !== 'complete') return { label: 'Review image provenance', tab: 'images', reason: 'Selected images still require per-image permission review.' };
  if (!effective(story).caption.trim()) return { label: 'Develop the caption', tab: 'caption', reason: 'A caption has not been saved.' };
  return { label: 'Review the carousel', tab: 'carousel', reason: 'Check image order, caption and current package together.' };
}
export function previewUrl(value) {
  if (typeof value === 'string' && /^\/api\/stories\/CON-[A-Za-z0-9_-]{1,120}\/assets\/[^/?#\\\s]+\/preview\?hash=[a-f0-9]{64}$/.test(value)) return value;
  return safeUrl(value);
}
export function image(asset, { className = '', index, storyId, eager = false } = {}) {
  const url = previewUrl(asset?.previewUrl);
  return `<div class="photo ${esc(className)} ${url ? '' : 'no-preview'}">${url ? `<img src="${esc(url)}" alt="${esc(asset.title || 'Archival image candidate')}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer"><span class="preview-status" role="status">Loading preview…</span><button type="button" class="preview-retry small-button" data-action="retry-preview" hidden>Retry preview</button>` : `<span class="photo-placeholder"><span aria-hidden="true">◫</span><small>No preview available</small></span>`}${index !== undefined ? `<span class="photo-number">${String(index + 1).padStart(2, '0')}</span>` : ''}${storyId && asset ? `<button class="photo-expand" data-action="inspect" data-story="${esc(storyId)}" data-asset="${esc(asset.id)}" aria-label="Review provenance: ${esc(asset.title || 'image')}">↗</button>` : ''}</div>`;
}
export function empty(title, message, action = '') { return `<div class="empty-state"><span aria-hidden="true">↳</span><h3>${esc(title)}</h3><p>${esc(message)}</p>${action}</div>`; }
export function external(url, label, className = '') {
  const safe = safeUrl(url);
  return safe ? `<a class="${esc(className)}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>` : `<span class="muted">${esc(label)} · link unavailable</span>`;
}
export function sectionHeading(title, detail = '', action = '') { return `<div class="section-heading"><div><h2>${esc(title)}</h2>${detail ? `<p>${esc(detail)}</p>` : ''}</div>${action}</div>`; }
export function storyCard(story, { compact = false } = {}) {
  const status = stateLabel(story);
  const candidate = mediaFor(story)[0] || story.media?.[0];
  const action = nextAction(story);
  return `<article class="story-card ${compact ? 'compact' : ''}"><a class="story-image-link" href="${storyUrl(story.id)}" aria-label="Open ${esc(story.title)}">${image(candidate, { eager: !compact })}</a><div class="story-card-copy"><div class="card-kicker"><span>${esc(story.subject || story.format || 'Editorial story')}</span>${badge(status.label, status.tone)}</div><h3><a href="${storyUrl(story.id)}">${esc(story.title)}</a></h3><p>${esc(story.hook || action.reason)}</p><div class="card-foot"><span>${effective(story).selectedAssetIds.length} selected · ${esc(story.media?.length || 0)} candidates</span><a href="${storyUrl(story.id, action.tab)}">${esc(action.label)} <span aria-hidden="true">→</span></a></div></div></article>`;
}
export function blockers(story) {
  return (story.blockers || []).length ? `<ul class="blocker-list">${story.blockers.map(item => `<li><span aria-hidden="true">○</span>${esc(human(typeof item === 'string' ? item : item.message || item.code))}</li>`).join('')}</ul>` : '<p class="muted">No additional package blockers reported. Publication approval and image rights still require review.</p>';
}
export function draftNotice(story) {
  if (story.localDraft?.stale) return `<div class="notice warning"><strong>Source revision changed</strong><p>This local draft was based on an earlier package. Editing is paused so it cannot silently replace newer work. Compare it with the current source before deciding which local edits to retain.</p><button class="small-button" data-action="review-stale" data-story="${esc(story.id)}">Compare source and local draft →</button></div>`;
  return `<div class="local-notice"><span class="status-dot" aria-hidden="true"></span><span data-save-status>${story.localDraft ? `${story.storageMode==='hosted'?'Saved to private Studio':'Saved locally'} · ${esc(date(story.localDraft.updatedAt))}` : 'Edits save privately in this development workspace'}</span><small>Not synced to n8n</small></div>`;
}
export function fieldDisabled(story) { return story.localDraft?.stale ? 'disabled' : ''; }
export function proposalContent(story, label = 'Download local proposal ↗', className = 'button button-light') {
  return story.localDraft ? `<a class="${esc(className)}" href="/api/stories/${encodeURIComponent(story.id)}/proposal" download>${esc(label)}</a>` : `<button class="${esc(className)}" disabled title="Make a local edit to enable proposal download">${esc(label)}</button><small class="proposal-hint">Make a local edit to enable download.</small>`;
}
export function proposalControl(story, label = 'Download local proposal ↗', className = 'button button-light') {
  return `<span class="proposal-control" data-proposal-for="${esc(story.id)}" data-proposal-label="${esc(label)}" data-proposal-class="${esc(className)}">${proposalContent(story, label, className)}</span>`;
}

export function matchesEditorialReview(asset, filter = 'all') {
  if (filter === 'all') return true;
  if (filter === 'unreviewed') return !asset.localReview;
  return ['shortlist','reject','hold'].includes(filter) && asset.localReview?.decision === filter;
}
export function editorialReviewFilter(value = 'all') {
  return `<label class="select-field">Editorial view<select id="image-editorial-filter" aria-label="Editorial view">${[['all','All decisions'],['shortlist','Shortlisted'],['reject','Rejected for this story'],['hold','Held for review'],['unreviewed','Not reviewed']].map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
