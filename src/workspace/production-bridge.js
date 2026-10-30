import {validatePacketImport} from '../production-packet-contract.js';
import {captionIsInternalTest} from '../n8n/draft-guards.js';
import {createHash} from 'node:crypto';
import {canonical} from '../package.js';
const array=value=>{try{const v=typeof value==='string'?JSON.parse(value):value;return Array.isArray(v)?v:[];}catch{return [];}};
const string=v=>v===undefined||v===null?'':String(v);
const version=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;

/** Exact recorded identifiers only. This projection cannot authorize or perform a release. */
export function projectProduction({row,records,buffer,observedAt,safeUrl}){
 const packages=records.packages.filter(p=>p.concept_id===row.concept_id);const p=packages.length===1?packages[0]:null;
 const packageVersion=version(p?.production_version),packageId=string(p?.package_id);
 const relatedExports=(records.exports||[]).filter(e=>e.concept_id===row.concept_id);
 const archives=(records.archives||[]).filter(e=>e.concept_id===row.concept_id);
 const proofExecution=string(p?.proof_execution_id);
 const exclusiveProof=proofExecution&&records.packages.filter(x=>string(x.proof_execution_id)===proofExecution).length===1;
 const proofs=exclusiveProof?(records.proofs||[]).filter(e=>string(e.execution_id)===proofExecution):[];
 const imports=(records.imports||[]).filter(i=>i.concept_id===row.concept_id);
 const guarded=(records.guardedHandoffs||[]).filter(i=>i.concept_id===row.concept_id);
 const handoffs=[...imports.map(i=>({...i,path:'manual_import'})),...guarded.map(i=>({...i,path:'guarded_handoff'}))].map(i=>({id:string(i.id),key:string(i.import_key||i.request_id),path:i.path,packageVersion:version(i.package_version||i.production_version),state:string(i.state||i.status),postId:string(i.buffer_id||i.buffer_post_id),at:i.imported_on||i.created_date||i.createdAt||null}));
 const active=handoffs.filter(i=>i.state!=='abandoned');const ids=[...new Set(active.map(i=>i.postId).filter(Boolean))];
 const provider=ids.map(id=>{const post=buffer.posts.find(p=>p.id===id);return {id,mapped:true,found:Boolean(post),status:post?.status||'unresolved',dueAt:post?.dueAt??null,sentAt:post?.sentAt??null,url:safeUrl(post?.externalLink),observedAt:buffer.observedAt,instagramVerified:false};});
 const blockers=[];if(!p)blockers.push(packages.length?'AMBIGUOUS_PRODUCTION_PACKAGE':'NO_PRODUCTION_PACKAGE');
 if(p&&!packageId)blockers.push('PACKAGE_ID_MISSING');if(p&&!packageVersion)blockers.push('PACKAGE_VERSION_MISSING');
 if(p&&version(p.editorial_handoff_version)!==packageVersion)blockers.push('STALE_EDITORIAL_HANDOFF');
 if(p?.final_approval_status!=='approved')blockers.push('FINAL_APPROVAL_REQUIRED');
 if(p?.source_claims_reviewed!==true)blockers.push('SOURCE_CLAIMS_REVIEW_REQUIRED');
 if(p?.rights_review_status!=='reviewed')blockers.push('PACKAGE_RIGHTS_REVIEW_REQUIRED');
 if(active.length)blockers.push('EXISTING_HANDOFF_RECONCILIATION_REQUIRED');
 if(provider.some(i=>!i.found)||active.some(i=>!i.postId))blockers.push('UNRESOLVED_PROVIDER_RESULT');
 if(active.length>1)blockers.push('MULTIPLE_HANDOFFS_ACROSS_VERSIONS');
 if(!Array.isArray(records.guardedHandoffs))blockers.push('GUARDED_HANDOFF_COVERAGE_UNKNOWN');
 const digest=p?createHash('sha256').update(canonical(Object.fromEntries(['id','concept_id','package_id','production_version','editorial_handoff_version','caption_draft','slide_sequence_asset_ids','final_caption','final_asset_urls','final_assets_verified','final_approval_status','source_claims_reviewed','source_claims_review_notes','rights_review_status','render_revision','render_preflight_status','proof_execution_id','updatedAt'].map(k=>[k,p[k]??null])))).digest('hex'):null;
 return {authority:'existing_n8n_production',relationship:packages.length===1?'exact_concept_id':packages.length?'ambiguous':'not_linked',observedAt,
  package:p?{id:packageId,rowId:string(p.id),version:packageVersion,editorialHandoffVersion:version(p.editorial_handoff_version),status:string(p.production_status),finalApprovalStatus:string(p.final_approval_status||'unreviewed'),rightsStatus:string(p.rights_review_status||'unreviewed'),sourceClaimsReviewed:p.source_claims_reviewed===true,sourceReviewNotes:string(p.source_claims_review_notes),sourceReviewDate:p.source_claims_reviewed_date||null,renderRevision:version(p.render_revision),renderPreflightStatus:string(p.render_preflight_status),finalAssetsVerified:p.final_assets_verified===true,finalCaption:string(p.final_caption),finalAssetUrls:array(p.final_asset_urls).map(safeUrl).filter(Boolean),sourceDigest:digest}:null,
  exports:relatedExports.map(e=>({id:string(e.export_id||e.id),version:version(e.production_version),current:!!packageVersion&&version(e.production_version)===packageVersion,status:string(e.export_status),kind:string(e.export_kind),filename:string(e.archive_filename),slideCount:Number(e.slide_count)||0,executionId:string(e.execution_id),createdAt:e.created_date||e.createdAt||null})),
  archives:archives.map(e=>({id:string(e.export_key||e.id),packageId:string(e.package_id),version:version(e.package_version),current:!!packageId&&e.package_id===packageId&&!!packageVersion&&version(e.package_version)===packageVersion,filename:string(e.archive_filename),sha256:string(e.sha256_checksum),verifiedPrivate:e.verified_private===true,status:string(e.storage_status),url:safeUrl(e.private_view_url)})),
  proofs:proofs.map(e=>({id:string(e.proof_id),label:string(e.label),status:string(e.status),slide:Number(e.slide_number)||null,url:safeUrl(e.preview_url),relationship:'explicit_package_execution_reference',versionVerified:false})),
  coverage:{exports:Array.isArray(records.exports),proofs:Array.isArray(records.proofs),guardedHandoffs:Array.isArray(records.guardedHandoffs)},
  handoffs,provider,providerObservedAt:buffer.observedAt,providerSnapshotComplete:buffer.complete===true,publicationApproved:false,productionApplied:false,blockers};
}

