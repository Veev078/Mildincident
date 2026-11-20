import {createHash} from 'node:crypto';
import {requireThat} from '../errors.js';
import {graphProjection,publishingGraphSha} from './buffer-handoff-security.js';
import {stableNative,priorBufferHandoff,validateNativePostTransfer} from './buffer-native-contract.js';
import {PUBLISHING_TABLES as T} from './buffer-release-patch.js';

/** Serializable validation over the SAME caption/image transfer contract. Initial
 * package creation grants no rights, final approval, staging or Buffer access. */
export function validateNativePackageStart(packet,context){
 const {story,packages,media,manual,guarded}=context,e=packet?.expected;
 if(!story||packages.length!==0||!e||['packageId','packageRowId','packageVersion','packageDigest'].some(k=>e[k]!==null)||!['approved_for_sourcing','media_review_required','sourcing_complete','ready_for_production'].includes(story.stage))throw Error('STUDIO_PACKAGE_START_DENIED');
 // The normal transfer validator verifies concept approval, exact original
 // state, image evidence, caption and selected order; no relaxed parallel path.
 const p={id:0,concept_id:story.concept_id,package_id:'PKG-'+story.concept_id,production_version:0,format:story.format,caption_draft:'',slide_sequence_asset_ids:'[]',buffer_claim_state:'idle'};
 const effective={...packet,expected:{...e,packageId:p.package_id,packageRowId:0,packageVersion:0,packageDigest:'preparation'}};
 validateNativePostTransfer(effective,{story,packages:[p],media,manual,guarded,packageDigest:'preparation'});
 if(!Number.isInteger(story.id)||!story.updatedAt)throw Error('STUDIO_PACKAGE_STORY_REVISION_REQUIRED');
 return {storyId:story.concept_id,storyRowId:story.id,storyUpdatedAt:story.updatedAt,requestId:packet.requestId,contentDigest:packet.contentDigest};
}

const edge=node=>({node,type:'main',index:0});
const serialize=(...f)=>f.map(v=>v.toString()).join('\n');
const projection=w=>{const p=structuredClone(graphProjection(w));for(const k of ['nodeGroups','groups'])if(Object.hasOwn(w,k))p[k]=structuredClone(w[k]);return p;};

/** Future reviewed patch for the EXISTING installed production worker. Reuses
 * its actual package assembler and insert mapping, then the exact transfer and
 * founder slide planner already installed. Never applies anything remotely. */
