// Read-only visual comparison against a copied real snapshot and copied research store.
// Never loads external images or uses the founder's writable private databases.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {x as extract} from 'tar';
import {chromium} from 'playwright';
import {createWorkspaceServer} from '../src/workspace/server.js';import {WorkspaceSource} from '../src/workspace/data-source.js';
import {LocalDraftStore} from '../src/workspace/store.js';import {LocalResearchStore} from '../src/workspace/research-store.js';
const input=path.resolve('.local/v11-live/workspace'),artifacts=path.resolve('.local/v11/real-data');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-v11-real-'));await fs.mkdir(artifacts,{recursive:true,mode:0o700});
const files=['snapshot.json','research.sqlite'];
const digest=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const beforeDigests=Object.fromEntries(await Promise.all(files.map(async file=>[file,await digest(path.join(input,file))])));
const errors=[],servers=[],stores=[];let browser;
async function boot(webRoot){
 const directory=await fs.mkdtemp(path.join(root,'copy-'));
 for(const file of files)await fs.copyFile(path.join(input,file),path.join(directory,file));
 const snapshot=JSON.parse(await fs.readFile(path.join(directory,'snapshot.json'),'utf8'));
 const source=new WorkspaceSource({root:directory,loadLive:async()=>snapshot});source.snapshot=snapshot;
 const drafts=new LocalDraftStore(path.join(directory,'drafts.sqlite')),research=new LocalResearchStore(path.join(directory,'research.sqlite'));stores.push(drafts,research);
 const engine={status:()=>({configured:true,readOnly:true,generationAvailable:false}),refresh:async()=>{}};
 const server=createWorkspaceServer({source,drafts,research,engine,...(webRoot?{webRoot}:{})});servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:'http://127.0.0.1:'+server.address().port};
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const baseline=path.join(root,'baseline');await fs.mkdir(baseline);const archive=path.join(root,'baseline.tar');await fs.writeFile(archive,execFileSync('git',['archive','6e1d3d86299a4120c11467f1fd8bc8320bb5f83d','web']));await extract({cwd:baseline,file:archive});
 const modes=process.argv.includes('--before-only')?[['before',path.join(baseline,'web')]]:process.argv.includes('--after-only')?[['after',null]]:[['before',path.join(baseline,'web')],['after',null]],reports=[];
 for(const [label,webRoot]of modes){
  const app=await boot(webRoot),page=await browser.newPage();page.setDefaultTimeout(15000);let externalRequestsBlocked=0,writeRequests=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()!=='GET')writeRequests++;});
  await page.route('**/*',route=>{if(route.request().url().startsWith(app.origin+'/'))route.continue();else{externalRequestsBlocked++;route.abort();}});
  await page.goto(app.origin);await page.locator('h1').waitFor();
  const model=await page.evaluate(()=>fetch('/api/workspace').then(r=>r.json()));
  assert.equal(model.stories.length,20);assert.equal(model.stories.filter(s=>s.recoveredHistory).length,2);
  const story=model.stories.find(s=>s.origin!=='n8n_development'&&s.selectedAssetIds?.length>0&&s.caption)||model.stories[0];
  for(const [width,height]of [[1366,768],[1440,900]]){
   await page.setViewportSize({width,height});
   for(const [name,route]of [['discover','discover'],['today','today'],['story','story/'+encodeURIComponent(story.id)+'/overview'],['production','production']]){
    await page.goto(app.origin+'/#/'+route);await page.locator('h1').waitFor();await page.waitForTimeout(200);
    await page.screenshot({path:path.join(artifacts,`${label}-${name}-${width}x${height}.png`)});
   }
  }
  assert.equal(writeRequests,0);reports.push({label,stories:model.stories.length,nativeStories:model.stories.filter(s=>s.origin!=='n8n_development').length,recoveredHistory:model.stories.filter(s=>s.recoveredHistory).length,storyId:story.id,externalRequestsBlocked,writeRequests,realPixelsInspected:false});await page.close();
 }
 const afterDigests=Object.fromEntries(await Promise.all(files.map(async file=>[file,await digest(path.join(input,file))])));
 assert.deepEqual(afterDigests,beforeDigests);assert.deepEqual(errors,[]);
 const report={passed:true,source:'existing read-only real snapshots copied to disposable stores',reports,browserErrors:errors,originalStoreDigestsUnchanged:true,sourceDigests:afterDigests,externalPhotoRequestsBlocked:true,noReplacementImages:true,productionWrites:0,paidCalls:0};
 await fs.writeFile(path.join(artifacts,process.argv.includes('--before-only')?'before-report.json':process.argv.includes('--after-only')?'after-report.json':'report.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();for(const server of servers)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});for(const store of stores)store.close();await fs.rm(root,{recursive:true,force:true});}
