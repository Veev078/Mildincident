// Keep stored links and old bookmarks working while presenting five editorial destinations.
export const navigation = [
  ['home', 'today', 'Today', '01'],
  ['discovery', 'discover', 'Discover', '02'],
  ['pipeline', 'stories', 'Stories', '03'],
  ['publishing', 'production', 'Production', '04'],
  ['library', 'library', 'Library', '05'],
];
const aliases = {today:'home',discover:'discovery',stories:'pipeline',production:'publishing',insights:'analytics'};
export function resolveRoute(hash = '') {
  const [name = 'home', encodedId, tab = 'overview'] = hash.replace(/^#\/?/, '').split('/');
  const view = aliases[name] || name;
  let id;
  try { id = encodedId && decodeURIComponent(encodedId); } catch { id = ''; }
  return {view:['home','discovery','pipeline','publishing','library','archive','analytics','story'].includes(view)?view:'home',id,tab};
}
export function destination(view) {
  return view==='story'?'pipeline':['archive','analytics'].includes(view)?'library':view;
}
export function libraryNavigation(view) {
  if(!['library','archive','analytics'].includes(view))return '';
  return `<nav class="library-sections" aria-label="Library sections">${[['library','Photographs & sources'],['archive','Published archive'],['analytics','Insights']].map(([id,label])=>`<a href="#/${id}" ${view===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
