import {HandoffError,requireThat} from '../errors.js';
const PATHS=new Set(['mildincident-dev-photo-replay-v1','mildincident-dev-lease-check-v1','mildincident-dev-editorial-job-v1','mildincident-dev-context-read-v1','mildincident-dev-recorded-media-v1']);
/** Activation can return before webhook registration. Probe without credentials before one side-effecting dispatch. */
export async function waitForDevelopmentWebhook(path,{fetchImpl=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=15000}={}) {
  requireThat(PATHS.has(path)&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=30000,'INVALID_DEV_ENDPOINT','Only known development endpoints can be probed.');
  const deadline=Date.now()+timeoutMs;let attempts=0;
  while(Date.now()<deadline&&attempts<12){attempts++;let response;
    try{response=await fetchImpl('https://rickywelch.app.n8n.cloud/webhook/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-Date.now())))});}catch{await delay(200);continue;}
    const status=response.status;await response.body?.cancel();
    if(status===401||status===403)return {ready:true,attempts,authenticationRequired:true};
    if(![404,502,503].includes(status))throw new HandoffError('UNPROTECTED_DEVELOPMENT_WEBHOOK','The expected authentication rejection was not observed. No authenticated dispatch was made.');
    await delay(250);
  }
  throw new HandoffError('DEVELOPMENT_WEBHOOK_NOT_READY','The development endpoint did not become ready. Do not dispatch or assume the activation response proves readiness.');
}
