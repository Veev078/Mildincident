import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {CaptionPilot,policyApprovalValid,photoVisionApprovalValid,photoVisionGraphApprovalValid,preparePhotoVisionPolicyProposal} from '../src/workspace/caption-pilot.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {OBSERVED_RESEARCH_CONNECTION} from '../src/workspace/research-connection.js';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const projection=tag=>({name:'MILDINCIDENT DEV — bounded editorial generation',nodes:[{name:tag,type:'synthetic-test-node'}],connections:{},settings:{executionOrder:'v1'}});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-photo-policy-')),research=new LocalResearchStore(path.join(root,'research.sqlite')),base=projection('original caption/story'),reusable=projection('reusable photo proposal');
 const config={version:2,mode:'founder_confirmed',enabled:true,approved:true,id:randomUUID(),workerVersion:'original-reviewed-version',graphSha256:hash(base),operations:{caption:true,story:true},connection:{...OBSERVED_RESEARCH_CONNECTION,headerName:'X-Mildincident-Development-Key',token:'synthetic-existing-private-dispatch-token-123456789'}};
 const state={worker:{...base,id:OBSERVED_RESEARCH_CONNECTION.editorialWorkerId,active:true,versionId:config.workerVersion,activeVersionId:config.workerVersion},reads:0};
 const makePilot=()=>new CaptionPilot({research,engine:{client:{api:async endpoint=>{assert.equal(endpoint,'/workflows/'+OBSERVED_RESEARCH_CONNECTION.editorialWorkerId);state.reads++;return structuredClone(state.worker);}}},loadConfig:async()=>structuredClone(config)});
 const pilot=makePilot();t.after(async()=>{research.close();await fs.rm(root,{recursive:true,force:true});});
 const proposed=()=>preparePhotoVisionPolicyProposal({basePolicy:config,graphSha256:hash(reusable)});
 function install(extension){config.photoVision=extension;state.worker={...reusable,id:OBSERVED_RESEARCH_CONNECTION.editorialWorkerId,active:true,versionId:extension.workerVersion,activeVersionId:extension.workerVersion};}
 return {research,config,state,pilot,makePilot,proposed,install,reusable};
}
test('accepted recurring caption/story approval stays valid with no photo approval and a reusable proposal remains unpaid and disabled',async t=>{
 const f=await fixture(t),before=JSON.stringify(f.config);await f.pilot.inspect();assert.equal(f.pilot.policyState('story').state,'available');assert.equal(f.pilot.photoPolicyState().state,'disabled');assert.equal(f.pilot.photoBinding(),null);
 const p=f.proposed();assert.equal(p.enabled,false);assert.equal(p.approved,false);assert.equal(p.workerVersion,null);assert.equal(p.basePolicyId,f.config.id);assert.equal(p.baseGraphSha256,f.config.graphSha256);assert.equal(p.format,'compact_v2');assert.equal(p.maxOutputTokens,1200);assert.equal(p.maxModelCalls,1);assert.equal(p.maxToolCalls,0);assert.equal(p.maxResearchCalls,0);assert.equal(p.maxDraftCalls,0);assert.equal(p.maxRetries,0);assert.ok(!JSON.stringify(p).includes(f.config.connection.token));
 assert.equal(JSON.stringify(f.config),before);assert.equal(f.research.db.prepare('SELECT COUNT(*) n FROM studio_generation_actions').get().n,0);
 f.config.photoVision=p;assert.equal(policyApprovalValid(f.config),true);assert.equal(photoVisionApprovalValid(f.config),false);await f.pilot.inspect();assert.equal(f.pilot.policyState('caption').state,'available');assert.equal(f.pilot.photoPolicyState().state,'disabled');
});
test('one locally simulated exact reusable graph approval serves caption/story while photo starts can independently remain off',async t=>{
 const f=await fixture(t),extension={...f.proposed(),approved:true,enabled:true,workerVersion:'synthetic-reusable-version',approvedExecutionGraphSha256:'e'.repeat(64)};f.install(extension);await f.pilot.inspect();
 assert.equal(f.pilot.policyState('caption').state,'available');assert.equal(f.pilot.policyState('story').state,'available');assert.equal(f.pilot.photoPolicyState().state,'available');assert.equal(f.pilot.photoBinding().basePolicyId,f.config.id);assert.equal(f.pilot.photoBinding().policyId,extension.id);assert.equal(f.pilot.photoBinding().approvedExecutionGraphSha256,'e'.repeat(64));assert.deepEqual(f.pilot.dispatchBinding(),{approvedWorkerVersion:extension.workerVersion,approvedGraphSha256:extension.graphSha256});
 f.config.photoVision.enabled=false;await f.pilot.inspect();assert.equal(f.pilot.photoPolicyState().state,'disabled');assert.equal(f.pilot.policyState('caption').state,'available');assert.equal(photoVisionGraphApprovalValid(f.config),true);assert.equal(photoVisionApprovalValid(f.config),false);
 f.state.worker.versionId='unreviewed-version';await f.pilot.inspect();assert.equal(f.pilot.policyState('caption').state,'inactive');assert.equal(f.pilot.photoPolicyState().state,'disabled');
});
test('photo extension never broadens original approvals or accepts changed base identity, budgets, expired approval or unknown version',async t=>{
 const f=await fixture(t),good={...f.proposed(),approved:true,enabled:true,workerVersion:'synthetic-reusable-version'};
 for(const mutate of [p=>{p.basePolicyId=randomUUID();},p=>{p.baseWorkerVersion='other';},p=>{p.baseGraphSha256='a'.repeat(64);},p=>{p.workerVersion=null;},p=>{p.format='legacy';},p=>{p.maxOutputTokens=1500;},p=>{p.maxModelCalls=2;},p=>{p.maxToolCalls=1;},p=>{p.maxRetries=1;},p=>{p.expiresAt='2020-01-01T00:00:00Z';},p=>{p.approvedExecutionGraphSha256='malformed';}]){
  const p=structuredClone(good);mutate(p);f.config.photoVision=p;assert.equal(policyApprovalValid(f.config),true);assert.equal(photoVisionApprovalValid(f.config),false);
 }
 f.config.photoVision=good;f.config.operations.photo=true;assert.equal(policyApprovalValid(f.config),false);assert.equal(photoVisionApprovalValid(f.config),false);
});
function retainPhoto(f,{state='queued',manifest='b'.repeat(64),resultManifest=manifest}={}){
 const request=f.research.create({kind:'brief',prompt:'A labelled synthetic private photo assessment.'},[]),p={id:request.id,operation:'photo',storyId:'CON-TEST-1',createdAt:new Date().toISOString(),manifestSha256:manifest,requestHash:'c'.repeat(64),packet:{manifestSha256:manifest}};
 f.research.claimEngineQueue(p.id,p.requestHash);f.research.recordEngineState(p.id,state,{executionId:state==='ready_to_review'?'123':null,...(state==='ready_to_review'?{photoResult:{purpose:'private_photo_visual_assessment_result',jobId:p.id,executionId:'123',manifestSha256:resultManifest,usage:{input_tokens:1000,output_tokens:100},result:{}}}:{})});
 const time=new Date().toISOString(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());f.research.db.prepare('INSERT INTO studio_generation_actions VALUES(?,?,?,?,?,?,?)').run(p.id,randomUUID(),p.storyId,time,time,day,JSON.stringify(p));return p;
}
test('photo activity shares the durable busy/usage/Disable ledger across restart without consuming caption/story counts',async t=>{
 const f=await fixture(t);f.install({...f.proposed(),approved:true,enabled:true,workerVersion:'synthetic-reusable-version'});await f.pilot.inspect();const p=retainPhoto(f);assert.equal(f.pilot.policyState('caption').state,'busy');assert.equal(f.pilot.photoPolicyState().state,'busy');assert.deepEqual(f.pilot.counts(),{caption:0,story:0});
 const reopened=f.makePilot();await reopened.inspect();assert.equal(reopened.policyState('story').state,'busy');f.research.recordEngineState(p.id,'ready_to_review',{executionId:'123',photoResult:{purpose:'private_photo_visual_assessment_result',jobId:p.id,executionId:'123',manifestSha256:p.manifestSha256,usage:{input_tokens:1000,output_tokens:100}}});assert.equal(reopened.policyState('caption').state,'available');assert.equal(reopened.photoPolicyState().state,'available');assert.equal(reopened.usageReview().operations,1);assert.equal(reopened.usageReview().estimatedUsd,0.004);assert.equal(reopened.usageSummary().recent[0].operation,'photo');assert.equal(reopened.usageSummary().recent[0].state,'completed');
 reopened.disable();const after=f.makePilot();await after.inspect();assert.equal(after.policyState('caption').state,'disabled');assert.equal(after.policyState('story').state,'disabled');assert.equal(after.photoPolicyState().state,'disabled');assert.equal(after.usageReview({allTime:true}).operations,1);assert.throws(()=>after.guardLegacyStart(p.id),{code:'CAPTION_POLICY_DISABLED'});
});
test('a handled photo result with another manifest cannot free the shared operation claim; only the attached photo confirmation flow authorizes starts',async t=>{
 const f=await fixture(t);f.install({...f.proposed(),approved:true,enabled:true,workerVersion:'synthetic-reusable-version'});await f.pilot.inspect();const p=retainPhoto(f,{state:'ready_to_review',resultManifest:'d'.repeat(64)});assert.equal(f.pilot.policyState('caption').state,'busy');assert.equal(f.pilot.usageSummary().recent[0].state,'uncertain');assert.throws(()=>f.pilot.assertStart(p.id),{code:'PHOTO_VISION_NOT_AUTHORIZED'});
 const calls=[];f.pilot.photoVisionPilot={assertStart:id=>calls.push(id),proposal:raw=>({id:raw.id,operation:'photo',state:'reviewed_by_photo_flow'})};f.pilot.assertStart(p.id);assert.deepEqual(calls,[p.id]);assert.equal(f.pilot.usageSummary().recent[0].state,'reviewed_by_photo_flow');assert.equal(f.pilot.status({id:p.storyId}).proposal,null);
});
