// Stable native direction identifiers. These are different editorial operations,
// not permission to add facts, search again or replace the founder's caption.
export const WRITING_DIRECTIONS=Object.freeze({
 concise:{label:'Sharper & simpler',brief:'Cut the preamble and repeated explanation. Keep the one detail that earns attention, use everyday language, and stop when the point lands.'},
 narrative:{label:'Tell the story',brief:'Build a small story around a documented moment, origin or creative decision. Give it progression and a worthwhile ending; a date-and-credit list is not a narrative.'},
 discovery_opening:{label:'Better opening',brief:'Change the first line around the strongest supported detail. Let the reader discover the point immediately; no invented mystery or “did you know”.'},
 alternate_angle:{label:'Different angle',brief:'Find a different entry point in the same evidence: a making detail, unexpected connection or human moment. Change the idea leading the caption, not just its adjectives.'},
 supported_perspective:{label:'A closer look',brief:'Reframe the cultural meaning of one supported detail. Keep observation separate from interpretation and let names and facts do the work; no invented intentions.'}
});
export const WRITING_DIRECTION_LABELS=Object.freeze(Object.fromEntries(Object.entries(WRITING_DIRECTIONS).map(([key,value])=>[key,value.label])));
