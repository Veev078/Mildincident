import test from 'node:test';import assert from 'node:assert/strict';import {buildContextReadCheck} from '../src/n8n/context-read-check.js';
test('context replay cannot make paid calls or table writes and contains only fixed execute-once readers',()=>{
 const worker={name:'MILDINCIDENT DEV — bounded editorial generation',active:false,nodes:Array.from({length:9},(_,i)=>({name:'Read '+i,type:'n8n-nodes-base.dataTable',executeOnce:true,parameters:{operation:'get'}}))};const source=JSON.stringify(worker);const replay=buildContextReadCheck({worker,credentialId:'dev-id',credentialName:'Development'});
 assert.equal(JSON.stringify(worker),source);assert.ok(!replay.nodes.some(n=>n.type.includes('openAi')));assert.ok(replay.nodes.filter(n=>n.type.endsWith('dataTable')).every(n=>n.parameters.operation==='get'));assert.throws(()=>buildContextReadCheck({worker:{...worker,active:true}}),{code:'NOT_DEVELOPMENT_SANDBOX'});
});
