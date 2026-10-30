import {createHash} from 'node:crypto';
import {canonical} from '../package.js';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {requireThat,HandoffError} from '../errors.js';

export const photoDigest=value=>createHash('sha256').update(canonical(value)).digest('hex');
/** Portable validation used by the Studio and the proposed n8n Code node. A digest is correlation, not authentication. */
export function validatePhotoPacket(packet,digestOf,safe) {
 const must=(ok,code)=>{if(!ok)throw new Error(code);};
 must(packet&&packet.schemaVersion===1&&packet.payload&&/^[a-f0-9]{64}$/.test(packet.digest),'INVALID_PHOTO_PACKET');
 const p=packet.payload;must(p.purpose==='private_photographic_research'&&p.productionApplied===false&&p.rightsGranted===false,'INVALID_PHOTO_SCOPE');
 must(typeof p.requestId==='string'&&/^[a-f0-9-]{36}$/.test(p.requestId),'INVALID_PHOTO_IDENTITY');
 must(p.direction&&typeof p.direction.query==='string'&&p.direction.query.trim().length>=2&&p.direction.query.length<=500&&['story','image','photographer','series','archive','scene','adjacent'].includes(p.direction.mode),'INVALID_PHOTO_DIRECTION');
 must(['commons','loc','aic'].includes(p.direction.source)&&Number.isInteger(p.direction.page)&&p.direction.page>=1&&p.direction.page<=1000,'INVALID_PHOTO_SOURCE');
 must(p.budget?.sourceCalls===1&&p.budget.automaticRetries===0&&p.budget.paidCalls===0&&p.budget.remoteWrites===0,'INVALID_PHOTO_BUDGET');
 must(Array.isArray(p.references)&&p.references.length<=20,'INVALID_PHOTO_REFERENCES');
 for(const r of p.references){must(r&&typeof r.id==='string'&&r.id.length<=1600&&r.id.length>0,'INVALID_PHOTO_REFERENCE');for(const k of ['title','creator','date','description','sourceUrl','previewUrl'])must(typeof r[k]==='string'&&r[k].length<=2000,'INVALID_PHOTO_REFERENCE');must((!r.sourceUrl||safe(r.sourceUrl))&&(!r.previewUrl||safe(r.previewUrl)),'UNSAFE_PHOTO_REFERENCE');must(r.rightsGranted===false&&r.publicationApproved===false,'INVALID_PHOTO_SCOPE');must(r.nativeStoryId===null||typeof r.nativeStoryId==='string'&&/^CON-[A-Za-z0-9_-]{1,120}$/.test(r.nativeStoryId),'INVALID_NATIVE_PHOTO_LINK');}
 must(new Set(p.references.map(r=>r.id)).size===p.references.length,'DUPLICATE_PHOTO_REFERENCE');
 must(JSON.stringify(p).length<=24000,'PHOTO_PACKET_TOO_LARGE');must(digestOf(p)===packet.digest,'PHOTO_PACKET_CHANGED');return p;
}
export function makePhotoPacket(hunt,photos,{source=hunt.source==='saved'?'commons':hunt.source,page=hunt.source===source?hunt.page:1}={}) {
 const cut=(v,n)=>String(v||'').slice(0,n);
 const references=photos.map(p=>({id:p.id,title:cut(p.title,300),creator:cut(p.creator,300),date:cut(p.date,150),description:cut(p.description,600),sourceUrl:safePhotoReference(p.sourceUrl),previewUrl:safePhotoReference(p.previewUrl),nativeStoryId:p.nativeStoryId||null,decision:p.decision?{decision:p.decision.decision,reason:cut(p.decision.reason,700)}:null,rightsGranted:false,publicationApproved:false}));
 const payload={purpose:'private_photographic_research',requestId:hunt.id,direction:{query:hunt.query,mode:hunt.mode,source,page,originSource:hunt.source,parentTrailId:hunt.parent||null},references,budget:{sourceCalls:1,automaticRetries:0,paidCalls:0,remoteWrites:0},productionApplied:false,rightsGranted:false};
 const packet={schemaVersion:1,digest:photoDigest(payload),payload};try{validatePhotoPacket(packet,photoDigest,safePhotoReference);}catch(error){throw new HandoffError(error.message,'Research packet is invalid or exceeds 24,000 characters. Choose a supported archive and fewer references; no workflow was run.');}return packet;
}
export function validatePhotoReceipt(receipt,packet) {
 const p=validatePhotoPacket(packet,photoDigest,safePhotoReference);
 requireThat(receipt?.schemaVersion===1&&receipt.purpose==='private_photographic_research_result'&&receipt.inputDigest===packet.digest&&receipt.requestId===p.requestId,'INVALID_PHOTO_RECEIPT','This result does not match the exported research packet.');
 requireThat(receipt.source===p.direction.source&&receipt.query===p.direction.query&&receipt.page===p.direction.page&&receipt.remoteWrites===0&&receipt.paidCalls===0&&receipt.rightsGranted===false,'INVALID_PHOTO_RECEIPT','Research source, page or scope changed.');
 requireThat(['ok','unavailable'].includes(receipt.status)&&Array.isArray(receipt.photos)&&receipt.photos.length<=20&&typeof receipt.hasMore==='boolean'&&Number.isFinite(Date.parse(receipt.observedAt)),'INVALID_PHOTO_RECEIPT','The research result is incomplete.');
 requireThat(receipt.executionId===null||typeof receipt.executionId==='string'&&/^\d{1,30}$/.test(receipt.executionId),'INVALID_PHOTO_RECEIPT','Execution identity is invalid.');
 requireThat(receipt.status==='ok'||!receipt.photos.length,'INVALID_PHOTO_RECEIPT','A failed response cannot claim retrieved photographs.');
 for(const r of receipt.photos){requireThat(r&&typeof r.id==='string'&&r.id.startsWith(receipt.source+':')&&r.id.length<=1600&&r.source===receipt.source&&r.query===receipt.query&&r.rightsGranted===false&&r.publicationApproved===false,'INVALID_PHOTO_RECEIPT','A photograph has mismatched provenance or publication flags.');for(const k of ['sourceUrl','previewUrl','fileUrl'])requireThat(typeof r[k]==='string'&&(!r[k]||safePhotoReference(r[k])),'INVALID_PHOTO_RECEIPT','Unsafe photograph URL.');for(const k of ['title','creator','date','description','series','rightsLabel'])requireThat(typeof r[k]==='string'&&r[k].length<=2000,'INVALID_PHOTO_RECEIPT','Unexpected photograph metadata.');}
 requireThat(new Set(receipt.photos.map(p=>p.id)).size===receipt.photos.length,'INVALID_PHOTO_RECEIPT','Duplicate result identities.');return receipt;
}
export {canonical};
