/** Serializable validation only. `current` MUST come from trusted current backend reads, never the request. */
export function validatePacketImport(packet,current,now=Date.now()){
 const issues=[];const add=(code,message)=>issues.push({code,message});
 const stable=v=>v&&typeof v==='object'?Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
 const same=(a,b)=>stable(a)===stable(b);
 if(!packet||packet.kind!=='mildincident_editorial_to_production_review'||packet.schemaVersion!==1||!packet.identity||!packet.editorial||!current?.identity||!current.editorial){return {accepted:false,issues:[{code:'INVALID_PACKET_CONTRACT',message:'Supply a review packet and independently read current native context.'}],scope:'development_validation_only',productionApplied:false,nativeImportEnabled:false};}
 if(packet.scope!=='local_review_only'||packet.productionApplied!==false||packet.bufferCreateEnabled!==false)add('INVALID_PACKET_SCOPE','A review packet cannot request native writes or publishing.');
 const identity=current.identity,pkg=current.production?.package;
 if(identity.origin!=='n8n_production'||!identity.packageId||!identity.packageRowId||!pkg||!Number.isSafeInteger(identity.packageVersion)||identity.packageVersion<1)add('UNLINKED_NATIVE_IDENTITY','Accept the story through the existing native process; no package is inferred for development candidates.');
 for(const key of ['conceptId','origin','packageId','packageRowId','packageVersion','packageSourceDigest','sourceRevision','localBaseRevision','localVersion'])if(!same(packet.identity[key],identity[key]))add('STALE_OR_FOREIGN_'+key.toUpperCase(),'Packet '+key+' differs from current independently read context.');
 if(identity.localBaseRevision&&identity.localBaseRevision!==identity.sourceRevision)add('STALE_WORKING_BASE','Resolve the changed native source before using the saved working revision.');
 if(packet.digest!==current.digest)add('PACKET_DIGEST_CHANGED','Download again after reviewing the current records.');
 if(!same(packet.editorial,current.editorial))add('EDITORIAL_CONTENT_CHANGED','Caption, media order, claims, reviews or soundtrack differ from current approved material.');
 if(!same(packet.production,current.production))add('PRODUCTION_EVIDENCE_CHANGED','Production/provider evidence differs from current context.');
 for(const at of [current.production?.observedAt,current.production?.providerObservedAt]){const age=now-Date.parse(at);if(!Number.isFinite(age)||age < -60000||age>900000)add('CURRENT_OBSERVATIONS_NOT_FRESH','Refresh the read-only native and provider observations before validation.');}
 if(current.production?.providerSnapshotComplete!==true)add('PROVIDER_OBSERVATIONS_INCOMPLETE','A complete provider observation is required; missing data cannot establish absence.');
 if(current.production?.handoffs?.some(h=>h.state!=='abandoned')||current.production?.provider?.length)add('EXISTING_OR_UNCERTAIN_HANDOFF','Review all earlier versions and provider IDs. This proof never imports over a prior draft, sent or uncertain handoff.');
 if(pkg?.finalApprovalStatus!=='approved'||current.editorial.captionApproval?.recorded!==true||pkg.finalCaption!==current.editorial.caption)add('NATIVE_CAPTION_APPROVAL_REQUIRED','Current working copy must match native approved final copy.');
 if(pkg?.sourceClaimsReviewed!==true||current.editorial.humanFactReview?.recorded!==true)add('NATIVE_FACT_REVIEW_REQUIRED','Review claims in the authoritative native package.');
 if(pkg?.rightsStatus!=='complete'||current.editorial.orderedMedia?.some(m=>m.rightsStatus!=='cleared'))add('NATIVE_RIGHTS_REVIEW_REQUIRED','Per-image native permissions and package rights review are required; URLs and previews are not permission.');
 const media=current.editorial.orderedMedia;
 if(!Array.isArray(media)||!media.length||new Set(media.map(m=>m.assetId)).size!==media.length||media.some((m,i)=>!m.identityConfirmed||!m.fileUrl||m.position!==i+1))add('INVALID_NATIVE_MEDIA_SEQUENCE','Use an ordered, unambiguous native asset sequence with production file references.');
 for(const code of current.readiness?.blockers||[])if(!issues.some(i=>i.code===code))add(code,'Resolve '+code.toLowerCase().replace(/_/g,' ')+' in the existing editorial/native review.');
 return {accepted:issues.length===0,issues,scope:'development_validation_only',productionApplied:false,nativeImportEnabled:false,publicationApproved:false,rightsGranted:false};
}

/** One n8n Code-node proof. The workflow harness supplies independently loaded native context. No writer nodes. */
export function nativePacketImportProofCode(){return `const validate=${validatePacketImport.toString()};const packet=$input.first().json.packet;const current=$('Read Current Native Context').first().json.packet;const verdict=validate(packet,current);return [{json:{...verdict,...(verdict.accepted?{developmentProposal:{concept_id:current.identity.conceptId,package_id:current.identity.packageId,expected_row_id:current.identity.packageRowId,expected_version:current.identity.packageVersion,expected_source_digest:current.identity.packageSourceDigest,caption_draft:current.editorial.caption,slide_sequence_asset_ids:JSON.stringify(current.editorial.orderedMedia.map(m=>m.assetId)),format:current.editorial.format,citations:current.editorial.claims}}:{})}}];`;}
