import { esc, human, external, image, effective, fieldDisabled, sectionHeading } from './components.js';

export const emptyCreativeBrief = () => ({
  hookType: '', angle: '', visualIntent: '', captionApproach: 'retain_source', sequenceRoles: [],
  ratings: { hook: null, visual: null, shareability: null, timelessness: null }, notes: '', sourceLaneIds: [],
});

export function creativeBriefFor(story) {
  const stored = story.localDraft?.creativeBrief;
  const defaults = emptyCreativeBrief();
  return stored ? { ...defaults, ...structuredClone(stored), ratings: { ...defaults.ratings, ...stored.ratings } } : defaults;
}

const ratingLabels = [
  ['hook', 'Hook strength', 'Does the opening image and claim invite a specific question?'],
  ['visual', 'Visual-first', 'Can the selected photograph carry the story before the caption?'],
  ['shareability', 'Shareability', 'Is there a clear detail someone might want to send to a friend?'],
  ['timelessness', 'Timelessness', 'Would this angle remain interesting beyond the current moment?'],
];
const roles = [['', 'Choose a role'], ['question', 'Question'], ['context', 'Context'], ['evidence', 'Evidence'], ['payoff', 'Payoff']];

export function directionReviewSummary(story) {
  const brief = creativeBriefFor(story);
  const values = ratingLabels.map(([key]) => brief.ratings[key]);
  const complete = values.every(value => Number.isInteger(value) && value >= 1 && value <= 5);
  const rated = values.filter(value => Number.isInteger(value) && value >= 1 && value <= 5).length;
  return `<p class="eyebrow">Your editorial judgment</p><strong class="direction-review-score">${complete ? `${(values.reduce((sum, value) => sum + value, 0) / 4).toFixed(2)} <small>/ 5</small>` : `${rated} <small>/ 4 rated</small>`}</strong><p>${complete ? 'All four taste ratings are recorded. This average is a manual editorial opinion.' : 'An average appears only after all four ratings are recorded. Unrated means unknown, not zero.'}</p><p class="small muted">A high score does not verify the facts, clear image rights, approve publication or schedule a post.</p>`;
}

export function creativeBriefSummary(brief) {
  if (!brief) return '<p class="small muted">No creative brief was stored in this version.</p>';
  return `<div class="direction-brief-summary"><dl><div><dt>Hook</dt><dd>${esc(brief.hookType ? human(brief.hookType) : 'Not chosen')}</dd></div><div><dt>Angle</dt><dd>${esc(brief.angle || 'Not recorded')}</dd></div><div><dt>Visual intention</dt><dd>${esc(brief.visualIntent || 'Not recorded')}</dd></div><div><dt>Caption approach</dt><dd>${esc(human(brief.captionApproach || 'retain_source'))} · intention only</dd></div><div><dt>Manual ratings</dt><dd>${ratingLabels.map(([key, label]) => `${esc(label)}: ${brief.ratings?.[key] ?? 'not rated'}`).join(' · ')}</dd></div><div><dt>Source lanes</dt><dd>${(brief.sourceLaneIds || []).map(id => esc(human(id))).join(', ') || 'None saved'}</dd></div></dl>${brief.sequenceRoles?.length ? `<p class="small muted">Retained narrative-role annotations</p><ul>${brief.sequenceRoles.map(item => `<li><code>${esc(item.assetId)}</code> · ${esc(human(item.role))}${item.note ? `<p>${esc(item.note)}</p>` : ''}</li>`).join('')}</ul>` : ''}${brief.notes ? `<p class="body-copy">${esc(brief.notes)}</p>` : ''}</div>`;
}

