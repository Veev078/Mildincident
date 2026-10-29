import {analyzeStory} from '../editorial-intelligence.js';
import {buildEditorialDirection} from '../editorial-direction.js';
import {assessEditorialPackage} from '../editorial-evidence.js';
import {buildWorkspace,WORKSPACE_TABLES} from './model.js';

/** Adapt a real, provenance-validated n8n development candidate to existing Studio tools. */
export function developmentCandidateStory(candidate,{soundtrack=[],drafts=new Map(),decision=null,evidence=null}={}) {
  const id='CON-DEV-'+candidate.jobId;
  const sourceAudit=assessEditorialPackage(candidate,evidence);
  const metadata=new Map((evidence?.images||[]).filter(m=>m.assetId).map(m=>[m.assetId,m]));
  const format=candidate.format||'carousel';
  const target=format==='single_image'?1:candidate.targetSlideCount||5;
  const allMedia=[...candidate.media,...(evidence?.additionalMedia||[]).filter(m=>!candidate.media.some(original=>original.id===m.id))];
  const proposed=(evidence?.selectionProposal?.assetIds||candidate.proposedAssetIds||[]).filter(id=>allMedia.some(m=>m.id===id)).slice(0,target);
  const records=Object.fromEntries(Object.keys(WORKSPACE_TABLES).map(k=>[k,[]]));
  const media=allMedia.map((m,index)=>({concept_id:id,asset_id:m.id||`${id}-image-${index+1}`,title:m.title,creator:metadata.get(m.id)?.creator||m.creator,source_page_url:m.sourceUrl,thumb_url:m.previewUrl,provider:m.provider,license:m.license,rights_status:'preview_unreviewed',width:0,height:0}));
  records.stories=[{concept_id:id,title:candidate.title||'Development research needs work',subject:candidate.subject,hook:candidate.hook,caption:candidate.captionDraft,format,stage:decision?.decision==='rejected'?'development_rejected':decision?.decision==='approved'?'development_approved':decision?.decision==='needs_research'||sourceAudit.status==='needs_research'?'development_needs_research':'development_review',approval_status:decision?.decision==='approved'?'development_approved':'pending',citations:JSON.stringify(candidate.claims.map(c=>({claim:c.claim,claim_type:c.claimType,source_name:c.sourceName,source_url:c.url}))),founder_feedback:'Generated in an isolated n8n development job. Source facts, photographic identity and rights still require review.'}];
  records.media=media;records.soundtrack=soundtrack;
  records.packages=[{concept_id:id,caption_draft:candidate.captionDraft,slide_sequence_asset_ids:JSON.stringify(proposed),target_slide_count:target,rights_review_status:'unreviewed',source_claims_reviewed:false,designer_notes:candidate.carouselOutline,source_claims_review_notes:candidate.gaps.join('\n')}];
  const snapshot={records,observedAt:candidate.provenance.generatedAt,buffer:{posts:[],complete:true,observedAt:candidate.provenance.generatedAt},warnings:[]};
  const story=buildWorkspace(snapshot,drafts).stories[0];
  for(const asset of story.media){const original=allMedia.find(m=>m.id===asset.id);const captured=metadata.get(asset.id);if(captured){asset.sourceCaption=captured.caption;asset.sourceCredit=captured.credit;asset.sourceYears=captured.years;asset.sourceRelation=captured.relation;asset.materialType=captured.materialType;asset.dateContext=captured.dateContext;}else if(original?.sourceCaption){for(const key of ['sourceCaption','sourceCredit','sourceYears','sourceRelation','materialType','dateContext'])asset[key]=original[key];}}
  story.research=story.research.map((claim,index)=>{const packet=evidence?.sources.find(s=>s.claimIndex===index)||(candidate.sourceEvidence||[]).find(s=>s.claimIndex===index);return {...claim,linkStatus:candidate.claims[index]?.linkStatus||'unknown',capturedAccess:packet?.access||'not_inspected',capturedTextExcerpt:packet?.textExcerpt||'',capturedSourceTitle:packet?.title||'',capturedHttpStatus:packet?.httpStatus??null};});
  const working=story.localDraft&&!story.localDraft.stale?{...story,...story.localDraft}:story;
  story.intelligence=analyzeStory(working,{catalog:soundtrack});story.musicRecommendations=story.intelligence.musicRecommendations;
  story.editorialDirection=buildEditorialDirection(working,{creativeBrief:story.localDraft?.creativeBrief});
  story.editorialAudit=assessEditorialPackage({...candidate,captionDraft:working.caption,format:working.format,targetSlideCount:working.targetSlideCount,proposedAssetIds:working.selectedAssetIds},evidence?{...evidence,selectionProposal:{...evidence.selectionProposal,assetIds:working.selectedAssetIds}}:null);
  story.selectionProposalBasis=proposed.length?'source_caption_metadata_match':'no_automatic_selection';
  story.generationFormat=format;story.discoveryPlan=candidate.discoveryPlan||null;
  story.origin='n8n_development';story.engineCandidateId=candidate.id;story.engineJobId=candidate.jobId;story.engineProvenance=candidate.provenance;story.developmentDecision=decision;
  return story;
}
