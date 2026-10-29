import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeSourceUrl, deduplicateCitations, lintCaption, findDuplicateStories, rankSoundtracks, analyzeStory } from '../src/editorial-intelligence.js';

test('citation identity removes tracking without conflating image files, page numbers, fragments or meaningful queries', () => {
  assert.equal(canonicalizeSourceUrl('https://ARCHIVE.example:443/photo.jpg?id=1&utm_source=email&size=large#page=2'), 'https://archive.example/photo.jpg?id=1&size=large#page=2');
  assert.notEqual(canonicalizeSourceUrl('https://archive.example/photo.jpg?id=1'), canonicalizeSourceUrl('https://archive.example/photo.jpg?id=2'));
  assert.notEqual(canonicalizeSourceUrl('https://archive.example/one.jpg'), canonicalizeSourceUrl('https://archive.example/two.jpg'));
  assert.notEqual(canonicalizeSourceUrl('https://archive.example/book.pdf#page=2'), canonicalizeSourceUrl('https://archive.example/book.pdf#page=3'));
  for (const url of ['http://archive.example/photo', 'javascript:alert(1)', 'https://user:secret@archive.example/photo', 'https://archive.example/bad path', null]) assert.equal(canonicalizeSourceUrl(url), null);
});

test('citation dedup groups the same reference and retains distinct claims without asserting source verification', () => {
  const result = deduplicateCitations([
    { url: 'https://archive.example/collection?utm_campaign=x', sourceName: 'Museum', claim: 'First recorded claim.', claimType: 'verified_fact' },
    { url: 'https://archive.example/collection', sourceName: 'Museum collection', claim: 'Second recorded claim.', claimType: 'hypothesis' },
    { url: 'https://archive.example/collection', sourceName: 'Museum', claim: 'First recorded claim.', claimType: 'verified_fact' },
    { url: 'not a URL', sourceName: 'Invalid' },
  ]);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].claims.length, 2);
  assert.deepEqual(result.sources[0].sourceNames, ['Museum', 'Museum collection']);
  assert.equal(result.sources[0].verifiedByThisTool, false);
  assert.ok(result.issues.some(issue => issue.code === 'INVALID_SOURCE_URL'));
  assert.ok(result.issues.some(issue => issue.code === 'SOURCES_NOT_REVERIFIED'));
});

test('caption lint counts Unicode code points, catches actual handoff hazards, and distinguishes citations from proof', () => {
  const count = lintCaption('😀'.repeat(2200));
  assert.equal(count.characters, 2200);
  assert.equal(count.remaining, 0);
  assert.ok(lintCaption('😀'.repeat(2201)).issues.some(i => i.code === 'CAPTION_TOO_LONG'));
  assert.ok(lintCaption('[INTERNAL CAROUSEL TEST — DO NOT PUBLISH]').issues.some(i => i.code === 'INTERNAL_TEST_CAPTION'));
  assert.ok(lintCaption('Locate original production photographs before selecting the cover.').issues.some(i => i.code === 'PRODUCTION_NOTES_IN_CAPTION'));
  const unsourced = lintCaption('The first machine opened in 1971 and changed everything.');
  assert.ok(unsourced.issues.some(i => i.code === 'FACTUAL_CLAIMS_WITHOUT_SOURCES'));
  const cited = lintCaption('The first machine opened in 1971.', { research: [{ url: 'https://museum.example/record', claim: 'Recorded citation' }] });
  assert.equal(cited.hasSources, true);
  assert.equal(cited.sourceVerification, 'not_assessed');
  assert.ok(cited.issues.some(i => i.code === 'VERIFY_FACTUAL_CLAIMS'));
});

test('duplicate-story suggestions require distinctive overlapping titles, give reasons and never merge records', () => {
  const stories = [
    { id: 'a', title: 'Inside the Batcave: London nightclub portraits', subject: 'Derek Ridgers club photography', hook: 'A goth nightclub in 1982' },
    { id: 'b', title: 'Inside the Batcave: London nightclub portraits', subject: 'Derek Ridgers club photography', hook: 'A club in 1982' },
    { id: 'c', title: 'The working machines of a lost amusement park', subject: 'Historic photography' },
    { id: 'd', title: 'The story of a thing', subject: 'Historic photography' },
  ];
  const result = findDuplicateStories(stories);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].storyIds, ['a', 'b']);
  assert.equal(result[0].score, 1);
  assert.equal(result[0].automaticallyMerged, false);
  assert.ok(result[0].reasons.some(reason => reason.includes('dossiers')));
  assert.equal(stories.length, 4);
  assert.deepEqual(findDuplicateStories([{ id: 'same', title: 'Same title' }, { id: 'same', title: 'Same title' }]), []);
});

