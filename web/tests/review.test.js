import test from 'node:test';import assert from 'node:assert/strict';import {founderQueue,proposalReviewState} from '../review.js';import {discovery} from '../discover.js';
const make=(id,other={})=>({id,title:id,subject:'A cultural project',revision:'r1',media:[],origin:'n8n_development',...other});
test('the new proposal queue never disguises recovered history, existing native stories or missing photography as fresh results',()=>{const workspace={stories:[make('new-result'),make('historical-result',{recoveredHistory:true}),make('native-story',{origin:undefined})]};const html=founderQueue({workspace});assert.ok(html.includes('data-review-card="new-result"'));assert.ok(!html.includes('data-review-card="historical-result"'));assert.ok(!html.includes('data-review-card="native-story"'));assert.ok(html.includes('Metadata only'));assert.ok(founderQueue({workspace,reviewFilter:'history'}).includes('Recovered research · existing result'));});
test('save/pass/reconsider controls preserve distinctions and changed material returns to review',()=>{const s=make('proposal');const reviews={proposal:{decision:'pass',sourceRevision:'r1',workingVersion:0}};assert.equal(proposalReviewState(s,reviews).decision,'pass');assert.equal(proposalReviewState({...s,localDraft:{version:1}},reviews).stale,true);assert.ok(founderQueue({workspace:{stories:[],founderReviews:{}}}).includes('No new ideas yet.'));const html=founderQueue({workspace:{stories:[s],founderReviews:reviews},reviewFilter:'passed'});assert.ok(html.includes('A reason is useful, but never required.'));assert.ok(html.includes('value="images_for_subject"'));assert.ok(html.includes('Return to unreviewed'));});
test('frame feedback binds the displayed selected hero rather than the first unrelated image',()=>{
 const s=make('frame-review',{selectedAssetIds:['chosen-frame'],media:[{id:'first-frame'},{id:'chosen-frame',title:'Selected frame',localPreview:{sha256:'a'.repeat(64)}}]});const html=founderQueue({workspace:{stories:[s]}});
 assert.match(html,/data-asset="chosen-frame"/);assert.match(html,new RegExp('data-preview-hash="'+'a'.repeat(64)+'"'));assert.ok(html.includes('Source or attribution problem'));assert.ok(html.includes('Interface problem'));
});
test('generated photographic continuations remain labeled and linked to their parent instead of implying a new subject discovery',()=>{
 const html=founderQueue({workspace:{stories:[make('follow-up',{continuationOf:{storyId:'CON-parent',assetId:'exact-frame'}})]}});
 assert.ok(html.includes('Further photographic research · existing story'));assert.ok(html.includes('#/story/CON-parent/images'));assert.ok(html.includes('exact earlier frame exact-frame'));
});

test('Discover has one clear direction form and truthful saved status without exposing operational controls as the main action',()=>{
 const html=discovery({workspace:{stories:[],engine:{configured:true,readOnly:true,generationAvailable:false},researchRequests:[{id:'request-1',kind:'brief',prompt:'An actual saved direction',version:0,createdAt:'2026-10-30T15:00:00Z',baselineIds:[]}]}});
 assert.equal((html.match(/data-research-form/g)||[]).length,1);assert.equal((html.match(/data-action="prepare-discovery"/g)||[]).length,1);
 assert.ok(html.includes('Save research direction'));assert.ok(html.includes('Direction saved · research not started'));assert.ok(html.includes('Research does not start from this action.'));
 assert.ok(!html.includes('data-engine-action="queue"'));assert.ok(!html.includes('data-engine-action="start"'));assert.ok(html.includes('<details class="research-system"><summary>System details and research record</summary>'));
 const queued=discovery({workspace:{stories:[],engine:{configured:true,readOnly:true,generationAvailable:false},researchRequests:[{id:'q1',kind:'discovery',prompt:'Already queued elsewhere',version:0,engineJob:{state:'queued',version:1,candidates:[]}}]}});assert.ok(!queued.includes('data-engine-action="start"'));
});
test('saved proposals show their destination and source credit without implying image or rights verification',()=>{
 const story=make('saved-source',{media:[{id:'frame',creator:'Source-reported photographer',sourceUrl:'https://example.org/original'}]});
 const html=founderQueue({workspace:{stories:[story],founderReviews:{'saved-source':{decision:'save',sourceRevision:'r1',workingVersion:0}}},reviewFilter:'saved'});
 assert.ok(html.includes('Continue developing →'));assert.ok(html.includes('Source-reported photographer'));assert.ok(html.includes('Original source'));
 assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('Metadata only · preview unavailable'));assert.ok(html.includes('does not authorize publication'));
});
