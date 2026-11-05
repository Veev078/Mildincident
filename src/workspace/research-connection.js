import fs from 'node:fs/promises';import path from 'node:path';
import {requireThat} from '../errors.js';import {EditorialEngineClient,loadEditorialEngineClient} from './editorial-engine-client.js';
export const OBSERVED_RESEARCH_CONNECTION=Object.freeze({mode:'read_only',generationEnabled:false,jobsTableId:'z22YLsWc4lO1yCG4',candidatesTableId:'W40NQ6jFBZWbpB3U',editorialWorkerId:'6CkqfYc4Pyd4k8vi',historyJobIds:['41949fff-2af7-47e3-a207-15390f1a64b6','99de2099-d762-40d5-85d9-222ba3c241db','0de9954f-aa84-4cc7-84fc-adec0fc5afeb']});
/** An administrator-installed private permit is required; the browser cannot arm research. */
export async function researchConnection({env,config,createClient=options=>new EditorialEngineClient(options)}){
 if(!config.hosted)return loadEditorialEngineClient({apiKey:env.N8N_API_KEY});
 if(!env.N8N_API_KEY)return null;
 if(!env.STUDIO_RESEARCH_CONNECTION_FILE)return createClient({apiKey:env.N8N_API_KEY,connection:{...OBSERVED_RESEARCH_CONNECTION}});
 const filename=path.resolve(env.STUDIO_RESEARCH_CONNECTION_FILE),root=await fs.realpath(config.dataRoot);
 const stat=await fs.lstat(filename);requireThat(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.size<=16384,'INVALID_RESEARCH_CONNECTION','Research connection must be a private regular file.');
 const actual=await fs.realpath(filename);requireThat(actual.startsWith(root+path.sep),'INVALID_RESEARCH_CONNECTION','Research connection must stay on the private persistent disk.');
 const connection=JSON.parse(await fs.readFile(actual,'utf8')),a=connection.authorization;
 requireThat(Object.keys(connection).every(k=>['mode','generationEnabled','jobsTableId','candidatesTableId','editorialWorkerId','headerName','token','approvedWorkerVersion','authorization'].includes(k))&&connection.mode==='standard'&&connection.generationEnabled===true&&['jobsTableId','candidatesTableId','editorialWorkerId'].every(k=>connection[k]===OBSERVED_RESEARCH_CONNECTION[k])&&typeof connection.approvedWorkerVersion==='string'&&connection.approvedWorkerVersion.length>0,'INVALID_RESEARCH_CONNECTION','Use the existing bounded worker and an explicitly approved version.');
 requireThat(a&&Object.keys(a).length===3&&/^[a-f0-9-]{36}$/.test(a.id)&&a.maxRuns===1&&Number.isFinite(Date.parse(a.expiresAt))&&Date.parse(a.expiresAt)>Date.now(),'INVALID_RESEARCH_CONNECTION','A current single-run authorization is required.');
 return createClient({apiKey:env.N8N_API_KEY,connection:{...connection,historyJobIds:[...OBSERVED_RESEARCH_CONNECTION.historyJobIds]}});
}
