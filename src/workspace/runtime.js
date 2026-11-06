import {CaptionPilot,readCaptionPilotConfig} from './caption-pilot.js';
import sharp from 'sharp';import {HostedBackups} from './hosted-backups.js';
import {researchConnection,OBSERVED_RESEARCH_CONNECTION} from './research-connection.js';
import {closeStudioServer} from './shutdown.js';
import fs from 'node:fs/promises';import path from 'node:path';import {WorkspaceSource,fetchWorkspaceSnapshot} from './data-source.js';import {n8nReader} from '../audit.js';import {BufferReader} from '../buffer-reader.js';import {LocalDraftStore} from './store.js';import {LocalPreviewStore} from './previews.js';import {LocalResearchStore} from './research-store.js';import {PublicationFeeds} from '../discovery/publication-feeds.js';import {EditorialEngineClient,loadEditorialEngineClient} from './editorial-engine-client.js';import {EditorialEngineService} from './editorial-engine-service.js';import {ResearchDelivery} from './research-delivery.js';import {PrivateAccess} from './private-access.js';import {hostingConfig} from './hosting-config.js';
export async function startWorkspace({createServer,env=process.env,installSignals=true,loadSnapshot=null,createEngineClient=options=>new EditorialEngineClient(options)}={}){
 const config=hostingConfig(env);if(config.hosted){sharp.concurrency(1);sharp.cache({memory:16,files:0,items:10});}await fs.mkdir(config.dataRoot,{recursive:true,mode:0o700});
 const access=config.hosted?new PrivateAccess({origin:config.origin,filename:path.join(config.dataRoot,'auth.sqlite'),passwordHash:config.passwordHash}):null;
 const source=new WorkspaceSource({root:config.workspace,auditRoot:path.join(config.dataRoot,'audits'),loadLive:loadSnapshot||(()=>fetchWorkspaceSnapshot({read:n8nReader(env.N8N_API_KEY),bufferReader:env.BUFFER_ACCESS_TOKEN?new BufferReader({token:env.BUFFER_ACCESS_TOKEN}):null}))});await source.initialize();
 const drafts=new LocalDraftStore(path.join(config.workspace,'drafts.sqlite')),previews=new LocalPreviewStore(path.join(config.workspace,'previews')),research=new LocalResearchStore(path.join(config.workspace,'research.sqlite')),feeds=new PublicationFeeds(research);
 let engine=null,delivery=null;
 const loadClient=async()=>{try{return await researchConnection({env,config,createClient:createEngineClient});}catch{if(!env.N8N_API_KEY)return null;return createEngineClient({apiKey:env.N8N_API_KEY,connection:{...OBSERVED_RESEARCH_CONNECTION,connectionIssue:true}});}};
 try{const client=await loadClient();
 if(client){engine=new EditorialEngineService({research,client,...(config.hosted?{reloadClient:loadClient}:{}),imageFeedback:()=>previews.tasteFeedback(),sourceLeads:()=>feeds.context(),prepareSources:()=>feeds.refresh()});delivery=new ResearchDelivery(engine,{intervalMs:config.intervalMs});}
 }catch(error){console.error('Research connection unavailable: '+(error.code||'CONFIGURATION_ERROR'));}
 const captionPilot=engine?new CaptionPilot({research,engine,loadConfig:()=>readCaptionPilotConfig({env,config}),createClient:options=>createEngineClient({...options,apiKey:env.N8N_API_KEY})}):null;if(captionPilot){engine.captionPilot=captionPilot;await captionPilot.inspect();}
 const backups=config.hosted?await new HostedBackups({workspace:config.workspace,destinationRoot:config.backups,stateFile:path.join(config.dataRoot,'backup-state.json')}).initialize():null;
 const server=createServer({source,drafts,previews,research,engine,captionPilot,feeds,access,backups,delivery});
 let closing=null;const close=()=>closing||=(async()=>{await delivery?.stop();await backups?.stop();await closeStudioServer(server);if(source.inflight)await source.inflight.catch(()=>{});drafts.close();previews.close();research.close();access?.close();})();
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,resolve);});}catch(error){drafts.close();previews.close();research.close();access?.close();throw error;}
 console.log('MILDINCIDENT '+(config.hosted?'private hosted':'local')+' Studio listening on port '+config.port+'. Production writes disabled.');
 delivery?.start();backups?.start();if(engine&&!delivery)engine.refresh().catch(error=>console.error('Research read unavailable: '+(error.code||'READ_FAILED')));
 source.refresh().catch(error=>console.error('Source refresh unavailable: '+(error.code||'READ_FAILED')+'; cached work preserved.'));
 if(installSignals)for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{close().then(()=>{process.exitCode=0;}).catch(()=>{process.exitCode=1;});});
 return {server,config,source,research,drafts,previews,engine,captionPilot,delivery,access,backups,close};
}
