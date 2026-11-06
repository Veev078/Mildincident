import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import{createHash}from'node:crypto';
import{maintainAiPolicy}from'../src/workspace/ai-policy-maintenance.js';import{LocalResearchStore}from'../src/workspace/research-store.js';import{CaptionPilot}from'../src/workspace/caption-pilot.js';
test('operator installs recurring approval once, pins the native graph and honors durable disable without resetting history',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-policy-maintenance-')),file=path.join(root,'caption-pilot-policy.json'),secretFile=path.join(root,'existing-dispatch-secret'),token='synthetic-existing-dispatch-secret-not-a-real-credential';
 const env={STUDIO_DATA_DIR:root,STUDIO_CAPTION_POLICY_FILE:file,N8N_API_KEY:'synthetic-distinct-api-key'},research=new LocalResearchStore(path.join(root,'workspace/research.sqlite'));new CaptionPilot({research});
 t.after(async()=>{research.close();await fs.rm(root,{recursive:true,force:true});});await fs.writeFile(file,'{"enabled":false,"approved":false}',{mode:0o600});await fs.writeFile(secretFile,token,{mode:0o600});
 const graph={name:'Synthetic exact graph',nodes:[],connections:{},settings:{}},graphSha256=createHash('sha256').update(JSON.stringify(graph)).digest('hex'),worker={...graph,id:'6CkqfYc4Pyd4k8vi',versionId:'reviewed-version',active:false,activeVersionId:null};
 const options={env,readWorker:async()=>structuredClone(worker)},prepare={...options,command:'prepare',graphSha256,workerVersion:'reviewed-version',secretFile};
 const result=await maintainAiPolicy(prepare);assert.equal(result.enabled,false);assert.equal(result.requestQuota,null);assert.ok(!JSON.stringify(result).includes(token));const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(saved.connection.token,token);assert.equal(saved.expiresAt,undefined);assert.equal(saved.dailyCaptionLimit,undefined);
 await assert.rejects(maintainAiPolicy({...options,command:'enable',confirm:true}),{code:'UNSAFE_ENGINE_WORKFLOW'});
 worker.active=true;worker.activeVersionId=worker.versionId;worker.activeVersion={nodes:worker.nodes,connections:worker.connections};
 await assert.rejects(maintainAiPolicy({...options,command:'enable'}),{code:'POLICY_CONFIRMATION_REQUIRED'});
 const enabled=await maintainAiPolicy({...options,command:'enable',confirm:true});assert.equal(enabled.enabled,true);
 const pilot=new CaptionPilot({research});pilot.disable();const events=research.db.prepare('SELECT COUNT(*) n FROM studio_generation_policy_events').get().n;
 await assert.rejects(maintainAiPolicy({...options,command:'enable',confirm:true}),{code:'POLICY_STOPPED'});await maintainAiPolicy({...options,command:'enable',confirm:true,clearStop:true});assert.equal(pilot.disabled(),false);assert.ok(research.db.prepare('SELECT COUNT(*) n FROM studio_generation_policy_events').get().n>events);
 await maintainAiPolicy({...options,command:'disable'});assert.equal(pilot.disabled(),true);assert.equal(JSON.parse(await fs.readFile(file,'utf8')).connection.token,token);
 await maintainAiPolicy({...options,command:'revoke'});assert.equal(JSON.parse(await fs.readFile(file,'utf8')).connection,undefined);assert.equal(pilot.disabled(),true);
});
