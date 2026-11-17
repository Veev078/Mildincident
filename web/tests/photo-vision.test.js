import test from 'node:test';import assert from 'node:assert/strict';
import {photoVisionPanel} from '../photo-vision.js';
const s=()=>({id:'CON-VISION',revision:'r1',media:[{id:'one',title:'<private title>',localPreview:{sha256:'a'.repeat(64)}}],photoVision:{policy:{enabled:false},eligibleBatches:[{photoRequestId:'receipt',assetIds:['one'],assets:[{id:'one',title:'<private title>'}]}]}});
test('unpaid review stays possible with disabled vision but confirmed execution requires the exact server approval',()=>{
 const story=s();let html=photoVisionPanel(story);assert.match(html,/data-vision-action="prepare"/);assert(!html.includes('data-vision-action="confirm"'));assert(!html.includes('<private title>'));
 story.photoVision.proposal={id:'proposal',state:'prepared',canConfirm:false,images:[{assetId:'one'}],message:'Disabled',estimatedCost:'Not a hard cap.'};html=photoVisionPanel(story);assert.match(html,/data-vision-action="confirm"[^>]*disabled/);assert.match(html,/data-vision-action="reprepare"/);assert.match(html,/Image bytes leave Studio/);
 story.photoVision.policy.enabled=true;html=photoVisionPanel(story);assert.match(html,/data-vision-action="confirm"[^>]*disabled/);
});
test('uncertain or failed operations cannot be confirmed again and fileless stories show a compact truthful state',()=>{
 const story=s();story.photoVision.proposal={id:'proposal',state:'uncertain',message:'Reconcile once.'};let html=photoVisionPanel(story);assert.match(html,/data-vision-action="refresh"/);assert(!html.includes('data-vision-action="confirm"'));assert(!html.includes('data-vision-action="reprepare"'));
 story.photoVision.proposal.state='failed';html=photoVisionPanel(story);assert(!html.includes('data-vision-action="confirm"'));assert.match(html,/No automatic retry/);assert.match(html,/data-vision-action="reprepare"/);
 story.photoVision={policy:{enabled:true},eligibleBatches:[]};html=photoVisionPanel(story);assert.match(html,/^<details/);assert.match(html,/save photographs first/);assert(!html.includes('data-vision-action="confirm"'));
});
