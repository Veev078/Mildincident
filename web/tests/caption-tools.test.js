import test from'node:test';import assert from'node:assert/strict';
import{distinctCaptionVersions,captionDifference}from'../caption-comparison.js';
import{captionGenerationPanel}from'../caption-generation.js';
import{storyWorkspace}from'../views.js';
import{workspaceSnapshot}from'../../test/helpers/workspace-fixture.js';import{buildWorkspace}from'../../src/workspace/model.js';

test('comparison shows actual word changes safely, with a bounded fallback for long drafts',()=>{
 const d=captionDifference('A quiet <street>.','A vivid <street>.');assert.match(d.current,/<del>quiet<\/del>/);assert.match(d.selected,/<ins>vivid<\/ins>/);assert.ok(!d.current.includes('<street>'));assert.match(d.selected,/&lt;street&gt;/);assert.equal(captionDifference('one '.repeat(1000),'two '.repeat(1000)).detailed,false);assert.equal(captionDifference('same','same').selected,'same');
});
test('identical text is one choice with retained origins; current source validity wins over a stale duplicate',()=>{
 const versions=[{id:'old',caption:'Same copy',applicable:false},{id:'new',caption:'Same copy',applicable:true},{id:'blank',caption:' '},{id:'other',caption:'Different copy',applicable:true}],before=JSON.stringify(versions),distinct=distinctCaptionVersions(versions);assert.equal(distinct.length,2);assert.equal(distinct[0].id,'new');assert.deepEqual(distinct[0].origins.map(o=>o.id),['old','new']);assert.equal(JSON.stringify(versions),before);
});
test('AI toolbar offers only the exact approved native direction; unauthorized or uncertain work never exposes generation',()=>{
 const base={id:'story',caption:'Working copy',captionGeneration:{generation:{state:'available',direction:'concise'}}},state={captionTools:{story:'improve'}};
 const html=captionGenerationPanel(base,{state});assert.match(html,/data-caption-operation="generate"/);assert.match(html,/data-direction="concise"/);assert.match(html,/Generate improved draft/);assert.ok(!html.includes('<select'));
 for(const status of ['authorization_required','research_needed','pending','review_required'])assert.ok(!captionGenerationPanel({...base,captionGeneration:{generation:{state:status}}},{state}).includes('data-caption-operation="generate"'));
});
test('matching current text cannot be reapplied; stale drafts cannot be selected as replacements',()=>{
 const version={id:'old',caption:'Different source copy',kind:'saved',applicable:false},story={id:'story',caption:'Current',captionGeneration:{versions:[version]}},html=captionGenerationPanel(story,{state:{captionTools:{story:'compare'}}});assert.match(html,/data-caption-operation="use-version"[^>]*disabled/);assert.match(html,/older source material/);
 const same=captionGenerationPanel({...story,caption:'Different source copy'},{state:{captionTools:{story:'compare'}}});assert.ok(!same.includes('class="caption-current-copy"'));assert.match(same,/matches your current text/);
});
test('Develop and caption deep links have the same single editing workspace; pending source changes still block editing',()=>{
 const story=buildWorkspace(workspaceSnapshot()).stories[0],state={workspace:{},compared:[]};const overview=storyWorkspace(state,story,'overview'),caption=storyWorkspace(state,story,'caption');assert.equal(overview,caption);assert.equal((overview.match(/id="caption-editor"/g)||[]).length,1);assert.equal((overview.match(/data-save-status/g)||[]).length,1);assert.ok(!overview.includes('Try another version'));assert.ok(!overview.includes('Saved caption version'));
 const stale=storyWorkspace(state,{...story,localDraft:{stale:true,caption:'Keep this'}},'caption');assert.match(stale,/id="caption-editor"[^>]*disabled/);assert.match(stale,/Compare source and local draft/);
});