/** Review packet for the existing backend. No import/create instruction, new publishing ledger or authority. */
export function prepareProductionPacket(story){
 const local=story.localDraft;const draft=local||{};const effective={...story,...draft};const bridge=story.production||{};const pkg=bridge.package;
 const selected=effective.selectedAssetIds||[];
 const media=selected.map((id,index)=>{const matches=story.media.filter(m=>m.id===id);const m=matches.length===1?matches[0]:{};return {position:index+1,assetId:id,identityConfirmed:matches.length===1,sourceUrl:m.sourceUrl||'',fileUrl:m.fileUrl||'',creator:m.creator||'',credit:m.attribution||m.sourceCredit||'',license:m.license||'',licenseUrl:m.licenseUrl||'',rightsStatus:m.rightsStatus||'unknown',privatePreviewAvailable:Boolean(m.localPreview),productionFileVerified:false,nativeRightsReview:m.nativeRightsReview||{reviewed:false,rightsGranted:false},rightsEvidenceBasis:'native_media_review_state_not_independent_permission_verification',role:effective.creativeBrief?.sequenceRoles?.find(r=>r.assetId===id)?.role||null};});
 const blockers=[...(bridge.blockers||[]),...(story.blockers||[])];
 const fresh=at=>Number.isFinite(Date.parse(at))&&Date.now()-Date.parse(at)>=-60000&&Date.now()-Date.parse(at)<=900000;
 if(!fresh(bridge.observedAt))blockers.push('SOURCE_SNAPSHOT_STALE');if(!fresh(bridge.providerObservedAt)||bridge.providerSnapshotComplete!==true)blockers.push('PROVIDER_SNAPSHOT_STALE_OR_INCOMPLETE');
 if(local?.stale)blockers.push('STALE_LOCAL_REVISION');if(!selected.length)blockers.push('NO_SELECTED_MEDIA');
 if(new Set(selected).size!==selected.length||media.some(m=>!m.identityConfirmed))blockers.push('AMBIGUOUS_OR_MISSING_MEDIA');
 if(media.some(m=>m.rightsStatus!=='cleared'&&!m.nativeRightsReview?.reviewed))blockers.push('PER_IMAGE_RIGHTS_PENDING');if(media.some(m=>!m.fileUrl))blockers.push('PRODUCTION_FILE_REFERENCE_MISSING');
 if(!effective.caption?.trim())blockers.push('CAPTION_REQUIRED');if(captionIsInternalTest(effective.caption))blockers.push('INTERNAL_TEST_MATERIAL');
 if((effective.format==='single_image'?1:effective.targetSlideCount)!==selected.length)blockers.push('FORMAT_SEQUENCE_MISMATCH');
 const captionApproved=!!pkg&&pkg.finalApprovalStatus==='approved'&&!!pkg.finalCaption&&pkg.finalCaption===effective.caption;
 if(!captionApproved)blockers.push('WORKING_CAPTION_NOT_FINAL_APPROVED');
 if(local&&(['caption','title','hook','format','targetSlideCount'].some(k=>effective[k]!==story[k])||canonical(selected)!==canonical(story.selectedAssetIds)))blockers.push('LOCAL_CHANGES_REQUIRE_NATIVE_REVIEW');
 const packet={schemaVersion:1,kind:'mildincident_editorial_to_production_review',scope:'local_review_only',identity:{conceptId:story.id,origin:story.origin||'n8n_production',packageId:pkg?.id||null,packageRowId:pkg?.rowId||null,packageVersion:pkg?.version||null,packageSourceDigest:pkg?.sourceDigest||null,sourceRevision:story.revision,localBaseRevision:local?.baseRevision||null,localVersion:local?.version||null},
 editorial:{title:effective.title,hook:effective.hook,format:effective.format,targetSlideCount:effective.targetSlideCount,caption:effective.caption,captionApproval:{recorded:captionApproved,basis:'exact_current_native_final_caption'},decision:story.developmentDecision||null,orderedMedia:media,claims:story.research,humanFactReview:{recorded:pkg?.sourceClaimsReviewed===true,scope:'native_package_record',notes:pkg?.sourceReviewNotes||'',reviewedAt:pkg?.sourceReviewDate||null},soundtrack:effective.musicSelection||null,soundDirection:effective.creativeBrief?.soundBrief||null},
 production:{authority:'existing_n8n_production',package:pkg||null,exports:bridge.exports||[],archives:bridge.archives||[],proofs:bridge.proofs||[],handoffs:bridge.handoffs||[],provider:bridge.provider||[],observedAt:bridge.observedAt||null,providerObservedAt:bridge.providerObservedAt||null,providerSnapshotComplete:bridge.providerSnapshotComplete===true},
 readiness:{status:blockers.length?'needs_review':'ready_for_native_preflight',blockers:[...new Set(blockers)],nextAction:bridge.handoffs?.some(h=>h.state!=='abandoned')?'Reconcile existing provider IDs and history before any new handoff.':local?.stale?'Resolve source changes while preserving this working revision.':!pkg?'Review this development story and create its canonical production record only through the existing approved n8n process.':'Review this packet against the current n8n package and its existing approval/export process.'},productionApplied:false,publicationApproved:false,rightsGranted:false,bufferCreateEnabled:false};
 const serialized=JSON.parse(JSON.stringify(packet));serialized.nativeImportCheck=validatePacketImport(serialized,serialized);return {...serialized,digest:createHash('sha256').update(canonical(serialized)).digest('hex')};
}
