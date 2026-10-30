import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {photoEvidenceTools,inspectPhotoSource,captureEditorialEvidence,assessEditorialPackage} from '../src/editorial-evidence.js';import {safePhotoReference} from '../src/n8n/photo-url-guard.js';
const job='418e3861-610b-400a-9cc6-e0635ce6003d';
const html=`<title>Photographer archive</title><meta property="og:image" content="/cover.jpg"><script>private script text</script>
<img src="/related.jpg" alt="Actress Mira Sol sits near designer Elio North. Paris, 1974. © Alex Vale.">
<img src="/lunch.jpg" alt="Elio North has lunch at home. January 2002. © Tess Vale / Archive.">
<img src="/studio.jpg" alt="Elio North prepares a collection. January 1962. © Alex Vale.">
<img src="/show.jpg" alt="Elio North before a show in 1998. © Tess Vale / Archive.">`;
const candidate={id:'DEV-'+job+'-1',jobId:job,format:'single_image',targetSlideCount:1,title:'Mira Sol and Elio North around a 1967 film',subject:'Mira Sol and Elio North (1967)',captionDraft:'For a younger audience, the appeal is simple.',claims:[{claim:'A fixture claim',url:'https://archive.example.org/article',linkStatus:'live'}],media:[{id:'existing-image',previewUrl:'https://archive.example.org/related.jpg'}],provenance:{executionId:'42'}};
const output=items=>[{data:{main:[items.map(json=>({json}))]}}];
function execution(){return {id:'42',workflowId:'dev-worker',stoppedAt:'2026-10-29T13:00:00Z',data:{resultData:{runData:{
 'Development Job Request':output([{headers:{secret:'NEVER_EXPOSE'}}]),'Validate Development Dispatch':output([{job_id:job}]),'Verify Development Claim':output([{request_hash:'a'.repeat(64)}]),
 'Expand Claims for Link Check':output([{url:'https://archive.example.org/article',claim_index:0}]),'Check Source Links':output([{statusCode:200,data:'<title>Source</title><p>A recorded source paragraph.</p>'}]),
 'Prepare First-Party Page Scan':output([{source_page_url:'https://archive.example.org/gallery'}]),'Fetch First-Party Page Metadata':output([{body:html}]),
 'Research Candidates':[{metadata:{tokenUsage:{inputTokens:100,outputTokens:50}},data:{main:[[{json:{output:[{type:'message'}]}}]]}}],
 'Draft Editorial Concept':[{metadata:{tokenUsage:{inputTokens:70,outputTokens:30}},data:{main:[[{json:{output:[{type:'message'}]}}]]}}]
}}}};}
test('caption evidence selects the distinctive subject, keeps dates/credits, and never selects a generic cover',()=>{
 const images=inspectPhotoSource(html,'https://archive.example.org/gallery',{id:'DEV-'+job,subject:candidate.subject,title:candidate.title});const related=images.filter(i=>i.relation==='subject_caption_match');assert.equal(related.length,1);assert.equal(related[0].url,'https://archive.example.org/related.jpg');assert.equal(related[0].creator,'');assert.equal(related[0].copyrightHolder,'Alex Vale');assert.equal(related[0].creatorBasis,'copyright_holder_only');assert.deepEqual(related[0].years,[1974]);assert.equal(related[0].dateContext,'different_year_context');assert.equal(related[0].rightsGranted,false);assert.equal(images.find(i=>i.url.endsWith('/cover.jpg')).relation,'page_cover');
 const sandbox=vm.runInNewContext(`(${photoEvidenceTools.toString()})(${safePhotoReference.toString()}).inspect(${JSON.stringify(html)},'https://archive.example.org/gallery',${JSON.stringify(candidate)})`);assert.equal(sandbox.filter(i=>i.relation==='subject_caption_match').length,1);
});
test('source evidence rejects unsafe URLs, keeps file-path case and upgrades duplicate cover to a real image caption',()=>{
 const images=inspectPhotoSource('<meta property="og:image" content="/A.jpg"><img src="/A.jpg" alt="Subject portrait © A Name."><img src="/a.jpg" alt="Another frame"><img src="https://127.0.0.1/private.jpg" alt="No">','https://archive.example.org/gallery',{subject:'Subject portrait'});assert.equal(images.length,2);assert.equal(images[0].isCover,false);assert.equal(images[0].credit,'© A Name');assert.equal(inspectPhotoSource('x'.repeat(2500001),'https://archive.example.org/',{}).length,0);
});
test('execution evidence is identity-bound, preserves absent tool/cost measurements and omits incoming secrets',()=>{
 const raw=execution();const evidence=captureEditorialEvidence(raw,{workerId:'dev-worker',jobId:job,requestHash:'a'.repeat(64),candidate});assert.equal(evidence.selectionProposal.assetIds[0],'existing-image');assert.equal(evidence.sources[0].access,'source_text_captured');assert.equal(evidence.usage.inputTokens,170);assert.equal(evidence.usage.outputTokens,80);assert.equal(evidence.usage.price,null);assert.equal(evidence.usage.models[0].toolCalls,null);assert.ok(!JSON.stringify(evidence).includes('NEVER_EXPOSE'));
 assert.throws(()=>captureEditorialEvidence(raw,{workerId:'other',jobId:job,requestHash:'a'.repeat(64),candidate}),{code:'INVALID_ENGINE_RESULT'});
 const audit=assessEditorialPackage(candidate,evidence);assert.ok(audit.issues.some(i=>i.code==='AUDIENCE_PITCH_IN_CAPTION'));assert.ok(audit.issues.some(i=>i.code==='PHOTO_DATE_CONTEXT'));assert.ok(!audit.issues.some(i=>i.code==='INSUFFICIENT_RELATED_PHOTOGRAPHY'));
 const revised=assessEditorialPackage({...candidate,captionDraft:'A documentary photograph from Paris, 1974.'},evidence);assert.ok(!revised.issues.some(i=>i.code==='PHOTO_DATE_CONTEXT'));
});
test('200 maintenance pages and blocked pages are not treated as inspected factual evidence',()=>{
 const raw=execution();raw.data.resultData.runData['Check Source Links']=output([{statusCode:200,data:'<title>Site en maintenance</title><p>Temporary service.</p>'}]);const evidence=captureEditorialEvidence(raw,{workerId:'dev-worker',jobId:job,requestHash:'a'.repeat(64),candidate});assert.equal(evidence.sources[0].access,'access_unconfirmed');assert.equal(evidence.sources[0].humanFactVerification,false);
});

