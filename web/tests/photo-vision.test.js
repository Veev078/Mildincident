import test from 'node:test';import assert from 'node:assert/strict';
import {photoVisionPanel} from '../photo-vision.js';
const s=()=>({id:'CON-VISION',revision:'r1',media:[{id:'one',title:'<private title>',localPreview:{sha256:'a'.repeat(64)}}],photoVision:{policy:{enabled:false,state:'disabled'},eligibleBatches:[{photoRequestId:'receipt',assetIds:['one'],assets:[{id:'one',title:'<private title>'}]}]}});
test('unavailable AI has one explanation and no misleading confirmation; active review discloses cost and image sharing',()=>{
 const story=s();let html=photoVisionPanel(story);assert.match(html,/not enabled|paid review becomes available/i);assert(!html.includes('data-vision-action="confirm"'));assert(!html.includes('<private title>'));
 story.photoVision.proposal={id:'proposal',state:'prepared',canConfirm:false,images:[{assetId:'one'}],message:'Disabled',estimatedCost:'Not a hard cap.'};html=photoVisionPanel(story);assert(!html.includes('data-vision-action="confirm"'));story.photoVision.policy={enabled:true,state:'available'};html=photoVisionPanel(story);assert(!html.includes('data-vision-action="confirm"'));assert.match(html,/Image bytes leave Studio/);
 story.photoVision.proposal.canConfirm=true;html=photoVisionPanel(story);assert.match(html,/data-vision-action="confirm"/);assert.match(html,/Not a hard cap/);
});
test('uncertain operations can only be reconciled and failure cannot silently become another paid request',()=>{
 const story=s();story.photoVision.proposal={id:'proposal',state:'uncertain',message:'Reconcile once.'};let html=photoVisionPanel(story);assert.match(html,/data-vision-action="refresh"/);assert(!html.includes('data-vision-action="confirm"'));assert(!html.includes('data-vision-action="reprepare"'));
 story.photoVision.proposal.state='failed';html=photoVisionPanel(story);assert(!html.includes('data-vision-action="confirm"'));assert.match(html,/No automatic retry/);
 story.photoVision={policy:{enabled:true,state:'available'},eligibleBatches:[]};html=photoVisionPanel(story);assert.match(html,/^<details/);assert.match(html,/save photographs first/);assert(!html.includes('data-vision-action="confirm"'));
});
