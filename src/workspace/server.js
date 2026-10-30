import {buildWorkspace,WORKSPACE_TABLES} from './model.js';
import {possibleVariants} from '../photography/fingerprint.js';
import {PhotographyService} from '../photography/service.js';
import {FounderReviewStore,founderFollowUp} from './founder-review.js';
import {PublicationFeeds} from '../discovery/publication-feeds.js';
import {productionDecisions} from './production-decisions.js';
import {validatePacketImport} from '../production-packet-contract.js';
import {prepareProductionPacket} from './production-bridge.js';
import {assessStudioReadiness,imageEvidenceState} from '../editorial-readiness.js';
import {buildSourceSequencePlan} from '../editorial-sequence.js';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDiscoveryDesk } from '../editorial-discovery.js';
import { WorkspaceSource } from './data-source.js';
import { loadEditorialEngineClient } from './editorial-engine-client.js';
import { EditorialEngineService } from './editorial-engine-service.js';
import { developmentCandidateStory } from './development-story.js';
import { LocalResearchStore } from './research-store.js';
import { LocalDraftStore } from './store.js';
import { HandoffError, requireThat } from '../errors.js';
import { LocalPreviewStore, attachLocalPreviews, MAX_PREVIEW_BYTES } from './previews.js';

const WEB_ROOT = fileURLToPath(new URL('../../web/', import.meta.url));
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function body(request,maxSize=128*1024) {
  requireThat(String(request.headers['content-type'] || '').split(';')[0] === 'application/json', 'JSON_REQUIRED', 'Use application/json for local edits.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    requireThat(size <= maxSize, 'BODY_TOO_LARGE', 'Local request exceeds its permitted size.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HandoffError('INVALID_JSON', 'Request body is not valid JSON.'); }
}

