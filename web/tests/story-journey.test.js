import test from 'node:test';
import assert from 'node:assert/strict';
import {storyWorkspace} from '../views.js';
import {nextAction} from '../components.js';
import {buildWorkspace} from '../../src/workspace/model.js';
import {workspaceSnapshot} from '../../test/helpers/workspace-fixture.js';
const state={workspace:{hosted:true},compared:[]};
const story=()=>buildWorkspace(workspaceSnapshot()).stories[0];

test('five story stages retain every existing deep link and select the appropriate stage',()=>{
 const original=story(),before=JSON.stringify(original);
 for(const [tab,stage] of [['overview','Understand'],['research','Understand'],['images','Images'],['direction','Angle'],['caption','Edit'],['carousel','Edit'],['music','Edit'],['publishing','Check']]){
  const html=storyWorkspace(state,original,tab),primary=html.match(/<nav class="story-stages"[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.equal((primary.match(/<a /g)||[]).length,5);
  assert.match(primary,new RegExp('aria-current="step"><small aria-hidden="true">0[1-5]</small>'+stage));
  assert.ok(html.includes(`href="#/story/${original.id}/${tab}" aria-current="page"`));
 }
 assert.equal(JSON.stringify(original),before);
});

test('story overview leads with actual references and preserves private notes, working caption and source details',()=>{
 const original=story();original.localDraft={version:1,caption:'Working caption stays preserved',notes:'An unfinished angle'};
 const html=storyWorkspace(state,original,'overview');
 assert.ok(html.indexOf('class="story-premise')<html.indexOf('Before publishing</summary>'));
 assert.match(html,/An unfinished angle/);assert.match(html,/Working caption stays preserved/);
 assert.match(html,/Story details &amp; version history|Story details & version history/);
 assert.match(html,/data-action="draft-history"/);assert.match(html,/data-proposal-for=/);
 assert.match(html,/No preview available|https:\/\/example.org\/thumb/);
 assert.ok(!html.includes('Image verified'));
 original.media=[];original.selectedAssetIds=[];
 const missing=storyWorkspace(state,original,'overview');assert.match(missing,/No image references are attached/);assert.ok(!missing.includes('<img '));
});

test('clearer story journey retains stale-edit, permission and existing-provider boundaries',()=>{
 const original=story();original.localDraft={stale:true,caption:'Keep my work'};
 const stale=storyWorkspace(state,original,'caption');assert.match(stale,/Compare source and local draft/);assert.match(stale,/id="caption-editor"[^>]*disabled/);
 original.localDraft=null;original.publishing.requiresReview=true;
 const action=nextAction(original);assert.equal(action.tab,'publishing');assert.equal(action.label,'Finish required checks');
 const production=storyWorkspace(state,original,'publishing');assert.match(production,/Reconcile before another handoff/);assert.match(production,/does not create Buffer drafts, schedule, publish/);assert.match(production,/image rights|permissions|clear rights/);
});
