import { HandoffError, requireThat } from './errors.js';

// This is a user-supplied research reference, not a live analytics source or a
// set of production instructions. None of its claimed performance is imported.
const REFERENCE = Object.freeze({
  title: 'Deep dive: inspo accounts — what works, what doesn’t, and how to build it into mildincident',
  date: '2026-10-28', source: 'user_supplied_reference', verification: 'historical_user_reference_not_reverified',
  metricsComparable: false, timingVerified: false, accountCount: 6,
  limitations: [
    'The reference describes likes relative to followers, not reach-based engagement, saves, shares or audience demographics.',
    'Different account sizes, post ages, formats and sampling windows prevent a controlled performance comparison.',
    'Its examples and timing claims were not re-fetched or verified here; they are creative hypotheses, not growth forecasts.',
  ],
});

export const HOOK_TYPES = Object.freeze([
  'hidden_connection', 'true_form', 'secret_backstory', 'character_wardrobe', 'bizarre_fact', 'curated_list', 'timely_timeless',
]);
export const SOURCE_LANE_IDS = Object.freeze([
  'photographer_portfolios', 'independent_magazines', 'fashion_character', 'film_stills', 'music_nightlife', 'contemporary_visuals', 'artist_studios',
]);
export const SEQUENCE_ROLES = Object.freeze(['question', 'context', 'evidence', 'payoff']);
export const CAPTION_APPROACHES = Object.freeze(['sentence_case', 'lowercase', 'retain_source']);
const RATING_KEYS = ['hook', 'visual', 'shareability', 'timelessness'];
const BRIEF_KEYS = ['hookType', 'angle', 'visualIntent', 'captionApproach', 'sequenceRoles', 'ratings', 'notes', 'sourceLaneIds'];
const CODE = 'INVALID_CREATIVE_BRIEF';

function object(value, allowed, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), CODE, `${label} must be an object.`);
  requireThat(Object.keys(value).every(key => allowed.includes(key)), CODE, `${label} contains unsupported fields.`);
}

function text(value, maximum, label) {
  requireThat(typeof value === 'string' && [...value].length <= maximum, CODE, `${label} must be text of at most ${maximum} code points.`);
  requireThat(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), CODE, `${label} contains control characters.`);
  return value.trim();
}

/** Strict write validation. It never infers a right, edits a source record or rates an image. */
export function validateCreativeBrief(brief, story = {}) {
  object(brief, BRIEF_KEYS, 'Creative brief');
  const valid = {};
  if (Object.hasOwn(brief, 'hookType')) {
    requireThat(brief.hookType === '' || HOOK_TYPES.includes(brief.hookType), CODE, 'Choose one supported hook or leave it unset.');
    valid.hookType = brief.hookType;
  }
  for (const [key, max] of [['angle', 700], ['visualIntent', 1200], ['notes', 4000]]) {
    if (Object.hasOwn(brief, key)) valid[key] = text(brief[key], max, key);
  }
  if (Object.hasOwn(brief, 'captionApproach')) {
    requireThat(CAPTION_APPROACHES.includes(brief.captionApproach), CODE, 'Choose a supported caption approach.');
    valid.captionApproach = brief.captionApproach;
  }
  if (Object.hasOwn(brief, 'sequenceRoles')) {
    requireThat(Array.isArray(brief.sequenceRoles) && brief.sequenceRoles.length <= 20, CODE, 'Record at most 20 slide-role notes.');
    const media = new Set((Array.isArray(story?.media) ? story.media : []).filter(asset => asset && typeof asset.id === 'string').map(asset => asset.id));
    const seen = new Set();
    valid.sequenceRoles = brief.sequenceRoles.map(entry => {
      object(entry, ['assetId', 'role', 'note'], 'Slide role');
      const assetId = text(entry.assetId, 200, 'assetId');
      requireThat(assetId.length > 0 && media.has(assetId), CODE, 'Slide-role assets must belong to this current story.');
      requireThat(!seen.has(assetId), CODE, 'Each asset can have one primary sequence role.');
      requireThat(SEQUENCE_ROLES.includes(entry.role), CODE, 'Choose question, context, evidence or payoff for a slide role.');
      seen.add(assetId);
      return { assetId, role: entry.role, ...(Object.hasOwn(entry, 'note') ? { note: text(entry.note, 500, 'Slide-role note') } : {}) };
    });
  }
  if (Object.hasOwn(brief, 'ratings')) {
    object(brief.ratings, RATING_KEYS, 'Editorial ratings');
    valid.ratings = {};
    for (const key of RATING_KEYS) if (Object.hasOwn(brief.ratings, key)) {
      const value = brief.ratings[key];
      requireThat(value === null || (Number.isInteger(value) && value >= 1 && value <= 5), CODE, 'Ratings must be null or integers from 1 to 5.');
      valid.ratings[key] = value;
    }
  }
  if (Object.hasOwn(brief, 'sourceLaneIds')) {
    requireThat(Array.isArray(brief.sourceLaneIds) && brief.sourceLaneIds.length <= SOURCE_LANE_IDS.length, CODE, 'Source lanes must be a bounded list.');
    requireThat(brief.sourceLaneIds.every(id => SOURCE_LANE_IDS.includes(id)), CODE, 'Unknown source lane.');
    requireThat(new Set(brief.sourceLaneIds).size === brief.sourceLaneIds.length, CODE, 'Source lanes cannot be repeated.');
    valid.sourceLaneIds = [...brief.sourceLaneIds];
  }
  return valid;
}

