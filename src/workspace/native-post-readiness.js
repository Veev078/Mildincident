/** Concept decisions are canonical; private drafts cannot imply approval. */
export function nativePreparationReadiness(story){
 const pkg=story.production?.package,existing=Boolean(pkg?.rowId&&pkg.id&&Number.isInteger(pkg.version)&&pkg.version>0);
 const ambiguous=story.production?.relationship==='ambiguous'||story.production?.blockers?.includes('AMBIGUOUS_PRODUCTION_PACKAGE');
 const approved=['approved','concept_approved'].includes(story.approvalStatus),allowed=['approved_for_sourcing','media_review_required','sourcing_complete','ready_for_production'].includes(story.stage);
 const pending=['awaiting_chief_review','needs_revision','awaiting_founder_approval'].includes(story.stage)&&['pending','revision_requested','awaiting_founder_approval',''].includes(story.approvalStatus||'');
 let code=null,reason=null;
 if(story.organization?.trashed){code='POST_IN_TRASH';reason='Restore this post before preparation.';}
 else if(story.localDraft?.stale){code='STALE_SOURCE';reason='The source changed. Compare it with your saved edit before continuing.';}
 else if(story.origin==='n8n_development'){code='CANONICAL_STORY_REQUIRED';reason='This generated draft needs its canonical story record before preparation.';}
 else if(ambiguous||pkg&&!existing){code='PRODUCTION_RECORD_INVALID';reason='The existing production record is ambiguous or incomplete. Reconcile that record; another concept approval will not repair it.';}
 else if(!existing&&!approved&&pending){code='CONCEPT_APPROVAL_REQUIRED';reason='Approve this editorial concept to prepare its caption and slides. This does not approve facts, image usage or publishing.';}
 else if(!existing&&!allowed){code='CONCEPT_STAGE_INVALID';reason=`This story is at “${story.stage||'unrecorded'}”. ${approved?'Its concept approval is already recorded. ':''}The stage must be reconciled before preparation; approving again will not fix it.`;}
 else if(!existing&&!approved){code='CONCEPT_STATE_INVALID';reason='The concept decision and current stage do not agree. Reconcile the canonical record before preparation.';}
 return {available:!code,required:!existing,conceptApproved:approved,conceptConfirmationRequired:code==='CONCEPT_APPROVAL_REQUIRED',code,reason};
}
