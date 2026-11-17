import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildEditorialPackage,editorialVisualEvidence} from '../src/editorial-package.js';
import {buildSourceSequencePlan,sourceSequenceDraft} from '../src/editorial-sequence.js';

// Contract fixtures only. These strings are not real visual observations and
// do not establish that a live model completed any photographic review.
const sha=value=>createHash('sha256').update(value).digest('hex');
const asset=(id,caption)=>({id,sourceCaption:caption,sourceRelation:'subject_caption_match',sourceUrl:'https://example.org/test-project',previewUrl:`https://example.org/${id}.jpg`,creator:'Reported Maker',sourceCredit:'Source-reported credit',creatorVerified:false,materialType:'photograph_reference',rightsStatus:'unreviewed',localPreview:{sha256:sha(id),originalSha256:sha('original-'+id),originalWidth:1200,originalHeight:900}});
const story=()=>({id:'CON-package',revision:'source-r1',subject:'Test Maker, Test Project',caption:'Original authoritative caption.',selectedAssetIds:['old','wide'],localDraft:{version:3,caption:'Founder exact current writing.',selectedAssetIds:['old','wide'],creativeBrief:{notes:'Let the actual pictures lead.'}},research:[{claim:'Reported project context',url:'https://example.org/test-project'}],media:[asset('old','Test Project, source-reported older frame'),asset('wide','Test Project, source-reported wide view'),asset('detail','Test Project, source-reported detail'),asset('uncertain','Test Project, uncertain relation')]});
function reviewFor(s,{order=['wide','detail'],fits={}}={}){
  const manifest={storyId:s.id,sourceRevision:s.revision,workingVersion:s.localDraft?.version||0,images:s.media.map(a=>({assetId:a.id,sourceUrl:a.sourceUrl,sourcePreviewSha256:a.localPreview.sha256,originalSha256:a.localPreview.originalSha256,inputSha256:sha('model-input-'+a.id)}))};
  const manifestSha256=sha(JSON.stringify(manifest));
  return {verified:true,simulation:false,executionId:'9001',manifest,manifestSha256,result:{manifestSha256,images:manifest.images.map(i=>({assetId:i.assetId,inputSha256:i.inputSha256,relevance:fits[i.assetId]||'project',observations:'SIMULATED fixture visible content '+i.assetId,composition:'SIMULATED fixture framing '+i.assetId,distinctiveness:'SIMULATED fixture difference '+i.assetId,carouselPotential:'SIMULATED fixture role '+i.assetId,duplicateOf:null})),recommendedAssetIds:order}};
}

test('one package compares actual selected evidence with a deliberate proposal and leaves writing, order and rights untouched',()=>{
  const s=story(),before=JSON.stringify(s),p=buildEditorialPackage(s,{visualReview:reviewFor(s,{fits:{uncertain:'uncertain'}})});
  assert.equal(p.status,'visual_recommendation');assert.equal(p.captionContext.visualStatus,'verified_current');
  assert.deepEqual(p.current.selectedAssetIds,['old','wide']);assert.equal(p.current.caption,'Founder exact current writing.');
  assert.deepEqual(p.proposal.selectedAssetIds,['wide','detail']);assert.equal(p.proposal.coverAssetId,'wide');
  assert.deepEqual(p.proposal.comparison,{addedAssetIds:['detail'],removedAssetIds:['old'],orderChanged:true,coverChanged:true});
  assert.equal(p.proposal.coverAlternatives[0].assetId,'detail');assert.match(p.proposal.coverAlternatives[0].reasons.join(' '),/not independently ranked/);
  assert.equal(p.proposal.slides[0].pacing,'opening');assert.equal(p.proposal.slides[1].pacing,'closing');
  assert.match(p.proposal.slides[1].transition,/SIMULATED fixture visible content wide/);assert.match(p.proposal.slides[1].transition,/SIMULATED fixture visible content detail/);
  assert(p.proposal.withheld.some(i=>i.assetId==='old'&&/omitted/i.test(i.reason)));assert(p.proposal.withheld.some(i=>i.assetId==='uncertain'&&/uncertain/.test(i.reason)));
  assert.deepEqual(p.captionContext.selectedImages.map(i=>i.assetId),['old','wide']);assert.deepEqual(p.captionContext.proposedImages.map(i=>i.assetId),['wide','detail']);
  assert(p.captionContext.hookDirections.every(i=>i.text.includes('SIMULATED fixture visible content')&&i.requiresHumanReview));
  assert(p.gaps.some(g=>g.code==='ATTRIBUTION_UNVERIFIED'));assert(p.gaps.some(g=>g.code==='IMAGE_RIGHTS_REVIEW'));assert(p.gaps.some(g=>g.code==='FACTS_REVIEW'));
  assert.equal(p.approval.selectionChanged,false);assert.equal(p.approval.captionChanged,false);assert.equal(p.approval.rightsGranted,false);assert.equal(p.approval.publicationApproved,false);assert.equal(JSON.stringify(s),before);
});