test('captured claim pages can add real source references without another fetch or misattributing institution copyright',()=>{
 const raw=execution();raw.data.resultData.runData['Check Source Links']=output([{statusCode:200,data:'<title>Design archive</title><img src="/drawing.jpg" alt="Sketch for actress Mira Sol in a 1967 film. © Design Museum / Tess Vale."><img src="/event.jpg" alt="Museum event poster"><img src="/building.jpg" alt="Museum building">'}]);
 const evidence=captureEditorialEvidence(raw,{workerId:'dev-worker',jobId:job,requestHash:'a'.repeat(64),candidate});assert.equal(evidence.additionalMedia.length,1);const image=evidence.images.find(i=>i.url.endsWith('/drawing.jpg'));assert.equal(image.materialType,'design_documentation');assert.equal(image.creator,'');assert.equal(image.credit,'© Design Museum / Tess Vale');assert.equal(evidence.additionalMedia[0].rightsStatus,'preview_unreviewed');assert.equal(evidence.selectionProposal.assetIds.length,1);
});

test('responsive CMS variants are grouped as references while different asset query identities remain separate',()=>{
 const variants='<img src="/images/_gallery_1/Sketch.jpg" alt="Mira Sol costume, 1967"><img src="/images/_gallery_4/Sketch.jpg" alt="Mira Sol costume, 1967"><img src="/photo?id=one&amp;width=400" alt="One"><img src="/photo?id=two&amp;width=400" alt="Two">';
 const images=inspectPhotoSource(variants,'https://archive.example.org/gallery',{subject:'Mira Sol'});assert.equal(images.length,3);assert.equal(images[0].referenceVariants.length,2);assert.equal(images[0].sameImageVerified,false);assert.equal(images[0].duplicateBasis,'source_file_reference_variant');assert.ok(images.some(m=>m.url.includes('id=one')));assert.ok(images.some(m=>m.url.includes('id=two')));
});

