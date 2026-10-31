// V11 founder journeys use disposable stores and visibly synthetic image fixtures.
// No live n8n, source, paid-generation, Buffer, or hosting operation is permitted here.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {x as extract} from 'tar';
import {chromium} from 'playwright';
import {createWorkspaceServer} from '../src/workspace/server.js';
import {WorkspaceSource} from '../src/workspace/data-source.js';
import {LocalDraftStore} from '../src/workspace/store.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';
import {DEFAULT_DISCOVERY_PROMPT} from '../web/discovery-request.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-v11-'));
const artifacts=path.resolve('.local/v11');
await fs.mkdir(artifacts,{recursive:true,mode:0o700});
const servers=[],stores=[],checks=[],errors=[],writes=[];
let browser,page;
async function boot(webRoot){
 const directory=await fs.mkdtemp(path.join(root,'store-')),snapshot=workspaceSnapshot();
 snapshot.records.stories[0].title='SYNTHETIC EXISTING STORY — UI fixture only';
 snapshot.observedAt=new Date().toISOString();
 const source=new WorkspaceSource({root:directory,loadLive:async()=>snapshot});source.snapshot=snapshot;
 const drafts=new LocalDraftStore(path.join(directory,'drafts.sqlite')),research=new LocalResearchStore(path.join(directory,'research.sqlite')),previews=new LocalPreviewStore(path.join(directory,'previews'));
 stores.push(drafts,research,previews);
 const engine={status:()=>({configured:true,readOnly:true,generationAvailable:false}),refresh:async()=>{}};
 const server=createWorkspaceServer({source,drafts,research,previews,engine,...(webRoot?{webRoot}:{})});servers.push(server);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:'http://127.0.0.1:'+server.address().port,source,snapshot,drafts,research,previews};
}
function seedRequest(app,{prompt=DEFAULT_DISCOVERY_PROMPT,kind='discovery',state,data={}}={}){
 const request=app.research.create({kind,prompt,idempotencyKey:randomUUID()},app.source.view().stories);
 if(state){app.research.claimEngineQueue(request.id,'fixture-'+request.id);app.research.recordEngineState(request.id,state,data);}
 return request;
}
function seedProposal(app,{history=false}={}){
 const request=seedRequest(app,{kind:'brief',prompt:'Synthetic proposal delivery fixture; no research was performed.'});
 const candidate={id:'DEV-'+request.id+'-1',jobId:request.id,status:'ready_to_review',title:history?'SYNTHETIC RECOVERED RESULT — fixture only':'SYNTHETIC NEW PROPOSAL — fixture only',subject:'Synthetic culture fixture',hook:'A labeled editorial premise for workflow verification; no real research.',format:'carousel',targetSlideCount:2,captionDraft:'Synthetic fixture caption. No live factual or photographic verification.',carouselOutline:'Fixture sequence',claims:[{claim:'Labeled fixture claim, never a researched fact',claimType:'hypothesis',sourceName:'Synthetic source',url:'https://example.org/source'}],media:[1,2,3].map(i=>({id:'fixture-frame-'+i,title:'SYNTHETIC UI FIXTURE '+i,creator:'Synthetic fixture generator',sourceUrl:'https://example.org/source',previewUrl:'https://example.org/fixture-'+i+'.svg',provider:'synthetic_fixture'})),proposedAssetIds:['fixture-frame-1','fixture-frame-2'],gaps:['Synthetic fixture only; human source and rights review still required'],provenance:{kind:'brief',executionId:'synthetic-fixture',generatedAt:new Date().toISOString()}};
 app.research.claimEngineQueue(request.id,'fixture-'+request.id);app.research.recordEngineState(request.id,'ready_to_review',{candidates:[candidate],recoveredHistory:history});
 return {request,candidate,id:'CON-DEV-'+request.id};
}
async function openPage(app){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),p=await context.newPage();p.setDefaultTimeout(15000);
 p.on('pageerror',error=>errors.push(error.message));p.on('dialog',dialog=>dialog.accept());
 p.on('request',request=>{if(request.method()!=='GET')writes.push({method:request.method(),path:new URL(request.url()).pathname});});
 await p.route('https://example.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#dce3ee"/><rect x="70" y="70" width="940" height="1210" fill="none" stroke="#8b9db6" stroke-width="5"/><text x="100" y="570" font-family="sans-serif" font-size="61" fill="#25364e">SYNTHETIC UI FIXTURE</text><text x="100" y="650" font-family="sans-serif" font-size="38" fill="#25364e">No archival photograph</text></svg>'}));
 await p.route('**/*',route=>route.request().url().startsWith(app.origin+'/')?route.continue():route.request().url().startsWith('https://example.org/')?route.fallback():route.abort());
 return p;
}
async function screenshot(p,name){await p.screenshot({path:path.join(artifacts,name+'.png'),fullPage:false});}
async function noOverflow(p,label){const size=await p.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(size.width<=size.viewport+1,label+': '+JSON.stringify(size));}
async function discover(p,app){await p.goto(app.origin+'/#/discover');await p.getByRole('heading',{name:'Discover',exact:true}).waitFor();}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const baselineRoot=path.join(root,'baseline');await fs.mkdir(baselineRoot);const archive=path.join(root,'baseline.tar');
 await fs.writeFile(archive,execFileSync('git',['archive','6e1d3d86299a4120c11467f1fd8bc8320bb5f83d','web']));await extract({cwd:baselineRoot,file:archive});
 const before=await boot(path.join(baselineRoot,'web'));for(let i=0;i<6;i++)seedRequest(before);
 const beforePage=await openPage(before);await discover(beforePage,before);
 const baselineVisibleRequests=await beforePage.locator('[data-request-id]:visible').count();
 for(const [width,height]of [[1366,768],[1440,900]]){await beforePage.setViewportSize({width,height});await screenshot(beforePage,`before-discover-${width}x${height}`);}
 await beforePage.locator('.research-request-list').screenshot({path:path.join(artifacts,'before-research-activity.png')});
 await beforePage.context().close();
 const app=await boot();for(let i=0;i<6;i++)seedRequest(app);
 page=await openPage(app);await discover(page,app);
 await page.getByText('No new ideas yet.',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-review-card]').count(),0);
 assert.equal(await page.locator('[data-request-id]:visible').count(),0);
 assert.equal(await page.locator('.research-activity-row').count(),1);
 assert.equal(app.research.all().length,6);
 assert.ok((await page.locator('.research-activity-row > summary').innerText()).includes('6 equivalent historical records retained'));
 assert.ok((await page.locator('.research-activity-row > summary').innerText()).includes('Saved · not started'));
 checks.push('empty Discover shows no invented proposal; six equivalent historical directions become one compact row without deleting any record');
 const collapsedHeight=await page.locator('.research-activity').evaluate(el=>Math.ceil(el.getBoundingClientRect().height));
 await page.locator('.research-activity').screenshot({path:path.join(artifacts,'after-research-activity.png')});
 for(const [width,height]of [[1366,768],[1440,900],[390,844]]){await page.setViewportSize({width,height});await noOverflow(page,'empty Discover '+width);await screenshot(page,`after-discover-empty-${width}x${height}`);}
 await page.setViewportSize({width:1440,height:900});
 const baselineCount=app.research.all().length;
 await page.getByLabel('Creative direction',{exact:true}).fill('Preserve this unsaved specific direction while saving the default.');
 await page.getByRole('button',{name:'Save discovery direction',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Direction saved'));
 const firstDefaultCount=app.research.all().length;
 assert.equal(firstDefaultCount,baselineCount+1);
 await page.getByRole('button',{name:'Save discovery direction',exact:true}).click();
 await page.waitForTimeout(300);
 assert.equal(app.research.all().length,firstDefaultCount);
 assert.equal(await page.getByLabel('Creative direction',{exact:true}).inputValue(),'Preserve this unsaved specific direction while saving the default.');
 await page.getByLabel('Creative direction',{exact:true}).fill('');
 checks.push('repeated default saves reuse the same unstarted request; unsaved specific input is retained and no research runs');
 const queued=seedRequest(app,{kind:'brief',prompt:'SYNTHETIC queued fixture direction',state:'queued'});
 const running=seedRequest(app,{kind:'brief',prompt:'SYNTHETIC running fixture direction',state:'generating'});
 const received=seedRequest(app,{kind:'brief',prompt:'SYNTHETIC result received direction',state:'generating',data:{resultPending:true}});
 const failed=seedRequest(app,{kind:'brief',prompt:'SYNTHETIC failed fixture direction',state:'failed',data:{lastError:'SYNTHETIC_FAILURE'}});
 const fresh=seedProposal(app),historical=seedProposal(app,{history:true});
 await page.reload();await page.locator('[data-review-card="'+fresh.id+'"]').waitFor();
 assert.equal(await page.locator('[data-review-card="'+historical.id+'"]').count(),0);
 const activity=page.locator('.research-activity');
 for(const label of ['Queued','Running','Result received','Needs attention','Ready for review','Recovered historical work'])assert.ok((await activity.innerText()).includes(label),label);
 assert.equal(await page.locator('[data-engine-action="queue"]').count(),0);assert.equal(await page.locator('[data-engine-action="start"]').count(),0);
 await page.locator('[data-review-card="'+fresh.id+'"] img').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.proposal-image img')].every(img=>img.complete&&img.naturalWidth>0));
 for(const [width,height]of [[1366,768],[1440,900],[390,844]]){await page.setViewportSize({width,height});await noOverflow(page,'proposal Discover '+width);await screenshot(page,`after-discover-proposal-${width}x${height}`);}
 checks.push('existing result cards lead Discover; fresh and recovered fixture results stay separate and all six observed activity outcomes are distinct');
 await page.setViewportSize({width:1440,height:900});
 let card=page.locator('[data-review-card="'+fresh.id+'"]');await card.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'View saved',exact:true}).click();await page.locator('[data-review-filter="saved"][aria-pressed="true"]').waitFor();
 card=page.locator('[data-review-card="'+fresh.id+'"]');await card.locator('.review-receipt').filter({hasText:'Saved'}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Saved / developing',exact:true}).click();await page.locator('[data-review-card="'+fresh.id+'"] .review-receipt').filter({hasText:'Saved'}).waitFor();
 card=page.locator('[data-review-card="'+fresh.id+'"]');await card.getByRole('button',{name:'Pass',exact:true}).click();await page.getByRole('button',{name:'View passed',exact:true}).click();
 card=page.locator('[data-review-card="'+fresh.id+'"]');await card.locator('.review-receipt').filter({hasText:'Passed'}).waitFor();await card.getByRole('button',{name:'Explore',exact:true}).click();
 await page.getByRole('button',{name:'Explore further',exact:true}).click();card=page.locator('[data-review-card="'+fresh.id+'"]');await card.locator('.review-receipt').filter({hasText:'Explore further'}).waitFor();
 assert.ok(app.research.all().some(r=>r.prompt.includes('Deepen evidence and develop a grounded editorial angle')));
 await card.getByRole('button',{name:'Develop',exact:true}).click();await page.waitForURL('**/#/story/'+fresh.id+'/*');
 await page.locator('h1').waitFor();
 checks.push('Save and Pass have durable revisit destinations, Explore saves a real follow-up direction, and Develop opens the existing story workspace');
 await discover(page,app);await page.getByRole('button',{name:'Recovered history',exact:true}).click();await page.locator('[data-review-card="'+historical.id+'"] .eyebrow').filter({hasText:'Recovered research'}).waitFor();
 checks.push('recovered work remains inspectable under its own history view');
 assert.ok(!writes.some(w=>/\/engine\/(queue|start)|activate|buffer|publish|handoff/.test(w.path)),JSON.stringify(writes));assert.deepEqual(errors,[]);
 const report={passed:true,fixtureOnly:true,baseline:'6e1d3d86299a4120c11467f1fd8bc8320bb5f83d',checks,browserErrors:errors,friction:{baselineVisibleRepeatedRequestCards:baselineVisibleRequests,afterVisibleRepeatedRequestCards:0,historicalRecordsRetained:6,groupedHistoricalRows:1,collapsedActivityHeight:collapsedHeight,requiredNoteFieldsForFounderDecision:0},nativeWrites:0,productionWrites:0,paidCalls:0,realPhotographsInspected:false};
 await fs.writeFile(path.join(artifacts,'discover-report.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}catch(error){await page?.screenshot({path:path.join(artifacts,'discover-failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();for(const server of servers)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});for(const store of stores)store.close();await fs.rm(root,{recursive:true,force:true});}
