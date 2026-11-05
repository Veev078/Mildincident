import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalDraftStore} from '../src/workspace/store.js';
import {EditorialEngineService} from '../src/workspace/editorial-engine-service.js';
import {requestFingerprint} from '../src/workspace/editorial-engine-client.js';
import {captionGenerationState,validateCaptionBinding} from '../src/workspace/caption-generation.js';
import {researchAccess} from '../web/discovery-flow.js';
import {createWorkspaceServer} from '../src/workspace/server.js';
import {developmentCandidateStory} from '../src/workspace/development-story.js';
import {WORKSPACE_TABLES,buildWorkspace} from '../src/workspace/model.js';

const sourceJob=randomUUID(),sourceUrl='https://example.org/project',excerpt='A documented photographic project traces the relationships of a specific community. '.repeat(4);
const claim={claim:'The project documents a specific community.',claimType:'verified_fact',url:sourceUrl,sourceName:'Fixture source'};
const original={id:'DEV-'+sourceJob+'-1',jobId:sourceJob,title:'Explicit test fixture',subject:'Fixture project',hook:'Fixture premise',captionDraft:'',claims:[claim],sourceEvidence:[{claimIndex:0,url:sourceUrl,access:'source_text_captured',textExcerpt:excerpt}],media:[{id:'first',sourceUrl,previewUrl:'',title:'Fixture reference'},{id:'second',sourceUrl,previewUrl:'',title:'Other fixture reference'}],gaps:[],provenance:{executionId:'100',kind:'brief',generatedAt:new Date().toISOString()}};
const story=()=>developmentCandidateStory(structuredClone(original));
const binding=s=>{const request={id:randomUUID(),kind:'brief',prompt:'Draft only from the retained fixture evidence.',sourceUrl};return {storyId:s.id,sourceRevision:s.revision,sourceJobId:sourceJob,sourceCandidateId:original.id,sourceExecutionId:'100',evidenceSha256:'a'.repeat(64),request,requestHash:requestFingerprint(request)};};
function recovered(b){return {...structuredClone(original),id:'DEV-'+b.request.id+'-1',jobId:b.request.id,captionDraft:'A genuine fixture response, never claimed as real AI output. Specific image details and credits still need verification from the source material before production.',hookOptions:[],recovery:{mode:'draft_only',sourceJobId:sourceJob,sourceCandidateId:original.id,sourceExecutionId:'100',sourceCapturedAt:original.provenance.generatedAt,evidenceSha256:b.evidenceSha256},provenance:{...original.provenance,executionId:'101'}};}
async function setup(t){const root=await fs.mkdtemp(os.tmpdir()+'/mi-build-e-'),research=new LocalResearchStore(root+'/research.sqlite'),drafts=new LocalDraftStore(root+'/drafts.sqlite');t.after(async()=>{drafts.close();research.close();await fs.rm(root,{recursive:true,force:true});});return {root,research,drafts};}

test('caption dispatch binds one retained-evidence request and consumes a durable permit before a single uncertain provider dispatch',async t=>{
 const {research}=await setup(t),s=story(),b=binding(s);let dispatches=0,queues=0;
 const connection={executionScope:'draft_only',captionRecovery:b,authorization:{id:randomUUID(),maxRuns:1,expiresAt:new Date(Date.now()+60000).toISOString()}},client={connection,inspect:async()=>({configured:true,generationAvailable:true,generationApproved:true,workerActive:true}),queue:async r=>{queues++;return {id:1,status:'queued',request_hash:requestFingerprint(r)};},dispatch:async()=>{dispatches++;throw new Error('Fixture lost response');}};
 const engine=new EditorialEngineService({research,client});await engine.inspect();assert.equal(engine.captionStatus(s).state,'available');assert.equal(researchAccess({...engine.status(),executionScope:'draft_only',readOnly:false}).canStart,false);
 await assert.rejects(engine.generateCaption({...s,revision:'changed'},{sourceRevision:'changed',workingVersion:0}),{code:'CAPTION_NOT_AUTHORIZED'});assert.equal(dispatches,0);
 const wrong=research.create({kind:'brief',prompt:'Another unapproved research request'},[]);await assert.rejects(engine.queue(wrong.id),{code:'CAPTION_SCOPE_MISMATCH'});assert.equal(queues,0);
 await engine.generateCaption(s,{sourceRevision:s.revision,workingVersion:0});await new Promise(r=>setImmediate(r));assert.equal(dispatches,1);assert.equal(queues,1);assert.equal(engine.captionStatus(s).state,'review_required');assert.equal(captionGenerationState(s,research.all(),null,{}).state,'review_required');assert.equal(research.authorizationRemaining(connection.authorization),0);
 await assert.rejects(engine.generateCaption(s,{sourceRevision:s.revision,workingVersion:0}),{code:'CAPTION_NOT_AUTHORIZED'});assert.equal(dispatches,1);
 const restarted=new LocalResearchStore(research.db.location());try{assert.equal(restarted.authorizationRemaining(connection.authorization),0);}finally{restarted.close();}
});

