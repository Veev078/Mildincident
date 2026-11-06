import {esc} from './components.js';

// Compare text, not record IDs: autosave and a generated draft may contain identical copy.
// Keep the current-revision representative usable without discarding stale provenance.
export function distinctCaptionVersions(versions=[]){
 const groups=new Map();
 for(const v of versions){if(typeof v.caption!=='string'||!v.caption.trim())continue;
  const prior=groups.get(v.caption);if(!prior){groups.set(v.caption,{...v,origins:[v]});continue;}
  prior.origins.push(v);if(prior.applicable===false&&v.applicable!==false){const origins=prior.origins;groups.set(v.caption,{...v,origins});}
 }
 return [...groups.values()];
}

/** Bounded word diff. All editorial text is escaped before highlighting. */
export function captionDifference(current,selected){
 const a=String(current||'').match(/\s+|[^\s]+/gu)||[],b=String(selected||'').match(/\s+|[^\s]+/gu)||[];
 if(a.length*b.length>250000)return {current:esc(current),selected:esc(selected),detailed:false};
 const table=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i]===b[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
 let i=0,j=0,left='',right='';
 while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){left+=esc(a[i++]);right+=esc(b[j++]);}
 else if(i<a.length&&(j===b.length||table[i+1][j]>=table[i][j+1]))left+='<del>'+esc(a[i++])+'</del>';
 else right+='<ins>'+esc(b[j++])+'</ins>';}
 return {current:left,selected:right,detailed:true};
}
