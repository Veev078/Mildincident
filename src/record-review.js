import { editorialReadiness } from './reconciliation.js';

export const TABLE_IDS = Object.freeze({ stories: '5AxSMHqi15TNwBZl', packages: 'cCFwaHyKVVTZvr5s', media: 'ARiuqg92GgVSpZMr',
  imports: 'qQgPtQvq3V0hyZia', lifecycle: 'xxm1mdsO2pukqQjE', archives: 'Mf1GWRTseSOioyV6',
  soundtrack: 'UogVP7r92OOTCXd8', soundSelections: 'BB5JIwLWNs13m2Tv', imageArchives: '0Jx83xL1evH0R8l2' });

function duplicateKeys(rows, field) {
  const counts = new Map();
  for (const row of rows) if (row[field]) counts.set(row[field], (counts.get(row[field]) || 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
}

export function reviewRecords(records, bufferAudit) {
  const { stories, packages, media, imports, lifecycle, archives, soundtrack, soundSelections, imageArchives } = records;
  const storyIds = new Set(stories.map(s => s.concept_id));
  const packageIds = new Set(packages.map(p => p.package_id));
  const mappedIds = new Set(imports.map(i => i.buffer_id).filter(Boolean));
  const duplicatePackages = duplicateKeys(packages, 'concept_id');
  const ambiguousPackages = new Set(duplicatePackages.map(p => p.key));
  const board = stories.map(story => editorialReadiness({ story,
    productionPackage: ambiguousPackages.has(story.concept_id) ? undefined : packages.find(p => p.concept_id === story.concept_id),
    media, imports, posts: bufferAudit.posts, lifecycle: lifecycle.find(l => l.concept_id === story.concept_id), auditComplete: bufferAudit.complete }));
  return {
    observedAt: bufferAudit.observedAt, readOnly: true,
    checks: { duplicateStoryIds: duplicateKeys(stories, 'concept_id'), duplicatePackageStories: duplicatePackages,
      duplicateMediaIds: duplicateKeys(media, 'asset_id'),
      orphanPackageStories: packages.filter(p => !storyIds.has(p.concept_id)).map(p => p.concept_id),
      orphanMediaCount: media.filter(m => !storyIds.has(m.concept_id)).length,
      orphanArchives: archives.filter(a => !packageIds.has(a.package_id)).map(a => a.id),
      confirmedImportsWithoutIds: imports.filter(i => i.state === 'draft_created' && !i.buffer_id).map(i => i.id),
      // Media discovery and catalog records alone do not grant publication rights.
      mediaRightsStates: Object.fromEntries([...new Set(media.map(m => m.rights_status || 'unknown'))].map(s => [s, media.filter(m => (m.rights_status || 'unknown') === s).length])),
      soundtrackCount: soundtrack.length, soundSelectionsCount: soundSelections.length, curatedArchiveCount: imageArchives.length,
    },
    unmappedBufferPosts: bufferAudit.posts.filter(p => !mappedIds.has(p.id)).map(p => ({ id: p.id, status: p.status })),
    halloween: board.filter(s => /^CON-261026MANH26-0[1-4]$/.test(s.conceptId)),
    stories: board,
  };
}
