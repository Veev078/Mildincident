import test from 'node:test';import assert from 'node:assert/strict';import {waitForDevelopmentWebhook} from '../src/n8n/development-webhook-readiness.js';
test('registration readiness requires an authentication rejection and never sends a secret or repeats an authenticated call',async()=>{
 const statuses=[404,404,403];const calls=[];const result=await waitForDevelopmentWebhook('mildincident-dev-recorded-media-v1',{fetchImpl:async(url,options)=>{calls.push({url,options});return new Response('',{status:statuses.shift()});},delay:async()=>{}});assert.equal(result.attempts,3);assert.ok(calls.every(c=>Object.keys(c.options.headers).length===1&&!JSON.stringify(c.options).includes('Development-Key')));
 await assert.rejects(waitForDevelopmentWebhook('mildincident-dev-recorded-media-v1',{fetchImpl:async()=>new Response('{}',{status:200}),delay:async()=>{}}),{code:'UNPROTECTED_DEVELOPMENT_WEBHOOK'});
 await assert.rejects(waitForDevelopmentWebhook('arbitrary-path'),{code:'INVALID_DEV_ENDPOINT'});
});
