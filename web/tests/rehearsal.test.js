import test from 'node:test';import assert from 'node:assert/strict';import {carouselRehearsal} from '../views.js';
import {buildWorkspace} from '../../src/workspace/model.js';import {workspaceSnapshot} from '../../test/helpers/workspace-fixture.js';
test('rehearsal follows effective sequence and exposes roles without cropping or rights claims',()=>{
 const story=buildWorkspace(workspaceSnapshot()).stories[0];story.localDraft={selectedAssetIds:['asset-2','asset-1'],caption:'<unsafe>',creativeBrief:{sequenceRoles:[{assetId:'asset-2',role:'question',note:'<unsafe>'}]}};
 const before=JSON.stringify(story);const html=carouselRehearsal(story,0,'original');assert.match(html,/Archive photograph 2/);assert.match(html,/data-fit="original"/);assert.match(html,/Question/);assert.ok(!html.includes('<unsafe>'));assert.equal(JSON.stringify(story),before);assert.match(html,/no crop/);
 assert.match(carouselRehearsal(story,999),/Slide 2 of 2/);story.media=story.media.filter(m=>m.id!=='asset-1');assert.match(carouselRehearsal(story,999),/Slide 1 of 1/);story.localDraft.selectedAssetIds=[];assert.match(carouselRehearsal(story),/No slides selected/);
});