test('recovery recognition requires exact original job, execution, claims and captured evidence; edited captions are never replaced',()=>{
 const s=story(),b=binding(s),c=recovered(b),requests=[{engineJob:{candidates:[c]}}];assert.equal(captionGenerationState(s,requests,null,{}).state,'result_available');
 for(const change of [{sourceEvidence:[]},{recovery:{...c.recovery,sourceExecutionId:'999'}},{claims:[{...claim,claim:'A different story'}]},{sourceEvidence:[{...c.sourceEvidence[0],textExcerpt:'Different evidence'}]}])assert.notEqual(captionGenerationState(s,[{engineJob:{candidates:[{...c,...change}]}}],null,{}).state,'result_available');
 assert.equal(captionGenerationState(s,[...requests,...requests],null,{}).versions.length,1);assert.equal(captionGenerationState({...s,localDraft:{caption:'Founder copy'}},requests,null,{}).result.originalCaption,c.captionDraft);
 assert.throws(()=>validateCaptionBinding({...b,requestHash:'b'.repeat(64)},requestFingerprint),{code:'INVALID_CAPTION_BINDING'});assert.equal(captionGenerationState({...s,research:[]},[],null,{}).state,'research_needed');
});

test('original-story result use preserves sequence and source identity, survives restart, rejects stale/foreign/cross-origin requests and protects edits',async t=>{
 const {root,research,drafts}=await setup(t),s=story(),b=binding(s),c=recovered(b);
 const r=research.create({kind:'brief',prompt:'Original fixture research request',idempotencyKey:sourceJob},[]);research.claimEngineQueue(r.id,requestFingerprint(r));research.recordEngineState(r.id,'needs_research',{candidates:[original],executionId:'100'});
 const recoveredRequest=research.create({kind:b.request.kind,prompt:b.request.prompt,sourceUrl,idempotencyKey:b.request.id},[]);research.claimEngineQueue(recoveredRequest.id,b.requestHash);research.recordEngineState(recoveredRequest.id,'needs_research',{candidates:[c],executionId:'101'});
 const records=Object.fromEntries(Object.keys(WORKSPACE_TABLES).map(k=>[k,[]])),source={snapshot:{records,buffer:{posts:[],complete:true}},view:local=>buildWorkspace({records,buffer:{posts:[],complete:true}},local)};
 const server=createWorkspaceServer({source,research,drafts});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const origin='http://127.0.0.1:'+server.address().port;
 const current=async()=>fetch(origin+'/api/stories/'+s.id).then(r=>r.json());const first=await current();assert.equal(first.captionGeneration.state,'result_available');
 drafts.save(first,{baseRevision:first.revision,expectedVersion:0,selectedAssetIds:['second','first'],notes:'Founder selections stay.'});
 const post=(body,site=origin)=>fetch(origin+'/api/stories/'+s.id+'/caption/use',{method:'POST',headers:{Origin:site,'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'},body:JSON.stringify(body)}),input={sourceRevision:first.revision,workingVersion:1,candidateId:c.id};
 assert.ok((await post({...input,workingVersion:0})).status>=400);assert.ok((await post(input,'https://example.org')).status>=400);assert.ok((await post({...input,candidateId:'foreign'})).status>=400);assert.equal((await post(input)).status,200);
 const result=await current();assert.deepEqual(result.localDraft.selectedAssetIds,['second','first']);assert.equal(result.localDraft.notes,'Founder selections stay.');assert.equal(result.revision,first.revision);assert.ok(!result.localDraft.caption.includes('before production'));assert.equal(result.generatedCaptionOriginal,'');assert.equal(result.captionGeneration.result.originalCaption,c.captionDraft);
 assert.ok((await post({...input,workingVersion:2})).status>=400);assert.equal(drafts.history(s.id).length,2);const restarted=new LocalDraftStore(root+'/drafts.sqlite');try{assert.equal(restarted.get(s.id).caption,result.localDraft.caption);assert.deepEqual(restarted.get(s.id).selectedAssetIds,['second','first']);}finally{restarted.close();}
});