async function imageBody(request) {
  const length = Number(request.headers['content-length']);
  requireThat(!Number.isFinite(length) || length <= MAX_PREVIEW_BYTES, 'INVALID_PREVIEW_FILE', 'Image exceeds 25 MiB.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    requireThat(size <= MAX_PREVIEW_BYTES, 'INVALID_PREVIEW_FILE', 'Image exceeds 25 MiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createWorkspaceServer({ source, drafts, previews, research, engine, photography=research?new PhotographyService(research):null, founderReviews=research?new FounderReviewStore(research):null, feeds=research?new PublicationFeeds(research):null, webRoot = WEB_ROOT }) {
  const view = () => {
    const workspace = source.snapshot?source.view(drafts.all()):buildWorkspace({records:Object.fromEntries(Object.keys(WORKSPACE_TABLES).map(k=>[k,[]])),buffer:{posts:[],complete:false,observedAt:null},observedAt:new Date().toISOString(),warnings:[]});
    if(!source.snapshot)workspace.source={...workspace.source,kind:'disconnected',observedAt:null,bufferObservedAt:null,stale:true,unavailable:true,warnings:['No authoritative production snapshot is available. Private photographic research remains usable; connect n8n/Buffer or restore your private backup to inspect existing stories.'],refreshError:{code:'SOURCE_UNAVAILABLE',message:'Production observations unavailable; no example stories were substituted.'}};
    workspace.researchRequests = research?.all() || [];
    workspace.engine = engine?.status() || {configured:false,generationAvailable:false,generationApproved:false,workerActive:false};
    for (const request of workspace.researchRequests) for (const candidate of request.engineJob?.candidates || []) {
      const story = developmentCandidateStory(candidate,{soundtrack:source.snapshot?.records?.soundtrack || [],drafts:drafts.all(),continuation:request.continuation||request.engineJob.editorialContext?.continuation||null,decision:request.engineJob.reviewDecisions?.[candidate.id]||null,evidence:request.engineJob.evidence?.[candidate.id]||null});
      requireThat(!workspace.stories.some(s=>s.id===story.id),'AMBIGUOUS_ENGINE_RESULT','Development story identity collides with an existing record.');
      story.engineReviewVersion=request.engineJob.version;
      story.recoveredHistory=request.engineJob.recoveredHistory===true;
      workspace.stories.push(story);
    }
    attachLocalPreviews(workspace,previews);
    for (const story of workspace.stories) { story.visualVariants=possibleVariants(story.media);story.sourceSequencePlan = buildSourceSequencePlan(story); for(const asset of story.media)asset.inspection=imageEvidenceState(asset); story.readiness=assessStudioReadiness(story);const packet=prepareProductionPacket(story);story.productionDecisions=productionDecisions(story);story.productionPreparation={nativeImportCheck:packet.nativeImportCheck,...packet.readiness,digest:packet.digest,identity:packet.identity}; }
    workspace.photoHunts=photography?.all()||[];
    workspace.founderReviews=founderReviews?.all()||{};
    workspace.sourceInputs={publications:feeds?.status()||[],leads:feeds?.list()||[]};
    workspace.discovery = buildDiscoveryDesk(workspace.stories);
    workspace.researchHandoffAvailable = Boolean(research);
    return workspace;
  };
  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'");
    try {
      // A loopback listener plus Host/Origin checks protects local draft APIs from DNS rebinding/CSRF.
      const expectedHost = `127.0.0.1:${request.socket.localPort}`;
      requireThat(request.headers.host === expectedHost || request.headers.host === `localhost:${request.socket.localPort}`, 'INVALID_HOST', 'This workspace accepts only its local origin.');
      const origin = `http://${request.headers.host}`;
      if (request.headers.origin) requireThat(request.headers.origin === origin, 'INVALID_ORIGIN', 'Cross-origin access is not permitted.');
      const url = new URL(request.url, origin);
      if (['POST', 'PATCH'].includes(request.method)) {
        requireThat(request.headers['x-mildincident-intent'] === 'local-edit', 'INTENT_REQUIRED', 'An explicit local-edit intent is required.');
      }
      if (url.pathname === '/api/health' && request.method === 'GET') {
        json(response, 200, { status: 'ok', mode: 'local_editorial_workspace', productionMutationsEnabled: false, sourceAvailable: Boolean(source.snapshot), refreshing: Boolean(source.inflight) }); return;
      }
      if(url.pathname==='/api/discovery/sources/refresh'&&request.method==='POST'){requireThat(feeds,'RESEARCH_UNAVAILABLE','Publication intake is unavailable.');requireThat(Object.keys(await body(request)).length===0,'INVALID_SOURCE_REQUEST','Only configured publication feeds may be read.');await feeds.refresh();json(response,200,{sourceInputs:{publications:feeds.status(),leads:feeds.list()},paidCalls:0,productionApplied:false});return;}
      const continuationRoute=url.pathname.match(/^\/api\/stories\/([^/]+)\/photo-research$/);
      if(continuationRoute&&request.method==='POST'){requireThat(research,'RESEARCH_UNAVAILABLE','Private research is unavailable.');const input=await body(request),workspace=view(),story=workspace.stories.find(s=>s.id===decodeURIComponent(continuationRoute[1]));const saved=research.createPhotoContinuation(story,input,workspace.stories);json(response,201,{request:saved,scope:'private_research_only',networkRequests:0,paidCalls:0,productionApplied:false});return;}
      const founderRoute=url.pathname.match(/^\/api\/editorial\/reviews\/([^/]+)$/);
      if(founderRoute&&request.method==='POST'){requireThat(founderReviews,'RESEARCH_UNAVAILABLE','Private review is unavailable.');const workspace=view(),story=workspace.stories.find(s=>s.id===decodeURIComponent(founderRoute[1]));let followUp=null;const review=founderReviews.record(story,await body(request),{afterSave:value=>{const direction=founderFollowUp(story,value);if(direction)followUp=research.create(direction,workspace.stories);}});json(response,200,{review,followUp,productionApplied:false,publicationApproved:false});return;}
      if(url.pathname==='/api/photography/hunts'&&request.method==='POST'){requireThat(photography,'RESEARCH_UNAVAILABLE','Private research is unavailable.');const input=await body(request);photography.indexNative(source.snapshot);const hunt=photography.create(input);json(response,201,{hunt,productionApplied:false});return;}
      if(url.pathname==='/api/photography/references'&&request.method==='POST'){requireThat(photography,'RESEARCH_UNAVAILABLE','Private research is unavailable.');json(response,201,photography.saveReference(await body(request)));return;}
      const nativePhotoRoute=url.pathname.match(/^\/api\/photography\/hunts\/([a-f0-9-]{36})\/n8n-packet$/);
      if(nativePhotoRoute&&request.method==='POST'){requireThat(photography,'RESEARCH_UNAVAILABLE','Private research is unavailable.');json(response,200,{packet:photography.exportNative(nativePhotoRoute[1],await body(request)),productionApplied:false});return;}
      if(url.pathname==='/api/photography/n8n-results'&&request.method==='POST'){requireThat(photography,'RESEARCH_UNAVAILABLE','Private research is unavailable.');json(response,200,photography.importNative(await body(request,512*1024)));return;}
      const photoRoute=url.pathname.match(/^\/api\/photography\/(hunts|decisions)\/([^/]+)$/);
      if(photoRoute&&photoRoute[1]==='hunts'&&request.method==='GET'){requireThat(photography,'RESEARCH_UNAVAILABLE','Private research is unavailable.');json(response,200,{hunt:photography.get(decodeURIComponent(photoRoute[2]),Number(url.searchParams.get('offset')||0))});return;}
      if(photoRoute&&request.method==='POST'){requireThat(photography,'RESEARCH_UNAVAILABLE','Private research is unavailable.');const input=await body(request),id=decodeURIComponent(photoRoute[2]);if(photoRoute[1]==='decisions'){json(response,200,photography.decide(id,input));return;}const hunt=await photography.resume(id,input.pages??1);json(response,200,{hunt,productionApplied:false,rightsGranted:false});return;}
      if (url.pathname === '/api/workspace' && request.method === 'GET') { json(response, 200, view()); return; }
      if (url.pathname === '/api/research/requests' && request.method === 'POST') {
        requireThat(research, 'RESEARCH_UNAVAILABLE', 'The private research request store is unavailable.');
        const input = await body(request); const workspace = view();
        json(response, 201, { request: research.create(input, workspace.stories), scope: 'local_only', productionApplied: false }); return;
      }
      if (url.pathname === '/api/research/engine/refresh' && request.method === 'POST') {
        requireThat(engine,'ENGINE_NOT_CONFIGURED','Private development engine connection is unavailable.');
        json(response,200,{engine:await engine.refresh(),productionApplied:false});return;
      }
      const engineMatch=url.pathname.match(/^\/api\/research\/requests\/([a-f0-9-]{36})\/engine\/(queue|start|review|evidence)$/);
      if(engineMatch && request.method==='POST'){
        requireThat(engine,'ENGINE_NOT_CONFIGURED','Private development engine connection is unavailable.');
        const input=await body(request);let job;
        if(engineMatch[2]==='queue'){requireThat(input&&Object.keys(input).length===0,'INVALID_RESEARCH_REQUEST','Queue requires only a saved request identity.');job=await engine.queue(engineMatch[1]);}
        else if(engineMatch[2]==='start'){requireThat(input&&Object.keys(input).every(k=>k==='expectedVersion'),'INVALID_RESEARCH_REQUEST','Unsupported start fields.');job=await engine.start(engineMatch[1],input.expectedVersion);}
        else if(engineMatch[2]==='evidence'){requireThat(Object.keys(input).length===0,'INVALID_RESEARCH_REQUEST','Evidence inspection takes no caller URLs or execution IDs.');job=await engine.captureEvidence(engineMatch[1]);}
        else job=engine.review(engineMatch[1],input);
        json(response,engineMatch[2]==='start'?202:200,{job,scope:'development_only',productionApplied:false});return;
      }
      const requestMatch = url.pathname.match(/^\/api\/research\/requests\/([a-f0-9-]{36})\/events$/);
      if (requestMatch && request.method === 'POST') {
        requireThat(research, 'RESEARCH_UNAVAILABLE', 'The private research request store is unavailable.');
        const input = await body(request); const workspace = view();
        json(response, 200, { request: research.event(requestMatch[1], input, workspace.stories), scope: 'local_only', productionApplied: false }); return;
      }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        source.refresh().catch(() => {}); // Failure is exposed by next workspace read, never logged with secrets.
        json(response, 202, { refreshing: true, productionChanges: 0 }); return;
      }
      const previewMatch = url.pathname.match(/^\/api\/stories\/(CON-[A-Za-z0-9_-]{1,120})\/assets\/([^/]{1,1200})\/(preview|review)$/);
      if (previewMatch) {
        requireThat(previews, 'PREVIEW_UNAVAILABLE', 'The private preview store is unavailable.');
        const storyId = previewMatch[1];
        let assetId;
        try { assetId = decodeURIComponent(previewMatch[2]); } catch { throw new HandoffError('INVALID_PREVIEW_SCOPE', 'Invalid image reference.'); }
        const findAsset = () => {
          const story = view().stories.find(s => s.id === storyId);
          requireThat(story && story.media.filter(m => m.id === assetId).length === 1, 'STORY_NOT_FOUND', 'An exact existing story/image record is required.');
        };
        findAsset();
        if (previewMatch[3] === 'review') {
          requireThat(request.method === 'POST', 'METHOD_NOT_ALLOWED', 'Use the local review action.');
          const input = await body(request); findAsset();
          json(response, 200, { review: previews.saveReview(storyId, assetId, input), scope: 'local_only', rightsGranted: false, productionApplied: false }); return;
        }
        if (request.method === 'GET') {
          const result = await previews.readPreview(storyId, assetId, url.searchParams.get('hash') ?? undefined);
          response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': result.bytes.length,
            'Cache-Control': url.searchParams.has('hash') ? 'private, max-age=300, immutable' : 'no-store',
            'Content-Disposition': 'inline; filename="private-review-preview.jpg"' });
          response.end(result.bytes); return;
        }
        if (request.method === 'POST') {
          requireThat(request.headers['x-mildincident-preview-declaration'] === 'private_review_only', 'PREVIEW_DECLARATION_REQUIRED', 'Confirm private review only; an upload does not prove provenance or rights.');
          const bytes = await imageBody(request);
          findAsset(); // Source may have refreshed while the file was uploaded.
          let originalName;
          try { originalName = decodeURIComponent(String(request.headers['x-mildincident-filename'] || 'private-review-image')); }
          catch { throw new HandoffError('INVALID_PREVIEW_NAME', 'The file name is not valid.'); }
          const preview = await previews.save({ storyId, assetId, bytes, originalName,
            contentType: String(request.headers['content-type'] || '').split(';')[0], declaration: request.headers['x-mildincident-preview-declaration'] });
          json(response, 200, { assetId, preview, scope: 'local_only', rightsGranted: false, productionApplied: false }); return;
        }
      }
      const match = url.pathname.match(/^\/api\/stories\/(CON-[A-Za-z0-9_-]{1,120})(?:\/(draft|proposal|production-packet(?:\/check)?|draft\/history|draft\/rebase))?$/);
      if (match) {
        const [, id, operation] = match;
        const story = view().stories.find(s => s.id === id);
        requireThat(story, 'STORY_NOT_FOUND', 'Existing story was not found in the source snapshot.');
        if (!operation && request.method === 'GET') { json(response, 200, story); return; }
        if (operation === 'draft' && request.method === 'PATCH') {
          const input = await body(request);
          const current = view().stories.find(s => s.id === id);
          requireThat(current, 'STORY_NOT_FOUND', 'Story was removed from the source snapshot.');
          const draft = drafts.save(current, input);
          const updated = view().stories.find(s => s.id === id);
          json(response, 200, { draft: { ...draft, stale: false }, intelligence: updated.intelligence, musicRecommendations: updated.musicRecommendations, editorialDirection: updated.editorialDirection, editorialAudit:updated.editorialAudit, readiness:updated.readiness, sourceSequencePlan:updated.sourceSequencePlan, productionPreparation:updated.productionPreparation, productionDecisions:updated.productionDecisions, scope: 'local_only', productionApplied: false }); return;
        }
        if (operation === 'draft/history' && request.method === 'GET') { json(response, 200, { versions: drafts.history(id), scope: 'local_only' }); return; }
        if (operation === 'draft/rebase' && request.method === 'POST') {
          const input = await body(request);
          const current = view().stories.find(s => s.id === id);
          requireThat(current, 'STORY_NOT_FOUND', 'Story was removed from the source snapshot.');
          const draft = drafts.rebase(current, input);
          const updated = view().stories.find(s => s.id === id);
          json(response, 200, { draft: { ...draft, stale: false }, intelligence: updated.intelligence, musicRecommendations: updated.musicRecommendations, editorialDirection: updated.editorialDirection, editorialAudit:updated.editorialAudit, readiness:updated.readiness, sourceSequencePlan:updated.sourceSequencePlan, productionPreparation:updated.productionPreparation, productionDecisions:updated.productionDecisions, scope: 'local_only', productionApplied: false }); return;
        }
        if(operation==='production-packet/check'&&request.method==='POST'){const input=await body(request);const current=view().stories.find(s=>s.id===id);requireThat(current,'STORY_NOT_FOUND','Story is no longer available.');json(response,200,validatePacketImport(input.packet,prepareProductionPacket(current)));return;}
        if(operation==='production-packet'&&request.method==='GET'){response.setHeader('Content-Disposition',`attachment; filename="${id}-production-review.json"`);json(response,200,prepareProductionPacket(story));return;}
        if (operation === 'proposal' && request.method === 'GET') {
          response.setHeader('Content-Disposition', `attachment; filename="${id}-local-proposal.json"`);
          json(response, 200, drafts.proposal(story)); return;
        }
      }
      if (url.pathname.startsWith('/api/')) { json(response, 404, { error: { code: 'API_NOT_FOUND', message: 'This action is not implemented. No production changes were made.' } }); return; }
      if (!['GET', 'HEAD'].includes(request.method)) { json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported operation.' } }); return; }
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      requireThat(!pathname.includes('..') && !pathname.includes('\\') && !pathname.includes('\0'), 'INVALID_PATH', 'Invalid static path.');
      const filename = path.join(webRoot, pathname);
      const ext = path.extname(filename);
      requireThat(Object.hasOwn(CONTENT_TYPES, ext), 'FILE_NOT_FOUND', 'Static file not found.');
      let data;
      try {
        const root = await fs.realpath(webRoot);
        const actual = await fs.realpath(filename);
        const relative = path.relative(root, actual);
        requireThat(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'FILE_NOT_FOUND', 'Static file not found.');
        data = await fs.readFile(actual);
      } catch { throw new HandoffError('FILE_NOT_FOUND', 'Static file not found.'); }
      response.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const code = error instanceof HandoffError ? error.code : 'LOCAL_ERROR';
      const message = error instanceof HandoffError ? error.message : 'The local operation did not complete. No production changes were made.';
      const status = ['INVALID_HOST', 'INVALID_ORIGIN', 'INTENT_REQUIRED'].includes(code) ? 403 :
        ['STALE_SOURCE', 'STALE_LOCAL_DRAFT', 'EDIT_CONFLICT', 'GENERATION_NOT_APPROVED', 'ENGINE_ALREADY_DISPATCHED'].includes(code) ? 409 :
          ['STORY_NOT_FOUND', 'DRAFT_NOT_FOUND', 'FILE_NOT_FOUND', 'PREVIEW_NOT_FOUND', 'RESEARCH_REQUEST_NOT_FOUND'].includes(code) ? 404 : ['SOURCE_UNAVAILABLE','ENGINE_NOT_CONFIGURED','ENGINE_NETWORK_UNCERTAIN'].includes(code) ? 503 : 400;
      if (!response.headersSent) json(response, status, { error: { code, message } });
      else response.end();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = new WorkspaceSource();
  await source.initialize();
  const drafts = new LocalDraftStore('.local/workspace/drafts.sqlite');
  const previews = new LocalPreviewStore('.local/workspace/previews');
  const research = new LocalResearchStore('.local/workspace/research.sqlite');
  const feeds=new PublicationFeeds(research);
  let engine=null;
  try { const client=await loadEditorialEngineClient(); if(client){engine=new EditorialEngineService({research,client,sourceLeads:()=>feeds.context(),prepareSources:()=>feeds.refresh()});engine.refresh().catch(error=>console.error(`Read-only engine refresh unavailable: ${error.code||'LOCAL_ERROR'}`));} } catch(error) { console.error(`Development engine unavailable: ${error.code || 'CONFIGURATION_ERROR'}`); }
  const server = createWorkspaceServer({ source, drafts, previews, research, engine, feeds });
  const port = Number(process.env.PORT || 4174);
  requireThat(Number.isSafeInteger(port) && port > 0 && port <= 65535, 'INVALID_PORT', 'PORT must be from 1 to 65535.');
  server.on('error', error => { console.error(`Workspace startup failed: ${error.code || 'LOCAL_ERROR'}`); process.exitCode = 1; drafts.close(); });
  server.listen(port, '127.0.0.1', () => console.log(`Editorial workspace listening on loopback port ${port}. Production writes are disabled.`));
  source.refresh().then(snapshot => console.log(`Read-only workspace refreshed: ${snapshot.records.stories.length} stories, ${snapshot.buffer.posts.length} Buffer records.`))
    .catch(error => console.error(`Read-only refresh unavailable: ${error.code}; existing cache preserved.`));
}
