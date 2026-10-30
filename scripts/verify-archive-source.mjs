import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {PHOTO_SOURCES,fetchPhotoPage} from '../src/photography/sources.js';import {LocalResearchStore} from '../src/workspace/research-store.js';import {PhotographyService} from '../src/photography/service.js';
// Exactly one free archive page. No n8n execution, Buffer access, model, retry or generic URL input.
const [source,query,...extra]=process.argv.slice(2);
if(extra.length||!['commons','loc','aic'].includes(source)||!query||query.trim().length<2||query.length>500){console.error('Use npm run research:live-check -- commons|loc|aic "a fresh research direction"');process.exitCode=1;}
else {
 let policy;try{policy=JSON.parse(await fs.readFile('/etc/codex/network-policy.json','utf8'));}catch{}
 const host=PHOTO_SOURCES[source].host,network=policy?.http_network_policy;
 if(policy?.version!==1||!network||network.type!=='unrestricted'&&!network.egress_rules?.some(rule=>rule.host===host)){
  console.log(JSON.stringify({status:'BLOCKED',reason:'Archive API access is absent from the available environment policy snapshot. Obtain environment-owner approval; do not route through another host.',requiredApiHost:host,sourceCalls:0,paidCalls:0,productionWrites:0}));process.exitCode=2;
 }else{
  const root=path.join('.local','archive-live-checks',randomUUID());await fs.mkdir(root,{recursive:true,mode:0o700});const research=new LocalResearchStore('.local/workspace/research.sqlite');const service=new PhotographyService(research);const hunt=service.create({query,mode:'scene',source});let report;
  try{const page=await fetchPhotoPage(source,query,1);service.put(page.photos,hunt.id);research.db.prepare('UPDATE photo_hunts SET page=2,state=? WHERE id=?').run(page.hasMore?'paused':'complete',hunt.id);
   report={status:'RETRIEVED_METADATA',observedAt:new Date().toISOString(),source,huntId:hunt.id,sourceCalls:1,providerRecords:page.providerRecords,references:page.photos.length,photos:page.photos,imageInspection:'not_performed',editorialQuality:'not_evaluated',rightsGranted:false,paidCalls:0,productionWrites:0};
  }catch(error){research.db.prepare("UPDATE photo_hunts SET state='unavailable' WHERE id=?").run(hunt.id);report={status:'UNAVAILABLE',source,huntId:hunt.id,sourceCalls:1,error:/^(ARCHIVE_[A-Z_]+(?:_\d+)?)$/.test(error.message)?error.message:'SOURCE_CONNECTION_FAILED',paidCalls:0,productionWrites:0};process.exitCode=1;}
  finally{research.close();}
  const filename=path.join(root,'report.json');await fs.writeFile(filename,JSON.stringify(report,null,2),{mode:0o600});const {photos,...summary}=report;console.log(JSON.stringify({...summary,privateReport:filename}));
 }
}
