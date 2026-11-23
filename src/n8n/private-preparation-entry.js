import {createHash} from 'node:crypto';
import {requireThat} from '../errors.js';
import {publishingGraphSha} from './buffer-handoff-security.js';
import {PUBLISHING_TABLES as T} from './buffer-release-patch.js';

export const PRIVATE_PREPARATION_PATH='mildincident-studio-private-preparation';
const allowedTypes=new Set(['code','crypto','if','webhook','respondToWebhook','dataTable','googleDrive'].map(t=>'n8n-nodes-base.'+t).concat('@n8n/n8n-nodes-langchain.mcpClient'));
const edge=node=>({node,type:'main',index:0});
const coreOrder=['id','name','webhookId','disabled','type','typeVersion','executeOnce','alwaysOutputData','retryOnFail','maxTries','waitBetweenTries','onError','position','parameters','credentials'];
// Match the node-object ordering observed in the deployed API. This changes no
// values. Installation must STILL compare the exact persisted graph checksum.
const nodeOrder=n=>Object.fromEntries([...new Set([...coreOrder,...Object.keys(n)])].filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));

/** Extract existing private branches, rather than invoking an unpublished
 * publishing worker. The output is a NEW, independently activated entry point.
 * No original workflow is modified and no remote operation occurs here. */