const HOOKS = [
  { id: 'hidden_connection', label: 'The hidden connection', prompt: 'Which documented connection changes how this subject is understood?', evidenceNeeded: 'Trace both sides of the connection to attributable sources; a visual resemblance is not proof of a relationship.' },
  { id: 'true_form', label: 'The true form', prompt: 'What does a closer look reveal beneath the familiar surface?', evidenceNeeded: 'Use an original image, object record or creator explanation. Verify transformations and manipulation rather than presenting an inference as a fact.' },
  { id: 'secret_backstory', label: 'The secret backstory', prompt: 'Which sourced detail changes the reading of a known photograph or cultural moment?', evidenceNeeded: 'Find attributable contemporary reporting or a primary account. Do not invent what somebody knew, felt or intended.' },
  { id: 'character_wardrobe', label: 'The character wardrobe', prompt: 'What does a person’s clothing reveal about character, culture or a particular moment?', evidenceNeeded: 'Identify the person, date, context and photographer. Distinguish documentary imagery from costume, editorial styling and fictional characters.' },
  { id: 'bizarre_fact', label: 'The bizarre fact', prompt: 'Which unusual, precisely worded detail earns a second look?', evidenceNeeded: 'Check the unusual claim against original evidence and qualify uncertainty. A striking anecdote or archived caption is not sufficient corroboration by itself.' },
  { id: 'curated_list', label: 'The curated list', prompt: 'What clear editorial idea makes these otherwise separate images belong together?', evidenceNeeded: 'Keep provenance and context for every item. A roundup is a selection, not evidence of a ranking or a universal “best.”' },
  { id: 'timely_timeless', label: 'The timely-but-timeless', prompt: 'Can a seasonal entry point lead into a story that remains interesting after the date passes?', evidenceNeeded: 'Verify the underlying story separately from the timely angle. Dates are context, not authorization to schedule a post.' },
];

