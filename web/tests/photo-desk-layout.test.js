import test from 'node:test';
import assert from 'node:assert/strict';
import {photoRequestPanel} from '../photo-requests.js';
import {selectedSequencePanel,assetCard} from '../photo-desk.js';

const requestPanel=(extra={})=>photoRequestPanel({
 id:'PHOTO-ONE',revision:'r1',photoRequests:[],
 photography:{identity:{series:'A real project'}},
 ...extra
},{});

test('photo discovery asks for search direction before showing the main search action',()=>{
 const html=requestPanel();
 const direction=html.indexOf('data-photo-direction="PHOTO-ONE"');
 const action=html.indexOf('data-photo-discover="PHOTO-ONE"');
 assert.ok(direction>=0&&action>direction);
 assert.equal((html.match(/data-photo-discover=/g)||[]).length,1);
 assert.ok(html.includes('photo-action-stack'));
 assert.ok(html.includes('not visually verified photographs'));
});

test('photo search remains disabled for stale draft without changing saved selections',()=>{
 const story={id:'PHOTO-ONE',revision:'r1',photoRequests:[],selectedAssetIds:['kept'],localDraft:{stale:true},
 photography:{identity:{series:'A real project'}}};
 const before=structuredClone(story);
 const html=photoRequestPanel(story,{});
 assert.match(html,/data-photo-discover="PHOTO-ONE"[^>]* disabled/);
 assert.match(html,/Review the source changes before searching/);
 assert.deepEqual(story,before);
});

test('photo action layout keeps search, source assistance and archival exploration separate',()=>{
 const html=requestPanel();
 assert.ok(html.indexOf('photo-source-assist')>html.indexOf('data-photo-discover'));
 assert.ok(html.indexOf('photo-search-advanced')>html.indexOf('photo-source-assist'));
 assert.ok(html.includes('aria-describedby="photo-action-status-PHOTO-ONE"'));
 assert.ok(html.includes('Check identity and permission.'));
});

test('selected sequence preserves exact order, offers explicit removal and escapes source labels',()=>{
 const story={id:'CON-ui',selectedAssetIds:['two','one'],media:[{id:'one',title:'First frame',previewUrl:''},{id:'two',title:'Second <frame>',previewUrl:''}],revision:'r1'};
 const before=structuredClone(story),html=selectedSequencePanel(story);assert(html.indexOf('Inspect selected photograph 1: Second &lt;frame&gt;')<html.indexOf('Inspect selected photograph 2: First frame'));assert.match(html,/Remove Second &lt;frame&gt; from sequence/);assert.match(html,/Arrange sequence/);assert.deepEqual(story,before);
});

test('photo selection pauses on stale source with an explanation; source relevance never grants rights',()=>{
 const html=assetCard({id:'CON-ui',selectedAssetIds:[],localDraft:{stale:true}},{id:'one',title:'A frame',photoRelevance:{label:'Project reference'},rightsStatus:'preview_unreviewed'},false);
 assert.match(html,/data-action="toggle-asset"[^>]* disabled/);assert.match(html,/Selection paused/);assert.match(html,/Rights pending/);assert(!html.includes('Clearance recorded'));
});

test('an unavailable selected cover is reported without relabeling another photograph as the cover',()=>{
 const story={id:'CON-ui',selectedAssetIds:['missing-cover','one'],media:[{id:'one',title:'Second frame'}],revision:'r1'};
 const html=selectedSequencePanel(story);
 assert.match(html,/2 photographs/);assert.match(html,/Inspect selected photograph 2: Second frame/);assert.match(html,/<span>02<\/span>/);assert.match(html,/A selected reference is unavailable/);assert(!html.includes('<span>Cover</span>'));
 assert.deepEqual(story.selectedAssetIds,['missing-cover','one']);
});
