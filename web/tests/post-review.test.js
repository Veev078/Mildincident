import test from 'node:test';import assert from 'node:assert/strict';import {postReview,postInspector} from '../post-review.js';
test('post review previews only the saved selection in its exact order and never substitutes a candidate cover',()=>{
 const story={id:'CON-kept',caption:'Source caption',selectedAssetIds:['a'],media:[{id:'a',title:'First',previewUrl:''},{id:'b',title:'Second',previewUrl:''},{id:'filler',title:'Unselected filler',previewUrl:'https://example.org/filler.jpg'}],localDraft:{selectedAssetIds:['b','a'],caption:'A private <caption>'}},before=JSON.stringify(story),html=postReview(story);
 assert.ok(html.includes('aria-label="Selected slide order"'));assert.ok(html.includes('A private &lt;caption&gt;'));assert.ok(!html.includes('filler.jpg'));const strip=html.split('aria-label="Selected slide order"')[1].split('</nav>')[0];assert.ok(strip.indexOf('data-asset="b"')<strip.indexOf('data-asset="a"'));assert.equal(JSON.stringify(story),before);assert.ok(!html.includes('Approved for handoff'));assert.ok(html.includes('Your post.'));
});
test('source changes, missing selection and prior provider activity retain truthful next actions',()=>{
 const sparse={id:'CON',media:[],selectedAssetIds:[],caption:''};assert.ok(postReview(sparse).includes('Choose the photographs'));assert.ok(!postReview(sparse).includes('Preview post'));
 assert.ok(postReview({...sparse,localDraft:{stale:true,caption:'Retain me'}}).includes('Compare changes'));assert.ok(postReview({...sparse,publishing:{observed:'buffer_sent',requiresReview:true,postIds:['recorded-id']}}).includes('Earlier delivery recorded'));assert.ok(!postReview(sparse).includes('data-requirement='));
});

test('an unsent post keeps Send to Buffer visible without inventing approval',()=>{
 const story={id:'CON-review',caption:'Exact caption',selectedAssetIds:['a'],media:[{id:'a',previewUrl:'https://example.org/photo.jpg'}],approvalRequest:{unchanged:true,id:'local-copy',message:'Saved privately.'}};
 const html=postReview(story);assert.match(html,/Send to Buffer/);assert.match(html,/data-post-completion="review"/);assert.doesNotMatch(html,/Photo permission needed|Review photo permissions/);assert.doesNotMatch(html,/data-approval-prepare=/);assert.doesNotMatch(html,/photo-expand/);assert.doesNotMatch(html,/data-buffer-action="send"/);assert.match(html,/Post details/);assert.match(html,/data-post-preview=/);
});

 test('Send to Buffer remains available to review after preparation closes without clearing image rights',()=>{
 const story={id:'CON-private',caption:'A saved caption',selectedAssetIds:['a'],media:[{id:'a',nativeRightsReview:{reviewed:false,rightsGranted:false}}],nativePublishing:{reviewAvailable:true,finalFilesVerified:false}},before=JSON.stringify(story),html=postReview(story);assert.match(html,/Send to Buffer/);assert.match(html,/data-post-completion="review"/);assert.doesNotMatch(html,/data-native-review="submit"|Review photo permissions/);assert.equal(JSON.stringify(story),before);
 const disabled=postReview({...story,nativePublishing:{reviewAvailable:false,preparationReason:'Private preparation is switched off.'}});assert.match(disabled,/Send to Buffer/);assert.doesNotMatch(disabled,/permission needed|Prepare for approval/);
 const done=postReview({...story,nativePublishing:{reviewAvailable:false,nativeContentCurrent:true},nativeReviewTransfer:{state:'native_review_saved',filesPrepared:false}});assert.match(done,/Preparation verified/);assert.doesNotMatch(done,/permission needed|Prepare for approval|Preparation unavailable/);
 const changed=postReview({...story,nativePublishing:{reviewAvailable:true,nativeContentCurrent:false},nativeReviewTransfer:{state:'native_review_saved',filesPrepared:false}});assert.match(changed,/Send to Buffer/);assert.match(done,/Send to Buffer/);
 const inspector=postInspector(story,'permissions');assert.doesNotMatch(inspector,/Photo permissions|Open permission records|Credit needed/);assert.match(inspector,/Facts & attribution/);
 });

test('uncertain or recorded deliveries cannot offer another send even when the reader is unavailable',()=>{
 for(const state of ['sending','needs_reconciliation','confirmed_draft']){const html=postReview({id:'CON',caption:'Caption',selectedAssetIds:['a'],media:[{id:'a'}],bufferDraft:{state,canCheck:false}});assert.doesNotMatch(html,/data-post-completion="review"/);assert.match(html,/View delivery/);}
});