test('an empty or single-frame verified recommendation never pads a carousel through source metadata fallbacks',()=>{
  const s=story(),empty=reviewFor(s,{order:[]}),p=buildEditorialPackage(s,{visualReview:empty}),plan=buildSourceSequencePlan(s,{visualReview:empty});
  assert.equal(p.status,'no_supported_images');assert.equal(p.proposal.format,null);assert.deepEqual(p.proposal.slides,[]);assert.deepEqual(plan.options,[]);assert(p.gaps.some(g=>g.code==='NO_SUPPORTED_IMAGES'));
  assert.equal(p.proposal.withheld.length,4);assert.deepEqual(p.current.selectedAssetIds,['old','wide']);
  const one=reviewFor(s,{order:['detail']}),single=buildEditorialPackage(s,{visualReview:one}),onePlan=buildSourceSequencePlan(s,{visualReview:one});
  assert.equal(single.proposal.format,'single_image');assert.equal(single.proposal.slides.length,1);assert.equal(onePlan.options.length,1);assert.equal(onePlan.options[0].format,'single_image');assert.deepEqual(single.captionContext.hookDirections.map(i=>i.assetId),['detail']);
});

test('verified flag alone, simulations, stale revisions and changed image bytes cannot provide image-grounded writing',()=>{
  const s=story(),valid=reviewFor(s);
  const cases=[
    r=>{delete r.manifest;},r=>{r.simulation=true;},r=>{r.executionId='unverified';},
    r=>{r.manifest.workingVersion++;},r=>{r.manifest.sourceRevision='old';},r=>{r.manifest.storyId='CON-other';},
    r=>{r.manifestSha256='f'.repeat(64);},r=>{r.result.images.pop();},r=>{r.result.images[0].inputSha256=sha('different');},
    r=>{r.manifest.images[0].sourcePreviewSha256=sha('changed');r.manifestSha256=sha(JSON.stringify(r.manifest));r.result.manifestSha256=r.manifestSha256;},
    r=>{r.manifest.images[0].sourceUrl='https://example.org/unrelated';r.manifestSha256=sha(JSON.stringify(r.manifest));r.result.manifestSha256=r.manifestSha256;},
  ];
  for(const mutate of cases){const r=structuredClone(valid);mutate(r);const p=buildEditorialPackage(s,{visualReview:r});assert.equal(p.captionContext.pixelReviewPerformed,false);assert.deepEqual(p.captionContext.hookDirections,[]);assert(p.captionContext.selectedImages.every(i=>i.observations===null));assert.equal(p.proposal.status,'metadata_candidates');}
  const replaced=structuredClone(s);replaced.media[0].localPreview.originalSha256=sha('replacement');assert.equal(editorialVisualEvidence(replaced,valid).status,'stale_images');
  const sim=buildEditorialPackage(s,{visualReview:{...valid,simulation:true}});assert(sim.gaps.some(i=>i.code==='SIMULATED_REVIEW_IGNORED'));assert(!JSON.stringify(sim).includes('SIMULATED fixture visible content'));
});

