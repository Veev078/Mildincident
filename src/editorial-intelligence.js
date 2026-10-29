// Editorial decision support from text/metadata only. No source fetch, pixel/audio
// analysis, rights clearance, automatic merge or publication decision occurs here.
const TRACKING = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i;
const STOP = new Set('a an and are as at be been before by for from had has have in into is it its of on or that the their these this to was were when where which who with'.split(' '));
const string = value => typeof value === 'string' ? value : '';
const normalized = value => string(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const tokens = value => [...new Set((normalized(value).match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 2 && !STOP.has(t)))];
const tags = value => (Array.isArray(value) ? value : string(value).split(/[|,;]/)).map(t => string(t).trim()).filter(Boolean);
const safeText = value => string(value).slice(0, 4000);

export function canonicalizeSourceUrl(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\u0000-\u0020\u007f]/u.test(value)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  // Preserve image identifiers, non-tracking parameters, parameter order and
  // fragments: these can distinguish an actual file, PDF page or archive item.
  return url.href;
}

export function deduplicateCitations(research = []) {
  const groups = new Map();
  const issues = [];
  for (const [index, citation] of (Array.isArray(research) ? research : []).entries()) {
    const url = canonicalizeSourceUrl(citation?.url || citation?.source_url);
    if (!url) { issues.push({ code: 'INVALID_SOURCE_URL', index, message: 'A citation needs a valid HTTPS source reference without credentials.' }); continue; }
    const group = groups.get(url) || { url, sourceNames: [], claims: [], verifiedByThisTool: false };
    const name = safeText(citation.sourceName || citation.source_name).trim();
    const claim = safeText(citation.claim).trim();
    const claimType = safeText(citation.claimType || citation.claim_type).trim() || 'unspecified';
    if (name && !group.sourceNames.includes(name)) group.sourceNames.push(name);
    if (claim && !group.claims.some(c => c.claim === claim && c.claimType === claimType)) group.claims.push({ claim, claimType });
    groups.set(url, group);
  }
  if (groups.size) issues.push({ code: 'SOURCES_NOT_REVERIFIED', message: 'These are stored source references. Their content, credibility and factual support have not been checked by this tool.' });
  return { sources: [...groups.values()], issues };
}

export function lintCaption(value, { research = [] } = {}) {
  const caption = string(value);
  const characters = [...caption].length;
  const issues = [];
  const add = (code, severity, message) => issues.push({ code, severity, message });
  if (!caption.trim()) add('EMPTY_CAPTION', 'error', 'Write a caption before preparing a handoff.');
  else if (characters < 25) add('SHORT_CAPTION', 'warning', 'This caption may still be an outline. Review the narrative and attribution.');
  if (characters > 2200) add('CAPTION_TOO_LONG', 'error', 'Caption exceeds the 2,200-code-point limit used by the local preflight.');
  if (/INTERNAL[\s\S]{0,60}TEST|DO\s+NOT\s+PUBLISH/iu.test(caption)) add('INTERNAL_TEST_CAPTION', 'error', 'Internal-test and do-not-publish captions cannot be handed off.');
  if (/\b(?:TODO|TK|TBC)\b|\[(?:insert|add|source|caption|credit)[^\]]*\]/iu.test(caption)) add('UNFINISHED_PLACEHOLDER', 'warning', 'Resolve editorial placeholders before final review.');
  if (/locate original production photographs|can anchor a .*photo essay|all photographic reuse requires|check rights before selecting|source previews are unlicensed/iu.test(caption)) add('PRODUCTION_NOTES_IN_CAPTION', 'warning', 'This caption contains production directions. Keep the published narrative separate from internal notes.');
  if (/\b(?:verified_fact|hypothesis|interpretation)\s*:/iu.test(caption)) add('DOSSIER_LABEL_IN_CAPTION', 'warning', 'Research labels appear in the caption; review the final editorial wording.');
  const { sources } = deduplicateCitations(research);
  const factualCues = /\b(?:1[5-9]\d{2}|20\d{2}|first|only|oldest|largest|never|always)\b/iu.test(caption);
  if (factualCues && !sources.length) add('FACTUAL_CLAIMS_WITHOUT_SOURCES', 'warning', 'Dates or categorical claims need supporting original-source references.');
  if (sources.length && factualCues) add('VERIFY_FACTUAL_CLAIMS', 'info', 'Check dates and categorical claims against the cited passages; stored citations do not prove the wording.');
  return { characters, remaining: 2200 - characters, limit: 2200, counting: 'unicode_code_points',
    words: (caption.match(/[\p{L}\p{N}]+/gu) || []).length, issues, hasSources: sources.length > 0, sourceVerification: 'not_assessed' };
}