test('lazy archive images recover single-figure captions/credits while script decoys and shared captions cannot invent identity',()=>{
 const page='https://archive.example.org/gallery';const context={id:'DEV-fixture',subject:'Mira Sol (1967)'};
 const html='<script>const fake="<img src=\"/fake.jpg\" alt=\"Mira Sol 1967\">";</script><figure><img src="data:image/gif;base64,AA" data-lazy-src="/portrait.jpg" width="1" height="1" alt="Image"><figcaption>Mira Sol in Paris, 1974. © Alex Vale.</figcaption></figure><figure><img src="/group-a.jpg" alt="Image 1"><img src="/group-b.jpg" alt="Image 2"><figcaption>Mira Sol at an event, 1967. © Alex Vale.</figcaption></figure>';
 const images=inspectPhotoSource(html,page,context);assert.equal(images.length,3);assert.ok(!images.some(m=>m.url.endsWith('fake.jpg')));const portrait=images.find(m=>m.url.endsWith('portrait.jpg'));assert.equal(portrait.captionBasis,'figure_caption');assert.deepEqual(portrait.years,[1974]);assert.equal(portrait.creator,'');assert.equal(portrait.copyrightHolder,'Alex Vale');assert.equal(portrait.relation,'subject_caption_match');assert.ok(images.filter(m=>m.url.includes('group-')).every(m=>m.relation==='context_only'));
});
test('linked captions and picture fallbacks are supported without replacing established image-reference identities',()=>{
 const page='https://archive.example.org/gallery';const images=inspectPhotoSource('<figure><picture><source type="image/webp" srcset="/images/_gallery_4/Sketch.jpg 1600w"><img src="/images/_gallery_1/Sketch.jpg" aria-describedby="caption"></picture></figure><p id="caption">Mira Sol costume sketch, 1967. © Design Museum.</p><figure><picture><source type="image/webp" data-srcset="/second.webp 2x"><img src="data:image/gif;base64,AA" alt="Mira Sol portrait, 1974"></picture></figure>',page,{subject:'Mira Sol'});
 assert.equal(images.length,2);assert.equal(images[0].url,'https://archive.example.org/images/_gallery_1/Sketch.jpg');assert.equal(images[0].referenceVariants.length,2);assert.equal(images[0].captionBasis,'linked_caption');assert.equal(images[0].creator,'');assert.equal(images[1].url,'https://archive.example.org/second.webp');assert.equal(images[1].rightsGranted,false);
});

test('noscript photograph fallbacks preserve the original reference when a lazy responsive duplicate follows',()=>{
 const page='https://archive.example.org/gallery';const images=inspectPhotoSource('<noscript><img src="/images/_gallery_1/Photo.jpg" alt="Mira Sol, 1974"></noscript><img data-srcset="/images/_gallery_4/Photo.jpg 1600w, /images/_gallery_1/Photo.jpg 250w" alt="Mira Sol, 1974">',page,{subject:'Mira Sol'});assert.equal(images.length,1);assert.equal(images[0].url,page.replace('/gallery','')+'/images/_gallery_1/Photo.jpg');assert.equal(images[0].referenceVariants.length,2);
});

test('courtesy credit remains source credit and never becomes a claimed photographer',()=>{
 const [image]=inspectPhotoSource('<figure><img src="/portrait.jpg"><figcaption>Mira Sol today. Photo: Courtesy Mira Sol.</figcaption></figure>','https://archive.example.org/article',{subject:'Mira Sol'});assert.equal(image.credit,'Photo: Courtesy Mira Sol');assert.equal(image.creator,'');
});