export function prepareStudioPackagePreparation(workflow,{expectedVersion,expectedSha256}={}){
 requireThat(workflow.id==='YdW8V9Qxl2qn5mC8'&&workflow.versionId===expectedVersion&&publishingGraphSha(workflow)===expectedSha256,'PUBLISHING_BASE_CHANGED','Capture and pin the installed production worker before preparing this patch.');
 const w=projection(workflow),changed=[],get=name=>{const n=w.nodes.find(n=>n.name===name);requireThat(n,'PUBLISHING_NODE_CHANGED','The existing production contract changed.');return n;};
 const add=(name,type,parameters,extra={})=>{requireThat(!w.nodes.some(n=>n.name===name),'PUBLISHING_PATCH_ALREADY_PRESENT','Do not reapply post preparation.');const n={id:'mi-prepare-'+createHash('sha256').update(name).digest('hex').slice(0,20),name,type,typeVersion:type.endsWith('.dataTable')?1:type.endsWith('.if')?2.2:2,position:[2500,w.nodes.length*20],parameters,retryOnFail:false,...extra};w.nodes.push(n);changed.push(name);return n;};
 const link=(a,b)=>{w.connections[a]={main:[[edge(b)]]};},branch=(a,yes,no)=>{w.connections[a]={main:[[edge(yes)],[edge(no)]]};};
 const condition=(name,expr)=>add(name,'n8n-nodes-base.if',{conditions:{options:{typeValidation:'strict',version:2},conditions:[{leftValue:expr,rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
 const packageRead=structuredClone(get('Read Studio Review Package').parameters);
 requireThat(w.connections['Read Studio Review Guarded Handoffs']?.main?.[0]?.[0]?.node==='Build Studio Native Package Digest','PUBLISHING_REVIEW_PATH_CHANGED','The installed exact review path differs.');
 condition('Studio Post Needs Initial Package?',"={{ $('Read Studio Review Package').all().filter(i => i.json.concept_id).length === 0 }}");
 link('Read Studio Review Guarded Handoffs','Studio Post Needs Initial Package?');branch('Studio Post Needs Initial Package?','Validate Studio Package Start','Read Effective Studio Review Package');
 add('Validate Studio Package Start','n8n-nodes-base.code',{jsCode:`${serialize(stableNative,priorBufferHandoff,validateNativePostTransfer,validateNativePackageStart)}const read=name=>$(name).all().map(i=>i.json).filter(r=>r.concept_id),ss=read('Read Studio Review Story'),packet=$('Read Studio Review Envelope').first().json.packet;if(ss.length!==1||$('Hash Studio Review Packet').first().json.actual_content_digest!==packet.contentDigest)throw Error('STUDIO_PACKAGE_INPUT_CHANGED');return [{json:validateNativePackageStart(packet,{story:ss[0],packages:read('Read Studio Review Package'),media:read('Read Studio Review Media'),manual:read('Read Studio Review Manual Handoffs'),guarded:read('Read Studio Review Guarded Handoffs')})}];`});
 // Both existing initial-create entry points share this conditional update.
 // Merely blocking later forms by stage is insufficient: an earlier form may
 // already have passed its old read/rowNotExists check.
 requireThat(w.connections['Guard New Production Package']?.main?.[0]?.length===1&&w.connections['Guard New Production Package'].main[0][0].node==='Save New Draft Package'&&w.connections['Save New Draft Package']?.main?.[0]?.length===1,'PUBLISHING_INITIAL_CREATE_CHANGED','The existing initial package insert path differs.');
 add('Build Shared Initial Package Reservation','n8n-nodes-base.code',{jsCode:"let studio=false,legacy=false;try{studio=$('Validate Studio Package Start').isExecuted===true;}catch{}try{legacy=$('Guard New Production Package').isExecuted===true;}catch{}if(studio===legacy)throw Error('INITIAL_PACKAGE_ENTRY_AMBIGUOUS');const c=$(studio?'Read Studio Review Story':'Get Concept for Production Package').first().json;if(!Number.isInteger(c.id)||!c.updatedAt||!['approved','concept_approved'].includes(c.approval_status)||!['approved_for_sourcing','media_review_required','sourcing_complete','ready_for_production'].includes(c.stage))throw Error('INITIAL_PACKAGE_CONCEPT_CHANGED');if(legacy){const p=$('Assemble Production Package Draft').first().json;if(p.draft_action!=='create'||p.concept_id!==c.concept_id||p.production_version!==1)throw Error('INITIAL_PACKAGE_CREATE_REQUIRED');}return [{json:{storyId:c.concept_id,storyRowId:c.id,storyUpdatedAt:c.updatedAt,storyStage:c.stage,route:studio?'studio':'legacy'}}];"});
 link('Validate Studio Package Start','Build Shared Initial Package Reservation');link('Guard New Production Package','Build Shared Initial Package Reservation');changed.push('Guard New Production Package');
 const claim="$('Build Shared Initial Package Reservation').first().json";
 add('Reserve Initial Studio Package','n8n-nodes-base.dataTable',{resource:'row',operation:'update',dataTableId:{__rl:true,mode:'id',value:T.stories},matchType:'allConditions',filters:{conditions:[{keyName:'id',condition:'eq',keyValue:`={{ ${claim}.storyRowId }}`},{keyName:'updatedAt',condition:'eq',keyValue:`={{ ${claim}.storyUpdatedAt }}`},{keyName:'stage',condition:'eq',keyValue:`={{ ${claim}.storyStage }}`}]},columns:{mappingMode:'defineBelow',value:{stage:'studio_package_preparing'}}},{alwaysOutputData:true});link('Build Shared Initial Package Reservation','Reserve Initial Studio Package');
 const sharedStoryRead=structuredClone(get('Read Studio Review Story').parameters);sharedStoryRead.filters={conditions:[{keyName:'concept_id',condition:'eq',keyValue:`={{ ${claim}.storyId }}`}]};sharedStoryRead.returnAll=true;
 add('Read Reserved Initial Studio Story','n8n-nodes-base.dataTable',sharedStoryRead,{alwaysOutputData:true,executeOnce:true});link('Reserve Initial Studio Package','Read Reserved Initial Studio Story');
 add('Verify Initial Studio Package Reservation','n8n-nodes-base.code',{jsCode:"const c=$('Build Shared Initial Package Reservation').first().json,rows=$input.all().map(i=>i.json).filter(r=>r.concept_id);if($('Reserve Initial Studio Package').all().filter(i=>i.json.id===c.storyRowId).length!==1||rows.length!==1||rows[0].id!==c.storyRowId||rows[0].concept_id!==c.storyId||rows[0].stage!=='studio_package_preparing')throw Error('STUDIO_PACKAGE_NOT_RESERVED');return [{json:{}}];"});link('Read Reserved Initial Studio Story','Verify Initial Studio Package Reservation');
 condition('Initial Package Comes From Studio?',"={{ $('Build Shared Initial Package Reservation').first().json.route === 'studio' }}");link('Verify Initial Studio Package Reservation','Initial Package Comes From Studio?');branch('Initial Package Comes From Studio?','Assemble Initial Studio Package','Restore Legacy Initial Package Payload');
 add('Restore Legacy Initial Package Payload','n8n-nodes-base.code',{jsCode:"if($('Build Shared Initial Package Reservation').first().json.route!=='legacy')throw Error('INITIAL_PACKAGE_ENTRY_CHANGED');return $('Assemble Production Package Draft').all();"});link('Restore Legacy Initial Package Payload','Save New Draft Package');
 const originalAfterLegacyInsert=w.connections['Save New Draft Package'].main[0][0].node;
 add('Restore Legacy Initial Story Stage','n8n-nodes-base.dataTable',{resource:'row',operation:'update',dataTableId:{__rl:true,mode:'id',value:T.stories},matchType:'allConditions',filters:{conditions:[{keyName:'id',condition:'eq',keyValue:`={{ ${claim}.storyRowId }}`},{keyName:'updatedAt',condition:'eq',keyValue:"={{ $('Read Reserved Initial Studio Story').first().json.updatedAt }}"},{keyName:'stage',condition:'eq',keyValue:'studio_package_preparing'}]},columns:{mappingMode:'defineBelow',value:{stage:`={{ ${claim}.storyStage }}`}}},{alwaysOutputData:true});link('Save New Draft Package','Restore Legacy Initial Story Stage');changed.push('Save New Draft Package');
 add('Read Restored Legacy Initial Story','n8n-nodes-base.dataTable',structuredClone(sharedStoryRead),{alwaysOutputData:true,executeOnce:true});link('Restore Legacy Initial Story Stage','Read Restored Legacy Initial Story');
 add('Verify Legacy Initial Story Restoration','n8n-nodes-base.code',{jsCode:"const c=$('Build Shared Initial Package Reservation').first().json,rows=$input.all().map(i=>i.json).filter(r=>r.concept_id);if(c.route!=='legacy'||$('Restore Legacy Initial Story Stage').all().filter(i=>i.json.id===c.storyRowId).length!==1||rows.length!==1||rows[0].id!==c.storyRowId||rows[0].concept_id!==c.storyId||rows[0].stage!==c.storyStage)throw Error('INITIAL_PACKAGE_STAGE_RESTORE_UNCERTAIN');return $('Save New Draft Package').all();"});link('Read Restored Legacy Initial Story','Verify Legacy Initial Story Restoration');link('Verify Legacy Initial Story Restoration',originalAfterLegacyInsert);
 let assembler=get('Assemble Production Package Draft').parameters.jsCode;
 for(const name of ['Normalize Production Draft Start','Get Concept for Production Package','Get Media for Production Package'])requireThat(assembler.includes("$('"+name+"')"),'PUBLISHING_ASSEMBLER_CHANGED','The original package assembler must be reviewed again.');
 assembler=assembler.replaceAll("$('Normalize Production Draft Start').first().json","({concept_id:$('Read Studio Review Story').first().json.concept_id,review_token:$('Read Studio Review Story').first().json.review_token,designer_notes:''})").replaceAll("$('Get Concept for Production Package')","$('Read Studio Review Story')").replaceAll("$('Get Media for Production Package')","$('Read Studio Review Media')");
 add('Assemble Initial Studio Package', 'n8n-nodes-base.code',{...structuredClone(get('Assemble Production Package Draft').parameters),jsCode:assembler});
 const insert=structuredClone(get('Save New Draft Package').parameters);Object.assign(insert.columns.value,{editorial_handoff_note:"={{ 'STUDIO_PACKAGE_START '+$('Read Studio Review Envelope').first().json.packet.requestId+' '+$('Read Studio Review Envelope').first().json.packet.contentDigest }}",buffer_claim_state:'idle',buffer_claim_owner:'',buffer_claim_digest:''});
 add('Save Initial Studio Package','n8n-nodes-base.dataTable',insert,{alwaysOutputData:true});link('Assemble Initial Studio Package','Save Initial Studio Package');
 add('Read Effective Studio Review Package','n8n-nodes-base.dataTable',packageRead,{alwaysOutputData:true,executeOnce:true});link('Save Initial Studio Package','Read Effective Studio Review Package');link('Read Effective Studio Review Package','Build Studio Native Package Digest');
 // Downstream reads use the exact independently reloaded package, including its
 // generated row ID. Bootstrap is recognised only by its executed guarded path.
 for(const name of ['Build Studio Native Package Digest','Validate Exact Studio Editorial Transfer','Studio Planner Package']){const n=get(name);requireThat(n.parameters.jsCode.includes("'Read Studio Review Package'"),'PUBLISHING_REVIEW_PATH_CHANGED','The existing review reader differs.');n.parameters.jsCode=n.parameters.jsCode.replaceAll("'Read Studio Review Package'","'Read Effective Studio Review Package'");changed.push(name);}
 const validate=get('Validate Exact Studio Editorial Transfer'),needle='const plan=validateNativePostTransfer(packet,{';
 requireThat(validate.parameters.jsCode.split(needle).length===2,'PUBLISHING_REVIEW_PATH_CHANGED','The exact editorial transfer validator differs.');
 validate.parameters.jsCode=validate.parameters.jsCode.replace(needle,"let effective=packet;if(packet.expected.packageVersion===null){let reserved=false;try{reserved=$('Verify Initial Studio Package Reservation').isExecuted===true;}catch{}const saved=$('Save Initial Studio Package').all().map(i=>i.json).filter(i=>i.id===prior.id),marker='STUDIO_PACKAGE_START '+packet.requestId+' '+packet.contentDigest;if(!reserved||saved.length!==1||prior.production_version!==1||prior.package_id!=='PKG-'+packet.expected.storyId||prior.editorial_handoff_note!==marker||prior.final_approval_status!=='pending'||prior.buffer_claim_state!=='idle')throw Error('STUDIO_INITIAL_PACKAGE_UNVERIFIED');effective={...packet,expected:{...packet.expected,packageId:prior.package_id,packageRowId:prior.id,packageVersion:prior.production_version,packageDigest:$input.first().json.actual_package_digest}};}const plan=validateNativePostTransfer(effective,{");
 // Commit only if our original row/updatedAt still matches. A failed bootstrap
 // remains visibly paused for reconciliation; no automatic rollback/retry.
 const reopen=get('Reopen Studio Story For Exact Review'),updated=reopen.parameters.filters.conditions.find(c=>c.keyName==='updatedAt');requireThat(updated,'PUBLISHING_REVIEW_PATH_CHANGED','The original conditional story commit changed.');updated.keyValue="={{ $('Read Studio Review Envelope').first().json.packet.expected.packageVersion === null ? $('Read Reserved Initial Studio Story').first().json.updatedAt : $('Read Studio Review Story').first().json.updatedAt }}";changed.push(reopen.name);
 return {workflowId:workflow.id,expectedVersion,expectedSha256,update:w,review:{graphSha256:publishingGraphSha(w),changedNodes:[...new Set(changed)],existingAssemblerReused:true,canonicalConditionalClaim:true,sharedWithLegacyInitialCreation:true,rightsGranted:false,approvalImported:false,publicStaging:false,bufferWrites:false,liveApplied:false}};
}

/** Permit null packageVersion ONLY on an exact, founder-confirmed initial review.
 * All send/approval/read operations retain their existing positive version gate. */
export function prepareStudioPackageGateway(workflow,{expectedVersion,expectedSha256}={}){
 requireThat(workflow.id==='v5ThKs5ZYP3RhZop'&&workflow.versionId===expectedVersion&&publishingGraphSha(workflow)===expectedSha256,'PUBLISHING_BASE_CHANGED','Capture and pin the installed coordinator.');
 const w=projection(workflow),n=w.nodes.find(n=>n.name==='Read Authenticated Studio Publishing Envelope'),old='!Number.isInteger(r.packageVersion)||r.packageVersion<1';
 requireThat(n?.parameters.jsCode.split(old).length===2,'PUBLISHING_GATEWAY_CHANGED','The existing authenticated version check differs.');
 n.parameters.jsCode=n.parameters.jsCode.replace(old,"(!(r.action==='review'&&r.packageVersion===null&&r.packet?.expected?.packageVersion===null&&r.confirm==='submit_exact_post_for_native_review')&&(!Number.isInteger(r.packageVersion)||r.packageVersion<1))");
 return {workflowId:workflow.id,expectedVersion,expectedSha256,update:w,review:{graphSha256:publishingGraphSha(w),changedNodes:[n.name],positiveVersionPreservedForSend:true,credentialsChanged:false,liveApplied:false}};
}