function overlap(left, right) {
  const a = new Set(left), b = new Set(right);
  if (!a.size || !b.size) return { similarity: 0, common: [] };
  const common = [...a].filter(t => b.has(t));
  return { similarity: (2 * common.length) / (a.size + b.size), common };
}

export function findDuplicateStories(stories = [], { threshold = 0.64 } = {}) {
  const candidates = [];
  const valid = (Array.isArray(stories) ? stories : []).filter(s => s?.id);
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const a = valid[i], b = valid[j];
    if (a.id === b.id) continue;
    const title = overlap(tokens(a.title), tokens(b.title));
    const context = overlap(tokens(`${a.subject || ''} ${a.hook || ''}`), tokens(`${b.subject || ''} ${b.hook || ''}`));
    const exactTitle = tokens(a.title).length > 0 && normalized(a.title).trim() === normalized(b.title).trim();
    const score = exactTitle ? 1 : title.similarity * 0.75 + context.similarity * 0.25;
    if (score < threshold || (!exactTitle && title.common.length < 2)) continue;
    const reasons = [exactTitle ? 'The stored titles match.' : `Shared title terms: ${title.common.slice(0, 6).join(', ')}.`];
    if (context.common.length) reasons.push(`Shared subject/hook terms: ${context.common.slice(0, 6).join(', ')}.`);
    reasons.push('Review the dossiers and image selections before deciding whether these are the same story. No records were merged.');
    candidates.push({ storyIds: [a.id, b.id], score: Math.round(score * 1000) / 1000, reasons, automaticallyMerged: false });
  }
  return candidates.sort((a, b) => b.score - a.score || a.storyIds.join('|').localeCompare(b.storyIds.join('|')));
}

// Directional broadening only: a named venue/scene/creature can suggest a theme,
// but a broad theme must never invent that named subject in the story.
const CONTEXT_EXPANSIONS = [
  [['batcave', 'goth', 'postpunk', 'post-punk'], ['goth', 'nightlife']],
  [['nightlife', 'nightclub', 'nightclubs', 'club', 'clubs'], ['nightlife']],
  [['film', 'cinema', 'cinematic', 'movie', 'movies', 'filmmaking', 'filmcraft'], ['film', 'cinema']],
  [['fashion', 'harajuku', 'streetstyle', 'street-style'], ['fashion']],
  [['photography', 'photograph', 'photographs', 'photographer', 'photo'], ['photography']],
  [['horror', 'monster', 'monsters', 'werewolf', 'fright'], ['horror']],
  [['home', 'domestic', 'house', 'family'], ['domestic']],
  [['seaside', 'ocean', 'beach', 'boardwalk'], ['seaside']],
  [['industrial', 'machinery', 'mechanical', 'machines'], ['industrial']],
];

function contextTokens(story) {
  const selected = new Set(Array.isArray(story.selectedAssetIds) ? story.selectedAssetIds : []);
  const photos = (Array.isArray(story.media) ? story.media : []).filter(m => m && selected.has(m.id));
  const text = `${story.title || ''} ${story.subject || ''} ${story.hook || ''} ${story.caption || ''} ${photos.map(p => `${p.title || ''} ${p.creator || ''}`).join(' ')}`;
  const literal = new Set(tokens(text));
  const result = new Set(literal);
  for (const [triggers, themes] of CONTEXT_EXPANSIONS) if (triggers.some(t => literal.has(t))) for (const t of themes) result.add(t);
  for (const match of text.matchAll(/\b(1[6-9]\d{2}|20\d{2})(?:s)?\b/g)) result.add(`${Math.floor(Number(match[1]) / 10) * 10}s`);
  return { literal, themes: result };
}

