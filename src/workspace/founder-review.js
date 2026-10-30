import {requireThat} from '../errors.js';
export const REVIEW_ACTIONS=['develop','save','pass','explore','alternatives','reset'];
export const REVIEW_BASES=['overall_selection','individual_photograph','images_for_subject','story_angle','needs_research','publication_fit','factual_issue','source_issue','rights_issue','retrieval_issue','interface_issue'];
export const TASTE_DIMENSIONS=['photographic_style','subject','originality','mood','composition','cultural_relevance','familiarity','story_potential'];
/** Founder preferences in the existing private research DB, never publication approvals. */
export class FounderReviewStore {
 constructor(research){this.db=research.db;this.db.exec('CREATE TABLE IF NOT EXISTS founder_review_events(target_id TEXT NOT NULL,version INTEGER NOT NULL,data_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(target_id,version))');}
 get(id){const row=this.db.prepare('SELECT version,data_json,created_at FROM founder_review_events WHERE target_id=? ORDER BY version DESC LIMIT 1').get(id);return row?{...JSON.parse(row.data_json),version:row.version,createdAt:row.created_at}:null;}
 all(){return Object.fromEntries(this.db.prepare('SELECT e.target_id,e.version,e.data_json,e.created_at FROM founder_review_events e WHERE version=(SELECT MAX(version) FROM founder_review_events WHERE target_id=e.target_id)').all().map(r=>[r.target_id,{...JSON.parse(r.data_json),version:r.version,createdAt:r.created_at}]));}
 history(id){return this.db.prepare('SELECT version,data_json,created_at FROM founder_review_events WHERE target_id=? ORDER BY version DESC LIMIT 20').all(id).map(r=>({...JSON.parse(r.data_json),version:r.version,createdAt:r.created_at}));}
 record(story,input,{afterSave}={}){
  requireThat(story&&input&&Object.keys(input).every(k=>['decision','basis','reason','dimensions','expectedVersion','sourceRevision','workingVersion','assetId','previewSha256'].includes(k)),'INVALID_FOUNDER_REVIEW','Review an existing proposal. Publication flags are not accepted.');
  requireThat(REVIEW_ACTIONS.includes(input.decision)&&(input.basis===undefined||REVIEW_BASES.includes(input.basis))&&(input.reason===undefined||typeof input.reason==='string'&&input.reason.length<=1200),'INVALID_FOUNDER_REVIEW','Choose an editorial action; a note is optional.');
  const dimensions=input.dimensions||[];requireThat(Array.isArray(dimensions)&&dimensions.length<=8&&new Set(dimensions).size===dimensions.length&&dimensions.every(d=>TASTE_DIMENSIONS.includes(d)),'INVALID_FOUNDER_REVIEW','Choose supported preference dimensions.');
  requireThat(input.sourceRevision===story.revision&&input.workingVersion===(story.localDraft?.version||0),'EDIT_CONFLICT','This proposal changed. Reload the current material before reviewing.');
  let photograph=null;
  if(input.basis==='individual_photograph'){
   const matches=(story.media||[]).filter(asset=>asset.id===input.assetId);
   requireThat(matches.length===1,'INVALID_FOUNDER_REVIEW','Choose an exact photograph belonging to this story.');
   const asset=matches[0],previewSha256=asset.localPreview?.sha256||'';
   requireThat(input.previewSha256===previewSha256,'EDIT_CONFLICT','This photograph preview changed. Review it again before saving feedback.');
   photograph={assetId:asset.id,sourceUrl:asset.sourceUrl||'',creator:asset.creator||'',previewSha256:previewSha256||null,previewEvidence:previewSha256?'local_pixels_available':asset.previewUrl?'remote_reference':'metadata_only',identityVerified:false,rightsGranted:false};
  }else requireThat(input.assetId===undefined&&input.previewSha256===undefined,'INVALID_FOUNDER_REVIEW','Image identifiers require photograph-specific feedback.');
  this.db.exec('BEGIN IMMEDIATE');try{const prior=this.get(story.id);requireThat(Number.isInteger(input.expectedVersion)&&input.expectedVersion===(prior?.version||0),'EDIT_CONFLICT','A newer decision exists. Reload before changing it.');
   const value={decision:input.decision,basis:input.basis||'overall_selection',reason:(input.reason||'').trim(),dimensions,subject:story.subject||story.title,sourceRevision:story.revision,workingVersion:story.localDraft?.version||0,scope:photograph?'specific_photograph_selection':'specific_editorial_proposal',...(photograph?{photograph}:{}),reviewer:'founder',publicationApproved:false,rightsGranted:false};
   this.db.prepare('INSERT INTO founder_review_events VALUES(?,?,?,?)').run(story.id,(prior?.version||0)+1,JSON.stringify(value),new Date().toISOString());if(afterSave)afterSave(value);this.db.exec('COMMIT');return this.get(story.id);
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
}

/** A private follow-up direction, not dispatch or a generated story. */
export function founderFollowUp(story,review){
 if(!['explore','alternatives'].includes(review.decision))return null;
 const photo=review.photograph||(story.media||[]).find(p=>p.id===(story.localDraft?.selectedAssetIds||story.selectedAssetIds||[])[0])||story.media?.[0];
 const task=review.decision==='alternatives'?'Find alternative photographs and related frames':'Deepen evidence and develop a grounded editorial angle';
 const scope=review.photograph?'Feedback concerns only photograph '+review.photograph.assetId+'. Keep the subject eligible; seek a different frame, shoot or credited source.':'Feedback basis: '+review.basis+'. Do not infer a universal subject ban.';
 return {kind:'brief',prompt:(task+' for the existing story: '+(story.subject||story.title)+'. Preserve its identity and existing working revisions. '+scope+' Founder context: '+(review.reason||'No note supplied')+'. Treat sources and credits as research leads, not verified rights or photographic quality.').slice(0,2000),sourceUrl:photo?.sourceUrl||''};
}