test('explicit image credits and series trails stay bound to a single photograph, separate from copyright and article bylines',()=>{
 const page='https://publication.example/photography/night-market';
 const html='<p>Article by <a href="/writers/visitor">Unrelated Writer</a></p><figure><img src="/frame-one.jpg" alt="A local scene"><figcaption>Night market study. Photography by <a href="https://photographer.example/portfolio">Noor Lens</a>. From the series <a href="/projects/night-market">After Hours</a>. © Independent Publication.</figcaption></figure><figure><img src="/frame-two.jpg"><img src="/frame-three.jpg"><figcaption>Photography by <a href="/group-credit">Shared unknown credit</a>.</figcaption></figure>';
 const images=inspectPhotoSource(html,page,{subject:'Night market study'});const one=images[0];
 assert.equal(one.creator,'Noor Lens');assert.equal(one.creatorBasis,'explicit_source_photo_credit');assert.equal(one.creatorVerified,false);assert.equal(one.copyrightHolder,'Independent Publication');assert.equal(one.seriesReference.label,'After Hours');assert.equal(one.seriesReference.url,'https://publication.example/projects/night-market');assert.deepEqual(one.researchLinks.map(l=>l.kind),['photographer','series']);assert.ok(one.researchLinks.every(l=>l.verified===false));assert.ok(images.slice(1).every(m=>m.creator===''&&m.researchLinks.length===0));assert.ok(!JSON.stringify(images).includes('Unrelated Writer'));
 const vmImages=vm.runInNewContext(`(${photoEvidenceTools.toString()})(${safePhotoReference.toString()}).inspect(${JSON.stringify(html)},${JSON.stringify(page)},{subject:'Night market study'})`);assert.equal(vmImages[0].seriesReference.url,one.seriesReference.url);
});
test('a copyright owner is not asserted as photographer and unsafe caption trails cannot become research links',()=>{
 const [image]=inspectPhotoSource('<figure><img src="/portrait.jpg"><figcaption>Local portrait. © A Person. From the series <a href="https://127.0.0.1/private">Private page</a>. Photography by <a href="javascript:alert(1)">Unverified Name</a>.</figcaption></figure>','https://publication.example/article',{subject:'Local portrait'});
 assert.equal(image.researchLinks.length,0);assert.equal(image.creatorBasis,'explicit_source_photo_credit');assert.equal(image.creatorVerified,false);assert.equal(image.rightsGranted,false);
 const [copyrightOnly]=inspectPhotoSource('<img src="/frame.jpg" alt="A local study © A Person.">','https://publication.example/article',{});assert.equal(copyrightOnly.creator,'');assert.equal(copyrightOnly.copyrightHolder,'A Person');assert.equal(copyrightOnly.creatorBasis,'copyright_holder_only');
});
test('bounded source scans retain late related frames, disclose truncation and do not suppress an explicitly captioned series',()=>{
 const page='https://publication.example/series';const gallery=Array.from({length:55},(_,i)=>'<img src="/frame-'+i+'.jpg" alt="'+(i>=51?'Night Market study':'A different image')+'">').join('');
 const images=inspectPhotoSource(gallery,page,{subject:'Night Market study'});assert.equal(images.length,40);assert.equal(images.filter(i=>i.relation==='subject_caption_match').length,4);assert.equal(images[0].captureCoverage.referenceCount,55);assert.equal(images[0].captureCoverage.retainedCount,40);assert.equal(images[0].captureCoverage.completeShootVerified,false);
 const series=inspectPhotoSource(Array.from({length:28},(_,i)=>'<img src="/series-'+i+'.jpg" alt="Night Market study">').join(''),page,{subject:'Night Market study'});assert.equal(series.length,28);assert.ok(series.every(m=>m.relation==='subject_caption_match'));assert.equal(series[0].pixelAnalysisPerformed,false);
 const [truncated]=inspectPhotoSource('<img src="/one.jpg">'+' '.repeat(300001),page,{});assert.equal(truncated.captureCoverage.pageTruncated,true);
});
