import test from 'node:test';import assert from 'node:assert/strict';
import {publishing,storyWorkspace,nextProductionDecision} from '../views.js';
const make=(extra={})=>({id:'CON-PRODUCTION-FIXTURE',title:'Fixture story with an existing package',revision:'r1',media:[],packageVersion:2,productionDecisions:[{key:'permissions',title:'Resolve selected-photograph permissions',detail:'Permission has not been recorded.',tab:'images'},{key:'claims',title:'Review cited claims',detail:'Check each source.',tab:'research'}],...extra});
test('Production includes an existing package before it has a private edit or provider post and shows its actual next decision',()=>{
 const story=make(),html=publishing({workspace:{stories:[story]}});
 assert.match(html,/Fixture story with an existing package/);assert.match(html,/#\/story\/CON-PRODUCTION-FIXTURE\/images/);assert.match(html,/Resolve selected-photograph permissions/);assert.ok(!html.includes('Ready to publish'));
 const workspace=storyWorkspace({},story,'publishing');assert.match(workspace,/Readiness review/);assert.match(workspace,/Check each source/);assert.match(workspace,/Factual review/);assert.match(workspace,/Image permissions/);assert.match(workspace,/Production records &amp; review packet|Production records & review packet/);assert.match(workspace,/Download production review packet/);
});
test('existing sent, draft or uncertain handoff review takes priority without erasing permissions and factual checks',()=>{
 const story=make();story.productionDecisions.push({key:'handoff',title:'Resolve the earlier handoff before any new import',detail:'Retain the existing provider IDs. Never retry an ambiguous create.',tab:'publishing'});
 const before=JSON.stringify(story);assert.equal(nextProductionDecision(story).key,'handoff');
 const html=storyWorkspace({},story,'publishing');assert.ok(html.indexOf('Resolve the earlier handoff')<html.indexOf('Resolve selected-photograph permissions'));assert.match(html,/Check each source/);assert.match(html,/Permission has not been recorded/);assert.match(html,/Never retry an ambiguous create/);assert.equal(JSON.stringify(story),before);
});
