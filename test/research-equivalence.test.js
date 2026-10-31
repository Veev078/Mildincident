import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {DEFAULT_DISCOVERY_PROMPT} from '../web/discovery-request.js';

const defaultInput=()=>({kind:'discovery',prompt:DEFAULT_DISCOVERY_PROMPT,idempotencyKey:randomUUID()});
const reuse={reuseDefault:true};
async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-research-equivalence-')),filename=path.join(root,'research.sqlite'),store=new LocalResearchStore(filename);
 t.after(async()=>{store.close();await fs.rm(root,{recursive:true,force:true});});return {root,filename,store};
}

test('equivalent default saves reuse only unstarted work and preserve retry identities after start/restart',async t=>{
 const {filename,store}=await setup(t),baseline=[{id:'story-a',revision:'source-v1'},{id:'story-b',revision:'source-v2',localDraft:{version:3}}];
 const originalInput=defaultInput(),original=store.create(originalInput,baseline,reuse);
 const repeatedInput={...defaultInput(),prompt:'  '+DEFAULT_DISCOVERY_PROMPT.toUpperCase().replaceAll(' ','  ')+'  '};
 const repeated=store.create(repeatedInput,[...baseline].reverse(),reuse);
 assert.equal(repeated.id,original.id);assert.equal(repeated.prompt,DEFAULT_DISCOVERY_PROMPT);assert.equal(repeated.createdAt,original.createdAt);assert.equal(store.all().length,1);
 store.event(original.id,{event:'handoff_requested',expectedVersion:0},baseline);
 const reopened=new LocalResearchStore(filename);
 try{
  const retry=reopened.create(repeatedInput,[{id:'different-baseline'}],reuse);
  assert.equal(retry.id,original.id);assert.equal(retry.events.length,1);assert.deepEqual(retry.baselineIds,['story-a','story-b']);
  assert.throws(()=>reopened.create({...repeatedInput,prompt:DEFAULT_DISCOVERY_PROMPT},baseline,reuse),{code:'EDIT_CONFLICT'});
  assert.equal(reopened.create(originalInput,[],reuse).id,original.id);
  assert.notEqual(reopened.create(defaultInput(),baseline,reuse).id,original.id);
 }finally{reopened.close();}
 assert.equal(store.get(original.id).events.length,1);
});

test('source revisions, local revisions and baseline membership keep default requests distinct',async t=>{
 const {store}=await setup(t),baseline=[{id:'story-a',revision:'source-v1',localDraft:{version:1}}];
 const first=store.create(defaultInput(),baseline,reuse);
 for(const next of [[{id:'story-a',revision:'source-v2',localDraft:{version:1}}],[{id:'story-a',revision:'source-v1',localDraft:{version:2}}],[...baseline,{id:'story-b',revision:'source-v1'}]])assert.notEqual(store.create(defaultInput(),next,reuse).id,first.id);
 assert.equal(store.all().length,4);assert.equal(store.get(first.id).version,0);
});

test('custom prompts, sources, native identities and legacy requests never merge as defaults',async t=>{
 const {store}=await setup(t),nativeInput=defaultInput(),legacy=store.create(nativeInput,[]);
 const first=store.create(defaultInput(),[],reuse);assert.notEqual(first.id,legacy.id);
 const imported=store.create(defaultInput(),[]);assert.notEqual(imported.id,first.id);
 for(const input of [
  {kind:'brief',prompt:DEFAULT_DISCOVERY_PROMPT},
  {kind:'discovery',prompt:DEFAULT_DISCOVERY_PROMPT+' Focus on a specific scene.'},
  {kind:'discovery',prompt:DEFAULT_DISCOVERY_PROMPT,sourceUrl:'https://example.org/project'}
 ])assert.notEqual(store.create(input,[],reuse).id,store.create(input,[],reuse).id);
 assert.equal(store.get(legacy.id).id,nativeInput.idempotencyKey);assert.equal(store.all().length,9);
});

