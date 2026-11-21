import test from 'node:test';import assert from 'node:assert/strict';import {postReview} from '../post-review.js';
test('post review previews only the saved selection in its exact order and never substitutes a candidate cover',()=>{
 const story={id:'CON-kept',caption:'Source caption',selectedAssetIds:['a'],media:[{id:'a',title:'First',previewUrl:''},{id:'b',title:'Second',previewUrl:''},{id:'filler',title:'Unselected filler',previewUrl:'https://example.org/filler.jpg'}],localDraft:{selectedAssetIds:['b','a'],caption:'A private <caption>'}},before=JSON.stringify(story),html=postReview(story);
 assert.ok(html.includes('aria-label="Selected slide order"'));assert.ok(html.includes('A private &lt;caption&gt;'));assert.ok(!html.includes('filler.jpg'));const strip=html.split('aria-label="Selected slide order"')[1].split('</nav>')[0];assert.ok(strip.indexOf('data-asset="b"')<strip.indexOf('data-asset="a"'));assert.equal(JSON.stringify(story),before);assert.ok(!html.includes('Approved for handoff'));assert.ok(html.includes('Your post.'));
});
test('source changes, missing selection and prior provider activity retain truthful next actions',()=>{
 const sparse={id:'CON',media:[],selectedAssetIds:[],caption:''};assert.ok(postReview(sparse).includes('Choose the photographs'));assert.ok(!postReview(sparse).includes('Preview post'));
 assert.ok(postReview({...sparse,localDraft:{stale:true,caption:'Retain me'}}).includes('Compare changes'));assert.ok(postReview({...sparse,publishing:{observed:'buffer_sent',requiresReview:true,postIds:['recorded-id']}}).includes('Earlier delivery recorded'));assert.ok(!postReview(sparse).includes('data-requirement='));
});

test('a private review copy stays Needs review, with one next action and no zoom or invented approval',()=>{
 const story={id:'CON-review',caption:'Exact caption',selectedAssetIds:['a'],media:[{id:'a',previewUrl:'https://example.org/photo.jpg'}],approvalRequest:{unchanged:true,id:'local-copy',message:'Saved privately.'}};
 const html=postReview(story);assert.match(html,/Photo permission needed/);assert.match(html,/Review photo permissions/);assert.doesNotMatch(html,/data-approval-prepare=/);assert.doesNotMatch(html,/photo-expand/);assert.doesNotMatch(html,/data-buffer-action="send"/);assert.match(html,/Post details/);assert.match(html,/data-post-preview=/);
});
