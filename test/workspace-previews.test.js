import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { LocalPreviewStore, attachLocalPreviews, imageFeedbackProvenance } from '../src/workspace/previews.js';
import { buildWorkspace } from '../src/workspace/model.js';
import { workspaceSnapshot } from './helpers/workspace-fixture.js';
import { createWorkspaceServer } from '../src/workspace/server.js';
import { LocalDraftStore } from '../src/workspace/store.js';
import { WorkspaceSource } from '../src/workspace/data-source.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mi-preview-'));
  const store = new LocalPreviewStore(root);
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  const bytes = await sharp({ create: { width: 1800, height: 2400, channels: 3, background: '#747e6b' } }).withMetadata().jpeg().toBuffer();
  return { root, store, bytes, input: { storyId: 'CON-EXISTING-01', assetId: 'asset-1', bytes,
    contentType: 'image/jpeg', originalName: '../../private-original.jpg', declaration: 'private_review_only' } };
}

test('private uploaded preview decodes, strips metadata, retains originals and never grants rights/source identity', async t => {
  const { root, store, input, bytes } = await fixture(t);
  const preview = await store.save(input);
  assert.equal(preview.originalName, 'private-original.jpg');
  assert.equal(preview.rightsGranted, false);
  assert.equal(preview.identityVerified, false);
  assert.equal(preview.localOnly, true);
  assert.equal(preview.originalWidth, 1800);
  const output = await store.readPreview(input.storyId, input.assetId, preview.sha256);
  const meta = await sharp(output.bytes).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(meta.width <= 1600 && meta.height <= 2000);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.icc, undefined);
  assert.deepEqual(await fs.readFile(path.join(root, 'blobs', `${preview.originalSha256}.original`)), bytes);
  assert.equal((await fs.stat(path.join(root, 'blobs', `${preview.originalSha256}.original`))).mode & 0o777, 0o600);
  assert.deepEqual(await store.save(input), preview);
  const reopened = new LocalPreviewStore(root);
  try { assert.deepEqual(reopened.get(input.storyId, input.assetId), preview); } finally { reopened.close(); }
});

test('preview upload rejects missing declaration, fake JPGs, MIME mismatches, SVG and bad filename controls', async t => {
  const { store, input } = await fixture(t);
  await assert.rejects(store.save({ ...input, declaration: '' }), { code: 'PREVIEW_DECLARATION_REQUIRED' });
  await assert.rejects(store.save({ ...input, bytes: Buffer.from('not an image') }), { code: 'INVALID_PREVIEW_FILE' });
  await assert.rejects(store.save({ ...input, contentType: 'image/png' }), { code: 'INVALID_PREVIEW_TYPE' });
  await assert.rejects(store.save({ ...input, contentType: 'image/svg+xml', bytes: Buffer.from('<svg/>') }), { code: 'INVALID_PREVIEW_TYPE' });
  await assert.rejects(store.save({ ...input, originalName: 'bad\nname.jpg' }), { code: 'INVALID_PREVIEW_NAME' });
  assert.equal(store.all().size, 0);
});