export function rankSoundtracks(story = {}, catalog = [], { limit = 3 } = {}) {
  const maximum = Number.isInteger(limit) ? Math.max(0, Math.min(10, limit)) : 3;
  if (!maximum) return [];
  const context = contextTokens(story);
  const selected = story.musicSelection;
  const selectionKey = selected?.track && selected?.artist ? normalized(`${selected.artist}|${selected.track}`).trim() : null;
  const seen = new Set();
  const ranked = [];
  for (const track of Array.isArray(catalog) ? catalog : []) {
    if (!track || typeof track !== 'object') continue;
    if ([false, 0, 'false', 'inactive'].includes(track.active) || !track.track || !track.artist) continue;
    const key = normalized(`${track.artist}|${track.track}`).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = [];
    const literalMatches = [];
    const inferredMatches = [];
    let score = 0;
    for (const [field, weight] of [['themes', 3], ['moods', 2], ['eras', 1]]) {
      for (const tag of tags(track[field])) {
        const words = tokens(tag);
        if (!words.length || !words.every(w => context.themes.has(w))) continue;
        score += weight;
        if (!matches.includes(tag)) matches.push(tag);
        const target = words.every(w => context.literal.has(w)) ? literalMatches : inferredMatches;
        if (!target.includes(tag)) target.push(tag);
      }
    }
    const retained = selectionKey === key;
    if (!score && !retained) continue;
    ranked.push({ track: string(track.track), artist: string(track.artist), score, selected: retained,
      reason: retained ? 'Your saved music direction is retained. Availability and permissions still need review.' :
        [literalMatches.length ? `Literal metadata cues: ${literalMatches.slice(0, 4).join(', ')}.` : '', inferredMatches.length ? `Broader themes inferred from those cues: ${inferredMatches.slice(0, 4).join(', ')}; review the fit.` : ''].filter(Boolean).join(' '),
      matchedTags: matches, literalMatchedTags: literalMatches, inferredMatchedTags: inferredMatches, basis: 'editorial_metadata', availability: 'not_verified', licenseVerified: false });
  }
  if (selectionKey && !ranked.some(r => r.selected)) ranked.push({ track: string(selected.track), artist: string(selected.artist), score: 0, selected: true,
    reason: 'Your saved music direction is retained even though it is outside the current catalog.', matchedTags: [], basis: 'saved_preference', availability: 'not_verified', licenseVerified: false });
  ranked.sort((a, b) => Number(b.selected) - Number(a.selected) || b.score - a.score || a.artist.localeCompare(b.artist) || a.track.localeCompare(b.track));
  const result = [];
  const artists = new Set();
  for (const entry of ranked) if (entry.selected || !artists.has(normalized(entry.artist))) {
    result.push(entry); artists.add(normalized(entry.artist)); if (result.length >= maximum) return result;
  }
  for (const entry of ranked) if (!result.includes(entry)) { result.push(entry); if (result.length >= maximum) break; }
  return result;
}

export function analyzeStory(story = {}, { catalog = [] } = {}) {
  const citations = deduplicateCitations(story.research);
  const selected = new Set(Array.isArray(story.selectedAssetIds) ? story.selectedAssetIds : []);
  const media = (Array.isArray(story.media) ? story.media : []).filter(m => m && typeof m === 'object');
  const selectedMedia = media.filter(m => selected.has(m.id));
  return { caption: lintCaption(story.caption, { research: story.research }), sources: citations.sources,
    sourceIssues: citations.issues, musicRecommendations: rankSoundtracks(story, catalog),
    rights: { selectedCount: selected.size, pendingCount: selectedMedia.filter(m => m.rightsStatus !== 'cleared').length + [...selected].filter(id => !media.some(m => m.id === id)).length,
      missingAssetIds: [...selected].filter(id => !media.some(m => m.id === id)), automaticallyCleared: false },
    analysisBasis: 'stored_text_and_metadata', visualAnalysisPerformed: false, audioAnalysisPerformed: false };
}
