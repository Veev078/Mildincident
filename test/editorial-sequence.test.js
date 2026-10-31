import test from 'node:test';import assert from 'node:assert/strict';import {buildSourceSequencePlan} from '../src/editorial-sequence.js';
const asset=(id,year,materialType='photograph_reference')=>({id,previewUrl:`https://archive.example.org/${id}.jpg`,sourceRelation:'subject_caption_match',sourceCaption:`A source-caption reference from ${year}.`,sourceCredit:'Recorded source credit',sourceYears:[year],materialType});
test('source plans distinguish photographs and dated supporting documents without padding or granting clearance',()=>{
 const story={selectedAssetIds:['photo'],media:[asset('cover',1974),asset('dress',1967,'design_documentation'),asset('photo',1974),asset('trench',1967,'design_documentation'),asset('rejected',1967)]};story.media[0].sourceRelation='page_cover';story.media[4].localReview={decision:'reject'};
 const before=JSON.stringify(story);const plan=buildSourceSequencePlan(story);assert.equal(plan.options.length,2);assert.deepEqual(plan.options[1].slides.map(s=>s.assetId),['photo','dress','trench']);assert.deepEqual(plan.options[1].slides.map(s=>s.years[0]),[1974,1967,1967]);assert.equal(plan.options[1].slides[1].material,'design_documentation');assert.equal(plan.pixelReviewPerformed,false);assert.equal(plan.rightsGranted,false);assert.equal(JSON.stringify(story),before);
 const one=buildSourceSequencePlan({media:[asset('photo',1974),{...asset('duplicate',1974),previewUrl:'https://archive.example.org/photo.jpg'}]});assert.equal(one.options.length,1);assert.equal(one.options[0].targetSlideCount,1);
 const none=buildSourceSequencePlan({media:[{id:'no-metadata'}]});assert.deepEqual(none.options,[]);
});

test('frame feedback improves unselected source-caption recommendations without replacing an explicit founder sequence',()=>{
 const media=[asset('held',1974),asset('unreviewed',1974),asset('shortlisted',1974),asset('selected-second',1974),asset('selected-first',1974),asset('rejected',1974),{...asset('unrelated-shortlist',1974),sourceRelation:'context_only'}];
 const story={selectedAssetIds:['selected-first','selected-second'],media};
 const beforeFeedback=buildSourceSequencePlan(story);assert.deepEqual(beforeFeedback.options[1].slides.map(s=>s.assetId),['selected-first','selected-second','held','unreviewed','shortlisted','rejected']);
 media[0].localReview={decision:'hold'};media[2].localReview={decision:'shortlist'};media[5].localReview={decision:'reject'};media[6].localReview={decision:'shortlist'};
 // Explicit selection remains first even when it has a hold decision.
 media[4].localReview={decision:'hold'};
 const unchanged=JSON.stringify(story),after=buildSourceSequencePlan(story),order=after.options[1].slides.map(s=>s.assetId);
 assert.deepEqual(order,['selected-first','selected-second','shortlisted','unreviewed','held']);assert.equal(order.indexOf('shortlisted'),2);assert.equal(beforeFeedback.options[1].slides.findIndex(s=>s.assetId==='shortlisted'),4);
 assert.deepEqual(after.options[0].slides.map(s=>s.assetId),['selected-first']);assert.equal(JSON.stringify(story),unchanged);assert.equal(after.pixelReviewPerformed,false);assert.equal(after.rightsGranted,false);
 // A later explicit working sequence takes precedence over both source order and shortlist ranking.
 story.localDraft={selectedAssetIds:['held','selected-second']};assert.deepEqual(buildSourceSequencePlan(story).options[1].slides.slice(0,2).map(s=>s.assetId),['held','selected-second']);
});

test('feedback ranking has stable ties and never promotes missing-caption frames, bans a subject or pads a carousel',()=>{
 const story={media:[asset('ordinary-first',1974),asset('shortlist-one',1974),asset('shortlist-two',1974),asset('ordinary-last',1974),asset('held',1974),asset('rejected-one',1974),{...asset('empty-caption',1974),sourceCaption:''}]};
 for(const i of [1,2,6])story.media[i].localReview={decision:'shortlist'};story.media[4].localReview={decision:'hold'};story.media[5].localReview={decision:'reject'};
 const plan=buildSourceSequencePlan(story);assert.deepEqual(plan.options[1].slides.map(s=>s.assetId),['shortlist-one','shortlist-two','ordinary-first','ordinary-last','held']);assert.equal(plan.options[0].slides[0].assetId,'shortlist-one');
 const insufficient=buildSourceSequencePlan({subject:'The same subject remains eligible',media:[story.media[1],story.media[5],story.media[6]]});assert.equal(insufficient.options.length,1);assert.equal(insufficient.options[0].slides[0].assetId,'shortlist-one');assert.equal(insufficient.gaps.length,1);
});

test('sequence recommendations consume latest projected frame decisions without confusing preview attachments with approval',async()=>{
 const {attachLocalPreviews}=await import('../src/workspace/previews.js');
 const story={id:'CON-FIXTURE',media:[asset('former-shortlist',1974),asset('latest-shortlist',1974),asset('ordinary',1974)]};
 const reviews=new Map([[JSON.stringify([story.id,'former-shortlist']),{decision:'hold',version:2,history:[{decision:'shortlist',version:1}]}],[JSON.stringify([story.id,'latest-shortlist']),{decision:'shortlist',version:1}]]);
 attachLocalPreviews({stories:[story]},{all:()=>new Map(),allReviews:()=>reviews});
 const plan=buildSourceSequencePlan(story);assert.deepEqual(plan.options[1].slides.map(s=>s.assetId),['latest-shortlist','ordinary','former-shortlist']);assert.equal(plan.rightsGranted,false);assert.equal(plan.pixelReviewPerformed,false);
});
