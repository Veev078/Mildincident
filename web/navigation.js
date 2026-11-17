import {storyStage} from './story-flow.js';
// Keep stored links and old bookmarks working while presenting five editorial destinations.
export const navigation = [
 ['discovery','discover','Discover','01'],
 ['pipeline','stories','Build','02'],
 ['publishing','production','Approve / Buffer','03'],
];
const aliases = {today:'home',discover:'discovery',stories:'pipeline',production:'publishing',insights:'analytics'};
export function resolveRoute(hash = '') {
  const [name = 'home', encodedId, tab = 'build'] = hash.replace(/^#\/?/, '').split('/');
  const view = (Object.hasOwn(aliases,name)?aliases[name]:name)||'discovery';
  let id;
  try { id = encodedId && decodeURIComponent(encodedId); } catch { id = ''; }
  return {view:['home','discovery','pipeline','publishing','library','archive','analytics','story'].includes(view)?view:'home',id,tab:view==='story'?storyStage(tab):tab};
}
export function destination(view) {
  return view==='story'?'pipeline':['archive','analytics'].includes(view)?'library':view;
}
export function libraryNavigation(view) {
  if(!['library','archive','analytics'].includes(view))return '';
  return `<nav class="library-sections" aria-label="Library sections">${[['library','Photographs & sources'],['archive','Published archive'],['analytics','Insights']].map(([id,label])=>`<a href="#/${id}" ${view===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