export function directionSequenceObservations(story) {
  const groups = new Map();
  for (const issue of story.editorialDirection?.sequence?.issues || []) {
    const message = typeof issue === 'string' ? human(issue) : issue.message || human(issue.code);
    const key = typeof issue === 'string' ? issue : issue.code || message;
    const previous = groups.get(key);
    groups.set(key, { message, count: (previous?.count || 0) + 1 });
  }
  return groups.size ? `<div class="notice subtle"><strong>Sequence observations</strong><ul>${[...groups.values()].map(item => `<li>${esc(item.message)}${item.count > 1 ? ` (${item.count} image records)` : ''}</li>`).join('')}</ul><p>These checks reflect the last saved brief and source metadata, not visual analysis of the photographs.</p></div>` : '<p class="small muted">No additional sequence-metadata flags were supplied for the last saved brief. This is not a visual or publication approval.</p>';
}

function hookOptions(story, direction, brief) {
  const hooks = direction.hooks || [];
  return hooks.length ? `<fieldset class="direction-hook-options"><legend class="field-label">Choose one narrative hook</legend>${hooks.map(hook => `<label class="direction-hook ${brief.hookType === hook.id ? 'chosen' : ''}"><input type="radio" id="direction-hook-${esc(hook.id)}" name="direction-hook" value="${esc(hook.id)}" data-brief-field="hookType" data-story="${esc(story.id)}" ${brief.hookType === hook.id ? 'checked' : ''} ${fieldDisabled(story)}><span><strong>${esc(hook.label)}</strong><small>${esc(hook.prompt)}</small><em>Evidence needed: ${esc(Array.isArray(hook.evidenceNeeded) ? hook.evidenceNeeded.join('; ') : hook.evidenceNeeded || 'Establish the claimed connection from original sources.')}</em></span></label>`).join('')}</fieldset>` : '<p class="muted">No narrative-hook library was supplied. You can still develop an angle and visual intention below.</p>';
}

