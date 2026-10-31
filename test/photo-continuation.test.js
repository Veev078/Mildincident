import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {preparePhotoContinuation} from '../src/photography/continuation.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {requestFingerprint} from '../src/workspace/editorial-engine-client.js';
import {planDevelopmentResearch} from '../src/n8n/development-discovery-plan.js';
const story={id:'CON-SYNTHETIC-PROJECT',title:'Synthetic contemporary photographic project',subject:'Night Market study',revision:'revision-1',localDraft:{version:2},media:[{id:'exact-frame',title:'Synthetic frame',sourceUrl:'https://publication.example/project',creator:'Reported Photographer',creatorBasis:'explicit_source_photo_credit',sourceCaption:'A labeled fixture only',sourceResearchLinks:[{kind:'photographer',label:'Photographer',url:'https://photographer.example/portfolio'},{kind:'series',label:'Original series',url:'https://publication.example/series'}]}]};
const input=()=>({intent:'deepen',assetId:'exact-frame',sourceRevision:'revision-1',workingVersion:2,previewSha256:'',idempotencyKey:randomUUID()});
async function setup(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-continuation-'));const store=new LocalResearchStore(path.join(root,'research.sqlite'));t.after(async()=>{store.close();await fs.rm(root,{recursive:true,force:true});});return {root,store};}
test('image research is prepared from exact owned source/series metadata, not copyright assumptions or caller URLs',()=>{
 const {continuation,request}=preparePhotoContinuation(story,input());assert.equal(continuation.origin.assetId,'exact-frame');assert.equal(continuation.routes[0].kind,'series');assert.equal(continuation.routes[1].kind,'photographer');assert.equal(request.kind,'brief');assert.equal(request.sourceUrl,story.media[0].sourceUrl);assert.equal(continuation.sourceAssertionsVerified,false);assert.equal(continuation.publicationApproved,false);
 for(const change of [{assetId:'foreign'},{sourceRevision:'old'},{workingVersion:1},{previewSha256:'old'},{url:'https://caller.example/'},{rightsGranted:true}])assert.throws(()=>preparePhotoContinuation(story,{...input(),...change}));
 const ambiguous=structuredClone(story);Object.assign(ambiguous.media[0],{creator:'Copyright Owner',creatorBasis:'copyright_holder_only',sourceResearchLinks:[{kind:'series',url:'https://127.0.0.1/private',label:'Unsafe'}]});const other=preparePhotoContinuation(ambiguous,input()).continuation;assert.equal(other.photograph.creator,'');assert.equal(other.routes.length,1);assert.ok(!other.routes[0].query.includes('Copyright Owner'));
});
test('continuation requests are idempotent, immutable, restart-safe and cannot attach context to an earlier generic brief',async t=>{
 const {root,store}=await setup(t);const value=input();const saved=store.createPhotoContinuation(story,value,[story]);assert.equal(saved.handoffUrl,null);assert.equal(saved.engineJob,null);assert.equal(store.createPhotoContinuation(story,value,[story]).id,saved.id);assert.equal(store.all().length,1);
 const changed=structuredClone(story);changed.media[0].sourceResearchLinks[0].url='https://photographer.example/new-project';assert.throws(()=>store.createPhotoContinuation(changed,value,[story]),{code:'EDIT_CONFLICT'});assert.equal(store.get(saved.id).continuation.routes[1].url,'https://photographer.example/portfolio');
 const generic=store.create({kind:'brief',prompt:'A generic older request',idempotencyKey:randomUUID()},[story]);assert.throws(()=>store.createPhotoContinuation(story,{...value,idempotencyKey:generic.id},[story]),{code:'EDIT_CONFLICT'});assert.equal(store.get(generic.id).continuation,null);
 const reopened=new LocalResearchStore(path.join(root,'research.sqlite'));try{assert.deepEqual(reopened.get(saved.id).continuation,saved.continuation);}finally{reopened.close();}
});
test('next native request freezes photographic context in the existing hash without fetching feeds or dispatching a model',async t=>{
 const {store}=await setup(t);const saved=store.createPhotoContinuation(story,input(),[story]);let queued,fetches=0,dispatches=0;
 const client={queue:async request=>{queued=structuredClone(request);return {id:1,status:'queued'};},start:async()=>{dispatches++;}};
 const service=new EditorialEngineService({research:store,client,prepareSources:async()=>{fetches++;},sourceLeads:()=>{throw new Error('Unrelated feed leads should not dilute image research');}});
 await service.queue(saved.id);assert.equal(fetches,0);assert.equal(dispatches,0);assert.deepEqual(queued.editorialContext.continuation,saved.continuation);const hash=store.engineJob(saved.id).requestHash;assert.equal(requestFingerprint(queued),hash);
 await service.queue(saved.id);assert.equal(store.engineHistory(saved.id).length,2);const altered=structuredClone(queued);altered.editorialContext.continuation.origin.assetId='other-frame';assert.notEqual(requestFingerprint(altered),hash);
});
test('native brief research respects an exact continuation without weakening unrelated prior exclusions or proactive novelty',()=>{
 const {continuation}=preparePhotoContinuation(story,input()),prior={story:{subject:story.subject},provenance:{generatedAt:'2026-10-30T12:00:00Z'}};
 const branches=[{json:{territory:'photography',instructions:'Native foundation',userPrompt:'Investigate the requested subject',avoid:[story.subject,story.title,'A different already covered story'],diversity:{selected_seed_preset:'native-photo'}}}];
 const job={kind:'brief',prompt:'Continue the selected photograph',editorial_context_json:JSON.stringify({schemaVersion:1,feedback:[],continuation})};const planned=planDevelopmentResearch(branches,[prior],job)[0].json;
 assert.deepEqual(planned.avoid,['A different already covered story']);assert.ok(planned.userPrompt.includes('not a fresh discovery'));assert.ok(planned.userPrompt.includes('https://publication.example/series'));assert.equal(planned.discoveryPlan.preset,'native-photo');
 const fresh=planDevelopmentResearch(branches,[prior],{kind:'discovery',prompt:'Discover new subjects'})[0].json;assert.ok(fresh.avoid.includes(story.subject));assert.throws(()=>planDevelopmentResearch(branches,[],{...job,kind:'discovery'}),/INVALID_PHOTO_CONTINUATION/);
 for(const changes of [{routes:[{kind:'unknown',url:'https://example.org/'}]},{routes:[{kind:'series',label:'unsafe',url:'https://user:pass@example.org/'}]},{rightsGranted:true}])assert.throws(()=>planDevelopmentResearch(branches,[],{...job,editorial_context_json:JSON.stringify({schemaVersion:1,feedback:[],continuation:{...continuation,...changes}})}),/INVALID_PHOTO_CONTINUATION/);
});

test('oversized source context retains intact identities and URLs within the existing editorial budget',()=>{
 const large=structuredClone(story);Object.assign(large,{title:'t'.repeat(1000),subject:'s'.repeat(1000)});Object.assign(large.media[0],{sourceCaption:'c'.repeat(5000),sourceCredit:'r'.repeat(2000),sourceUrl:'https://publication.example/'+ 'a'.repeat(1300),sourceResearchLinks:Array.from({length:2},(_,i)=>({kind:i?'photographer':'series',label:'l'.repeat(300),url:'https://publication.example/'+String(i).repeat(1300)}))});
 const {continuation}=preparePhotoContinuation(large,input());assert.ok(JSON.stringify(continuation).length<=7000);assert.equal(continuation.origin.assetId,'exact-frame');assert.equal(continuation.photograph.sourceUrl,large.media[0].sourceUrl);assert.ok(continuation.routes.length<=3);
});

test('returned development research links to its exact parent without acquiring native package identity or overwriting earlier work',async()=>{
 const {developmentCandidateStory}=await import('../src/workspace/development-story.js');const {continuation}=preparePhotoContinuation(story,input());
 const candidate={id:'DEV-418e3861-610b-400a-9cc6-e0635ce6003d-1',jobId:'418e3861-610b-400a-9cc6-e0635ce6003d',title:'Synthetic returned research branch',subject:story.subject,format:'single_image',captionDraft:'Fixture only',claims:[],media:[],gaps:[],provenance:{kind:'brief',executionId:'fixture',generatedAt:'2026-10-30T12:00:00Z'}};
 const before=JSON.stringify(story),returned=developmentCandidateStory(candidate,{continuation});assert.equal(returned.continuationOf.storyId,story.id);assert.equal(returned.continuationOf.assetId,'exact-frame');assert.notEqual(returned.id,story.id);assert.equal(returned.production.relationship,'not_linked');assert.equal(returned.production.package,null);assert.equal(JSON.stringify(story),before);
});

test('saved natural-language direction freezes with the exact working version, survives restart and reaches future native research without generation',async t=>{
 const {root,store}=await setup(t),current=structuredClone(story);
 const direction='Focus more on the unusual location than the movie itself.\nKeep the photographer’s recorded uncertainty.';
 current.localDraft.creativeBrief={notes:direction};const before=JSON.stringify(current),value=input();
 const saved=store.createPhotoContinuation(current,value,[current]);
 assert.equal(saved.continuation.founderDirection,direction);assert.equal(saved.continuation.origin.workingVersion,2);assert.equal(JSON.stringify(current),before);
 let queued,dispatches=0;const service=new EditorialEngineService({research:store,client:{queue:async request=>(queued=structuredClone(request),{id:1,status:'queued'}),dispatch:async()=>{dispatches++;}},sourceLeads:()=>[]});
 await service.queue(saved.id);assert.equal(dispatches,0);assert.equal(queued.editorialContext.continuation.founderDirection,direction);
 const frozenHash=store.engineJob(saved.id).requestHash;assert.equal(requestFingerprint(queued),frozenHash);
 const branches=[{json:{territory:'photography',instructions:'Native foundation',userPrompt:'Investigate the requested subject',avoid:[],diversity:{selected_seed_preset:'native-photo'}}}];
 const planned=planDevelopmentResearch(branches,[],{kind:'brief',prompt:saved.prompt,editorial_context_json:JSON.stringify(queued.editorialContext)})[0].json;
 assert.ok(planned.userPrompt.includes(JSON.stringify(direction)));assert.match(planned.userPrompt,/saved editorial request/);assert.match(planned.userPrompt,/only where the sources support it/);assert.match(planned.userPrompt,/cannot override factual, rights, output or cost gates/);
 current.localDraft.creativeBrief.notes='A later change must not rewrite an existing research context.';
 assert.throws(()=>store.createPhotoContinuation(current,value,[current]),{code:'EDIT_CONFLICT'});
 assert.equal(store.get(saved.id).continuation.founderDirection,direction);
 const changed=structuredClone(queued);changed.editorialContext.continuation.founderDirection=current.localDraft.creativeBrief.notes;assert.notEqual(requestFingerprint(changed),frozenHash);
 const reopened=new LocalResearchStore(path.join(root,'research.sqlite'));try{assert.equal(reopened.get(saved.id).continuation.founderDirection,direction);assert.equal(reopened.engineJob(saved.id).requestHash,frozenHash);}finally{reopened.close();}
});

test('research direction keeps original text and source URL within bounded context, with oversized or stale work rejected before a request is saved',async t=>{
 const {store}=await setup(t),current=structuredClone(story);current.localDraft.creativeBrief={notes:'A specific source-supported direction. '.repeat(80)};
 Object.assign(current.media[0],{sourceCaption:'c'.repeat(700),sourceCredit:'x'.repeat(400),sourceUrl:'https://publication.example/'+ 's'.repeat(1300),sourceResearchLinks:Array.from({length:2},(_,i)=>({kind:i?'photographer':'series',label:'l'.repeat(200),url:'https://publication.example/'+String(i).repeat(1300)}))});
 const {continuation}=preparePhotoContinuation(current,input());assert.ok(JSON.stringify(continuation).length<=7000);assert.equal(continuation.founderDirection,current.localDraft.creativeBrief.notes);assert.equal(continuation.photograph.sourceUrl,current.media[0].sourceUrl);
 const oversized=structuredClone(current);oversized.localDraft.creativeBrief.notes='📷'.repeat(4000);const original=JSON.stringify(oversized);
 assert.throws(()=>store.createPhotoContinuation(oversized,input(),[oversized]),{code:'INVALID_PHOTO_CONTINUATION'});assert.equal(JSON.stringify(oversized),original);assert.equal(store.all().length,0);
 const stale=structuredClone(current);stale.localDraft.stale=true;assert.throws(()=>store.createPhotoContinuation(stale,input(),[stale]),{code:'EDIT_CONFLICT'});assert.equal(store.all().length,0);
 const branches=[{json:{instructions:'Native',userPrompt:'Native',avoid:[],diversity:{selected_seed_preset:'native'}}}];
 for(const invalid of [true,{},'x'.repeat(4001),'bad\u0000direction'])assert.throws(()=>planDevelopmentResearch(branches,[],{kind:'brief',prompt:'Research this photograph',editorial_context_json:JSON.stringify({schemaVersion:1,feedback:[],continuation:{...continuation,founderDirection:invalid}})}),/INVALID_PHOTO_CONTINUATION/);
 const legacy=preparePhotoContinuation(story,input()).continuation;assert.ok(!Object.hasOwn(legacy,'founderDirection'));assert.ok(planDevelopmentResearch(branches,[],{kind:'brief',prompt:'Existing legacy direction',editorial_context_json:JSON.stringify({schemaVersion:1,feedback:[],continuation:legacy})}));
});