test('authorized drafting-only request receives pending and completed native states on its original story without research context or repeated dispatch',async t=>{
 const {research,root}=await setup(t),s=story(),b=binding(s),nativeJobs=[],nativeCandidates=[];let queues=0,dispatches=0,finish;
 const old=research.create({kind:'brief',prompt:'Retained original fixture research',idempotencyKey:sourceJob},[]);research.claimEngineQueue(old.id,requestFingerprint(old));research.recordEngineState(old.id,'needs_research',{candidates:[original],executionId:'100'});
 const client={connection:{executionScope:'draft_only',captionRecovery:b,jobsTableId:'jobs',candidatesTableId:'results',authorization:{id:randomUUID(),maxRuns:1,expiresAt:new Date(Date.now()+60000).toISOString()}},inspect:async()=>({configured:true,generationAvailable:true,generationApproved:true,workerActive:true}),rows:async table=>table==='jobs'?nativeJobs:nativeCandidates,executionStatus:async()=>({status:'running',startedAt:new Date().toISOString()}),queue:async request=>{queues++;assert.equal(request.editorialContext,undefined);const row={id:1,job_id:request.id,request_hash:requestFingerprint(request),kind:request.kind,prompt:request.prompt,source_url:request.sourceUrl,status:'queued',execution_id:''};nativeJobs.push(row);return row;},dispatch:async()=>{dispatches++;return new Promise(resolve=>finish=resolve);}};
 const engine=new EditorialEngineService({research,client,prepareSources:()=>{throw new Error('Research/feed preparation must not run');}});await engine.generateCaption(s,{sourceRevision:s.revision,workingVersion:0});assert.equal(engine.captionStatus(s).state,'pending');assert.equal(captionGenerationState(s,research.all(),null,{}).state,'pending');
 const c=recovered(b),raw={...c,story:{title:c.title,subject:c.subject,hook:c.hook},claims:c.claims.map(c=>({claim:c.claim,claim_type:c.claimType,source_url:c.url,source_name:c.sourceName})),media:[],editorialStage:'drafted'};nativeJobs[0].status='needs_research';nativeJobs[0].execution_id='101';nativeCandidates.push({job_id:c.jobId,candidate_id:c.id,candidate_json:JSON.stringify(raw),status:'needs_research'});finish({executionId:'101',jobId:c.jobId,status:'needs_research',accepted:true,scope:'development_only',productionApplied:false});
 for(let i=0;i<20&&engine.captionStatus(s).state==='pending';i++)await new Promise(r=>setImmediate(r));assert.equal(engine.captionStatus(s).state,'result_available');assert.equal(engine.captionStatus(s).result.executionId,'101');assert.equal(queues,1);assert.equal(dispatches,1);assert.equal(s.caption,'');
 const reopened=new LocalResearchStore(root+'/research.sqlite');try{assert.equal(captionGenerationState(s,reopened.all(),null,{}).state,'result_available');}finally{reopened.close();}
});
