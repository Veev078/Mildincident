import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {photoRequestPanel} from '../photo-requests.js';

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
 assert.match(html,/data-photo-discover="PHOTO-ONE" disabled/);
 assert.deepEqual(story,before);
});

test('photo action layout keeps search, source assistance and archival exploration separate',()=>{
 const html=requestPanel();
 assert.ok(html.indexOf('photo-source-assist')>html.indexOf('data-photo-discover'));
 assert.ok(html.indexOf('photo-search-advanced')>html.indexOf('photo-source-assist'));
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.ok(css.includes('.photo-desk .photo-action-stack'));
 assert.ok(css.includes('.photo-desk-grid .asset-actions .small-button'));
 assert.ok(css.includes('min-height:44px'));
});
