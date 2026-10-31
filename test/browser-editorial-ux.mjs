// Browser/visual proof only: all writes use disposable SQLite stores; no live APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {x as extract} from 'tar';
import {chromium} from 'playwright';
import {createWorkspaceServer} from '../src/workspace/server.js';
import {WorkspaceSource} from '../src/workspace/data-source.js';
import {LocalDraftStore} from '../src/workspace/store.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-editorial-ux-'));
const artifacts=path.resolve(process.argv.find(a=>a.startsWith('--artifacts='))?.slice(12)||'.local/ux-transformation');
const baseline=process.argv.find(a=>a.startsWith('--baseline='))?.slice(11)||'f501fd5';
assert.match(baseline,/^[a-f0-9]{7,40}$/);
await fs.mkdir(artifacts,{recursive:true,mode:0o700});
const servers=[],stores=[],checks=[],errors=[];
let browser;
let captureBasis='existing_private_cached_snapshot';
async function boot(snapshot,webRoot){
 const directory=await fs.mkdtemp(path.join(root,'store-'));
 const source=new WorkspaceSource({root:directory,loadLive:async()=>snapshot});source.snapshot=snapshot;
 const drafts=new LocalDraftStore(path.join(directory,'drafts.sqlite')),research=new LocalResearchStore(path.join(directory,'research.sqlite'));
 stores.push(drafts,research);
 const server=createWorkspaceServer({source,drafts,research,...(webRoot?{webRoot}:{})});
 servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:'http://127.0.0.1:'+server.address().port,source,drafts,research};
}
async function capture(label,webRoot,snapshot){
 const app=await boot(snapshot,webRoot),page=await browser.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 // External photograph references remain uninspected. Never replace them with invented photography.
 await page.route('**/*',route=>route.request().url().startsWith(app.origin+'/')?route.continue():route.abort());
 const model=app.source.view(),id=model.stories[0]?.id;
 for(const [width,height]of [[1366,768],[1440,900]]){
  await page.setViewportSize({width,height});
  for(const [name,route]of [['today','home'],['discover','discovery'],['story','story/'+encodeURIComponent(id)+'/overview'],['production','publishing'],['stories','pipeline'],['library','library'],['caption','story/'+encodeURIComponent(id)+'/caption']]){
   if(name==='story'&&!id)continue;
   await page.goto(app.origin+'/#/'+route);await page.locator('h1').waitFor();await page.waitForTimeout(450);
   await page.screenshot({path:path.join(artifacts,label+'-'+name+'-'+width+'x'+height+'.png')});
  }
 }
 await page.close();return {source:captureBasis,stories:model.stories.length,externalPhotographsInspected:false,originalStoresModified:false};
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let cached;try{cached=JSON.parse(await fs.readFile('.local/workspace/snapshot.json','utf8'));}catch{captureBasis='generated_fixture_snapshot';cached=workspaceSnapshot();cached.records.stories[0].title='Synthetic UI fixture — no live editorial content';}
 const baselineDir=path.join(root,'baseline');await fs.mkdir(baselineDir);const archive=path.join(root,'baseline.tar');
 await fs.writeFile(archive,execFileSync('git',['archive',baseline,'web']));await extract({cwd:baselineDir,file:archive});
 const before=await capture('before',path.join(baselineDir,'web'),cached);
 if(process.argv.includes('--before-only')){console.log(JSON.stringify({before,captureOnly:true}));}
 else{
  const after=await capture('after',path.resolve('web'),cached);
  const snapshot=workspaceSnapshot();snapshot.records.stories[0].title='Synthetic UX workflow — fixture only';
  const app=await boot(snapshot),page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push(e.message));
  const calls=[];page.on('request',r=>{if(r.method()!=='GET')calls.push({method:r.method(),path:new URL(r.url()).pathname});});
  await page.route('**/*',r=>r.request().url().startsWith(app.origin+'/')?r.continue():r.abort());
  await page.goto(app.origin);await page.locator('h1').waitFor();
  const nav=page.getByRole('navigation',{name:'Main navigation',exact:true});
  assert.equal(await nav.locator('a').count(),5);for(const label of ['Today','Discover','Stories','Production','Library'])assert.equal(await nav.getByRole('link',{name:new RegExp(label)}).count(),1);
  checks.push('five founder-facing primary destinations render with real API data');
  for(const route of ['today','discover','stories','production','home','discovery','pipeline','publishing','library','archive','analytics']){
   await page.goto(app.origin+'/#/'+route);await page.locator('h1').waitFor();assert.ok((await page.locator('h1').innerText()).length);
  }
  const id='CON-EXISTING-01';for(const tab of ['overview','research','images','direction','carousel','caption','music','publishing']){
   await page.goto(app.origin+'/#/story/'+id+'/'+tab);await page.locator('h1').waitFor();assert.equal(await page.getByRole('navigation',{name:'Story stages',exact:true}).locator('a').count(),3);
  }
  checks.push('modern navigation aliases and every legacy story deep link remain usable');
  await page.goto(app.origin+'/#/story/'+id+'/caption');await page.getByLabel('Local caption draft').fill('Synthetic revision retained after reopening the creative workspace.');
  await page.waitForFunction(()=>document.querySelector('[data-save-status]')?.textContent.includes('Saved'));
  await page.goto(app.origin+'/#/stories');await page.goto(app.origin+'/#/story/'+id+'/caption');
  assert.equal(await page.getByLabel('Local caption draft').inputValue(),'Synthetic revision retained after reopening the creative workspace.');
  checks.push('caption edits save to isolated SQLite and survive leaving/reopening the story');
  await page.goto(app.origin+'/#/discover');
  await page.getByRole('button',{name:'Existing stories',exact:true}).click();
  await page.locator('[data-review-card="'+id+'"]').getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Saved / developing',exact:true}).click();
  await page.locator('[data-review-card="'+id+'"] .review-receipt').filter({hasText:'Saved'}).waitFor();
  await page.reload();await page.getByRole('button',{name:'Saved / developing',exact:true}).click();
  await page.locator('[data-review-card="'+id+'"] .review-receipt').filter({hasText:'Saved'}).waitFor();
  checks.push('one-click founder selection persists and is available in the saved review queue');
  const creative=page.getByLabel('Creative direction',{exact:true});
  if(!await creative.isVisible())await page.locator('.discovery-research summary').click();
  await creative.fill('Synthetic private direction; do not dispatch a model.');
  await page.getByRole('button',{name:'Save discovery direction',exact:true}).click();
  assert.equal(await creative.inputValue(),'Synthetic private direction; do not dispatch a model.');
  assert.equal(app.research.all().length,1);
  await page.getByRole('button',{name:'Save research direction',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-request-id]').length===2);
  assert.equal(app.research.all().length,2);assert.ok(!calls.some(c=>/queue|dispatch|activate/.test(c.path)));
  checks.push('saving directions preserves unsent input and never queues or dispatches paid research');
  const lead={id:'synthetic-source-lead',sourceKey:'synthetic',sourceName:'Synthetic publication fixture',title:'Synthetic photographic project — not real research',url:'https://example.org/project',summary:'A clearly labeled metadata-only source lead',previewUrl:'',aiGenerated:false,rightsGranted:false};
  app.research.db.prepare('INSERT INTO publication_leads VALUES(?,?,?)').run(lead.id,lead.sourceKey,JSON.stringify(lead));
  await page.reload();await page.getByText('Publication leads',{exact:true}).click();
  const requestCount=calls.length;await page.getByRole('button',{name:'Develop a research direction',exact:true}).click();
  assert.ok((await page.getByLabel('Creative direction',{exact:true}).inputValue()).includes(lead.title));assert.equal(await page.getByLabel('Source link (optional)',{exact:true}).inputValue(),lead.url);assert.equal(calls.length,requestCount);assert.equal(app.research.all().length,2);
  await page.getByRole('button',{name:'Save research direction',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-request-id]').length===3);
  assert.equal(app.research.all()[0].sourceUrl,lead.url);assert.ok(!calls.some(c=>/queue|dispatch|activate/.test(c.path)));
  checks.push('a publication source lead becomes an editable, persisted source-bound direction without automatic research');

  for(const [width,height]of [[1366,768],[1440,900],[390,844]]){
   await page.setViewportSize({width,height});
   for(const route of ['today','discover','stories','production','library','story/'+id+'/overview','story/'+id+'/images','story/'+id+'/caption']){
    await page.goto(app.origin+'/#/'+route);await page.locator('h1').waitFor();
    assert.ok(await page.locator('.sidebar-tools').isVisible());
    await page.locator('.connection-details').evaluate(el=>{el.open=true;});
    const overflow=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
    assert.ok(overflow.body<=overflow.viewport+1,route+' overflows '+width+'px: '+JSON.stringify(overflow));
   }
  }
  checks.push('Today, Discover, Stories, Production, Library and story stages have no page overflow at laptop and mobile widths');
  assert.deepEqual(errors,[]);checks.push('all visual and interactive workflows complete without browser JavaScript errors');
  const report={passed:true,before,after,checks,browserErrors:errors,fixtureWritesOnly:true,nativeWrites:0,paidCalls:0,hostingDeployed:false};
  await fs.writeFile(path.join(artifacts,'report.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));await page.close();
 }
}finally{
 await browser?.close();for(const server of servers)await new Promise(resolve=>server.close(resolve));for(const store of stores)store.close();await fs.rm(root,{recursive:true,force:true});
}
