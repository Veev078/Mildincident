import test from 'node:test';import assert from 'node:assert/strict';
import {storyWorkspace} from '../views.js';
import {founderDirection,creativeBriefFor,emptyCreativeBrief} from '../direction.js';
import {buildWorkspace} from '../../src/workspace/model.js';
import {workspaceSnapshot} from '../../test/helpers/workspace-fixture.js';
const state={workspace:{hosted:true},compared:[]};
const make=()=>buildWorkspace(workspaceSnapshot()).stories[0];
test('opening a story keeps photographs, caption, direction and review in one existing working copy',()=>{
 const story=make(),before=JSON.stringify(story),html=storyWorkspace(state,story,'overview');
 for(const marker of ['develop-workspace','develop-lead-image','aria-label="Selected photographs"','aria-label="Local caption draft"','aria-label="Your direction"','data-readiness-panel','data-action="rehearse-story"','data-action="make-opening"'])assert.ok(html.includes(marker),marker);
 assert.ok(html.includes(story.caption));assert.ok(html.includes('data-asset="asset-2"'));assert.ok(!html.includes('Choose one narrative hook'));
 assert.equal(JSON.stringify(story),before);
});
test('the simple direction uses retained creative notes and never rewrites source fields or advanced values',()=>{
 const story=make(),brief=emptyCreativeBrief();brief.notes='Focus on the unusual location <carefully>.';brief.angle='A retained previous angle';brief.ratings.visual=5;brief.sequenceRoles=[{assetId:'asset-1',role:'context',note:'Existing intent'}];story.localDraft={version:3,creativeBrief:brief};
 const before=JSON.stringify(story),html=founderDirection(story);
 assert.ok(html.includes('Focus on the unusual location &lt;carefully&gt;.'));assert.ok(html.includes('data-brief-field="notes"'));assert.ok(html.includes('does not generate new material'));
 assert.equal(JSON.stringify(story),before);const working=creativeBriefFor(story);working.notes='Another instruction';assert.equal(story.localDraft.creativeBrief.notes,brief.notes);assert.equal(working.angle,brief.angle);assert.equal(working.ratings.visual,5);
});
test('source changes disable all working-copy inputs and sequence actions without losing text',()=>{
 const story=make();story.localDraft={stale:true,caption:'Retained caption',creativeBrief:{notes:'Retained direction'}};
 const html=storyWorkspace(state,story,'overview');assert.match(html,/id="caption-editor"[^>]*disabled/);assert.match(html,/id="founder-direction"[^>]*disabled/);assert.match(html,/data-action="make-opening"[^>]*disabled/);assert.ok(html.includes('Retained caption'));assert.ok(html.includes('Retained direction'));assert.ok(html.includes('Compare source and local draft'));
});
