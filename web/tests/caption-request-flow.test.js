import test from'node:test';import assert from'node:assert/strict';
import{captionGenerationPanel}from'../caption-generation.js';
import{captionRequestProposal,canConfirmCaption}from'../caption-request-flow.js';
const proposal={id:'proposal-new',storyId:'story',sourceRevision:'source-v1',workingVersion:2,direction:'concise',sourceLabel:'Retained source passages',state:'prepared',canConfirm:true,expiresAt:'2099-01-01T10:00:00Z',limits:{maxDraftOutputTokens:1800},estimatedCost:'$0.04–$0.05'};
const story={id:'story',origin:'n8n_development',engineJobId:'source-job',engineProvenance:{executionId:'2353'},revision:'source-v1',caption:'Current <caption>',localDraft:{version:2,caption:'Current <caption>'},captionGeneration:{pilot:{state:'available',enabled:true,proposal}}};
const state={captionTools:{story:'improve'}};
test('pilot improvement shows a real direction/review/confirmation flow without mutating the current caption',()=>{
 const before=JSON.stringify(story),html=captionGenerationPanel(story,{state});assert.match(html,/Improvement direction/);assert.match(html,/Review request/);assert.match(html,/Reviewing a request does not run AI/);assert.match(html,/Retained source passages/);assert.match(html,/1,?800 output tokens/);assert.match(html,/no new research or searches/);assert.match(html,/data-caption-request="confirm"[^>]*>Confirm caption improvement/);assert.match(html,/not a hard spending cap/);assert.match(html,/Disable future AI starts/);assert.equal(JSON.stringify(story),before);assert.ok(!html.includes('data-caption-operation="generate"'));
});
test('inactive, disabled and unavailable confirmations stay visible but cannot commission work',()=>{
 for(const pilotState of ['inactive','disabled','limit_reached','review_required']){
  const s={...story,captionGeneration:{pilot:{state:pilotState,enabled:false,proposal:{...proposal,canConfirm:false}}}},html=captionGenerationPanel(s,{state});assert.match(html,/data-caption-request="confirm"[^>]*disabled/);assert.match(html,/No AI has started/);assert.ok(!html.includes('data-caption-request="disable"'));
 }
 assert.equal(canConfirmCaption({...story,captionGeneration:{pilot:{state:'inactive',enabled:true,proposal}}},proposal),false);assert.equal(canConfirmCaption({...story,captionGeneration:{pilot:{state:'available',enabled:false,proposal}}},proposal),false);
 assert.equal(canConfirmCaption({...story,localDraft:{version:3}},proposal),false);assert.equal(canConfirmCaption({...story,revision:'source-v2'},proposal),false);assert.equal(canConfirmCaption(story,{...proposal,expiresAt:'2000-01-01T00:00:00Z'}),false);
});
test('queued/running/failed/uncertain outcomes never show another confirmation; completed offers comparison only',()=>{
 for(const stateName of ['queued','running','failed','uncertain']){
  const html=captionGenerationPanel({...story,captionGeneration:{pilot:{state:'busy',proposal:{...proposal,state:stateName}}}},{state});assert.ok(!html.includes('data-caption-request="confirm"'));assert.match(html,/Check for results/);if(['uncertain','failed'].includes(stateName))assert.match(html,/not be resent automatically/);
 }
 const complete=captionGenerationPanel({...story,captionGeneration:{pilot:{proposal:{...proposal,state:'completed',executionId:'3001',usage:{inputTokens:2000,outputTokens:400}}}}},{state});assert.match(complete,/Compare new draft/);assert.match(complete,/Draft receipt/);assert.match(complete,/Execution 3001/);assert.match(complete,/2,000 input \/ 400 output tokens recorded/);assert.match(complete,/Dollar cost is not verified/);assert.match(complete,/working caption is unchanged/);assert.ok(!complete.includes('data-caption-request="confirm"'));
});
test('a lost confirmation remains uncertain until recorded progression, while fresh local plans beat stale server plans',()=>{
 const uncertain={...proposal,state:'uncertain',canConfirm:false},s={...story};assert.equal(captionRequestProposal(s,{captionProposals:{story:uncertain}}).state,'uncertain');
 assert.equal(captionRequestProposal({...story,captionGeneration:{pilot:{proposal:{...proposal,state:'running'}}}},{captionProposals:{story:uncertain}}).state,'running');
 const old={...proposal,id:'old',expiresAt:'2098-01-01T10:00:00Z'};assert.equal(captionRequestProposal({...story,captionGeneration:{pilot:{proposal:old}}},{captionProposals:{story:proposal}}).id,proposal.id);
});
test('request context and status escape source and backend strings',()=>{
 const html=captionGenerationPanel({...story,captionGeneration:{pilot:{proposal:{...proposal,sourceLabel:'<script>source</script>',message:'<img src=x>'}}}},{state});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x>'));assert.match(html,/&lt;script&gt;source/);
});

test('stories without a retained native identity can edit but cannot prepare a paid drafting plan',()=>{
 const html=captionGenerationPanel({...story,origin:'production',engineJobId:null,captionGeneration:{pilot:{state:'disabled',enabled:false}}},{state});assert.match(html,/data-caption-request="prepare"[^>]*disabled/);assert.match(html,/needs retained native research for this exact story/);
});