test('requests with existing events, engine ownership, continuation or engine history cannot be reused',async t=>{
 const {store}=await setup(t);
 const scenarios=[
  request=>store.event(request.id,{event:'handoff_requested',expectedVersion:0},[]),
  request=>store.event(request.id,{event:'story_linked',expectedVersion:0,storyId:'linked-story'},[{id:'linked-story'}]),
  request=>store.claimEngineQueue(request.id,'native-request-hash'),
  request=>store.db.prepare('INSERT INTO research_continuations VALUES(?,?)').run(request.id,JSON.stringify({origin:{storyId:'existing-story'}})),
  request=>store.db.prepare('INSERT INTO research_engine_events VALUES(?,?,?,?,?)').run(request.id,1,'failed','{}',new Date().toISOString())
 ];
 for(let i=0;i<scenarios.length;i++){
  const baseline=[{id:'baseline-'+i,revision:'source-v1'}],first=store.create(defaultInput(),baseline,reuse);
  scenarios[i](first);const before=store.get(first.id),next=store.create(defaultInput(),baseline,reuse);
  assert.notEqual(next.id,first.id);assert.deepEqual(store.get(first.id),before);
 }
 assert.equal(store.all().length,scenarios.length*2);
});

test('reuse and alias bindings participate in the existing private transaction',async t=>{
 const {store}=await setup(t),first=store.create(defaultInput(),[],reuse),input=defaultInput();
 store.db.exec('BEGIN IMMEDIATE');assert.equal(store.create(input,[],reuse).id,first.id);store.db.exec('ROLLBACK');
 assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM research_request_aliases').get().n,0);
 store.event(first.id,{event:'handoff_requested',expectedVersion:0},[]);
 assert.equal(store.create(input,[],reuse).id,input.idempotencyKey);assert.equal(store.all().length,2);
});

test('authoritative native identities cannot resolve a Studio retry alias to a different request',async t=>{
 const {store}=await setup(t),first=store.create(defaultInput(),[],reuse),aliasInput=defaultInput();
 assert.equal(store.create(aliasInput,[],reuse).id,first.id);
 assert.throws(()=>store.create(aliasInput,[]),{code:'EDIT_CONFLICT'});
 assert.equal(store.get(aliasInput.idempotencyKey),null);assert.equal(store.all().length,1);assert.equal(store.get(first.id).engineJob,null);
 assert.equal(store.create(aliasInput,[],reuse).id,first.id);
});

test('simultaneous default saves across separate processes produce one request and durable retry aliases',{timeout:15000},async t=>{
 const {filename,store}=await setup(t),moduleUrl=new URL('../src/workspace/research-store.js',import.meta.url).href;
 const script=`import {LocalResearchStore} from ${JSON.stringify(moduleUrl)};
  const store=new LocalResearchStore(process.argv[1]),input=JSON.parse(process.argv[2]);
  process.send({ready:true});process.once('message',()=>{try{const request=store.create(input,[{id:'same-baseline',revision:'v1'}],{reuseDefault:true});process.send({id:request.id});store.close();process.disconnect();}catch(error){console.error(error);process.exit(1);}});`;
 function child(input){
  const worker=spawn(process.execPath,['--input-type=module','-e',script,filename,JSON.stringify(input)],{stdio:['ignore','ignore','pipe','ipc']});
  let failure='',resolved,readyResolve;worker.stderr.on('data',data=>{failure+=data;});
  const ready=new Promise(resolve=>{readyResolve=resolve;});
  const done=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',message=>{if(message.ready)readyResolve();else resolved=message.id;});worker.on('exit',code=>{if(code===0&&resolved)resolve(resolved);else reject(new Error(failure||'Research worker failed'));});});
  t.after(()=>{if(worker.exitCode===null)worker.kill();});return {worker,ready,done,input};
 }
 const children=[child(defaultInput()),child(defaultInput())];await Promise.all(children.map(c=>c.ready));children.forEach(c=>c.worker.send('save'));
 const ids=await Promise.all(children.map(c=>c.done));assert.equal(ids[0],ids[1]);assert.equal(store.all().length,1);
 for(const child of children)assert.equal(store.create(child.input,[],reuse).id,ids[0]);
});
