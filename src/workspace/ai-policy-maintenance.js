import fs from 'node:fs/promises';
import path from 'node:path';
import {lstatSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {requireThat} from '../errors.js';
import {hostingConfig} from './hosting-config.js';
import {readCaptionPilotConfig,policyApprovalValid,perUsePolicy} from './caption-pilot.js';
import {OBSERVED_RESEARCH_CONNECTION} from './research-connection.js';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const connectionFields=['jobsTableId','candidatesTableId','editorialWorkerId'];

/** One-time operator configuration. Never installs/activates workflows or queues/dispatches models. */
export async function maintainAiPolicy({command,env=process.env,graphSha256,workerVersion,operations=['caption','story'],secretFile,confirm=false,clearStop=false,readWorker}={}){
 requireThat(['status','prepare','enable','disable','revoke'].includes(command),'INVALID_POLICY_COMMAND','Use status, prepare, enable, disable or revoke.');
 const config=hostingConfig(env),file=env.STUDIO_CAPTION_POLICY_FILE;
 requireThat(file,'POLICY_PATH_REQUIRED','Configure STUDIO_CAPTION_POLICY_FILE once on the persistent disk before maintenance.');
 const root=await fs.realpath(config.dataRoot),target=path.resolve(file),parent=await fs.realpath(path.dirname(target));
 requireThat(parent.startsWith(root+path.sep)||parent===root,'INVALID_CAPTION_POLICY','Keep the private policy inside the existing data root.');
 requireThat(!target.startsWith(path.resolve(config.workspace)+path.sep),'INVALID_CAPTION_POLICY','Keep the policy outside editorial backups.');
 let c;try{c=await readCaptionPilotConfig({env,config});}catch(error){if(error.code!=='ENOENT')throw error;c={enabled:false,approved:false};}
 let worker=null;
 async function verifyWorker(candidate,active){
  requireThat(env.N8N_API_KEY,'N8N_CONNECTION_REQUIRED','Use the existing server-side n8n API key.');
  if(readWorker)worker=await readWorker(OBSERVED_RESEARCH_CONNECTION.editorialWorkerId);
  else{const r=await fetch('https://rickywelch.app.n8n.cloud/api/v1/workflows/'+OBSERVED_RESEARCH_CONNECTION.editorialWorkerId,{headers:{'X-N8N-API-KEY':env.N8N_API_KEY},redirect:'error',signal:AbortSignal.timeout(20000)});requireThat(r.ok,'N8N_READ_FAILED','Native read failed; no operation was started.');worker=await r.json();}
  const projection=Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,worker[k]]));
  requireThat(worker.id===OBSERVED_RESEARCH_CONNECTION.editorialWorkerId&&worker.versionId===candidate.workerVersion&&hash(projection)===candidate.graphSha256&&(!active||worker.active===true&&worker.activeVersionId===worker.versionId&&JSON.stringify(worker.activeVersion?.nodes)===JSON.stringify(worker.nodes)&&JSON.stringify(worker.activeVersion?.connections)===JSON.stringify(worker.connections)),'UNSAFE_ENGINE_WORKFLOW','Native version/checksum differs; stop without installing or retrying.');
 }
 async function save(next){const temp=target+'.operator-'+randomUUID();try{await fs.writeFile(temp,JSON.stringify(next)+'\n',{mode:0o600,flag:'wx'});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
 function ledgerEvent(event,{resetStop=false}={}){
  // Existing app schema only; never recreate or reset any database or action/claim.
  const filename=path.join(config.workspace,'research.sqlite');requireThat(lstatSync(filename).isFile(),'DURABLE_STORE_REQUIRED','Start the existing Studio before maintaining its policy.');
  const db=new DatabaseSync(filename);try{
   db.exec('BEGIN IMMEDIATE');
   if(resetStop)db.prepare('UPDATE studio_generation_control SET disabled=0,updated_at=? WHERE id=1').run(new Date().toISOString());
   if(event==='disabled'||event==='revoked')db.prepare('INSERT INTO studio_generation_control VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET disabled=1,updated_at=excluded.updated_at').run(new Date().toISOString());
   db.prepare('INSERT INTO studio_generation_policy_events(created_at,event,data_json) VALUES(?,?,?)').run(new Date().toISOString(),'operator_'+event,JSON.stringify({policyId:c.id||null}));db.exec('COMMIT');
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{db.close();}
 }
 if(command==='prepare'){
  requireThat(!c.enabled,'POLICY_ALREADY_ENABLED','Disable future starts before replacing approval configuration.');
  requireThat(/^[a-f0-9]{64}$/.test(graphSha256||'')&&typeof workerVersion==='string'&&workerVersion.length>0&&operations.length>0&&new Set(operations).size===operations.length&&operations.every(k=>['caption','story'].includes(k)),'INVALID_CAPTION_POLICY','Pin the reviewed graph/version and the caption/story operation allowlist.');
  let token=c.connection?.token;
  if(secretFile){const actual=await fs.realpath(secretFile),stat=await fs.lstat(secretFile);requireThat(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.size<=4096&&actual.startsWith(root+path.sep)&&!actual.startsWith(config.workspace+path.sep),'INVALID_CAPTION_POLICY','Use an existing private dispatch-secret file outside editorial backups.');token=(await fs.readFile(actual,'utf8')).trim();}
  requireThat(typeof token==='string'&&token.length>=32&&!/[\r\n]/.test(token)&&token!==env.N8N_API_KEY,'DISPATCH_AUTH_REQUIRED','Reuse the existing dedicated dispatch secret; never substitute the API key or create a new credential.');
  const next={version:2,mode:'founder_confirmed',enabled:false,approved:false,id:randomUUID(),workerVersion,graphSha256,operations:Object.fromEntries(['caption','story'].map(k=>[k,operations.includes(k)])),connection:{...Object.fromEntries(connectionFields.map(k=>[k,OBSERVED_RESEARCH_CONNECTION[k]])),headerName:'X-Mildincident-Development-Key',token}};
  await verifyWorker(next,false);await save(next);c=next;ledgerEvent('prepared');
 }else if(command==='enable'){
  requireThat(confirm&&perUsePolicy(c)&&policyApprovalValid({...c,enabled:true,approved:true}),'POLICY_CONFIRMATION_REQUIRED','Explicit operator approval of this prepared recurring policy is required.');
  requireThat(c.connection&&connectionFields.every(k=>c.connection[k]===OBSERVED_RESEARCH_CONNECTION[k])&&c.connection.headerName==='X-Mildincident-Development-Key'&&typeof c.connection.token==='string'&&c.connection.token.length>=32&&!/[\r\n]/.test(c.connection.token)&&c.connection.token!==env.N8N_API_KEY,'DISPATCH_AUTH_REQUIRED','The exact existing private dispatch connection is required.');
  const db=new DatabaseSync(path.join(config.workspace,'research.sqlite'),{readOnly:true});let stopped;try{stopped=db.prepare('SELECT disabled FROM studio_generation_control WHERE id=1').get()?.disabled===1;}finally{db.close();}
  requireThat(!stopped||clearStop,'POLICY_STOPPED','The founder disabled future starts. Explicit --clear-stop operator approval is required; history will be retained.');
  await verifyWorker(c,true);ledgerEvent('enabled',{resetStop:clearStop});await save({...c,enabled:true,approved:true});c={...c,enabled:true,approved:true};
 }else if(command==='disable'||command==='revoke'){
  ledgerEvent(command==='disable'?'disabled':'revoked');c=command==='revoke'?{enabled:false,approved:false}:{...c,enabled:false};await save(c);
 }
 return {command,enabled:c.enabled===true,approved:c.approved===true,mode:perUsePolicy(c)?'founder_confirmed':'disabled_or_legacy',policyId:c.id||null,workerVersion:c.workerVersion||null,graphSha256:c.graphSha256||null,operations:c.operations||null,requestQuota:perUsePolicy(c)?null:'legacy_or_disabled',dispatchAuthenticationPresent:typeof c.connection?.token==='string',paidCalls:0,workflowMutations:0};
}
