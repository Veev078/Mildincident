import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {publicSourceAddress,readPublicSource,resolvePublicSource} from '../src/photography/public-source-transport.js';
import {automaticPhotoPlan,permittedProjectPage,projectPageReferences,fetchProjectPage,supportedProjectPage} from '../src/photography/project-sources.js';
import {permittedSourceImage,readSourceImage,acquireReceiptImage} from '../src/photography/source-images.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {LocalPreviewStore} from '../src/workspace/previews.js';
import {PhotographyService} from '../src/photography/service.js';

const source='https://unfamiliar-publisher.example/features/test-maker-project';
const cdn='https://media.unfamiliar-cdn.example/test-project.jpg';
const html=(image=cdn)=>`<html><h1>Test Maker, Test Project</h1><figure><img src="${image}" width=1300 height=1700><figcaption>Test Maker, Test Project. Photograph by Test Maker.</figcaption></figure></html>`;
const story=()=>({id:'CON-public-source-test',revision:'r1',subject:'Test Maker, Test Project',caption:'Founder writing remains.',research:[{url:source,capturedAccess:'source_text_captured',capturedTextExcerpt:'Test Maker made Test Project.'}],media:[],selectedAssetIds:[],localDraft:{version:0,selectedAssetIds:[]}});
const prepare=s=>({idempotencyKey:randomUUID(),sourceRevision:s.revision,workingVersion:s.localDraft.version,direction:'best'}),confirm=s=>({confirm:true,sourceRevision:s.revision,workingVersion:s.localDraft.version});
const publicDns=async()=>[{address:'93.184.216.34',family:4}];
const response=(body='fixture',{status=200,headers={}}={})=>new Response(body,{status,headers:{'content-type':'text/html',...headers}});
const readOptions={accept:'text/html',maxBytes:2000,lookupImpl:publicDns};
async function setup(t,options={}){const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-public-sources-')),research=new LocalResearchStore(root+'/research.sqlite'),previews=new LocalPreviewStore(root+'/previews'),service=new PhotographyService(research,{previews,...options});t.after(async()=>{research.close();previews.close();await fs.rm(root,{recursive:true,force:true});});return {service,research,previews};}

test('public source DNS rejects private, mixed, mapped, reserved and transition addresses',async()=>{
 for(const address of ['0.0.0.0','10.1.2.3','127.0.0.1','169.254.169.254','172.31.1.1','192.168.1.1','100.64.2.1','198.18.0.1','192.0.2.4','198.51.100.4','203.0.113.4','224.0.0.2','255.255.255.255','::1','::','::ffff:127.0.0.1','::ffff:8.8.8.8','fc00::1','fe80::1','2001:db8::1','2001::1','2001:20::1','2002:0808:0808::1'])assert.equal(publicSourceAddress(address),false,address);
 for(const address of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111','2001:4860:4860::8888'])assert.equal(publicSourceAddress(address),true,address);
 await assert.rejects(resolvePublicSource('bound.example',{lookupImpl:async()=>[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]}),{code:'SOURCE_NONPUBLIC_ADDRESS'});
});

test('transport pins the checked address per hop and drops cookies, auth and referrer',async()=>{
 const requests=[],resolved=[];
 const result=await readPublicSource(source,{...readOptions,lookupImpl:async host=>{resolved.push(host);return publicDns();},requestImpl:async(url,options)=>{requests.push({url,options});return requests.length===1?response(null,{status:302,headers:{location:'/moved/test-project','set-cookie':'session=fixture'}}):response('fixture html');}});
 assert.equal(result.bytes.toString(),'fixture html');assert.equal(result.transport.requests,2);assert.equal(result.transport.networkValidation,'public_dns_pinned_socket');assert.deepEqual(resolved,['unfamiliar-publisher.example','unfamiliar-publisher.example']);
 for(const {options}of requests){assert.deepEqual(options.address,{address:'93.184.216.34',family:4});assert.deepEqual(Object.keys(options.headers).sort(),['Accept','Accept-Encoding','User-Agent']);assert(!options.headers.Cookie);assert(!options.headers.Authorization);assert(!options.headers.Referer);}
});

test('rebindings, unbound CDN redirects, credentials and ports stop before the next request',async()=>{
 let calls=0,dns=0;
 await assert.rejects(readPublicSource(source,{...readOptions,lookupImpl:async()=>++dns===1?publicDns():[{address:'127.0.0.1',family:4}],requestImpl:async()=>{calls++;return response(null,{status:302,headers:{location:'/redirected'}});}}),{code:'SOURCE_NONPUBLIC_ADDRESS'});assert.equal(calls,1);
 for(const target of ['https://unbound-cdn.example/frame.jpg','https://127.0.0.1/private','https://name:pass@public.example/frame','https://public.example:8443/frame']){
  calls=0;await assert.rejects(readPublicSource(source,{...readOptions,requestImpl:async()=>{calls++;return response(null,{status:302,headers:{location:target}});}}));assert.equal(calls,1,target);
 }
 for(const target of ['https://127.0.0.1/private','https://[::ffff:127.0.0.1]/private','https://name:pass@public.example/frame','https://public.example:8443/frame','https://public.example/frame?signature=private']){
  await assert.rejects(readPublicSource(target,{...readOptions,requestImpl:()=>assert.fail('Unsafe syntax reached network')}),{code:'SOURCE_UNSAFE_URL'});
 }
});

test('redirect destinations need exact retained binding and every hop stays independently verified',async()=>{
 const destination='https://maker.other.example/projects/test-project',seen=[];
 const result=await readPublicSource(source,{...readOptions,allowedRedirectUrls:[destination],requestImpl:async url=>{seen.push(url);return url===source?response(null,{status:301,headers:{location:destination}}):response('exact bound destination');}});
 assert.deepEqual(seen,[source,destination]);assert.equal(result.transport.finalUrl,destination);
 let calls=0;await assert.rejects(readPublicSource(source,{...readOptions,requestImpl:async()=>response(null,{status:302,headers:{location:'/next-'+(++calls)}})}),{code:'SOURCE_REDIRECT_LIMIT'});assert.equal(calls,3);
});

test('size, streaming, timeout and proxy failures are bounded without retries',async()=>{
 for(const body of [response('x',{headers:{'content-length':'2001'}}),{status:200,headers:new Headers({'content-type':'text/html'}),body:(async function*(){yield Buffer.alloc(1000);yield Buffer.alloc(1001);})()}])await assert.rejects(readPublicSource(source,{...readOptions,requestImpl:async()=>body}),{code:'SOURCE_TOO_LARGE'});
 await assert.rejects(readPublicSource(source,{...readOptions,requestImpl:async()=>response('short',{headers:{'content-length':'10'}})}),{code:'SOURCE_SIZE_CHANGED'});
 await assert.rejects(readPublicSource(source,{...readOptions,requestImpl:async()=>response('zipped',{headers:{'content-encoding':'gzip'}})}),{code:'SOURCE_ENCODED_RESPONSE'});
 await assert.rejects(readPublicSource(source,{...readOptions,timeoutMs:5,lookupImpl:()=>new Promise(resolve=>setTimeout(()=>resolve([{address:'8.8.8.8',family:4}]),20)),requestImpl:()=>assert.fail('Timed-out DNS reached network')}),/SOURCE_TIMEOUT/);
 await assert.rejects(readPublicSource(source,{...readOptions,proxyConfigured:true,lookupImpl:()=>assert.fail('Proxy limitation must stop before DNS')}),{code:'SOURCE_PINNED_TRANSPORT_UNAVAILABLE'});
});

test('unfamiliar retained research connects while unrecorded and generic catalogue/search pages do not',()=>{
 const s=story(),plan=automaticPhotoPlan(s);assert.equal(plan.source,'project');assert.equal(plan.route,'retained_project_page');assert.equal(plan.sourceCalls,2);assert.equal(plan.sourceConnectionPolicy,'evidence_bound_public_v1');assert.equal(plan.sourceConnections.length,0);assert(permittedProjectPage(s,source));assert(!permittedProjectPage(s,source+'/invented'));
 for(const target of ['https://publisher.example/search?q=Test','https://publisher.example/category/art','https://publisher.example/collections/','https://publisher.example/tag/test-project','https://www.linkedin.com/posts/test-maker'])assert.equal(supportedProjectPage(target),false,target);
 s.research=[{url:'https://www.loc.gov/item/1234'}];assert.equal(automaticPhotoPlan(s).source,'loc');
});

test('standalone picture/lazy metadata and individual schema ImageObject retain specific evidence',()=>{
 const markup=`<h1>Test Maker, Test Project</h1><picture><source type="image/avif" srcset="/unsupported.avif 2x"><source type="image/jpeg" data-lazy-srcset="${cdn}?w=500 500w, ${cdn}?w=1600 1600w"><img src="data:image/gif;base64,AA" width=1 height=1 alt="Test Maker, Test Project"></picture><img data-original-src="/second.jpg" alt="A different project"><script type="application/ld+json">{"@type":"https://schema.org/ImageObject","contentUrl":"/third.jpg","caption":"Test Maker, Test Project. Photograph by Test Maker."}</script>`;
 const parsed=projectPageReferences(story(),{url:source,html:markup,basis:'founder_supplied_saved_page'});assert(parsed.photos.some(p=>p.previewUrl===cdn+'?w=1600'));assert(parsed.photos.some(p=>p.previewUrl.endsWith('/second.jpg')&&!p.description.includes('Test Maker')));assert(parsed.photos.some(p=>p.previewUrl.endsWith('/third.jpg')&&p.creator==='Test Maker'));assert.equal(parsed.sourceCapture.networkFetched,false);
});

test('captured unfamiliar CDN files decode locally with intact provenance and survive restart',async t=>{
 const trail='https://maker.other.example/projects/test-project',second='https://pictures.other-cdn.example/test-project-detail.jpg',pages=[],images=[];
 const generated=await sharp({create:{width:360,height:480,channels:3,background:{r:60,g:120,b:180}}}).jpeg().toBuffer();
 const {service,research,previews}=await setup(t,{readProjectPage:async(s,url)=>{pages.push(url);assert(permittedProjectPage(s,url));return html(url===source?cdn:second)+(url===source?`<p>Test Maker, Test Project. <a href="${trail}">artist website</a></p>`:'');},fetchImage:async url=>{images.push(url);return response(generated,{headers:{'content-type':'image/jpeg'}});},retrieve:()=>assert.fail('No generic archive fallback')});
 const s=story(),before=JSON.stringify(s),request=service.prepareDiscovery(s,prepare(s)),result=await service.searchStoryRequest(s,request.id,confirm(s));assert.deepEqual(pages,[source,trail]);assert.deepEqual(images,[cdn,second]);assert.equal(result.decodedImageCount,1);assert.equal(result.pixelDuplicateCount,1);assert.equal(result.acquisitionSummary.newDecodedPhotographs,1);assert.equal(JSON.stringify(s),before);
 const retained=service.storyRequest(request.id),photo=retained.receipt.photos[0],capture=retained.sourceCaptures.find(c=>c.url===photo.sourceUrl);assert(permittedSourceImage(capture.url,photo.previewUrl,capture));assert(!permittedSourceImage(capture.url,'https://injected.example/never-embedded.jpg',capture));assert(!permittedSourceImage(capture.url,photo.previewUrl,{...capture,html:capture.html+'changed'}));
 const asset=service.storyMedia(s)[0],stored=previews.get(s.id,asset.id);assert.equal(stored.originalWidth,360);assert.equal(stored.originalSha256,createHash('sha256').update(generated).digest('hex'));assert.equal(stored.sourceInspection.pageSha256,capture.sha256);assert.equal(result.imageAttempts[0].transport.networkValidation,'injected_test_transport');
 const restarted=new PhotographyService(research,{previews,readProjectPage:()=>assert.fail('No replay network'),fetchImage:()=>assert.fail('No replay network')});await restarted.searchStoryRequest(s,request.id,confirm(s));assert.equal(restarted.storyRequestsFor(s)[0].decodedImageCount,1);assert.equal(JSON.stringify(s),before);
 const forged={...photo,previewUrl:'https://injected.example/never-embedded.jpg'};await assert.rejects(acquireReceiptImage({story:s,request:retained,photo:forged,store:previews,fetchImpl:()=>assert.fail('Unembedded image fetched')}),{code:'PHOTO_IMAGE_NOT_BOUND'});
});

test('page redirect bases stay attached to original source identity and image redirects cannot invent CDN links',async()=>{
 const s=story(),page=await fetchProjectPage(s,source,{withEvidence:true,fetchImpl:async url=>url===source?response(null,{status:301,headers:{location:'/moved/project/'}}):response(html('frame.jpg'))});
 const parsed=projectPageReferences(s,{url:source,html:page.html,transport:page.transport});assert.equal(parsed.photos[0].sourceUrl,source);assert.equal(parsed.photos[0].previewUrl,'https://unfamiliar-publisher.example/moved/project/frame.jpg');assert.equal(parsed.sourceCapture.transport.initialUrl,source);
 await assert.rejects(readSourceImage(cdn,{fetchImpl:async()=>response(null,{status:302,headers:{location:'https://other-cdn.example/not-in-capture.jpg'}})}),{code:'SOURCE_REDIRECT_NOT_BOUND'});
 await assert.rejects(readSourceImage(cdn,{fetchImpl:async()=>response(null,{status:302,headers:{location:'/not-in-capture.jpg'}})}),{code:'SOURCE_REDIRECT_NOT_BOUND'});
});
