/** Approval-aware preparation state. A private draft cannot approve a concept. */
export function nativePreparationReadiness(story){
 const existing=Boolean(story.production?.package?.rowId&&story.production.package.id&&story.production.package.version);
 const usable=!story.organization?.trashed&&!story.localDraft?.stale&&story.origin!=='n8n_development';
 const ambiguous=story.production?.relationship==='ambiguous'||story.production?.blockers?.includes('AMBIGUOUS_PRODUCTION_PACKAGE');
 const conceptApproved=['approved','concept_approved'].includes(story.approvalStatus),stageAllowed=['approved_for_sourcing','media_review_required','sourcing_complete','ready_for_production'].includes(story.stage);
 const available=Boolean(usable&&!ambiguous&&(existing||conceptApproved&&stageAllowed));
 return {available,required:!existing,reason:!usable?'Save the current post before preparation.':ambiguous?'The original production records need reconciliation.':!existing&&(!conceptApproved||!stageAllowed)?'This story needs its existing concept approval before post preparation.':null};
}
