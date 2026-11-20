/** Editorial identity excludes operational claim owners and database timestamps.
 * A claim update must not invalidate the exact caption/images it protects. */
export function nativePackageDigestMaterial(p){
 return Object.fromEntries(['id','concept_id','package_id','production_version','editorial_handoff_version','caption_draft','slide_sequence_asset_ids','final_caption','final_asset_urls','final_assets_verified','final_approval_status','source_claims_reviewed','source_claims_review_notes','rights_review_status','format','target_slide_count','cover_treatment','sequence_status','slide_manifest','render_batch_id','render_revision','render_manifest_json','render_preflight_status','proof_execution_id'].map(k=>[k,p[k]??null]));
}