const LANES = [
  { id: 'photographer_portfolios', label: 'Photographer portfolios',
    description: 'Follow the photographer’s own archive, portfolio, books and contact details, including work outside institutional collections.',
    hosts: ['magnumphotos.com', 'derekridgersarchive.com', 'davidgodlis.com'], terms: 'photographer portfolio archive',
    examples: [{ name: 'Magnum Photos', url: 'https://www.magnumphotos.com/' }, { name: 'Derek Ridgers Archive', url: 'https://www.derekridgersarchive.com/' }, { name: 'David Godlis', url: 'https://www.davidgodlis.com/' }] },
  { id: 'independent_magazines', label: 'Independent magazines',
    description: 'Find image-led stories, interviews and credited editorials; follow the photographer or artist credit back to the original work.',
    hosts: ['dazeddigital.com', 'anothermag.com', 'theface.com', '032c.com'], terms: 'photography interview editorial',
    examples: [{ name: 'Dazed', url: 'https://www.dazeddigital.com/' }, { name: 'AnOther', url: 'https://www.anothermag.com/' }, { name: 'The Face', url: 'https://theface.com/' }] },
  { id: 'fashion_character', label: 'Fashion as character',
    description: 'Research a person, scene or fictional character through dress and context, rather than treating a product specification as a story.',
    hosts: ['anothermag.com', 'theface.com', 'i-d.co'], terms: 'wardrobe character style photographer',
    examples: [{ name: 'AnOther', url: 'https://www.anothermag.com/' }, { name: 'The Face', url: 'https://theface.com/' }, { name: 'i-D', url: 'https://i-d.co/' }] },
  { id: 'film_stills', label: 'Film and still-image archives',
    description: 'Look for original production stills, contact sheets, costume records and the circumstances behind a frame—not an invented archival image.',
    hosts: ['bfi.org.uk', 'oscars.org', 'criterion.com'], terms: 'production still photographs collection',
    examples: [{ name: 'BFI', url: 'https://www.bfi.org.uk/' }, { name: 'Academy collections', url: 'https://www.oscars.org/' }, { name: 'Criterion', url: 'https://www.criterion.com/' }] },
  { id: 'music_nightlife', label: 'Music, nightlife and subcultures',
    description: 'Use photographer-led records of venues, audiences, performers and the everyday visual language of a scene.',
    hosts: ['derekridgersarchive.com', 'davidgodlis.com', 'museumofyouthculture.com'], terms: 'nightlife music club photographs',
    examples: [{ name: 'Derek Ridgers Archive', url: 'https://www.derekridgersarchive.com/' }, { name: 'David Godlis', url: 'https://www.davidgodlis.com/' }, { name: 'Museum of Youth Culture', url: 'https://www.museumofyouthculture.com/' }] },
  { id: 'contemporary_visuals', label: 'Unusual contemporary imagery',
    description: 'Discover current photography, visual art and moving-image work with a distinct visual idea; keep its contemporary date visible.',
    hosts: ['itsnicethat.com', 'nowness.com', 'ignant.com'], terms: 'photography artist project',
    examples: [{ name: 'It’s Nice That', url: 'https://www.itsnicethat.com/' }, { name: 'Nowness', url: 'https://www.nowness.com/' }, { name: 'IGNANT', url: 'https://www.ignant.com/' }] },
  { id: 'artist_studios', label: 'Artist studios and original projects',
    description: 'Start with a credited artist profile, then locate the artist’s own project, statement and studio contact. The directory is a discovery lead.',
    hosts: [], terms: 'artist studio official portfolio original project',
    examples: [{ name: 'Art21 artist profiles', url: 'https://art21.org/' }, { name: 'Colossal discovery', url: 'https://www.thisiscolossal.com/' }] },
];

const safeContext = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim() : '';
const issue = (code, message, extra = {}) => ({ code, message, ...extra });

function storedBriefForReview(value, story, issues) {
  if (value === undefined) return {};
  try {
    // A previously valid annotation can become stale after the source removes an
    // image. Keep it for review; write validation remains strict against current IDs.
    const existing = Array.isArray(story.media) ? story.media : [];
    const historicalIds = Array.isArray(value?.sequenceRoles) ? value.sequenceRoles
      .filter(role => typeof role?.assetId === 'string').map(role => ({ id: role.assetId })) : [];
    return validateCreativeBrief(value, { ...story, media: [...existing, ...historicalIds] });
  } catch (error) {
    if (!(error instanceof HandoffError)) throw error;
    issues.push(issue('INVALID_STORED_CREATIVE_BRIEF', 'The saved direction needs review. It has not been overwritten; repair unsupported fields before saving a new version.'));
    return {};
  }
}

