import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferConfirmDialog} from '../buffer-draft.js';
const story={id:'CON-kept',caption:'Saved <caption>',selectedAssetIds:['b','a'],media:[{id:'a'},{id:'b'}]};
test('blocked send keeps the actual caption/order in one review without inventing file or rights clearance',()=>{
 const delivery={ready:false,blockers:[{code:'NATIVE_RIGHTS_REVIEW_REQUIRED'},{code:'FINAL_JPEGS_REQUIRED'},{code:'BUFFER_CONNECTION_REVIEW_REQUIRED'}]},before=JSON.stringify(story),html=bufferConfirmDialog(story,delivery);
 assert.match(html,/Saved &lt;caption&gt;/);assert.ok(html.indexOf('data-asset="b"')<html.indexOf('data-asset="a"'));assert.match(html,/no verified usage basis/);assert.match(html,/finished slide files/);assert.match(html,/delivery is switched off/);assert.match(html,/Choose replacement photos/);assert.doesNotMatch(html,/data-buffer-action="send"|data-post-completion="confirm"|final JPEG files verified|Review photo permissions/);assert.equal(JSON.stringify(story),before);
});
test('only server-reviewed ready delivery exposes the existing explicit confirmation',()=>{
 const html=bufferConfirmDialog(story,{ready:true,completion:true,fileCount:2});assert.match(html,/2 final JPEG files verified/);assert.match(html,/data-final-post-reviewed/);assert.match(html,/data-post-completion="confirm"/);
 const unknown=bufferConfirmDialog(story,{});assert.doesNotMatch(unknown,/data-post-completion="confirm"|data-buffer-action="send"/);assert.match(unknown,/not been verified/);
});
