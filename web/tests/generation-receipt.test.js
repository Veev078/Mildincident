import test from 'node:test';import assert from'node:assert/strict';import{generationReceipt}from'../generation-receipt.js';import{discoverySetup}from'../discovery-flow.js';
test('draft receipt distinguishes measured usage, unfinished tool records and missing accounting without invented costs',()=>{
 const story={id:'CON-DEV-fixture',origin:'n8n_development',generatedCaptionOriginal:'Original',photographicStage:'needs_research',engineProvenance:{executionId:'2359'},generationUsage:{inputTokens:24135,outputTokens:3401,price:null,priceVerified:false,models:[{node:'Research Candidates',runs:1,toolExecutionEvidence:{calls:2,basis:'provider_reported_requests',emitted:3,completed:2,incomplete:1}}]}};
 const html=generationReceipt(story);assert.match(html,/24,135 input/);assert.match(html,/2 provider-reported searches/);assert.match(html,/3 tool records, 2 completed, 1 unfinished/);assert.match(html,/Dollar cost is not verified/);assert.match(html,/Review photographs/);assert.ok(!html.includes('$0'));
 assert.match(generationReceipt({...story,generationUsage:null}),/Token usage not captured/);assert.equal(generationReceipt({origin:'production'}),'');assert.ok(!generationReceipt({...story,engineProvenance:{executionId:'<script>'}}).includes('<script>'));
});
test('authorized Discover explains one planned operation and consumption; no grant is supplied by the browser',()=>{
 const engine={configured:true,readOnly:false,generationApproved:true,generationAvailable:true,workerActive:true,authorizedRunsRemaining:1};const html=discoverySetup({workspace:{engine}});assert.match(html,/1 approved run available/);assert.match(html,/not a hard spending cap/);assert.match(html,/does not cancel accepted work/);assert.ok(!discoverySetup({workspace:{engine:{...engine,generationAvailable:false}}}).includes('approved run available'));
});

import {captionWorkspace} from '../caption.js';
test('caption workspace keeps original captured support beside editing without treating missing text as captured evidence',()=>{
 const story={id:'fixture',caption:'Working copy',media:[],selectedAssetIds:[],research:[{url:'https://example.org/source',sourceName:'Publisher',capturedAccess:'source_text_captured',capturedTextExcerpt:'A <quoted> source passage.'},{url:'https://example.org/absent',sourceName:'Unavailable',capturedAccess:'access_unconfirmed'}]};
 const html=captionWorkspace({},story);assert.match(html,/class="writing-sources"/);assert.equal((html.match(/Read saved excerpt/g)||[]).length,1);assert.match(html,/A &lt;quoted&gt; source passage/);assert.ok(!html.includes('<quoted>'));
});

import {founderQueue} from '../review.js';
test('New ideas shows most recently generated result first without reordering input or changing other review views',()=>{
 const make=(id,date)=>({id,origin:'n8n_development',title:id,hook:'An angle',caption:'A real draft',media:[],engineProvenance:{generatedAt:date}}),stories=[make('old','2026-11-01T10:00:00Z'),make('new','2026-11-05T10:00:00Z')],before=JSON.stringify(stories);
 const html=founderQueue({workspace:{stories}});assert.ok(html.indexOf('data-review-card="new"')<html.indexOf('data-review-card="old"'));assert.equal(JSON.stringify(stories),before);
});

test('retained-evidence caption receipt recognizes exact linked drafts without borrowing their billing into original research',()=>{
 const html=generationReceipt({id:'source-story',origin:'n8n_development',generatedCaptionOriginal:'',engineProvenance:{executionId:'2353'},localDraft:{captionSource:{executionId:'2355'}},captionGeneration:{result:{caption:'Retained AI caption',executionId:'2355'},versions:[{kind:'generated',caption:'Retained AI caption'}]}});
 assert.match(html,/AI draft saved from retained research/);assert.ok(!html.includes('A complete AI caption is not recorded'));assert.match(html,/Execution 2353/);assert.match(html,/caption source 2355/);assert.match(html,/usage below belongs to the original research record/);assert.match(html,/Token usage not captured/);
});
