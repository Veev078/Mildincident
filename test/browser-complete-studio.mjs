// Real retained records, isolated private stores, blocked external network.
// Six Jack files are genuine downsampled model-input photographs, not production originals.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const phase=process.argv.includes('--before')?'before':'after';
const curationOnly=process.argv.includes('--curation-only');
const artifacts=path.resolve(process.env.STUDIO_EVIDENCE_DIR||'.local/complete-studio');
const moduleRoot=phase==='before'?path.join(artifacts,'baseline'):path.resolve('.');
const load=p=>import(pathToFileURL(path.join(moduleRoot,p)));
const [{WorkspaceSource,PRODUCTION_CONTEXT_TABLES},{WORKSPACE_TABLES},{LocalDraftStore},{LocalResearchStore},{LocalPreviewStore},{PhotographyService},{createWorkspaceServer}]=await Promise.all([
 load('src/workspace/data-source.js'),load('src/workspace/model.js'),load('src/workspace/store.js'),load('src/workspace/research-store.js'),load('src/workspace/previews.js'),load('src/photography/service.js'),load('src/workspace/server.js')]);
await fs.mkdir(artifacts,{recursive:true,mode:0o700});
const root=await fs.mkdtemp(path.join(artifacts,phase+'-isolated-'));
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const preservedFiles=['.local/first-cycle/rows-stories.json','.local/first-cycle/rows-packages.json','.local/first-cycle/rows-media.json','.local/v17-1/reconciliation-2369/execution.json'];
const preservedHashes=new Map(await Promise.all(preservedFiles.map(async file=>[file,hash(await fs.readFile(file))])));
const snapshot=await read('.local/v12-b/live/workspace/snapshot.json');
Object.assign(snapshot.records,await read('.local/v17-1/current-records.json'));
for(const name of ['stories','packages','media','performance'])snapshot.records[name]=await read('.local/first-cycle/rows-'+name+'.json');
for(const [name,id]of Object.entries({...WORKSPACE_TABLES,...PRODUCTION_CONTEXT_TABLES})){
 try{if(!['stories','packages','media','performance'].includes(name))snapshot.records[name]=await read('.local/v19-buffer-live-20261117/recovery/rows-'+id+'.json');}catch{}
}
const execution=await read('.local/v17-1/reconciliation-2369/execution.json');
const packet=execution.data.resultData.runData['Validate Photo Assessment'][0].data.main[0][0].json.packet;
const source=new WorkspaceSource({root,loadLive:async()=>snapshot});source.snapshot=snapshot;
const drafts=new LocalDraftStore(path.join(root,'drafts.sqlite'));
const research=new LocalResearchStore(path.join(root,'research.sqlite'));
const previews=new LocalPreviewStore(path.join(root,'previews'));
const photography=new PhotographyService(research,{previews,readProjectPage:()=>assert.fail('No external source reads in retained replay'),fetchImage:()=>assert.fail('No new image acquisition in retained replay')});
const originalView=source.view.bind(source);
source.view=(...args)=>{
 const workspace=originalView(...args);
 for(const story of workspace.stories)if(story.id===packet.manifest.storyId){
  for(const i of packet.images)if(!story.media.some(m=>m.id===i.assetId))story.media.push({id:i.assetId,title:i.caption,sourceCaption:i.caption,sourceRelation:'subject_caption_match',sourceUrl:i.sourceUrl,previewUrl:i.imageUrl,rightsStatus:'unreviewed'});
 }
 return workspace;
};
const realInputs=[];
for(const i of packet.images){
 const bytes=Buffer.from(i.data,'base64');assert.equal(hash(bytes),i.inputSha256);
 const saved=await previews.save({storyId:packet.manifest.storyId,assetId:i.assetId,bytes,contentType:'image/jpeg',originalName:'retained-jack-model-input.jpg',declaration:'private_review_only'});
 previews.recordSourceInspection(packet.manifest.storyId,i.assetId,saved.sha256,{sourceUrl:i.sourceUrl,imageUrl:i.imageUrl,executionId:'2369'});
 previews.db.prepare('UPDATE local_source_preview_evidence SET acquisition_json=? WHERE story_id=? AND asset_id=? AND preview_sha256=?').run(JSON.stringify({basis:'retained_model_input_derivative',executionId:'2369',inputSha256:i.inputSha256,sourcePreviewSha256:i.sourcePreviewSha256,recordedOriginalSha256:i.originalSha256,productionOriginal:false,visualInspectionPerformed:false}),packet.manifest.storyId,i.assetId,saved.sha256);
 realInputs.push({assetId:i.assetId,inputSha256:i.inputSha256,width:saved.width,height:saved.height,productionOriginal:false});
}
const feedFixture=process.argv.includes('--feed-fixture');
const {FounderReviewStore}=await load('src/workspace/founder-review.js');const founderReviews=new FounderReviewStore(research);
if(feedFixture)for(const story of source.view().stories.filter(s=>['CON-2610285uk8-2','CON-261031DESK07','CON-261031DESK04'].includes(s.id)))founderReviews.record(story,{decision:'save',basis:'overall_selection',reason:'Isolated visual replay decision only.',expectedVersion:0,sourceRevision:story.revision,workingVersion:0});
let engine=null;
if(feedFixture){
 const {EditorialEngineService}=await load('src/workspace/editorial-engine-service.js');
 const {requestFingerprint}=await load('src/workspace/editorial-engine-client.js');
 for(const id of ['9373705e-5106-4779-897f-7283ce71a6e0','005a5a95-bbd5-444d-9849-d326b5033a31']){const request=research.create({kind:'discovery',prompt:'REPLAY ONLY: retain the historical input-budget failure',sourceUrl:'',idempotencyKey:id},[]);research.claimEngineQueue(id,requestFingerprint(request));research.recordEngineState(id,'failed',{executionId:'2365',lastError:'RESEARCH_INPUT_BUDGET_EXCEEDED',failure:{code:'RESEARCH_INPUT_BUDGET_EXCEEDED',stoppedBeforeModels:true},candidates:[]});}
 engine=new EditorialEngineService({research,client:null});
 research.saveDeliveryState({state:'unavailable',errorCode:'ENGINE_HTTP_404',lastSuccess:null});
}
const server=createWorkspaceServer({source,drafts,research,previews,photography,founderReviews,engine,webRoot:path.join(moduleRoot,'web')});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']});
const page=await browser.newPage();page.setDefaultTimeout(18000);
const errors=[],screenshots=[],checks=[],layoutIssues=[],blocked=new Set(),responses=[],imageRequests=[],imageResponses=[],imageMeasurements=[],networkPromises=[];
let stage='initial';
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(origin+'/api/'))responses.push({path:new URL(r.url()).pathname,status:r.status()});});
page.on('request',r=>{const url=new URL(r.url());if(!r.url().startsWith(origin+'/'))blocked.add(url.hostname);if(r.resourceType()==='image')imageRequests.push({stage,url:r.url(),local:r.url().startsWith(origin+'/')});});
page.on('response',r=>{if(r.request().resourceType()!=='image'||!r.url().startsWith(origin+'/'))return;const sampleStage=stage;networkPromises.push((async()=>{const bytes=await r.body().catch(()=>Buffer.alloc(0)),timing=r.request().timing();imageResponses.push({stage:sampleStage,path:new URL(r.url()).pathname,query:new URL(r.url()).search,bytes:bytes.length,status:r.status(),responseMs:Math.round(timing.responseEnd*100)/100});})());});
// CDP URL blocking preserves Chromium's ordinary HTTP cache; Playwright routing
// disables it and would misrepresent duplicate-thumbnail performance.
const network=await page.context().newCDPSession(page);await network.send('Network.enable');await network.send('Network.setBlockedURLs',{urls:['https://*']});
async function opened(route,width){
 stage=route+'@'+width;
 await page.setViewportSize({width,height:width===390?844:1000});
 await page.goto(origin+'/#/'+route);await page.locator('h1').waitFor();await page.waitForTimeout(500);
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 await page.evaluate(()=>window.scrollTo(0,0));
 const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 if(dimensions.document>dimensions.viewport+1)layoutIssues.push({route,width,...dimensions});
}
async function capture(name){
 await page.evaluate(feedFixture=>{let banner=document.getElementById('replay-evidence');if(!banner){banner=document.createElement('div');banner.id='replay-evidence';document.body.append(banner);}banner.textContent='LOCAL REPLAY · RETAINED RECORDS · JACK: REAL SMALL INPUTS · OTHER PRIVATE FILES UNAVAILABLE · NO LIVE ACTIONS';if(feedFixture)banner.textContent+=' · FAILURE/REVIEW STATES SIMULATED';banner.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fff0bd;color:#222;padding:5px;text-align:center;font:10px sans-serif';},feedFixture);
 const filename=path.join(artifacts,phase+'-'+name+'.png');await page.screenshot({path:filename});await fs.chmod(filename,0o600);screenshots.push(filename);
}
const stories=[['duo','CON-261026qkpn-2'],['jack','CON-2610285uk8-2'],['hase','CON-261031DESK07'],['miami','CON-261031DESK04'],['artemis','CON-261031xgyc-2']];
const currentStory=async()=>{const r=await fetch(origin+'/api/stories/'+packet.manifest.storyId);assert(r.ok);return r.json();};
async function savedWhen(predicate){let last;for(let n=0;n<100;n++){last=await currentStory();if(predicate(last))return last;await new Promise(resolve=>setTimeout(resolve,75));}assert.fail('Isolated edit did not persist');}
try{
 for(const width of curationOnly?[]:[1440,390]){
  for(const [name,id]of stories){await opened('story/'+id+'/build',width);await capture(name+'-build-'+width);checks.push(name+' Build renders at '+width);}
  for(const tab of ['refine','approve']){await opened('story/'+packet.manifest.storyId+'/'+tab,width);await capture('jack-'+tab+'-'+width);checks.push('Jack '+tab+' renders at '+width);}
  for(const tab of ['refine','approve']){await opened('story/CON-261026qkpn-2/'+tab,width);await capture('duo-'+tab+'-'+width);checks.push('Duo '+tab+' renders at '+width);}
  for(const route of ['discover','analytics']){await opened(route,width);if(feedFixture&&route==='discover')await page.getByRole('button',{name:'Saved / developing',exact:true}).click();await capture(route+'-'+width);checks.push(route+' renders at '+width);}
 }
 if(curationOnly){
  await opened('story/'+packet.manifest.storyId+'/build',390);
  await page.locator('[data-curation-open]').click();await page.locator('#curation-dialog').waitFor();
  assert.equal(await page.locator('[data-vision-action="confirm"]:enabled').count(),0);
  const size=await page.locator('#curation-dialog').evaluate(e=>({width:e.getBoundingClientRect().width,viewport:innerWidth}));
  assert(size.width<=size.viewport,'Mobile curation dialog must fit');
  await capture('jack-curation-390');checks.push('Optional source-based curation fits mobile; AI confirmation remains unavailable');
 }
 assert.deepEqual(errors,[],'Browser runtime errors');
 assert.equal(drafts.all().size,0,'Read-only captures must not create edits');
 if(!curationOnly&&(phase==='after'||process.argv.includes('--journey'))){
  const initial=await currentStory(),nativeCaption=initial.caption,nativeOrder=[...initial.selectedAssetIds];
  await opened('story/'+packet.manifest.storyId+'/build',1440);
  if(phase==='after')assert.equal(await page.locator('.photo-gallery-grid .photo-select').count(),6,'All six genuine saved photographs must remain reachable in Saved');
  const matchedCopies=initial.media.filter(a=>a.savedCopy||a.matchedSavedCopy||a.previewMatch).length;
  if(phase==='after'&&matchedCopies){
   const alias=initial.media.find(a=>nativeOrder.includes(a.id)&&a.savedCopy);
   assert(alias,'A matched selected source reference should remain available');
   await page.locator('.post-sequence-list [data-photo-saved-copy="'+alias.id+'"]').click();
   const adopted=await savedWhen(s=>s.localDraft?.selectedAssetIds.includes(alias.savedCopy.assetId));
   const expected=nativeOrder.map(id=>id===alias.id?alias.savedCopy.assetId:id).filter((id,index,ids)=>ids.indexOf(id)===index);
   assert.deepEqual(adopted.localDraft.selectedAssetIds,expected);assert.equal(adopted.localDraft.caption??adopted.caption,nativeCaption);
   checks.push('Explicit Use saved file replaces one exact source reference in place; original selection remains in history');
   await capture('jack-saved-file-adopted-1440');
  }
  stage='selection-only';const selectionStart=imageRequests.length;
  // Choose three actual privately retained frames deliberately in isolated storage.
  const beforeSelection=await currentStory();
  for(const assetId of beforeSelection.localDraft?.selectedAssetIds??nativeOrder){const button=page.locator('.post-frame-remove[data-asset="'+assetId+'"]');if(await button.count())await button.click();}
  await savedWhen(s=>(s.localDraft?.selectedAssetIds??s.selectedAssetIds).length===0);
  const visibleIds=await page.locator('.photo-select').evaluateAll(buttons=>buttons.map(b=>b.dataset.asset));
  const chosen=packet.images.map(i=>i.assetId).filter(id=>visibleIds.includes(id)).slice(0,3);
  assert.equal(chosen.length,3,'At least three real saved photographs must be selectable');
  for(const assetId of chosen){await page.locator('.photo-select[data-asset="'+assetId+'"]').click();await savedWhen(s=>s.localDraft?.selectedAssetIds.includes(assetId));}
  await page.waitForTimeout(150);
  const selectionRequests=imageRequests.slice(selectionStart).filter(r=>r.local),requestCounts=new Map();for(const request of selectionRequests)requestCounts.set(request.url,(requestCounts.get(request.url)||0)+1);
  imageMeasurements.push({scope:'three selections after gallery loaded; local genuine small model-input JPEGs only',requests:selectionRequests.length,uniqueUrls:requestCounts.size,duplicateRequestEvents:[...requestCounts].filter(([,count])=>count>1).map(([url,count])=>({path:new URL(url).pathname,query:new URL(url).search,count})),matchedCopies});
  await page.locator('[data-curation-open]').click();await page.locator('#curation-dialog').waitFor();
  assert.equal(await page.locator('[data-vision-action="confirm"]:enabled').count(),0,'Unapproved Vision cannot be confirmed');
  assert((await page.locator('#curation-dialog').innerText()).match(/not.*(?:enabled|judged)|off|approved|source context|source-based|source information/i),'Source-only/disabled AI basis must be explicit');
  await capture('jack-curation-1440');await page.locator('[data-curation-close]').click();
  checks.push('Curation visible; Vision unavailable without approval; no paid action');
  const caption=nativeCaption+'\n\nIsolated local acceptance edit; never sent.';
  await opened('story/'+packet.manifest.storyId+'/refine',1440);
  await page.locator('#caption-editor').fill(caption);
  await savedWhen(s=>s.localDraft?.caption===caption);
  await page.reload();await page.locator('#caption-editor').waitFor();assert.equal(await page.locator('#caption-editor').inputValue(),caption);
  checks.push('Caption and exact photo order survive browser refresh');
  await capture('jack-refine-edited-1440');
  if(phase==='after'){
   const guidance=page.getByRole('region',{name:'Creative guidance'});
   await guidance.scrollIntoViewIfNeeded();
   await page.locator('.refine-assistance').evaluate(e=>e.scrollIntoView({block:'start'}));
   await capture('jack-refine-guidance-1440');
   await page.setViewportSize({width:390,height:844});await page.locator('.refine-assistance').evaluate(e=>e.scrollIntoView({block:'start'}));await capture('jack-refine-guidance-390');
   const preservedIntent=await page.locator('[data-form="music-intent"]').evaluate(form=>({eraApproach:form.elements.eraApproach.value,avoidTags:form.elements.avoidTags.value,notes:form.elements.notes.value}));
   await page.getByLabel('Sound approach',{exact:true}).selectOption('silent');
   await page.getByLabel('Desired mood tags',{exact:true}).fill('reflective, cinematic');
   await page.getByRole('button',{name:'Save sound brief',exact:true}).click();
   const sound=await savedWhen(s=>s.localDraft?.creativeBrief?.musicIntent?.mode==='silent');
   assert.deepEqual(sound.localDraft.creativeBrief.musicIntent.moods,['reflective','cinematic']);
   assert.equal(sound.localDraft.caption,caption);assert.deepEqual(sound.localDraft.selectedAssetIds,chosen);
   const afterIntent=sound.localDraft.creativeBrief.musicIntent;
   assert.equal(afterIntent.eraApproach,preservedIntent.eraApproach);assert.equal(afterIntent.avoidTags.join(', '),preservedIntent.avoidTags);assert.equal(afterIntent.notes,preservedIntent.notes);
   await page.reload();await page.getByLabel('Sound approach',{exact:true}).waitFor();assert.equal(await page.getByLabel('Sound approach',{exact:true}).inputValue(),'silent');
   assert.equal(await page.getByLabel('Desired mood tags',{exact:true}).inputValue(),'reflective, cinematic');
   checks.push('Inline sound brief persists after refresh; caption, exact slides and existing advanced sound fields preserved');
   const hookButtons=page.locator('[data-action="choose-hook"]:enabled');
   if(await hookButtons.count()){
    const button=hookButtons.first(),index=Number(await button.getAttribute('data-index')),beforeHook=await currentStory(),angle=beforeHook.hookOptions[index].text;
    await button.click();const changed=await savedWhen(s=>s.localDraft?.hook===angle);
    assert.equal(changed.localDraft.caption,caption);assert.deepEqual(changed.localDraft.selectedAssetIds,chosen);
    assert.deepEqual(changed.localDraft.creativeBrief.musicIntent,afterIntent);
    checks.push('Actual retained source-supported story angle saves without rewriting caption or slides');
   }else checks.push('Retained Jack record has no complete captured-source alternative hook; no invented angle was displayed or applied');
   await page.locator('[data-refine-improve="discovery_opening"]').click();
   await page.locator('.caption-improvement').waitFor();
   assert.equal(await page.locator('[data-caption-request="confirm"]:enabled').count(),0,'Unavailable AI cannot be confirmed');
   assert.equal(await page.locator('[data-caption-operation="generate"]:enabled').count(),0,'No legacy paid drafting without authorization');
   assert.equal((await currentStory()).localDraft.caption,caption);
   checks.push('Improve the opening opens the existing separate review flow without starting AI');
  }
  await opened('story/'+packet.manifest.storyId+'/approve',1440);
  await page.locator('[data-post-preview]').waitFor();assert.equal(await page.locator('[data-post-preview] .photo-expand').count(),0);await page.locator('[data-post-preview]').press('ArrowRight');assert.match(await page.locator('[data-post-preview] .slide-counter').innerText(),/2.*3/);await capture('jack-inline-preview-'+1440);await page.setViewportSize({width:390,height:844});await capture('jack-inline-preview-390');await page.setViewportSize({width:1440,height:1000});if(!await page.locator('[data-action="rehearse-story"]').count())await page.getByRole('button',{name:'Post details',exact:true}).click();await page.locator('[data-action="rehearse-story"]').click();await page.locator('[data-rehearsal]').waitFor();
  assert.equal(await page.locator('[data-rehearsal] .rehearsal-stage img').evaluate(i=>i.complete&&i.naturalWidth>0),true,'Real photo renders in preview');
  await page.locator('#asset-dialog').getByRole('button',{name:'Next slide',exact:true}).click();
  assert.match(await page.locator('[data-rehearsal]').innerText(),/2\s*\/\s*3/);
  await page.locator('.rehearsal-caption').evaluate(e=>e.open=true);
  assert((await page.locator('.rehearsal-caption').innerText()).includes(caption));
  await capture('jack-carousel-1440');
  await page.setViewportSize({width:390,height:844});await capture('jack-carousel-390');
  await page.getByRole('button',{name:'Close post preview',exact:true}).click();
  assert.equal(await page.locator('[data-buffer-action="send"]:enabled').count(),0,'No live Buffer sending');
  const localPreparation=page.locator('[data-approval-prepare]:enabled');
  if(phase==='after'&&await localPreparation.count()){
   await localPreparation.click();
   const prepared=await savedWhen(s=>s.approvalRequest?.unchanged===true);
   assert.equal(prepared.localDraft.caption,caption);assert.deepEqual(prepared.localDraft.selectedAssetIds,chosen);
   assert.notEqual(prepared.rightsStatus,'cleared','Retained files do not establish rights');
   checks.push('Exact local approval handoff prepared; factual/rights approval and native publishing remain separate');
   await page.locator('.review-transfer').evaluate(e=>e.scrollIntoView({block:'center'}));await capture('jack-approval-prepared-390');
  }
  const final=await currentStory();assert.equal(final.caption,nativeCaption);assert.deepEqual(final.selectedAssetIds,nativeOrder);assert.deepEqual(final.localDraft.selectedAssetIds,chosen);
  const reopened=new LocalDraftStore(path.join(root,'drafts.sqlite'));
  try{const durable=reopened.all().get(packet.manifest.storyId);assert.equal(durable.caption,caption);assert.deepEqual(durable.selectedAssetIds,chosen);}finally{reopened.close();}
  checks.push('Three genuine small retained photographs preview in deliberate order; original caption/order preserved; SQLite reopen retains isolated edits; Buffer remains gated');
 }
 await Promise.all(networkPromises);
 for(const [file,beforeHash]of preservedHashes)assert.equal(hash(await fs.readFile(file)),beforeHash,'Retained source changed: '+file);
 const report={status:layoutIssues.length?'OBSERVED_ISSUES':'PASS',phase,checks,screenshots,errors,layoutIssues,realRetainedInputs:realInputs,retainedCanonicalStories:snapshot.records.stories.length,blockedExternalHosts:[...blocked],apiFailures:responses.filter(r=>r.status>=400),thumbnailPerformance:{imageMeasurements,imageResponses,cacheEnabled:true,scope:'loopback replay with six small real retained Jack model-input JPEGs; not a hosted latency benchmark'},newPhotographs:0,newAiCalls:0,liveMutations:0,limitations:['Jack inputs are genuine small photographic JPEGs from the prior six-image operation; full production originals are not present in this isolated replay.','Hase, Miami, Duo and Artemis use retained real metadata; Render private photo files are not present locally.','No hosted acceptance or new discovery is represented by these screenshots.']};
 await fs.writeFile(path.join(artifacts,phase+(curationOnly?'-mobile-curation':'')+'-browser-report.json'),JSON.stringify(report,null,2),{mode:0o600});
 assert.equal(layoutIssues.length,0,'No horizontal overflow');console.log(JSON.stringify({status:report.status,phase,screenshots:screenshots.length,realRetainedJackInputs:realInputs.length,errors,layoutIssues,apiFailures:report.apiFailures,newPhotographs:0,newAiCalls:0,liveMutations:0}));
}finally{await page.close();await browser.close();await new Promise(resolve=>server.close(resolve));previews.close();research.close();drafts.close();}
