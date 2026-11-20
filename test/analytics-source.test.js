import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWorkspaceSnapshot} from '../src/workspace/data-source.js';

test('read-only performance refresh verifies the channel and records missing vs failed measurements without fetching internal tests',async()=>{
 const calls=[];
 const bufferReader={account:async()=>({organizations:[{id:'org'}]}),channels:async()=>[{id:'channel',name:'mildincident',service:'instagram'}],posts:async()=>({complete:true,posts:[{id:'measured',status:'sent'},{id:'missing',status:'sent'},{id:'failed',status:'sent'},{id:'test',status:'sent',text:'INTERNAL CAROUSEL TEST — DO NOT PUBLISH'},{id:'draft',status:'draft'}]}),metrics:async id=>{calls.push(id);if(id==='failed')throw Error('private provider details');return{id,metrics:id==='measured'?[{name:'reach',value:0,unit:'count'}]:null,metricsUpdatedAt:null};}};
 const result=await fetchWorkspaceSnapshot({read:async()=>({data:[],nextCursor:null}),bufferReader});
 assert.deepEqual(calls,['measured','missing','failed']);
 assert.deepEqual(result.buffer.posts.slice(0,3).map(post=>post.metricsRead.state),['measured','not_supplied','unavailable']);
 assert.equal(result.buffer.posts[0].metrics[0].value,0);assert.equal(result.buffer.posts[0].metricsUpdatedAt,null);
 assert.equal(result.buffer.accountIdentity.channelId,'channel');assert.equal(result.buffer.accountIdentity.service,'instagram');
 assert.ok(!JSON.stringify(result).includes('private provider details'));
});

test('an ambiguous account match cannot be used to attribute audience measurements',async()=>{
 let reads=0;const bufferReader={account:async()=>({organizations:[{id:'one'},{id:'two'}]}),channels:async org=>[{id:org,name:'mildincident',service:'instagram'}],posts:async()=>{reads++;}};
 await assert.rejects(fetchWorkspaceSnapshot({read:async()=>({data:[],nextCursor:null}),bufferReader}),{code:'BUFFER_CHANNEL_AMBIGUOUS'});assert.equal(reads,0);
});
