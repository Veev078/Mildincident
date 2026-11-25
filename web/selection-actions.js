import {effective} from './components.js';

/** Explicit edits only. Matching a private file never rewrites a saved choice. */
export function savedCopySelection(story,referenceId){
 const reference=story.media.find(a=>a.id===referenceId),copy=story.media.find(a=>a.id===reference?.savedCopy?.assetId);
 if(!copy?.localPreview||copy.localPreview.sha256!==reference.savedCopy.sha256)throw Error('Reopen this photograph to check its saved copy.');
 const ids=effective(story).selectedAssetIds;
 if(!ids.includes(referenceId))return coverSelection(story,copy.id,false);
 if(ids.includes(copy.id))return ids.filter(id=>id!==referenceId);
 return ids.map(id=>id===referenceId?copy.id:id);
}
export function coverSelection(story,assetId,cover=true){
 if(!story.media.some(a=>a.id===assetId))throw Error('Reopen this photograph before choosing it.');
 const ids=effective(story).selectedAssetIds;
 const result=cover?[assetId,...ids.filter(id=>id!==assetId)]:ids.includes(assetId)?ids:[...ids,assetId];
 if(result.length>20)throw Error('Remove a slide before adding another photograph. A post can have up to 20 slides.');
 return result;
}