/** Derived UI guidance only. Tolerates stale annotations without rewriting them. */
export function buildEditorialDirection(story = {}, options = {}) {
  story = story && typeof story === 'object' && !Array.isArray(story) ? story : {};
  const issues = [];
  const original = options?.creativeBrief !== undefined ? options.creativeBrief : story.creativeBrief;
  const brief = storedBriefForReview(original, story, issues);
  const media = (Array.isArray(story.media) ? story.media : []).filter(asset => asset && typeof asset.id === 'string');
  const byId = new Map(media.map(asset => [asset.id, asset]));
  const selected = (Array.isArray(story.selectedAssetIds) ? story.selectedAssetIds : []).filter(id => typeof id === 'string');
  const selectedSet = new Set(selected);
  const annotations = new Map((brief.sequenceRoles || []).map(role => [role.assetId, role]));
  const sequenceIssues = [];
  if (!selected.length) sequenceIssues.push(issue('NO_SELECTED_SEQUENCE', 'Select existing story images before reviewing their sequence.'));
  if (selected.length !== selectedSet.size) sequenceIssues.push(issue('DUPLICATE_SELECTED_ASSET', 'An asset appears more than once in the selected sequence.'));
  const roles = [...selectedSet].map((assetId, index) => {
    const annotation = annotations.get(assetId);
    if (!byId.has(assetId)) sequenceIssues.push(issue('MISSING_SELECTED_ASSET', 'A selected source image is no longer available; keep the prior draft and resolve it explicitly.', { assetId }));
    if (!annotation) sequenceIssues.push(issue('UNASSIGNED_SEQUENCE_ROLE', 'Give this slide a primary role after reviewing the actual photograph.', { assetId }));
    return { assetId, position: index + 1, selected: true, available: byId.has(assetId), role: annotation?.role || null, note: annotation?.note || '' };
  });
  for (const annotation of brief.sequenceRoles || []) if (!selectedSet.has(annotation.assetId)) {
    const available = byId.has(annotation.assetId);
    roles.push({ ...annotation, position: null, selected: false, available, note: annotation.note || '' });
    sequenceIssues.push(issue(available ? 'ANNOTATED_ASSET_NOT_SELECTED' : 'ANNOTATED_ASSET_REMOVED',
      available ? 'A role note belongs to a current story image outside the selected sequence. The annotation is retained.' : 'A role note belongs to an image removed from the current source. The earlier annotation is retained for review.', { assetId: annotation.assetId }));
  }
  const topic = [safeContext(story.title), safeContext(story.subject)].filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).join(' ').slice(0, 180) || 'unusual photography cultural history';
  const creator = [...selectedSet].map(id => safeContext(byId.get(id)?.creator)).find(name => name && !/^(?:unknown|not recorded|creator not recorded)$/iu.test(name));
  const sourceLanes = LANES.map(lane => {
    const target = lane.id === 'photographer_portfolios' && creator ? `${creator} ${topic}` : topic;
    const sites = lane.hosts.length ? ` (${lane.hosts.map(host => `site:${host}`).join(' OR ')})` : '';
    const query = `${target} ${lane.terms}${sites}`;
    const search = new URL('https://search.brave.com/search');
    search.searchParams.set('q', query);
    return { id: lane.id, label: lane.label, description: lane.description, query, searchUrl: search.href,
      examples: lane.examples.map(example => ({ ...example })), selected: (brief.sourceLaneIds || []).includes(lane.id),
      connection: 'not_connected', resultStatus: 'search_suggestion_only',
      rightsNote: 'A search result, portfolio, magazine image or downloadable file grants no reuse rights. Verify the specific image, creator, license, required credit and permission evidence.' };
  });
  const ratings = Object.fromEntries(RATING_KEYS.map(key => [key, brief.ratings?.[key] ?? null]));
  const complete = Object.values(ratings).every(value => Number.isInteger(value) && value >= 1 && value <= 5);
  return {
    reference: structuredClone(REFERENCE),
    hooks: HOOKS.map(hook => ({ ...hook, selected: brief.hookType === hook.id })),
    sourceLanes,
    captionGuidance: [
      'Open with a precise, supportable detail or relationship; an intriguing question does not justify inventing a surprising claim.',
      'Try a concise claim, context and evidence structure. Review attribution and provenance without treating a fixed sentence count as a publishing rule.',
      'Sentence case, lowercase or retaining the source voice are editorial choices. Changing case must not silently alter names, quotations or source records.',
      'A single photograph, carousel, moving-image artifact or longer caption may be appropriate when the material earns it. The reference is not a format ban.',
      'Avoid unsupported superlatives, production instructions and engagement bait. Source-check the actual wording before approving a proposal.',
    ],
    sequence: { roles, issues: sequenceIssues, basis: 'metadata_and_editor_judgment', visualAnalysisPerformed: false,
      supportedFormats: ['single_image', 'carousel', 'video'],
      guidance: 'Question, context, evidence and payoff are optional narrative roles, not an automatic image-quality judgment or a mandatory slide count. Review the actual photographs; no role is assigned from pixels.' },
    review: { ratings, average: complete ? Math.round(Object.values(ratings).reduce((sum, value) => sum + value, 0) / 4 * 100) / 100 : null,
      complete, basis: 'editor_self_assessment', empiricalPerformanceScore: false, publicationApproved: false,
      guidance: 'Scores organize editorial discussion. Even a high average does not clear rights, verify facts, predict reach or authorize publication.' },
    chosenHookType: brief.hookType || null, captionApproach: brief.captionApproach || 'retain_source',
    issues, creativeDirectionIsLocal: true, sourceVerificationPerformed: false,
    timing: { recommendedTimes: [], verified: false, automaticScheduling: false },
  };
}
