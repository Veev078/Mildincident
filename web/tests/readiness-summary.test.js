import test from 'node:test';
import assert from 'node:assert/strict';
import {productionSummary} from '../readiness.js';
import {readinessPanel} from '../views.js';
import {home,todaySelection} from '../today.js';
const story=extra=>({id:'CON-REVIEW',title:'A real-shaped review fixture',revision:'source',media:[{id:'a',rightsStatus:'cleared'}],selectedAssetIds:['a'],caption:'The working caption.',research:[{claim:'A sourced claim'}],...extra});

test('readiness groups repeated production requirements while keeping factual, permission and approval records independent',()=>{
 const s=story({blockers:['PER_IMAGE_RIGHTS_PENDING','PACKAGE_RIGHTS_REVIEW_INCOMPLETE','SOURCE_CLAIMS_REVIEW_REQUIRED'],production:{blockers:['PACKAGE_RIGHTS_REVIEW_INCOMPLETE','FINAL_APPROVAL_REQUIRED'],package:{rightsStatus:'unreviewed',sourceClaimsReviewed:true,finalApprovalStatus:'approved',finalCaption:'A different caption.'}}});
 const before=JSON.stringify(s),summary=productionSummary(s);
 assert.deepEqual(summary.groups.map(g=>g.key),['rights','facts','caption']);assert.equal(summary.groups[0].codes.length,2);assert.equal(summary.codes.length,4);
 assert.equal(summary.requirements.find(r=>r.key==='facts').recorded,true);assert.equal(summary.requirements.find(r=>r.key==='rights').recorded,false);assert.equal(summary.requirements.find(r=>r.key==='approval').recorded,false);
 const html=readinessPanel(s);assert.equal((html.match(/<h3><a[^>]+>Photograph permissions/g)||[]).length,1);assert.ok(html.includes('What blocks production'));assert.ok(html.includes('PACKAGE RIGHTS REVIEW INCOMPLETE'));assert.equal(JSON.stringify(s),before);
});
test('an editorial exception or empty codes cannot masquerade as image permission or publishing authorization',()=>{
 const s=story({production:{package:{rightsStatus:'reviewed',sourceClaimsReviewed:true,finalApprovalStatus:'approved',finalCaption:'The working caption.'}},media:[{id:'a',rightsStatus:'editorial_exception_authorized',nativeRightsReview:{reviewed:true,kind:'recorded_editorial_exception',rightsGranted:false}}]});
 assert.equal(productionSummary(s).requirements.find(r=>r.key==='rights').recorded,false);
 s.media[0].nativeRightsReview.kind='recorded_human_clearance';assert.equal(productionSummary(s).requirements.find(r=>r.key==='rights').recorded,true);
 const summary=productionSummary(s);assert.equal(summary.publicationApproved,false);assert.equal(summary.productionApplied,false);assert.ok(readinessPanel(s).includes('Independent rights, factual review and final native approval still apply'));
});
test('existing or uncertain handoff and stale revision remain the first actions while preserving every other recorded check',()=>{
 const s=story({localDraft:{stale:true},production:{blockers:['UNRESOLVED_PROVIDER_RESULT','PER_IMAGE_RIGHTS_PENDING','UNRECOGNIZED_GATE']},productionDecisions:[{key:'claims',title:'Review sources',detail:'Keep this claim-level review.',tab:'research'},{key:'handoff',title:'Resolve previous handoff',detail:'Never retry an ambiguous create.',tab:'publishing'}]});
 const summary=productionSummary(s);assert.equal(summary.next.key,'revision');assert.deepEqual(summary.groups.slice(0,2).map(g=>g.key),['revision','handoff']);assert.equal(summary.codes.length,3);assert.ok(summary.groups.some(g=>g.key==='other'));assert.ok(readinessPanel(s).includes('Never retry an ambiguous create.'));
});
test('Today consolidates decisions per story and excludes recovered work from new proposals without inventing recency',()=>{
 const s=story({productionDecisions:[{key:'claims',title:'Review original sources',detail:'Check dates',tab:'research'}],publishing:{requiresReview:true}});
 const history=story({id:'history',origin:'n8n_development',recoveredHistory:true}),fresh=story({id:'new',origin:'n8n_development'});
 const html=home({workspace:{stories:[s,history,fresh]}});assert.equal(todaySelection({stories:[s,history,fresh]}).fresh.length,1);assert.equal((html.match(/Review original sources/g)||[]).length,1);assert.ok(html.includes('today-editorial-lead'));assert.ok(html.includes('1 new proposal awaiting'));
 assert.ok(!html.includes('Latest story'));assert.ok(!html.includes('Ready to publish'));
});
