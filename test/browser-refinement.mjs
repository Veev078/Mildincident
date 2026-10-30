// Isolated founder journeys. Synthetic images are explicitly labeled; no live sources or providers.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {execFileSync} from 'node:child_process';import {x as extract} from 'tar';
import {chromium} from 'playwright';
import {createWorkspaceServer} from '../src/workspace/server.js';
import {WorkspaceSource} from '../src/workspace/data-source.js';
import {LocalDraftStore} from '../src/workspace/store.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';
import {workspaceSnapshot} from './helpers/workspace-fixture.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-refinement-')),artifacts=path.resolve('.local/ux-refinement');
await fs.mkdir(artifacts,{recursive:true,mode:0o700});
const servers=[],stores=[],checks=[],errors=[];let browser;
const id='CON-EXISTING-01';
async function boot(webRoot){
 const directory=await fs.mkdtemp(path.join(root,'store-')),snapshot=workspaceSnapshot();snapshot.records.stories[0].title='Synthetic refinement workflow — fixture only';
 const source=new WorkspaceSource({root:directory,loadLive:async()=>snapshot});source.snapshot=snapshot;
 const drafts=new LocalDraftStore(path.join(directory,'drafts.sqlite')),research=new LocalResearchStore(path.join(directory,'research.sqlite')),previews=new LocalPreviewStore(path.join(directory,'previews'));stores.push(drafts,research,previews);
 const server=createWorkspaceServer({source,drafts,research,previews,...(webRoot?{webRoot}:{})});servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:'http://127.0.0.1:'+server.address().port,source,snapshot,drafts,research,previews};
}
async function setupPage(app,context){
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://example.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#dbe6fa"/><text x="60" y="550" font-size="46" fill="#15325f">SYNTHETIC UI FIXTURE</text><text x="60" y="620" font-size="32" fill="#15325f">No archival photograph</text></svg>'}));
 await page.route('**/*',route=>route.request().url().startsWith('https://example.org/')?route.fallback():route.request().url().startsWith(app.origin+'/')?route.continue():route.abort());
 return page;
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const baseline=path.join(root,'baseline');await fs.mkdir(baseline);const archive=path.join(root,'baseline.tar');await fs.writeFile(archive,execFileSync('git',['archive','4323379','web']));await extract({cwd:baseline,file:archive});
 const before=await boot(path.join(baseline,'web')),beforeContext=await browser.newContext(),beforePage=await setupPage(before,beforeContext);
 for(const [width,height]of [[1366,768],[1440,900]]){await beforePage.setViewportSize({width,height});await beforePage.goto(before.origin+'/#/story/'+id+'/images');await beforePage.locator('[data-action=inspect]').first().click();await beforePage.getByLabel('Editorial decision',{exact:true}).waitFor();await beforePage.screenshot({path:path.join(artifacts,`before-inspector-${width}x${height}.png`)});await beforePage.getByRole('button',{name:'Close image details',exact:true}).click();}
 await beforeContext.close();
 const app=await boot(),context=await browser.newContext({viewport:{width:1366,height:768},permissions:['clipboard-read','clipboard-write']}),page=await setupPage(app,context);
 const writes=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(new URL(r.url()).pathname);});
 await page.goto(app.origin+'/#/story/'+id+'/images');await page.locator('[data-action=inspect]').first().click();
 assert.ok(await page.getByRole('button',{name:'Previous photograph',exact:true}).isDisabled());assert.ok(await page.getByRole('button',{name:'Next photograph',exact:true}).isEnabled());
 const note='Keep this frame-specific note while comparing adjacent photographs.';
 await page.getByLabel('Feedback type',{exact:true}).selectOption('composition');await page.getByLabel('Why this image?',{exact:true}).fill(note);
 await page.getByRole('button',{name:'Next photograph',exact:true}).click();assert.equal(await page.locator('[data-inspector]').getAttribute('data-asset'),'asset-2');
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-inspector]').getAttribute('data-asset'),'asset-3');assert.ok(await page.getByRole('button',{name:'Next photograph',exact:true}).isDisabled());
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');assert.equal(await page.getByLabel('Why this image?',{exact:true}).inputValue(),note);assert.equal(await page.getByLabel('Feedback type',{exact:true}).inputValue(),'composition');
 await page.getByLabel('Why this image?',{exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-inspector]').getAttribute('data-asset'),'asset-1');
 assert.equal(app.previews.review(id,'asset-1'),null);assert.equal(writes.length,0);checks.push('gallery boundaries and keyboard navigation preserve unsaved frame-specific feedback without writing a decision');
 await page.getByRole('button',{name:'Close image details',exact:true}).click();await page.locator('[data-action=inspect]').first().click();assert.equal(await page.getByLabel('Why this image?',{exact:true}).inputValue(),note);checks.push('closing and reopening inspection keeps the unsaved note and exact frame context');
 await page.getByRole('button',{name:'Close image details',exact:true}).click();
 app.snapshot.records.packages[0].caption_draft='A separately updated synthetic source caption.';app.snapshot.observedAt=new Date().toISOString();
 await page.locator('.connection-details > summary').click();await page.getByRole('button',{name:'Check for updates ↻',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Read-only source refresh completed'));
 await page.locator('[data-action=inspect]').first().click();assert.equal(await page.getByLabel('Why this image?',{exact:true}).inputValue(),note);assert.ok(await page.getByRole('button',{name:'Save editorial review',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Use note with this version',exact:true}).click();await page.getByRole('button',{name:'Save editorial review',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-image-review]')?.dataset.version==='1');
 const review=app.previews.review(id,'asset-1');assert.equal(review.reason,note);assert.equal(review.context.decisionBasis,'composition');assert.equal(review.rightsGranted,false);assert.equal(review.history.length,1);assert.equal(app.previews.review(id,'asset-2'),null);checks.push('changed source material pauses stale feedback until explicit acknowledgement, then saves the exact current frame only');
 const acknowledgedNote='A confirmed review stays saved even when the following workspace read fails.';
 const reviewPosts=[];page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/assets/asset-1/review'))reviewPosts.push(request.postDataJSON());});
 let failWorkspaceRead=true;await page.route(app.origin+'/api/workspace',route=>failWorkspaceRead?(failWorkspaceRead=false,route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'SYNTHETIC_READ_FAILURE',message:'Synthetic workspace read failed after acknowledged save.'}})})):route.continue());
 await page.getByLabel('Why this image?',{exact:true}).fill(acknowledgedNote);await page.getByRole('button',{name:'Save editorial review',exact:true}).click();
 await page.getByText('Image feedback saved. The latest workspace could not be refreshed; your confirmed review is retained.',{exact:true}).waitFor();
 assert.equal(app.previews.review(id,'asset-1').version,2);assert.equal(app.previews.review(id,'asset-1').history.length,2);assert.equal(reviewPosts.length,1);assert.equal(reviewPosts[0].expectedVersion,1);assert.equal(await page.locator('[data-image-review]').getAttribute('data-version'),'2');
 await page.getByRole('button',{name:'Close image details',exact:true}).click();await page.locator('[data-action=inspect]').first().click();assert.equal(await page.getByLabel('Why this image?',{exact:true}).inputValue(),acknowledgedNote);assert.equal(await page.locator('[data-image-review]').getAttribute('data-version'),'2');assert.equal(reviewPosts.length,1);
 await page.unroute(app.origin+'/api/workspace');await page.reload();await page.locator('[data-action=inspect]').first().click();assert.equal(await page.getByLabel('Why this image?',{exact:true}).inputValue(),acknowledgedNote);
 await page.getByLabel('Why this image?',{exact:true}).fill('A deliberate later reconsideration uses the newly acknowledged review version.');await page.getByRole('button',{name:'Save editorial review',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-image-review]')?.dataset.version==='3');assert.equal(reviewPosts.length,2);assert.equal(reviewPosts[1].expectedVersion,2);assert.equal(app.previews.review(id,'asset-1').history.length,3);
 checks.push('an acknowledged image save survives a failed workspace read without duplicate submission or stale-version retry');

 for(const [width,height]of [[1366,768],[1440,900],[390,844]]){await page.setViewportSize({width,height});const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,dialog:document.querySelector('dialog').scrollWidth,client:document.querySelector('dialog').clientWidth}));assert.ok(overflow.page<=overflow.viewport+1,JSON.stringify(overflow));assert.ok(overflow.dialog<=overflow.client+1,JSON.stringify(overflow));await page.screenshot({path:path.join(artifacts,`after-inspector-${width}x${height}.png`)});}checks.push('large image inspection and its review controls fit laptop and mobile widths without horizontal overflow');
 await page.getByRole('button',{name:'Close image details',exact:true}).click();await page.setViewportSize({width:1440,height:900});await page.goto(app.origin+'/#/story/'+id+'/caption');
 const caption='Synthetic caption with its own line breaks.\n\nA second line, retained exactly.';await page.getByLabel('Local caption draft',{exact:true}).fill(caption);await page.getByRole('button',{name:'Copy caption',exact:true}).click();await page.getByText('Caption copied. This does not approve or publish it.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),caption);
 assert.equal(await page.locator('.caption-contact-sheet .photo').count(),2);await page.waitForFunction(()=>document.querySelector('[data-save-status]')?.textContent.includes('Saved'));await page.screenshot({path:path.join(artifacts,'after-caption-fixture-1440x900.png')});await page.reload();assert.equal(await page.getByLabel('Local caption draft',{exact:true}).inputValue(),caption);checks.push('the caption workbench copies current multiline text exactly and saves/reopens beside its real selected references');
 await page.getByLabel('Local caption draft',{exact:true}).fill('');await page.getByRole('button',{name:'Copy caption',exact:true}).click();await page.getByText('Write a caption first, then copy it.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),caption);
 await page.getByLabel('Local caption draft',{exact:true}).fill(caption);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Synthetic clipboard denial');}}}));await page.getByRole('button',{name:'Copy caption',exact:true}).click();await page.getByText(/Automatic copy is unavailable/).first().waitFor();assert.deepEqual(await page.getByLabel('Caption ready to copy',{exact:true}).evaluate(el=>({start:el.selectionStart,end:el.selectionEnd})),{start:0,end:caption.length});checks.push('empty and denied clipboard states are honest and leave the caption available for manual copy');
 await page.getByRole('button',{name:'Close caption copy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-save-status]')?.textContent.includes('Saved'));
 await page.goto(app.origin+'/#/today');await page.getByRole('link',{name:'Continue the caption',exact:true}).waitFor();await page.screenshot({path:path.join(artifacts,'after-resume-fixture-1440x900.png')});await page.getByRole('link',{name:'Continue the caption',exact:true}).click();assert.equal(new URL(page.url()).hash,'#/story/'+id+'/caption');assert.equal(await page.getByLabel('Local caption draft',{exact:true}).inputValue(),caption);checks.push('Today resumes the actual writing stage visited this session without losing the saved caption');
 await page.goto(app.origin+'/#/discover');await page.getByRole('button',{name:'Existing stories',exact:true}).click();const card=page.locator('[data-review-card="'+id+'"]');await card.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'View saved',exact:true}).click();await page.locator('[data-review-filter=saved][aria-pressed=true]').waitFor();await page.locator('[data-review-card="'+id+'"] .review-receipt').filter({hasText:'Saved'}).waitFor();
 await page.locator('[data-review-card="'+id+'"]').getByRole('button',{name:'Pass',exact:true}).click();await page.getByRole('button',{name:'View passed',exact:true}).click();await page.locator('[data-review-filter=passed][aria-pressed=true]').waitFor();await page.locator('[data-review-card="'+id+'"] .review-receipt').filter({hasText:'Passed'}).waitFor();checks.push('saved and passed decisions have direct routes to their persistent review destinations');
 assert.ok(!writes.some(url=>/queue|dispatch|activate|buffer/i.test(url)));assert.deepEqual(errors,[]);
 const report={passed:true,fixtureOnly:true,syntheticImageFixtures:true,checks,browserErrors:errors,productionWrites:0,nativeWrites:0,paidCalls:0,hostingDeployed:false};await fs.writeFile(path.join(artifacts,'refinement-report.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));
}catch(error){await browser?.contexts().at(-1)?.pages().at(-1)?.screenshot({path:path.join(artifacts,'refinement-failure.png'),fullPage:true});throw error;}
finally{await browser?.close();for(const server of servers)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});for(const store of stores)store.close();await fs.rm(root,{recursive:true,force:true});}
