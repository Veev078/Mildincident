import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {buildLeaseCheckRunner,validateDevelopmentDispatch} from '../src/n8n/editorial-job-lease.js';
test('development lease is constrained by job identity, content hash and queued status',()=>{
 const workflow=buildLeaseCheckRunner({tableId:'development_jobs',credentialId:'dev_auth',credentialName:'Dev only'});const claim=workflow.nodes.find(n=>n.type.endsWith('dataTable'));
 assert.equal(claim.parameters.dataTableId.value,'development_jobs');assert.deepEqual(claim.parameters.filters.conditions.map(c=>c.keyName),['job_id','request_hash','status']);assert.equal(claim.parameters.columns.value.status,'generating');assert.equal(workflow.nodes[0].parameters.authentication,'headerAuth');
 const body={job_id:'418e3861-610b-400a-9cc6-e0635ce6003d',dispatch_id:'abce3861-610b-400a-9cc6-e0635ce6003d',request_hash:'a'.repeat(64)};
 const run=value=>vm.runInNewContext(`(${validateDevelopmentDispatch.toString()})()`,{$input:{first:()=>({json:{body:value}})}});
 assert.equal(run(body)[0].json.job_id,body.job_id);assert.throws(()=>run({...body,job_id:'production'}));assert.throws(()=>run({...body,activate:true}));
});
