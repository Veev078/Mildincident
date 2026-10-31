// The unified V11 story journey uses disposable fixture stores; no live sources/providers.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {execFileSync} from 'node:child_process';import {x as extract} from 'tar';import {chromium} from 'playwright';
import {createWorkspaceServer} from '../src/workspace/server.js';import {WorkspaceSource} from '../src/workspace/data-source.js';
import {LocalDraftStore} from '../src/workspace/store.js';import {LocalResearchStore} from '../src/workspace/research-store.js';import {LocalPreviewStore} from '../src/workspace/previews.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-v11-develop-')),artifacts=path.resolve('.local/v11');await fs.mkdir(artifacts,{recursive:true,mode:0o700});
const servers=[],stores=[],checks=[],errors=[],writes=[];const id='CON-EXISTING-01';let browser,page;
const snapshot=workspaceSnapshot();snapshot.records.stories[0].title='SYNTHETIC STORY WORKSPACE — fixture only';snapshot.records.stories[0].hook='A recorded fixture premise, not new editorial research.';snapshot.observedAt=new Date().toISOString();
const originalSnapshot=JSON.stringify(snapshot);
async function boot({directory,webRoot}={}){
 directory||=await fs.mkdtemp(path.join(root,'store-'));
 const source=new WorkspaceSource({root:directory,loadLive:async()=>snapshot});source.snapshot=snapshot;
 const drafts=new LocalDraftStore(path.join(directory,'drafts.sqlite')),research=new LocalResearchStore(path.join(directory,'research.sqlite')),previews=new LocalPreviewStore(path.join(directory,'previews'));stores.push(drafts,research,previews);
 const server=createWorkspaceServer({source,drafts,research,previews,...(webRoot?{webRoot}:{})});servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {directory,origin:'http://127.0.0.1:'+server.address().port,drafts,research,previews,source,close:async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});servers.splice(servers.indexOf(server),1);for(const store of [drafts,research,previews]){store.close();stores.splice(stores.indexOf(store),1);}}};
}
async function openPage(app){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',error=>errors.push(error.message));p.on('dialog',dialog=>dialog.accept());p.on('request',request=>{if(request.method()!=='GET')writes.push({method:request.method(),path:new URL(request.url()).pathname});});
 await p.route('https://example.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#e1e7ef"/><rect x="55" y="55" width="970" height="1240" fill="none" stroke="#869ab4" stroke-width="5"/><text x="80" y="610" font-family="sans-serif" font-size="62" fill="#30445f">SYNTHETIC UI FIXTURE</text><text x="80" y="700" font-family="sans-serif" font-size="40" fill="#30445f">No archival photograph</text></svg>'}));
 await p.route('**/*',route=>route.request().url().startsWith(app.origin+'/')?route.continue():route.request().url().startsWith('https://example.org/')?route.fallback():route.abort());return p;
}
async function go(p,app,tab='overview'){await p.goto(app.origin+'/#/story/'+id+'/'+tab);await p.locator('h1').waitFor();}
async function saved(p){await p.waitForFunction(()=>document.querySelector('[data-save-status]')?.textContent.includes('Saved'));}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const baselineRoot=path.join(root,'baseline');await fs.mkdir(baselineRoot);const archive=path.join(root,'baseline.tar');await fs.writeFile(archive,execFileSync('git',['archive','6e1d3d86299a4120c11467f1fd8bc8320bb5f83d','web']));await extract({cwd:baselineRoot,file:archive});
 const before=await boot({webRoot:path.join(baselineRoot,'web')}),beforePage=await openPage(before);await go(beforePage,before);
 const beforeStages=await beforePage.getByRole('navigation',{name:'Story stages',exact:true}).locator('a').count();
 const beforeVisibleEditingFields=await beforePage.locator('#caption-editor:visible,#founder-direction:visible').count();
 for(const [width,height]of [[1366,768],[1440,900]]){await beforePage.setViewportSize({width,height});await beforePage.screenshot({path:path.join(artifacts,`before-develop-fixture-${width}x${height}.png`)});}await beforePage.context().close();
 let app=await boot();page=await openPage(app);await go(page,app);
 await page.locator('.develop-workspace').waitFor();assert.equal(await page.getByRole('navigation',{name:'Story stages',exact:true}).locator('a').count(),3);
 assert.ok(await page.getByLabel('Your direction',{exact:true}).isVisible());assert.ok(await page.getByLabel('Local caption draft',{exact:true}).isVisible());assert.equal(await page.locator('.develop-sequence > li').count(),2);
 const workingFields=await page.locator('#caption-editor:visible,#founder-direction:visible').count();
 let caption='Synthetic unified-workspace caption.\n\nLine breaks retained with the image sequence.';
 const direction='Focus more on the unusual location than the movie itself. This is a saved fixture instruction.';
 await page.getByLabel('Your direction',{exact:true}).fill(direction);await page.getByLabel('Local caption draft',{exact:true}).fill(caption);await saved(page);
 assert.equal(app.drafts.get(id).caption,caption);assert.equal(app.drafts.get(id).creativeBrief.notes,direction);assert.deepEqual(app.drafts.get(id).selectedAssetIds??JSON.parse(snapshot.records.packages[0].slide_sequence_asset_ids),['asset-1','asset-2']);
 assert.equal(new URL(page.url()).hash,'#/story/'+id+'/overview');checks.push('photographs, natural-language direction and caption are editable together without route changes; autosave retains both fields and the sequence');
 await page.reload();await page.locator('.develop-workspace').waitFor();assert.equal(await page.getByLabel('Your direction',{exact:true}).inputValue(),direction);assert.equal(await page.getByLabel('Local caption draft',{exact:true}).inputValue(),caption);
 await page.locator('[data-action="make-opening"]').first().click();await saved(page);assert.deepEqual(app.drafts.get(id).selectedAssetIds,['asset-2','asset-1']);assert.equal(app.drafts.get(id).caption,caption);assert.equal(app.drafts.get(id).creativeBrief.notes,direction);
 await page.locator('.develop-sequence [data-action="move-slide"][data-direction="1"]').first().click();await saved(page);assert.deepEqual(app.drafts.get(id).selectedAssetIds,['asset-1','asset-2']);
 await page.getByRole('button',{name:'Rehearse carousel',exact:true}).click();await page.locator('[data-rehearsal]').waitFor();await page.getByRole('button',{name:'Next carousel image',exact:true}).click();assert.ok((await page.locator('[data-rehearsal]').innerText()).includes('Slide 2 of 2'));await page.getByRole('button',{name:'Close carousel rehearsal',exact:true}).click();
 checks.push('opening-image choice, keyboard-accessible sequence movement and carousel rehearsal preserve the writing and direction');
 for(const [width,height]of [[1366,768],[1440,900],[390,844]]){await page.setViewportSize({width,height});const widthCheck=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(widthCheck.page<=widthCheck.viewport+1,JSON.stringify(widthCheck));await page.screenshot({path:path.join(artifacts,`after-develop-fixture-${width}x${height}.png`)});}
 await page.setViewportSize({width:1440,height:900});await go(page,app,'direction');await page.getByLabel('Your direction',{exact:true}).waitFor();assert.equal(await page.getByLabel('Your direction',{exact:true}).inputValue(),direction);
 assert.equal(await page.locator('input[name="direction-hook"]:visible').count(),0);assert.equal(await page.locator('[data-brief-rating]:visible').count(),0);
 let revisedDirection=direction+' Retain source uncertainties.';await page.getByLabel('Your direction',{exact:true}).fill(revisedDirection);await page.getByRole('button',{name:'Save direction & continue',exact:true}).click();await page.waitForURL('**/#/story/'+id+'/overview');assert.equal(app.drafts.get(id).creativeBrief.notes,revisedDirection);assert.equal(await page.getByLabel('Local caption draft',{exact:true}).inputValue(),caption);
 checks.push('legacy Angle becomes one optional direction field; Continue acknowledges its save and returns to the same creative workspace');
 // Hold an acknowledged older save while a newer direction waits behind it.
 let releaseFirst,observeFirst,observeFailure;const firstObserved=new Promise(resolve=>{observeFirst=resolve;}),failedObserved=new Promise(resolve=>{observeFailure=resolve;}),firstGate=new Promise(resolve=>{releaseFirst=resolve;});let patchCount=0;
 const draftRoute=app.origin+'/api/stories/'+id+'/draft';
 await page.route(draftRoute,async route=>{patchCount++;if(patchCount===1){observeFirst();await firstGate;await route.continue();}else if(patchCount===2){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'SYNTHETIC_SAVE_FAILURE',message:'Synthetic latest-direction save failed.'}})});observeFailure();}else await route.continue();});
 caption+='\n\nA caption change acknowledged before the later direction.';await page.getByLabel('Local caption draft',{exact:true}).fill(caption);await firstObserved;
 await page.getByText('More story tools',{exact:true}).click();await page.getByRole('navigation',{name:'Story workspace',exact:true}).getByRole('link',{name:'Direction',exact:true}).click();await page.getByLabel('Your direction',{exact:true}).waitFor();
 revisedDirection+=' The newest direction must be acknowledged before continuing.';await page.getByLabel('Your direction',{exact:true}).fill(revisedDirection);await page.getByRole('button',{name:'Save direction & continue',exact:true}).click();releaseFirst();await failedObserved;
 await page.getByText(/Synthetic latest-direction save failed/).waitFor();assert.equal(new URL(page.url()).hash,'#/story/'+id+'/direction');assert.equal(await page.getByLabel('Your direction',{exact:true}).inputValue(),revisedDirection);assert.ok(!(await page.locator('#toast').innerText()).includes('Direction saved privately'));assert.equal(app.drafts.get(id).caption,caption);assert.notEqual(app.drafts.get(id).creativeBrief.notes,revisedDirection);
 await page.unroute(draftRoute);await page.getByRole('button',{name:'Save direction & continue',exact:true}).click();await page.waitForURL('**/#/story/'+id+'/overview');assert.equal(app.drafts.get(id).creativeBrief.notes,revisedDirection);assert.equal(app.drafts.get(id).caption,caption);
 checks.push('Continue waits for the latest pending direction after an in-flight caption save; a failed second save retains text and route until an acknowledged retry');

 for(const tab of ['overview','research','images','direction','caption','carousel','music','publishing']){await go(page,app,tab);assert.equal(await page.getByRole('navigation',{name:'Story stages',exact:true}).locator('a').count(),3);}
 checks.push('all eight legacy story URLs remain usable with three primary activity choices');
 await go(page,app,'publishing');for(const requirement of ['facts','rights','approval'])assert.ok(await page.locator('[data-requirement="'+requirement+'"]').isVisible());
 assert.equal(await page.getByRole('button',{name:/^Publish$|^Schedule$|^Send to Buffer$/}).count(),0);
 await page.screenshot({path:path.join(artifacts,'after-review-fixture-1440x900.png')});
 checks.push('readiness retains independent image-permission and publication safeguards without exposing a publish or send action');
 const savedVersion=app.drafts.get(id).version,storeDirectory=app.directory;await page.context().close();await app.close();app=await boot({directory:storeDirectory});page=await openPage(app);await go(page,app);
 assert.equal(await page.getByLabel('Local caption draft',{exact:true}).inputValue(),caption);assert.equal(await page.getByLabel('Your direction',{exact:true}).inputValue(),revisedDirection);assert.deepEqual(app.drafts.get(id).selectedAssetIds,['asset-1','asset-2']);assert.equal(app.drafts.get(id).version,savedVersion);assert.ok(app.drafts.history(id).length>=2);
 checks.push('cold server/browser restart preserves direction, exact multiline caption, ordered images, versions and append-only history');
 assert.equal(JSON.stringify(snapshot),originalSnapshot);assert.ok(!writes.some(w=>/\/engine\/(queue|start)|activate|buffer|publish|handoff/.test(w.path)),JSON.stringify(writes));assert.deepEqual(errors,[]);
 const report={passed:true,fixtureOnly:true,checks,browserErrors:errors,friction:{beforePrimaryStoryStages:beforeStages,afterPrimaryStoryStages:3,beforeVisibleCaptionAndDirectionEditors:beforeVisibleEditingFields,afterVisibleCaptionAndDirectionEditors:workingFields,routeChangesForDirectionCaptionAndSequence:0,mandatoryTasteRatings:0},nativeWrites:0,productionWrites:0,paidCalls:0,realPhotographsInspected:false};await fs.writeFile(path.join(artifacts,'develop-report.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}catch(error){await page?.screenshot({path:path.join(artifacts,'develop-failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();for(const server of servers)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});for(const store of stores)store.close();await fs.rm(root,{recursive:true,force:true});}