test('preview overlay keeps existing source revision, source URL and rights state untouched', async t => {
  const { store, input } = await fixture(t);
  await store.save(input);
  const source = buildWorkspace(workspaceSnapshot());
  const revision = source.stories[0].revision;
  const originalUrl = source.stories[0].media[0].previewUrl;
  attachLocalPreviews(source, store);
  const asset = source.stories[0].media[0];
  assert.equal(source.stories[0].revision, revision);
  assert.equal(asset.sourcePreviewUrl, originalUrl);
  assert.equal(asset.rightsStatus, 'preview_unreviewed');
  assert.equal(asset.previewOrigin, 'local_upload');
  assert.match(asset.previewUrl, /^\/api\/stories\//);
  attachLocalPreviews(source, store);
  assert.equal(asset.sourcePreviewUrl, originalUrl);
  await assert.rejects(store.readPreview('CON-OTHER', input.assetId, asset.localPreview.sha256), { code: 'PREVIEW_NOT_FOUND' });
});

test('tampered cached preview bytes are detected rather than silently served/replaced', async t => {
  const { root, store, input } = await fixture(t);
  const preview = await store.save(input);
  await fs.appendFile(path.join(root, 'blobs', `${preview.sha256}.jpg`), 'tampered');
  await assert.rejects(store.readPreview(input.storyId, input.assetId, preview.sha256), { code: 'LOCAL_PREVIEW_CORRUPTED' });
  await assert.rejects(store.save(input), { code: 'LOCAL_PREVIEW_CORRUPTED' });
});

test('HTTP preview upload requires existing scoped asset, intent and declaration; derivative stays private and proposals remain unapproved', async t => {
  const { root, store, input } = await fixture(t);
  const drafts = new LocalDraftStore(path.join(root, 'drafts.sqlite'));
  const source = new WorkspaceSource({ root, loadLive: async () => workspaceSnapshot() });
  source.snapshot = workspaceSnapshot();
  const recordedPhoto={creator:'Reported fixture photographer',creatorBasis:'explicit_source_photo_credit',copyrightHolder:'Fixture copyright holder',sourceCaption:'A recorded frame in the original fixture series',sourceYears:[1974],sourceResearchLinks:[{kind:'series',url:'https://example.org/recorded-series',label:'Recorded fixture series',verified:true},{kind:'photographer',url:'https://example.org/reported-photographer',label:'Reported fixture photographer',verified:true}]};
  const originalView=source.view.bind(source);source.view=(...args)=>{const model=originalView(...args);Object.assign(model.stories[0].media[0],recordedPhoto);return model;};
  const server = createWorkspaceServer({ source, drafts, previews: store });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); drafts.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const url = `${origin}/api/stories/${input.storyId}/assets/${input.assetId}/preview`;
  const headers = { 'Content-Type': 'image/jpeg', 'X-Mildincident-Intent': 'local-edit', 'X-Mildincident-Filename': encodeURIComponent('synthetic-test.jpg') };
  assert.equal((await fetch(url, { method: 'POST', headers, body: input.bytes })).status, 400);
  headers['X-Mildincident-Preview-Declaration'] = 'private_review_only';
  assert.equal((await fetch(url.replace('/asset-1/', '/unknown/'), { method: 'POST', headers, body: input.bytes })).status, 404);
  const before = await (await fetch(`${origin}/api/workspace`)).json();
  const response = await fetch(url, { method: 'POST', headers, body: input.bytes });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.productionApplied, false);
  const after = await (await fetch(`${origin}/api/workspace`)).json();
  assert.equal(before.stories[0].revision, after.stories[0].revision);
  const image = await fetch(`${origin}${after.stories[0].media[0].previewUrl}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/jpeg/);
  assert.match(image.headers.get('cache-control'), /private/);
  assert.equal(image.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal((await fetch(url + '?hash=../../private')).status, 400);
  assert.equal((await fetch(`${origin}/.local/previews.sqlite`)).status, 404);
  const reviewUrl=url.replace(/preview$/,'review');
  const reviewHeaders={'Content-Type':'application/json','X-Mildincident-Intent':'local-edit'};
  const reviewBody=JSON.stringify({decision:'reject',reason:'Does not serve the planned opening narrative',expectedVersion:0});
  assert.equal((await fetch(reviewUrl.replace('/asset-1/','/foreign/'),{method:'POST',headers:reviewHeaders,body:reviewBody})).status,404);
  assert.equal((await fetch(reviewUrl,{method:'POST',headers:reviewHeaders,body:reviewBody})).status,200);
  assert.equal((await fetch(reviewUrl,{method:'POST',headers:reviewHeaders,body:reviewBody})).status,409);
  const reviewed=await(await fetch(`${origin}/api/workspace`)).json();
  assert.equal(reviewed.stories[0].media[0].localReview.decision,'reject');
  assert.equal(reviewed.stories[0].revision,before.stories[0].revision);
  const scoped={decision:'hold',reason:'Reassess this exact preview before choosing the opening image',expectedVersion:1,sourceRevision:reviewed.stories[0].revision,workingVersion:0,previewSha256:reviewed.stories[0].media[0].localPreview.sha256};
  for(const change of [{sourceRevision:'old'},{workingVersion:99},{previewSha256:'b'.repeat(64)}])assert.equal((await fetch(reviewUrl,{method:'POST',headers:reviewHeaders,body:JSON.stringify({...scoped,...change})})).status,409);
  assert.equal(store.review(input.storyId,input.assetId).version,1);
  assert.equal((await fetch(reviewUrl,{method:'POST',headers:reviewHeaders,body:JSON.stringify({...scoped,photographicResearch:{rightsGranted:true}})})).status,400);
  const scopedResult=await(await fetch(reviewUrl,{method:'POST',headers:reviewHeaders,body:JSON.stringify(scoped)})).json();assert.equal(scopedResult.review.context.previewSha256,scoped.previewSha256);assert.equal(store.tasteFeedback()[0].sourceRevision,scoped.sourceRevision);
  assert.equal(scopedResult.review.context.photographicResearch.photographerReported,'Reported fixture photographer');assert.equal(scopedResult.review.context.photographicResearch.trails[0].verified,false);assert.equal(scopedResult.review.context.photographicResearch.rightsGranted,false);
  recordedPhoto.creator='Changed source metadata';recordedPhoto.sourceResearchLinks[0].url='https://example.org/later-series';
  assert.equal((await(await fetch(`${origin}/api/workspace`)).json()).stories[0].media[0].creator,'Changed source metadata');
  assert.equal(store.tasteFeedback()[0].photograph.research.photographerReported,'Reported fixture photographer');assert.equal(store.tasteFeedback()[0].photograph.research.trails[0].url,'https://example.org/recorded-series');
});

test('photographic feedback keeps bounded reported credits and safe series trails without upgrading bylines or copyright into photographers',()=>{
 const asset={creator:'Reported publication writer',creatorBasis:'article_byline',copyrightHolder:'Recorded rights holder',sourceCaption:'s'.repeat(1000),sourceCredit:'c'.repeat(800),sourceYears:[1974,1974,0,99999,1981],sourceResearchLinks:[{kind:'series',url:'https://example.org/series#frame-1',label:'Original series',verified:true},{kind:'series',url:'https://example.org/series#frame-2',label:'Repeated page'},{kind:'photographer',url:'http://example.org/unsafe',label:'Insecure'},{kind:'photographer',url:'https://example.org/private?token=secret',label:'Private URL'},{kind:'source',url:'https://example.org/unrelated',label:'Unsupported link'},{kind:'photographer',url:'https://example.org/artist',label:'Reported artist'}]};
 const before=JSON.stringify(asset),research=imageFeedbackProvenance(asset);
 assert.equal(research.photographerReported,'');assert.equal(research.creatorReported,asset.creator);assert.equal(research.copyrightHolderReported,asset.copyrightHolder);assert.equal(research.captionReported.length,300);assert.equal(research.creditReported.length,180);assert.deepEqual(research.yearsReported,[1974,1981]);assert.equal(research.trails.length,2);assert.ok(research.trails.every(l=>l.verified===false));assert.equal(research.sourceAssertionsVerified,false);assert.equal(research.visualAnalysisPerformed,false);assert.equal(research.rightsGranted,false);assert.equal(JSON.stringify(asset),before);
 assert.equal(imageFeedbackProvenance({...asset,creatorBasis:'copyright_holder_only'}).photographerReported,'');assert.equal(imageFeedbackProvenance({...asset,creatorBasis:'explicit_source_photo_credit'}).photographerReported,asset.creator);assert.equal(imageFeedbackProvenance({}),null);
 const many=imageFeedbackProvenance({sourceResearchLinks:Array.from({length:20},(_,i)=>({kind:'series',url:'https://example.org/project/'+i+'?q='+'q'.repeat(400),label:'l'.repeat(500)}))});assert.ok(many.trails.length<=3);assert.ok(JSON.stringify(many.trails).length<1250);
});

test('editorial image reviews persist with append-only history, conflict checks and no source rights mutation',async t=>{
 const {root,store,input}=await fixture(t);const source=buildWorkspace(workspaceSnapshot());const before=source.stories[0].revision;
 let review=store.saveReview(input.storyId,input.assetId,{decision:'reject',reason:'Weak opening photograph for this particular narrative',expectedVersion:0});
 assert.equal(review.localOnly,true);assert.equal(review.rightsGranted,false);assert.equal(review.version,1);
 assert.throws(()=>store.saveReview(input.storyId,input.assetId,{decision:'shortlist',reason:'A conflicting simultaneous review',expectedVersion:0}),{code:'EDIT_CONFLICT'});
 review=store.saveReview(input.storyId,input.assetId,{decision:'shortlist',reason:'Reconsidered after reviewing the complete source sequence',expectedVersion:1});
 assert.equal(review.history.length,2);assert.equal(review.history[1].decision,'reject');
 const other=new LocalPreviewStore(root);try{assert.equal(other.review(input.storyId,input.assetId).decision,'shortlist');}finally{other.close();}
 attachLocalPreviews(source,store);assert.equal(source.stories[0].revision,before);assert.equal(source.stories[0].media[0].rightsStatus,'preview_unreviewed');assert.equal(source.stories[0].media[0].localReview.decision,'shortlist');
 assert.equal(source.stories[0].selectedAssetIds.includes(input.assetId),true);
 for(const bad of [{decision:'cleared',reason:'Attempting to grant rights',expectedVersion:2},{decision:'reject',reason:'short',expectedVersion:2},{decision:'reject',reason:'A valid reason with an unsupported field',expectedVersion:2,rightsGranted:true}])assert.throws(()=>store.saveReview(input.storyId,input.assetId,bad),{code:'INVALID_IMAGE_REVIEW'});
});

test('private source copies retain recorded inspection provenance without granting identity or rights',async t=>{
 const {store,input}=await fixture(t);const preview=await store.save(input);assert.equal(preview.sourceInspection,null);
 const record=store.recordSourceInspection(input.storyId,input.assetId,preview.sha256,{sourceUrl:'https://archive.example.org/page',imageUrl:'https://archive.example.org/image.jpg',executionId:'2500'});
 assert.equal(record.sourceInspection.basis,'recorded_source_copy');assert.equal(record.identityVerified,false);assert.equal(record.rightsGranted,false);
 const workspace=buildWorkspace(workspaceSnapshot());attachLocalPreviews(workspace,store);assert.equal(workspace.stories[0].media[0].previewOrigin,'source_cache');
 assert.throws(()=>store.recordSourceInspection(input.storyId,input.assetId,preview.sha256,{sourceUrl:'http://archive.example.org/page',imageUrl:'https://archive.example.org/a.jpg',executionId:'2500'}),{code:'INVALID_PREVIEW_SOURCE'});
});

test('image taste feedback carries recorded source/preview scope and never reassigns earlier decisions to replacement pixels',async t=>{
 const {store,input}=await fixture(t);const preview=await store.save(input),context={subject:'Synthetic photographic project',sourceRevision:'recorded-source',workingVersion:3,sourceUrl:'https://example.org/project',previewSha256:preview.sha256};
 store.saveReview(input.storyId,input.assetId,{decision:'reject',reason:'The chosen crop weakens this particular photographic frame',expectedVersion:0},{context});
 let feedback=store.tasteFeedback()[0];assert.equal(feedback.origin,'image_dialog');assert.equal(feedback.scope,'specific_photograph_selection');assert.equal(feedback.photograph.previewSha256,preview.sha256);assert.equal(feedback.sourceRevision,'recorded-source');assert.equal(feedback.workingVersion,3);assert.equal(feedback.decision,'rejected');
 const replacement=await sharp({create:{width:900,height:1200,channels:3,background:'#b34a78'}}).jpeg().toBuffer();await store.save({...input,bytes:replacement});feedback=store.tasteFeedback()[0];assert.equal(feedback.photograph.previewSha256,preview.sha256);assert.notEqual(store.get(input.storyId,input.assetId).sha256,preview.sha256);assert.equal(store.review(input.storyId,input.assetId).context.previewSha256,preview.sha256);
 const {editorialSelectionTools}=await import('../src/editorial-selection.js');assert.ok(!editorialSelectionTools().assess({subject:context.subject},{feedback:[feedback]}).reasons.some(r=>r.code==='FOUNDER_TASTE_PASS'));
});
test('legacy image feedback preserves unknown preview versions and latest reconsideration without a fabricated source revision',async t=>{
 const {store,input}=await fixture(t);store.saveReview(input.storyId,input.assetId,{decision:'reject',reason:'A weak frame for this particular story',expectedVersion:0});let feedback=store.tasteFeedback()[0];assert.equal(feedback.photograph.previewVersionRecorded,false);assert.equal(feedback.photograph.previewSha256,null);assert.equal(feedback.sourceRevision,null);
 store.saveReview(input.storyId,input.assetId,{decision:'shortlist',reason:'Reconsidered for a different sequence context',expectedVersion:1});feedback=store.tasteFeedback()[0];assert.equal(feedback.decision,'approved');assert.equal(feedback.reviewVersion,2);assert.equal(store.review(input.storyId,input.assetId).history.length,2);
});
test('image retrieval, factual and permission problems remain reported issues while aesthetic reconsideration changes future context',async t=>{
 const {store,input}=await fixture(t),context={subject:'Synthetic photographed scene',sourceRevision:'source-1',workingVersion:0,previewSha256:'a'.repeat(64)};
 const {EditorialEngineService}=await import('../src/workspace/editorial-engine-service.js');
 const {requestFingerprint}=await import('../src/workspace/editorial-engine-client.js');
 const engine=new EditorialEngineService({research:{founderTasteFeedback:()=>[]},imageFeedback:()=>store.tasteFeedback()});
 let version=0;
 for(const basis of ['retrieval_issue','source_issue','factual_issue','rights_issue','interface_issue']){
  store.saveReview(input.storyId,input.assetId,{decision:'hold',basis,reason:'A reported problem to investigate, not an aesthetic finding',expectedVersion:version++},{context});
  const feedback=engine.editorialContext().feedback[0];assert.equal(feedback.basis,'reported_'+basis);assert.equal(feedback.decisionBasis,basis);assert.equal(feedback.photograph.previewSha256,context.previewSha256);assert.equal(feedback.scope,'specific_photograph_selection');
 }
 const before=requestFingerprint({kind:'discovery',prompt:'New source-led research',editorialContext:engine.editorialContext()});
 const review=store.saveReview(input.storyId,input.assetId,{decision:'shortlist',basis:'composition',reason:'The framing supports this particular story after reconsideration',expectedVersion:version},{context});
 const feedback=engine.editorialContext().feedback[0];assert.equal(feedback.basis,'editorial_taste');assert.equal(feedback.decisionBasis,'composition');assert.equal(feedback.decision,'approved');assert.equal(review.history.length,6);assert.equal(review.history[0].basis,'composition');assert.equal(review.history[1].basis,'interface_issue');assert.equal(review.rightsGranted,false);
 assert.notEqual(requestFingerprint({kind:'discovery',prompt:'New source-led research',editorialContext:engine.editorialContext()}),before);
 assert.throws(()=>store.saveReview(input.storyId,input.assetId,{decision:'shortlist',basis:'rights_cleared',reason:'A prohibited permission assertion',expectedVersion:6}),{code:'INVALID_IMAGE_REVIEW'});
});
