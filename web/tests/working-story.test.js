import test from 'node:test';import assert from 'node:assert/strict';
import {workingStory,effective} from '../components.js';import {storyWorkspace,pipeline} from '../views.js';
test('local story identity appears across Studio views while original fields and revision stay unchanged',()=>{
 const story={id:'CON-LOCAL-FIXTURE',revision:'source-revision',title:'Original title',hook:'Original hook',format:'carousel',targetSlideCount:5,caption:'Original caption',media:[],selectedAssetIds:[],localDraft:{title:'Working <title>',hook:'Working hook',format:'single_image',targetSlideCount:1,caption:'Working caption'}};
 const before=JSON.stringify(story);const display=workingStory(story);assert.equal(display.title,'Working <title>');assert.equal(display.revision,story.revision);assert.equal(display.sourceEditorial.title,'Original title');assert.equal(effective(display).targetSlideCount,1);
 const html=storyWorkspace({},story,'direction');assert.match(html,/Working &lt;title&gt;/);assert.match(html,/Original title/);assert.match(html,/Original hook/);assert.match(html,/Save working story/);
 assert.match(storyWorkspace({},story,'overview'),/Working caption/);assert.match(pipeline({workspace:{stories:[story]},pipelineGroup:'all'}),/Working &lt;title&gt;/);assert.equal(JSON.stringify(story),before);
});
