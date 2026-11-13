import test from 'node:test';
import assert from 'node:assert/strict';
import {photoRequestPanel} from '../photo-requests.js';
import {selectedSequencePanel,assetCard} from '../photo-desk.js';

const requestPanel=(extra={})=>photoRequestPanel({
 id:'PHOTO-ONE',revision:'r1',photoRequests:[],
 photography:{identity:{series:'A real project'}},
 ...extra
},{});

test('photo discovery asks for search direction before showing the main search action',()=>{
 const html=requestPanel();
 const direction=html.indexOf('data-photo-direction="PHOTO-ONE"');
 const action=html.indexOf('data-photo-discover="PHOTO-ONE"');
 assert.ok(direction>=0&&action>direction);
 assert.equal((html.match(/data-photo-discover=/g)||[]).length,1);
 assert.ok(html.includes('photo-action-stack'));
 assert.ok(html.includes('not visually verified photographs'));
});

test('photo search remains disabled for stale draft without changing saved selections',()=>{
 const story={id:'PHOTO-ONE',revision:'r1',photoRequests:[],selectedAssetIds:['kept'],localDraft:{stale:true},
 photography:{identity:{series:'A real project'}}};
 const before=structuredClone(story);
 const html=photoRequestPanel(story,{});
 assert.match(html,/data-photo-discover="PHOTO-ONE"[^>]* disabled/);
 assert.match(html,/Review the source changes before searching/);
 assert.deepEqual(story,before);
});

test('photo action layout keeps search, source assistance and archival exploration separate',()=>{
 const html=requestPanel();
 assert.ok(html.indexOf('photo-source-assist')>html.indexOf('data-photo-discover'));
 assert.ok(html.indexOf('photo-search-advanced')>html.indexOf('photo-source-assist'));
 assert.ok(html.includes('aria-describedby="photo-action-status-PHOTO-ONE"'));
 assert.ok(html.includes('Check identity and permission.'));
});

test('selected sequence preserves exact order, offers explicit removal and escapes source labels',()=>{
 const story={id:'CON-ui',selectedAssetIds:['two','one'],media:[{id:'one',title:'First frame',previewUrl:''},{id:'two',title:'Second <frame>',previewUrl:''}],revision:'r1'};
 const before=structuredClone(story),html=selectedSequencePanel(story);assert(html.indexOf('Inspect selected photograph 1: Second &lt;frame&gt;')<html.indexOf('Inspect selected photograph 2: First frame'));assert.match(html,/Remove Second &lt;frame&gt; from sequence/);assert.match(html,/Arrange sequence/);assert.deepEqual(story,before);
});

test('photo selection pauses on stale source with an explanation; source relevance never grants rights',()=>{
 const html=assetCard({id:'CON-ui',selectedAssetIds:[],localDraft:{stale:true}},{id:'one',title:'A frame',photoRelevance:{label:'Project reference'},rightsStatus:'preview_unreviewed'},false);
 assert.match(html,/data-action="toggle-asset"[^>]* disabled/);assert.match(html,/Selection paused/);assert.match(html,/Rights pending/);assert(!html.includes('Clearance recorded'));
});

test('an unavailable selected cover is reported without relabeling another photograph as the cover',()=>{
 const story={id:'CON-ui',selectedAssetIds:['missing-cover','one'],media:[{id:'one',title:'Second frame'}],revision:'r1'};
 const html=selectedSequencePanel(story);
 assert.match(html,/2 photographs/);assert.match(html,/Inspect selected photograph 2: Second frame/);assert.match(html,/<span>02<\/span>/);assert.match(html,/A selected reference is unavailable/);assert(!html.includes('<span>Cover</span>'));
 assert.deepEqual(story.selectedAssetIds,['missing-cover','one']);
});

test('photo outcomes distinguish newly saved photographs, private copies and unacquired references',()=>{
 const complete={id:'search-one',state:'complete',sourceRevision:'r1',workingVersion:0,source:'project',plan:{route:'cached_project_evidence'},sourceProgression:{states:[],reuse:[{url:'https://www.life.com/project'}]},newPhotoCount:3,acquisitionSummary:{newDecodedPhotographs:1,decodedExistingReferences:2,newReferencesWithoutFiles:2,referenceDuplicates:4,exactFileDuplicates:1,contextReferences:2}};
 const html=requestPanel({photoRequests:[complete],selectedAssetIds:['kept']});
 assert.match(html,/1 new photograph saved/);assert.match(html,/1 new project photograph privately saved/);
 assert.match(html,/2 existing references now have a private image copy/);assert.match(html,/2 new references still need an image file/);
 assert.match(html,/1 identical image file not added again/);assert.match(html,/2 supporting references kept separate from project photographs/);
 assert.match(html,/Your selection is unchanged/);
 const onlyCopies=requestPanel({photoRequests:[{...complete,acquisitionSummary:{...complete.acquisitionSummary,newDecodedPhotographs:0,newReferencesWithoutFiles:0}}]});
 assert.match(onlyCopies,/Private copies saved for existing references/);assert.match(onlyCopies,/No new project photographs were saved/);
 assert(!onlyCopies.includes('New images ready to inspect'));
 const references=requestPanel({photoRequests:[{...complete,acquisitionSummary:{...complete.acquisitionSummary,newDecodedPhotographs:0,decodedExistingReferences:0}}]});
 assert.match(references,/New references found — image files still needed/);
});

test('photo receipts explain partial scans and completion without declaring the whole project exhausted',()=>{
 const url='https://www.dazeddigital.com/project',base={id:'search-one',state:'complete',sourceRevision:'r1',workingVersion:0,source:'project',plan:{route:'cached_project_evidence'},acquisitionSummary:{newDecodedPhotographs:0,newReferencesWithoutFiles:0},sourceProgression:{states:[{url,completeScan:false,remainingReferences:12}],reuse:[{url}]}};
 const partial=requestPanel({photoRequests:[{...base,sourcePages:[{url,coverage:{offset:0,nextOffset:40,hasMore:true,referenceCount:52,retainedCount:40}}]}]});
 assert.match(partial,/Checked 40 of 52 references on this page; 12 remain/);
 const finished=requestPanel({photoRequests:[{...base,sourcePages:[{url,coverage:{offset:40,nextOffset:52,hasMore:false,referenceCount:52,retainedCount:12}}]}]});
 assert.match(finished,/Finished the saved page’s remaining references \(41–52 of 52\)/);
 assert(!finished.includes('A saved page still has references to check'));
 const checked=requestPanel({photoRequests:[{...base,plan:{route:'sources_checked'},sourceProgression:{states:[{url,completeScan:true,remainingReferences:0}]}}]});
 assert.match(checked,/No page was repeated. Other project sources may still exist/);assert(!checked.includes('project exhausted'));
 const cursor=requestPanel({photoRequests:[{...base,sourcePages:[{url,coverage:{extractionOffset:40,retainedThrough:52,remainingReferenceCount:0,extractionComplete:true,referenceCount:52,retainedCount:12}}]}]});
 assert.match(cursor,/Finished the saved page’s remaining references \(41–52 of 52\)/);
 const deferred=requestPanel({photoRequests:[{...base,sourceProgression:{states:[],suppressedImageUrls:['https://images.example.org/frame.jpg']},imageAttempts:[{imageUrl:'https://images.example.org/frame.jpg',status:'deferred_previous_attempt',networkAttempted:false}]}]});
 assert.match(deferred,/1 earlier image attempt was not repeated/);assert.match(deferred,/earlier attempt kept; not requested again/);assert(!deferred.includes('· deferred_previous_attempt'));
});