test('source-only package keeps metadata useful while making no visual hook, taste score or rights claim',()=>{
  const s=story();s.media[3].materialType='publication_cover';s.media[3].sourceRelation='page_cover';
  const p=buildEditorialPackage(s);assert.equal(p.status,'source_review_needed');assert.equal(p.captionContext.pixelReviewPerformed,false);assert.deepEqual(p.captionContext.hookDirections,[]);
  assert.equal(p.captionContext.selectedImages[0].sourceCaption,s.media[0].sourceCaption);assert.equal(p.captionContext.selectedImages[0].observations,null);assert.equal(p.captionContext.selectedImages[0].basis,'reported_source_metadata');
  assert(p.proposal.withheld.some(i=>i.assetId==='uncertain'));assert.match(p.summary,/No visual quality judgment/);assert(p.gaps.some(i=>i.code==='VISUAL_REVIEW_NEEDED'));
  assert.equal(p.rightsGranted,false);assert.equal(p.publicationApproved,false);assert.equal(p.approval.humanReviewRequired,true);
});

test('binding changes with founder caption/order, source details, review, credit and rights evidence',()=>{
  const s=story(),base=buildEditorialPackage(s).digest;
  for(const mutate of [x=>x.localDraft.caption+=' edited',x=>x.localDraft.selectedAssetIds.reverse(),x=>x.media[0].sourceCaption+=' changed',x=>x.media[0].sourceUrl+='?edition=2',x=>x.media[0].sourceCredit='Corrected credit',x=>x.media[0].localReview={decision:'reject'},x=>x.media[0].nativeRightsReview={reviewed:true},x=>x.research[0].claim='Corrected fact']){const changed=structuredClone(s);mutate(changed);assert.notEqual(buildEditorialPackage(changed).digest,base);}
  const r=reviewFor(s),first=buildEditorialPackage(s,{visualReview:r});r.result.images[0].observations='SIMULATED corrected fixture content';assert.notEqual(buildEditorialPackage(s,{visualReview:r}).digest,first.digest);
  s.localDraft.stale=true;const stale=buildEditorialPackage(s,{visualReview:r});assert.equal(stale.status,'stale_story');assert.deepEqual(stale.proposal.selectedAssetIds,[]);assert.equal(stale.captionContext.pixelReviewPerformed,false);
});

test('saved current selection outside a partial assessment is never described using another picture',()=>{
  const s=story(),r=reviewFor(s,{order:['detail']});r.manifest.images=r.manifest.images.filter(i=>i.assetId==='detail');r.result.images=r.result.images.filter(i=>i.assetId==='detail');r.manifestSha256=sha(JSON.stringify(r.manifest));r.result.manifestSha256=r.manifestSha256;
  const p=buildEditorialPackage(s,{visualReview:r});assert.equal(p.captionContext.pixelReviewPerformed,true);assert(p.captionContext.selectedImages.every(i=>i.observations===null));assert.equal(p.captionContext.proposedImages[0].observations,'SIMULATED fixture visible content detail');assert(p.gaps.some(g=>g.code==='SELECTED_IMAGES_NOT_ASSESSED'));
});

test('old sequence plans fail if current files change even when a caller supplies the old plan object',()=>{
  const s=story(),plan=buildSourceSequencePlan(s),input={planDigest:plan.digest,optionId:'curated-sequence',sourceRevision:s.revision,workingVersion:3};
  assert(sourceSequenceDraft(s,plan,input));s.media[0].localPreview.sha256=sha('new file');assert.throws(()=>sourceSequenceDraft(s,plan,input),{code:'EDIT_CONFLICT'});
});
