import {createHash,randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {publishingGraphSha} from './buffer-handoff-security.js';
import {BUFFER_CLAIM_COLUMNS} from './buffer-claim-migration.js';
import {stableNative} from './buffer-native-contract.js';

/** Temporary, non-publishing proof, prepared only. The two actual native UPDATE
 * nodes come from the reviewed writer. No Buffer, media, approval or AI node can
 * be reached. A separate approval is required to install/run/remove this graph. */
export function prepareBufferClaimProof(writer,{rowId,storyId,packageVersion,credentialId='__APPROVED_PUBLISHING_JWT_CREDENTIAL__',proofId=randomUUID()}={}){
 requireThat(writer.workflowId==='Q02tRHMtZ90Kib18'&&/^[-a-f0-9]{36}$/.test(proofId)&&Number.isInteger(rowId)&&rowId>0&&/^CON-[A-Za-z0-9_-]{5,95}$/.test(storyId||'')&&Number.isInteger(packageVersion)&&packageVersion>0,'INVALID_CLAIM_PROOF','Bind the proof to one reviewed, unused canonical package.');
 const owners=[0,1].map(i=>'mildincident:claim-proof:'+proofId+':'+i),digest=createHash('sha256').update(proofId).digest('hex');
 const clone=name=>{const n=writer.update.nodes.find(n=>n.name===name);requireThat(n?.type==='n8n-nodes-base.dataTable','CLAIM_PROOF_SOURCE_CHANGED','Use the exact prepared writer reservation nodes.');return structuredClone(n);};
 const reserve=clone('Acquire Shared Buffer Reservation'),restore=clone('Commit Shared Buffer Create Intent');restore.name='Restore Only This Probe Claim';
 Object.assign(restore.parameters.columns.value,{buffer_claim_state:'idle',buffer_claim_owner:'',buffer_claim_digest:''});
 const node=(name,type,typeVersion,parameters,extra={})=>({id:'claim-proof-'+createHash('sha256').update(name).digest('hex').slice(0,16),name,type,typeVersion,position:[0,0],parameters,retryOnFail:false,...extra});
 const webhook=node('Private Claim Proof Request','n8n-nodes-base.webhook',2.1,{httpMethod:'POST',path:'mildincident-buffer-claim-check-'+proofId,responseMode:'responseNode',authentication:'jwtAuth',options:{}},{webhookId:proofId,credentials:{jwtAuth:{id:credentialId,name:'MILDINCIDENT Studio publishing JWT'}}});
 const read=node('Canonical Claim Proof Body','n8n-nodes-base.code',2,{jsCode:`${stableNative.toString()}const raw=$input.first().json;return [{json:{body:raw.body,auth:raw.headers?.authorization,canonical:stableNative(raw.body)}}];`});
 const hash=node('Hash Claim Proof Body','n8n-nodes-base.crypto',1,{action:'hash',type:'SHA256',value:'={{ $json.canonical }}',dataPropertyName:'digest',encoding:'hex'});
 const bind=node('Bind Shared Buffer Claim','n8n-nodes-base.code',2,{jsCode:`const raw=$('Canonical Claim Proof Body').first().json,r=raw.body;let claims,head;try{const parts=String(raw.auth).replace(/^Bearer /,'').split('.');head=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw Error('CLAIM_PROOF_AUTH_DENIED');}const now=Math.floor(Date.now()/1000);if(!$('Private Claim Proof Request').isExecuted||head.alg!=='HS256'||claims.iss!=='mildincident-studio'||claims.aud!=='mildincident-native-publishing-v1'||claims.sub!=='founder'||claims.bodySha256!==$input.first().json.digest||claims.jti!==r?.requestId||!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.exp<=now||claims.iat>now+30||claims.exp-claims.iat>300||r.proofId!==${JSON.stringify(proofId)}||!['reserve','restore'].includes(r.action)||!${JSON.stringify(owners)}.includes(r.owner)||Object.keys(r).some(k=>!['action','proofId','owner','requestId'].includes(k)))throw Error('CLAIM_PROOF_SCOPE_DENIED');return [{json:{action:r.action,claim:{packageRowId:${rowId},conceptId:${JSON.stringify(storyId)},packageVersion:${packageVersion},owner:r.owner,digest:${JSON.stringify(digest)}}}}];`});
 const choose=node('Restore Probe?', 'n8n-nodes-base.if',2.2,{conditions:{options:{typeValidation:'strict',version:2},conditions:[{leftValue:"={{ $json.action === 'restore' }}",rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}});
 const result=node('Read Native Claim Proof Outcome','n8n-nodes-base.code',2,{jsCode:"const b=$('Bind Shared Buffer Claim').first().json,rows=$input.all().map(i=>i.json).filter(r=>r.id);if(rows.length>1)throw Error('CLAIM_PROOF_MULTIPLE_ROWS');const r=rows[0];if(r&&r.id!==b.claim.packageRowId)throw Error('CLAIM_PROOF_ROW_CHANGED');return [{json:{state:rows.length===1?'changed':'not_acquired',action:b.action,owner:b.claim.owner,changedRows:rows.length,executionId:String($execution.id)}}];"});
 const response=node('Return Claim Proof Only','n8n-nodes-base.respondToWebhook',1.4,{respondWith:'json',responseBody:'={{ $json }}',options:{responseCode:200}}),edge=n=>({node:n,type:'main',index:0}),links={};
 const link=(a,b)=>links[a]={main:[[edge(b)]]};link(webhook.name,read.name);link(read.name,hash.name);link(hash.name,bind.name);link(bind.name,choose.name);links[choose.name]={main:[[edge(restore.name)],[edge(reserve.name)]]};link(reserve.name,result.name);link(restore.name,result.name);link(result.name,response.name);
 const update={name:'MILDINCIDENT shared Buffer claim proof (temporary)',nodes:[webhook,read,hash,bind,choose,reserve,restore,result,response],connections:links,settings:{executionOrder:'v1',availableInMCP:false}};
 return {update,review:{proofId,rowId,storyId,packageVersion,owners,digest,graphSha256:publishingGraphSha(update),bufferNodes:0,aiNodes:0,columnsTouched:BUFFER_CLAIM_COLUMNS,liveApplied:false}};
}

/** Injected runner only: never installs anything or knows a live credential.
 * Even an ambiguous probe is conditionally cleaned up, never reset blindly. */
export async function verifySharedClaimOnce({proof,dispatch,readPackage}){
 const before=await readPackage(),{owners,proofId,digest}=proof.review,without=r=>stableNative(Object.fromEntries(Object.entries(r).filter(([k])=>!BUFFER_CLAIM_COLUMNS.includes(k)&&!['updatedAt','updated_date'].includes(k))));
 requireThat(before.id===proof.review.rowId&&before.production_version===proof.review.packageVersion&&before.buffer_claim_state==='idle'&&!before.buffer_claim_owner&&!before.buffer_claim_digest,'CLAIM_PROOF_NOT_IDLE','Do not probe an existing reservation or uncertain delivery.');
 let results,error;try{results=await Promise.allSettled(owners.map(owner=>dispatch({action:'reserve',proofId,owner,requestId:randomUUID()})));}catch(e){error=e;}
 const current=await readPackage();if(current.buffer_claim_state==='reserved'&&owners.includes(current.buffer_claim_owner)&&current.buffer_claim_digest===digest)await dispatch({action:'restore',proofId,owner:current.buffer_claim_owner,requestId:randomUUID()});
 const after=await readPackage();requireThat(after.buffer_claim_state==='idle'&&!after.buffer_claim_owner&&!after.buffer_claim_digest&&without(before)===without(after),'CLAIM_PROOF_RESTORE_REQUIRED','Leave publishing disabled; probe restoration needs review.');
 requireThat(!error&&results?.every(r=>r.status==='fulfilled')&&results.filter(r=>r.value.changedRows===1).length===1&&results.filter(r=>r.value.changedRows===0).length===1,'CLAIM_PROOF_FAILED','The native claim was not proven. Publishing must remain disabled.');
 return {verified:true,graphSha256:proof.review.graphSha256,writerClaimColumns:BUFFER_CLAIM_COLUMNS,oneWinner:true,nonClaimDataPreserved:true,probeRestored:true};
}