export function buildPrivatePreparationEntry({production,coordinator,guarded,expected}){
 for(const [key,w]of Object.entries({production,coordinator,guarded}))requireThat(expected?.[key]===publishingGraphSha(w),'PREPARATION_SOURCE_CHANGED','Pin the exact reviewed source graphs before extracting preparation.');
 const nodes=new Map(),connections={},changes=[],reused=[];
 const take=(w,name)=>{const found=w.nodes.filter(n=>n.name===name);requireThat(found.length===1,'PREPARATION_NODE_CHANGED','An existing preparation node changed.');const n=structuredClone(found[0]);requireThat(!nodes.has(name),'PREPARATION_NODE_DUPLICATED','Preparation node names must be unique.');nodes.set(name,n);reused.push({name,sourceSha256:publishingGraphSha(w)});return n;};
 const link=(a,b)=>connections[a]={main:[[edge(b)]]};
 const branch=(a,yes,no)=>connections[a]={main:[[edge(yes)],[edge(no)]]};
 const code=(name,jsCode)=>{const n=structuredClone(coordinator.nodes.find(n=>n.name==='Store Studio Operation Result'));requireThat(n?.type==='n8n-nodes-base.code','PREPARATION_NODE_CHANGED','Use the existing receipt node format.');Object.assign(n,{id:'mi-private-'+createHash('sha256').update(name).digest('hex').slice(0,20),name,parameters:{jsCode},position:[1600,nodes.size*100]});nodes.set(name,n);changes.push(name);return n;};

 for(const name of ['Studio Publishing Request','Canonical Studio Publishing Body','Hash Studio Publishing Body','Read Authenticated Studio Publishing Envelope','Studio Operation Runs Asynchronously?','Acknowledge One Studio Native Operation','Studio Requests Native Review?','Studio Reads Private Final File?','Return Studio Publishing JSON','Store Studio Operation Result'])take(coordinator,name);
 const trigger=nodes.get('Studio Publishing Request');trigger.parameters.path=PRIVATE_PREPARATION_PATH;trigger.webhookId='mildincident-studio-private-preparation-v1';changes.push(trigger.name);
 const auth=nodes.get('Read Authenticated Studio Publishing Envelope');
 requireThat(auth.parameters.jsCode.startsWith("const preparationRequest="),'PREPARATION_AUTH_CHANGED','Use the reviewed preparation allowlist and body-bound JWT checks.');
 // Existing JWT verification (including digest, issuer, expiry and request ID)
 // stays byte-for-byte intact; the reviewed review/file/connection allowlist stays.
 requireThat(auth.parameters.jsCode.includes("['review','file','connection']"),'PREPARATION_AUTH_CHANGED','Publishing actions must be rejected before acknowledgement.');
 link('Studio Publishing Request','Canonical Studio Publishing Body');link('Canonical Studio Publishing Body','Hash Studio Publishing Body');link('Hash Studio Publishing Body',auth.name);link(auth.name,'Studio Operation Runs Asynchronously?');
 branch('Studio Operation Runs Asynchronously?','Acknowledge One Studio Native Operation','Studio Requests Native Review?');link('Acknowledge One Studio Native Operation','Studio Requests Native Review?');
 branch('Studio Requests Native Review?','Internal Finalize Render Request','Studio Reads Private Final File?');branch('Studio Reads Private Final File?','Internal Finalize Render Request','Internal Buffer Release Handoff');
 code('Internal Finalize Render Request',"const r=$('Read Authenticated Studio Publishing Envelope').first().json.studio_request;if(!['review','file'].includes(r.action))throw Error('PRIVATE_PREPARATION_ACTION_DENIED');if(r.action==='review'&&(r.confirm!=='submit_exact_post_for_native_review'||r.packet?.expected?.storyId!==r.storyId||r.packet.expected.packageVersion!==r.packageVersion||r.packet.requestId!==r.requestId))throw Error('STUDIO_REVIEW_CONFIRMATION_REQUIRED');return [{json:{request_kind:'mildincident_finalize_v1',phase:r.action==='review'?'studio_review':'studio_file',studio_packet:r.packet,concept_id:r.storyId,production_version:r.packageVersion,file_record_id:r.fileRecordId,asset_id:r.assetId,sha256:r.sha256}}];");
 code('Internal Buffer Release Handoff',"const r=$('Read Authenticated Studio Publishing Envelope').first().json.studio_request;if(r.action!=='connection')throw Error('PRIVATE_PREPARATION_ACTION_DENIED');return [{json:{request_kind:'mildincident_finalize_v1',phase:'studio_connection_check'}}];");

 // Remove the legacy initial-create route. Its studio reservation, assembler,
 // exact transfer validation and conditional commits are reused unchanged.
 const selected=structuredClone(production),cut=selected.nodes.find(n=>n.name==='Initial Package Comes From Studio?');
 requireThat(cut&&selected.connections[cut.name]?.main?.[0]?.[0]?.node==='Assemble Initial Studio Package','PREPARATION_SOURCE_CHANGED','Use the reviewed initial-package reservation path.');
 selected.connections[cut.name].main[1]=[edge('Reject Non Studio Preparation')];
 code('Reject Non Studio Preparation',"throw Error('PRIVATE_PREPARATION_LEGACY_ROUTE_DENIED');");
 const reservation=selected.nodes.find(n=>n.name==='Build Shared Initial Package Reservation');
 requireThat(reservation?.parameters.jsCode.includes("$('Guard New Production Package').isExecuted"),'PREPARATION_SOURCE_CHANGED','The shared reservation must be reviewed before extraction.');
 reservation.parameters.jsCode="const c=$('Read Studio Review Story').first().json;if($('Validate Studio Package Start').isExecuted!==true||!Number.isInteger(c.id)||!c.updatedAt||!['approved','concept_approved'].includes(c.approval_status)||!['approved_for_sourcing','media_review_required','sourcing_complete','ready_for_production'].includes(c.stage))throw Error('INITIAL_PACKAGE_CONCEPT_CHANGED');return [{json:{storyId:c.concept_id,storyRowId:c.id,storyUpdatedAt:c.updatedAt,storyStage:c.stage,route:'studio'}}];";changes.push(reservation.name);
 // Traverse only the actual review/file branches, never the rest of production.
 const visit=name=>{if(nodes.has(name))return;take(selected,name);for(const ports of Object.values(selected.connections[name]||{}))for(const list of ports)for(const e of list)visit(e.node);if(selected.connections[name])connections[name]=structuredClone(selected.connections[name]);};
 visit('Read Studio Review Envelope');visit('Read Studio Private File Scope');
 take(production,'Is Studio Editorial Review?');branch('Is Studio Editorial Review?','Read Studio Review Envelope','Read Studio Private File Scope');link('Internal Finalize Render Request','Is Studio Editorial Review?');
 link('Return Exact Studio Review Receipt','Store Studio Operation Result');link('Return Verified Studio Private JPEG','Return Studio Publishing JSON');
 for(const name of ['Validate Studio Buffer Connection Check','Read Existing Buffer Channel','Return Verified Buffer Connection'])take(guarded,name);
 link('Internal Buffer Release Handoff','Validate Studio Buffer Connection Check');link('Validate Studio Buffer Connection Check','Read Existing Buffer Channel');link('Read Existing Buffer Channel','Return Verified Buffer Connection');link('Return Verified Buffer Connection','Return Studio Publishing JSON');
 const update={name:'MILDINCIDENT · Private Post Preparation',nodes:[...nodes.values()].map(nodeOrder),connections,settings:{executionOrder:'v1',availableInMCP:false}};
 const proof=assertPrivatePreparationBoundary(update);
 return {update,review:{graphSha256:publishingGraphSha(update),...proof,changedNodes:changes,reused,sourceGraphs:expected,installed:false}};
}