function selectedSequence(story, brief) {
  const selected = effective(story).selectedAssetIds;
  const assets = (story.media || []);
  const annotations = brief.sequenceRoles || [];
  const extras = annotations.filter(annotation => !selected.includes(annotation.assetId));
  return `${extras.length ? `<p class="small muted">${extras.length} earlier image-role annotation${extras.length === 1 ? ' is' : 's are'} retained outside the current selection. They remain in the local proposal; no notes are silently discarded.</p>` : ''}${selected.length ? `<ol class="direction-sequence">${selected.map((id, index) => {
    const asset = assets.find(item => item.id === id);
    const annotation = annotations.find(item => item.assetId === id) || {};
    return `<li><div>${image(asset, { index, storyId: asset ? story.id : undefined })}</div><div><p class="eyebrow">${index === 0 ? 'Opening photograph' : `Slide ${index + 1}`}</p><h3>${esc(asset?.title || 'Selected asset is no longer in the current source')}</h3><p class="small muted">${esc(asset?.creator || id)}</p><label class="field-label" for="direction-role-${index}">Narrative role<select id="direction-role-${index}" data-brief-role="${esc(id)}" data-story="${esc(story.id)}" ${!asset ? 'disabled' : fieldDisabled(story)}>${roles.map(([value, label]) => `<option value="${value}" ${annotation.role === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field-label" for="direction-role-note-${index}">Why this image earns its place · up to 500 characters<textarea id="direction-role-note-${index}" data-brief-role-note="${esc(id)}" data-story="${esc(story.id)}" rows="2" maxlength="500" placeholder="The detail it introduces, supports or reveals…" ${!asset || !annotation.role ? 'disabled' : fieldDisabled(story)}>${esc(annotation.note || '')}</textarea></label></div></li>`;
  }).join('')}</ol>` : '<p class="muted">Choose existing photographs in the Images tab first. Narrative roles apply to actual selected image IDs and do not imply pixel analysis.</p>'}`;
}

function editorialSetup(story, state) {
  const current = {...effective(story), ...(state.editorialSetupDrafts?.[story.id] || {})};
  const source = story.sourceEditorial || story;
  return `<section class="editorial-panel">${sectionHeading('Shape the working story', 'Local title, hook and format. The original n8n record stays available below.')}<form data-form="editorial-setup" data-story="${esc(story.id)}"><label class="field-label" for="working-title">Working title<input id="working-title" name="title" maxlength="300" required value="${esc(current.title)}" ${fieldDisabled(story)}></label><label class="field-label" for="working-hook">Working hook<textarea id="working-hook" name="hook" maxlength="1000" rows="2" ${fieldDisabled(story)}>${esc(current.hook)}</textarea></label><div class="field-pair"><label class="field-label" for="working-format">Working format<select id="working-format" name="format" aria-label="Working format" data-format-control ${fieldDisabled(story)}>${[['single_image','Single photograph'],['carousel','Carousel'],['visual_essay','Visual essay'],['reel','Reel concept']].map(([value,label])=>`<option value="${value}" ${current.format===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="field-label" for="working-target">Planned frames<input id="working-target" name="targetSlideCount" type="number" min="${current.format==='carousel'?2:1}" max="10" required value="${esc(current.targetSlideCount)}" ${current.format==='single_image'?'readonly':''} ${fieldDisabled(story)}></label></div><p class="small muted">Changing format keeps every selected asset and note. Frame targets describe the plan; they do not trim your selection, source footage or grant clearance.</p><button class="button button-dark" type="submit" ${fieldDisabled(story)}>Save working story</button></form><details class="source-caption"><summary>Original title, hook and format</summary><p><strong>${esc(source.title)}</strong></p><p>${esc(source.hook || 'No source hook recorded.')}</p><p>${esc(human(source.format))} · target ${esc(source.targetSlideCount)}</p></details></section>`;
}

export function directionView(state, story) {
  const direction = story.editorialDirection || {};
  const brief = creativeBriefFor(story);
  const reference = direction.reference;
  const guidance = direction.captionGuidance || [];
  return `<div class="workspace-main"><section class="editorial-panel direction-intro"><p class="eyebrow">A considered creative direction</p><h2 class="serif-heading">Find the story inside the subject.</h2><p>Choose one claim worth investigating, the photographic intention and a reveal structure. These are local editorial decisions—not a replacement dossier, automatic caption rewrite or permission to publish.</p>${(story.sourceEditorial?.hook ?? story.hook) ? `<details><summary>Existing source hook</summary><p class="body-copy">${esc(story.sourceEditorial?.hook ?? story.hook)}</p></details>` : ''}</section>
    ${editorialSetup(story, state)}
    <section class="editorial-panel">${sectionHeading('The angle', 'A hook is a question to substantiate, not a fact to invent.')}${hookOptions(story, direction, brief)}<label class="field-label" for="direction-angle">The specific angle · up to 700 characters<textarea id="direction-angle" data-brief-field="angle" data-story="${esc(story.id)}" rows="3" maxlength="700" placeholder="What is the surprising, source-backed connection or detail?" ${fieldDisabled(story)}>${esc(brief.angle)}</textarea></label><label class="field-label" for="direction-visual">Visual intention · up to 1,200 characters<textarea id="direction-visual" data-brief-field="visualIntent" data-story="${esc(story.id)}" rows="3" maxlength="1200" placeholder="What should the selected photographs show, and what makes the opening image compelling?" ${fieldDisabled(story)}>${esc(brief.visualIntent)}</textarea></label></section>
    <section class="editorial-panel">${sectionHeading('Caption approach', 'Keep a consistent voice without applying an automatic rewrite.')}<label class="field-label" for="direction-caption-approach">Case and voice preference<select id="direction-caption-approach" data-brief-field="captionApproach" data-story="${esc(story.id)}" ${fieldDisabled(story)}><option value="retain_source" ${brief.captionApproach === 'retain_source' ? 'selected' : ''}>Retain the source approach</option><option value="sentence_case" ${brief.captionApproach === 'sentence_case' ? 'selected' : ''}>Sentence case</option><option value="lowercase" ${brief.captionApproach === 'lowercase' ? 'selected' : ''}>Lowercase</option></select></label><p class="small muted">This saves an intention only. The caption text remains exactly as written until you edit it in Caption.</p>${guidance.length ? `<ul class="direction-guidance">${guidance.map(item => `<li>${esc(typeof item === 'string' ? item : item.message || item.label)}</li>`).join('')}</ul>` : ''}</section>
    <section class="editorial-panel">${sectionHeading('A reason for every slide', 'Assign question, context, evidence or payoff to the actual selected photographs. No role is assigned automatically.')}<div data-direction-sequence>${selectedSequence(story, brief)}</div><div data-direction-sequence-issues>${directionSequenceObservations(story)}</div></section>
    <section class="editorial-panel">${sectionHeading('Broaden the source trail', 'Explore creator archives, documentary records, magazines and other story-specific leads. The existing image library is unchanged.')}<div class="direction-source-grid">${(direction.sourceLanes || []).map(lane => `<article><label class="direction-lane-choice"><input type="checkbox" data-brief-lane="${esc(lane.id)}" data-story="${esc(story.id)}" ${(brief.sourceLaneIds || []).includes(lane.id) ? 'checked' : ''} ${fieldDisabled(story)}><span>${esc(lane.label)}</span></label><p>${esc(lane.description)}</p>${lane.query ? `<p class="direction-query">${esc(lane.query)}</p>` : ''}<p>${external(lane.searchUrl, 'Open source search')}</p>${lane.examples?.length ? `<ul class="direction-source-examples">${lane.examples.map(example => `<li>${external(example.url, example.name)}</li>`).join('')}</ul>` : ''}<small>${esc(lane.rightsNote || 'Research lead only. Verify the original record and per-image permission before reuse.')}</small></article>`).join('') || '<p class="muted">No source lanes were supplied for this story.</p>'}</div></section>
    <section class="editorial-panel">${sectionHeading('The editor’s taste check', 'Four manual ratings. They measure your judgment, not predicted reach or publication readiness.')}<div class="direction-rating-grid">${ratingLabels.map(([key, label, prompt]) => `<label for="direction-rating-${key}"><strong>${label}</strong><span>${prompt}</span><select id="direction-rating-${key}" data-brief-rating="${key}" data-story="${esc(story.id)}" ${fieldDisabled(story)}><option value="" ${brief.ratings[key] === null ? 'selected' : ''}>Not rated</option>${[1, 2, 3, 4, 5].map(value => `<option value="${value}" ${brief.ratings[key] === value ? 'selected' : ''}>${value} / 5</option>`).join('')}</select></label>`).join('')}</div></section>
    <section class="editorial-panel"><h2>Creative brief notes</h2><p class="muted small">Keep unresolved judgments and source tasks with this direction. Existing n8n notes remain unchanged.</p><label class="sr-only" for="direction-notes">Creative brief notes</label><textarea id="direction-notes" data-brief-field="notes" data-story="${esc(story.id)}" rows="5" maxlength="4000" ${fieldDisabled(story)}>${esc(brief.notes)}</textarea></section></div>
    <aside class="workspace-aside"><section class="aside-block direction-review" data-direction-review>${directionReviewSummary(story)}</section><section class="aside-block"><p class="eyebrow">Reference, not current proof</p><h3>${esc(reference?.title || 'Historical inspiration study')}</h3><p>${reference?.date ? `Reference date: ${esc(reference.date)}. ` : ''}This user-provided study has not been reverified here.</p><p>Historical account comparisons are not comparable performance metrics for MILDINCIDENT. Posting windows are unverified and do not authorize scheduling.</p><p class="small muted">Use the creative patterns as prompts. Preserve original sources, attribution, image-rights review and the publication’s own voice.</p></section><section class="aside-block"><h3>Keep the evidence close.</h3><p>The broader source lanes are searches, not imported images or verified claims. Save original-source evidence in the research dossier before relying on an angle.</p></section></aside>`;
}
