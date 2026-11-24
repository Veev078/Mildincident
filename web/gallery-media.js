// Retrieval is custody, not relevance. Founder acceptance is bound to this exact saved image.
export function acceptedSavedPhoto(story,asset){
 const r=asset.localReview,c=r?.context;
 return Boolean(asset.localPreview&&r?.decision==='shortlist'&&c?.decisionBasis==='project_relevance'&&c.previewSha256===asset.localPreview.sha256&&(c.sourceUrl||'')===(asset.sourceUrl||'')&&c.subject===(story.subject||story.title));
}
export function galleryMedia(story){
 const selected=story.localDraft?.selectedAssetIds??story.selectedAssetIds??[],all=story.media||[],selectedCopies=new Set(all.filter(a=>selected.includes(a.id)).map(a=>a.savedCopy?.assetId).filter(Boolean));
 const direct=a=>a.photoRelevance?.category==='direct'||selected.includes(a.id)||selectedCopies.has(a.id)||acceptedSavedPhoto(story,a);
 const key=a=>a.localPreview?.originalSha256||a.localPreview?.sha256||a.id,representatives=new Map();
 const candidates=all.filter(a=>a.localPreview&&(a.localReview?.decision!=='reject'||selected.includes(a.id)));
 for(const a of [...candidates].sort((a,b)=>Number(selected.includes(b.id))-Number(selected.includes(a.id))||Number(direct(b))-Number(direct(a))))if(!representatives.has(key(a)))representatives.set(key(a),a);
 const unique=a=>representatives.get(key(a))===a;
 const saved=candidates.filter(a=>unique(a)&&direct(a)),references=all.filter(a=>!a.localPreview&&direct(a));
 const inspect=candidates.filter(a=>unique(a)&&!direct(a)); // Visible for judgment, never silently promoted.
 const other=all.filter(a=>!saved.includes(a)&&!references.includes(a)&&!inspect.includes(a));
 return {saved,references,inspect,other};
}
