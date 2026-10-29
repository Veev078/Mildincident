import test from 'node:test';import assert from 'node:assert/strict';import {buildDevelopmentRunner,enableSandboxSubworkflowEntry} from '../src/n8n/development-runner.js';
test('development runner requires native header authentication and only replays code from the supplied inactive sandbox',()=>{
 const sandbox={id:'sandbox123',active:false,name:'MILDINCIDENT DEV — bounded photo reference replay',nodes:Array.from({length:5},(_,i)=>({name:'Code '+i,type:'n8n-nodes-base.code',parameters:{jsCode:'return [];'}}))};
 const runner=buildDevelopmentRunner({sandboxId:'sandbox123',sandbox,credentialId:'dev456',credentialName:'Development header'});
 assert.equal(runner.nodes[0].parameters.authentication,'headerAuth');assert.equal(runner.nodes.length,7);assert.ok(runner.nodes.every(n=>n.type!=='n8n-nodes-base.executeWorkflow'));assert.equal(sandbox.nodes.length,5);assert.equal(runner.settings.executionTimeout,120);assert.ok(!JSON.stringify(runner).includes('scheduleTrigger'));assert.ok(!JSON.stringify(runner).includes('secret-value'));
 assert.throws(()=>buildDevelopmentRunner({sandboxId:'../production',credentialId:'dev456'}),{code:'DEV_CONNECTION_REQUIRED'});
});
test('only the exact inactive development sandbox can receive a subworkflow trigger',()=>{
 const source={active:false,name:'MILDINCIDENT DEV — bounded photo reference replay',nodes:[{name:'Get Concept',type:'n8n-nodes-base.code'}],connections:{}};const before=JSON.stringify(source);const out=enableSandboxSubworkflowEntry(source);assert.equal(out.nodes.length,2);assert.equal(JSON.stringify(source),before);assert.equal(out.connections['Development subworkflow entry'].main[0][0].node,'Get Concept');
 for(const bad of [{...source,active:true},{...source,name:'Production'},{...source,nodes:[{type:'n8n-nodes-base.dataTable'}]}])assert.throws(()=>enableSandboxSubworkflowEntry(bad));
});