test('soundtrack ranking uses selected-photo metadata, retains saved direction and avoids arbitrary generic fill', () => {
  const catalog = [
    { track: 'Night fixture', artist: 'Artist A', themes: 'goth|nightlife', eras: '1980s', active: true },
    { track: 'Day fixture', artist: 'Artist B', themes: 'beach|sunshine', eras: '1960s', active: true },
    { track: 'Second night fixture', artist: 'Artist A', themes: 'goth|nightlife', active: true },
    { track: 'Inactive fixture', artist: 'Artist C', themes: 'goth', active: false },
  ];
  const story = { title: 'An overlooked portrait collection', caption: 'Photographs from 1982.', selectedAssetIds: ['chosen'],
    media: [{ id: 'chosen', title: 'Batcave nightclub portrait', creator: 'Derek Ridgers' }, { id: 'unselected', title: 'Beach sunshine photograph' }],
    musicSelection: { track: 'Personal direction', artist: 'Founder choice' } };
  const ranked = rankSoundtracks(story, catalog);
  assert.equal(ranked[0].selected, true);
  assert.equal(ranked[0].track, 'Personal direction');
  assert.equal(ranked[1].track, 'Night fixture');
  assert.ok(!ranked.some(track => track.track === 'Day fixture'));
  assert.ok(!ranked.some(track => track.track === 'Inactive fixture'));
  assert.ok(ranked.every(track => track.availability === 'not_verified' && track.licenseVerified === false));
  assert.deepEqual(rankSoundtracks({ title: 'An unrelated subject' }, catalog), []);
});

test('story analysis preserves missing/unreviewed image rights and labels the exact analysis boundary', () => {
  const result = analyzeStory({ title: 'An archival story', caption: 'A real caption for local editorial review.', selectedAssetIds: ['present', 'missing'],
    media: [{ id: 'present', rightsStatus: 'license_metadata_public_domain_unreviewed' }], research: [] });
  assert.equal(result.rights.pendingCount, 2);
  assert.deepEqual(result.rights.missingAssetIds, ['missing']);
  assert.equal(result.rights.automaticallyCleared, false);
  assert.equal(result.visualAnalysisPerformed, false);
  assert.equal(result.audioAnalysisPerformed, false);
});

test('broad themes never manufacture a named scene, venue or creature in soundtrack reasons', () => {
  const catalog = [
    { track: 'Venue-specific fixture', artist: 'One', themes: 'Batcave', active: true },
    { track: 'Scene-specific fixture', artist: 'Two', themes: 'Harajuku', active: true },
    { track: 'Creature-specific fixture', artist: 'Three', themes: 'werewolf', active: true },
    { track: 'Generic scene fixture', artist: 'Four', themes: 'nightlife', active: true },
  ];
  assert.deepEqual(rankSoundtracks({ title: 'A Gothic cathedral' }, catalog), []);
  assert.deepEqual(rankSoundtracks({ title: 'Fashion photography' }, catalog), []);
  assert.deepEqual(rankSoundtracks({ title: 'A horror film' }, catalog), []);
  const inferred = rankSoundtracks({ title: 'The Batcave photographs' }, catalog).find(t => t.track === 'Generic scene fixture');
  assert.ok(inferred);
  assert.ok(inferred.inferredMatchedTags.includes('nightlife'));
  assert.match(inferred.reason, /inferred/);
});

test('sound brief prefers mood over decade-only nostalgia, uses selected-image dates and preserves conflicting saved choices',()=>{
 const catalog=[{track:'Decade-only fixture',artist:'One',themes:'1970s',eras:'1970s',active:true},{track:'Reflective fixture',artist:'Two',moods:'reflective',eras:'1970s',active:true},{track:'Film-era fixture',artist:'Three',moods:'reflective',eras:'1960s',active:true},{track:'Uneasy fixture',artist:'Four',themes:'photography',moods:'reflective|uneasy',eras:'1970s',active:true}];
 const story={caption:'A 1967 film.',selectedAssetIds:['photo'],media:[{id:'photo',sourceYears:[1974]}],creativeBrief:{musicIntent:{mode:'suggestions',moods:['reflective'],avoidTags:['uneasy'],eraApproach:'period_echo'}}};
 const ranked=rankSoundtracks(story,catalog);assert.equal(ranked[0].track,'Reflective fixture');assert.ok(!ranked.some(t=>t.track==='Decade-only fixture'||t.track==='Uneasy fixture'));assert.equal(ranked[0].periodBasis,'selected_image_source_dates');assert.match(ranked[0].reason,/not a verified recording date/);assert.equal(ranked[0].audioAuditioned,false);
 const retained=rankSoundtracks({...story,musicSelection:{track:'Uneasy fixture',artist:'Four'}},catalog);assert.equal(retained[0].selected,true);assert.ok(retained[0].briefWarnings.some(w=>w.includes('uneasy')));
 const silent={...story,creativeBrief:{musicIntent:{...story.creativeBrief.musicIntent,mode:'silent'}}};assert.deepEqual(rankSoundtracks(silent,catalog),[]);
 const personal=rankSoundtracks({...silent,musicSelection:{track:'Saved personal choice',artist:'Outside catalog'}},catalog);assert.equal(personal.length,1);assert.match(personal[0].briefWarnings[0],/silent/);
 const contrast=rankSoundtracks({...story,creativeBrief:{musicIntent:{...story.creativeBrief.musicIntent,eraApproach:'contrast'}}},catalog);assert.equal(contrast[0].track,'Film-era fixture');assert.match(contrast[0].reason,/recording dates are unverified/);
 assert.ok(lintCaption('For a younger audience, the appeal is simple.').issues.some(i=>i.code==='AUDIENCE_PITCH_IN_CAPTION'));
});

test('landscape framing instructions cannot invent a landscape subject in soundtrack reasons',()=>{
 const story={title:'A studio portrait',creativeBrief:{visualIntent:'Preserve full landscape framing.'}};
 assert.deepEqual(rankSoundtracks(story,[{track:'Landscape fixture',artist:'Fixture',themes:'landscape',active:true}]),[]);
});