/** Exhaustive positive inventory. Publication checks ALL nodes, not just the
 * branch selected at runtime. Reject child calls even when disconnected. */
export function assertPrivatePreparationBoundary(w){
 const writes={'Reserve Initial Studio Package':[T.stories,'update'],'Save Initial Studio Package':[T.packages,'insert'],'Reserve Studio Editorial Review':[T.packages,'update'],'Register Source Backed Studio Photographs':[T.media,'insert'],'Preserve Earlier Studio Native Package':['jfIlv4bFRpyUGqF6','insert'],'Reopen Studio Story For Exact Review':[T.stories,'update'],'Commit Exact Studio Native Review':[T.packages,'update']};
 requireThat(w.settings?.executionOrder==='v1'&&w.settings.availableInMCP===false&&Object.keys(w.settings).length===2,'PREPARATION_BOUNDARY_INVALID','Preparation must not reference an error workflow or expose MCP execution.');
 const names=new Set(w.nodes.map(n=>n.name));requireThat(names.size===w.nodes.length,'PREPARATION_BOUNDARY_INVALID','Duplicate preparation node names.');
 const triggers=w.nodes.filter(n=>/webhook|Trigger$/i.test(n.type)&&n.type!=='n8n-nodes-base.respondToWebhook');
 requireThat(triggers.length===1&&triggers[0].type==='n8n-nodes-base.webhook'&&triggers[0].parameters.path===PRIVATE_PREPARATION_PATH&&triggers[0].parameters.authentication==='jwtAuth'&&triggers[0].credentials?.jwtAuth?.id,'PREPARATION_BOUNDARY_INVALID','Only the existing dedicated JWT may authorize private preparation.');
 for(const n of w.nodes){
  requireThat(allowedTypes.has(n.type)&&n.retryOnFail!==true&&!n.disabled,'PREPARATION_BOUNDARY_INVALID','Preparation may not contain workflow calls, writers, hidden disabled nodes or model operations.');
  for(const match of JSON.stringify(n.parameters).matchAll(/\$\(['"]([^'"]+)['"]\)/g))requireThat(names.has(match[1]),'PREPARATION_BOUNDARY_INVALID','An expression references a node outside private preparation.');
  if(n.type==='@n8n/n8n-nodes-langchain.mcpClient')requireThat(n.name==='Read Existing Buffer Channel'&&n.parameters.endpointUrl==='https://mcp.buffer.com/mcp'&&n.parameters.tool?.value==='get_channel','PREPARATION_BOUNDARY_INVALID','Only the existing fixed Buffer channel read is allowed.');
  if(n.type==='n8n-nodes-base.googleDrive')requireThat(n.parameters.operation==='download','PREPARATION_BOUNDARY_INVALID','Private file access must be download only.');
  if(n.type==='n8n-nodes-base.dataTable'){
   requireThat(n.parameters.resource==='row'&&['get','insert','update'].includes(n.parameters.operation),'PREPARATION_BOUNDARY_INVALID','Only existing preparation record operations are allowed.');
   if(n.parameters.operation!=='get'){const permit=writes[n.name];requireThat(permit&&permit[0]===n.parameters.dataTableId?.value&&permit[1]===n.parameters.operation,'PREPARATION_BOUNDARY_INVALID','Only the exact existing preparation writes are allowed.');}
  }
 }
 for(const [from,ports]of Object.entries(w.connections)){requireThat(names.has(from),'PREPARATION_BOUNDARY_INVALID','Unknown preparation connection.');for(const list of Object.values(ports))for(const edges of list)for(const e of edges)requireThat(names.has(e.node),'PREPARATION_BOUNDARY_INVALID','A connection escaped the preparation graph.');}
 const seen=new Set(),visit=name=>{if(seen.has(name))return;seen.add(name);for(const list of Object.values(w.connections[name]||{}))for(const edges of list)for(const e of edges)visit(e.node);};visit(triggers[0].name);
 requireThat(seen.size===names.size,'PREPARATION_BOUNDARY_INVALID','Every node must belong to the private preparation entry.');
 return {nodeCount:w.nodes.length,workflowDependencies:[],webhooks:1,bufferWrites:false,publicStaging:false,finalApproval:false,paidAI:false};
}
