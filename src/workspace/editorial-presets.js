import {createHash} from 'node:crypto';
import {requireThat} from '../errors.js';

// Verified read-only native tables. Selection is observed, never written here.
export const EDITORIAL_PRESET_TABLES=Object.freeze({editorialPresets:'2NoRbvxCc120cM8t',editorialPresetSelection:'OQUJtdxjKZQLhYwS'});

export function editorialPresetCatalog(snapshot) {
 const rows=snapshot?.records?.editorialPresets,selection=snapshot?.records?.editorialPresetSelection;
 if(!Array.isArray(rows)||!Array.isArray(selection))return {available:false,observedAt:null,items:[]};
 const selected=selection.filter(r=>r.selection_key==='current');
 const items=rows.filter(r=>r&&typeof r.preset_key==='string'&&/^[a-z0-9_-]{1,100}$/.test(r.preset_key)&&typeof r.preset_name==='string'&&r.preset_name.length<=120&&typeof r.theme_prompt==='string'&&r.theme_prompt.trim().length>=12&&r.theme_prompt.trim().length<=2000&&['current_live_brand_brain','overlay_existing_brain'].includes(r.base_mode)&&r.status!=='archived').map(r=>{
  const item={key:r.preset_key,name:r.preset_name,direction:r.theme_prompt.trim(),baseMode:r.base_mode,nativeStatus:String(r.status||'').slice(0,100),nativeActive:r.is_active===true,nativeSelected:selected.length===1&&selected[0].preset_key===r.preset_key,nativeUpdatedAt:String(r.updatedAt||'')};
  return {...item,version:createHash('sha256').update(JSON.stringify(item)).digest('hex')};
 });
 // Ambiguous records cannot silently select a different direction.
 return {available:true,observedAt:snapshot.observedAt,items:items.filter(item=>items.filter(i=>i.key===item.key).length===1),selectionMode:'saved_brief'};
}

/** Reuse the existing brief input, not an invented n8n preset parameter. */
export function resolvePresetRequest(input,catalog,existing=null) {
 if(!input?.preset)return {input,preset:null};
 requireThat(Object.keys(input).every(k=>['kind','prompt','sourceUrl','idempotencyKey','preset'].includes(k))&&input.preset&&Object.keys(input.preset).length===2&&typeof input.preset.key==='string'&&/^[a-f0-9]{64}$/.test(input.preset.version),'INVALID_RESEARCH_REQUEST','Choose a recorded editorial theme.');
 const {preset,...request}=input;
 // A lost-response retry keeps its original immutable snapshot, even after a catalog refresh.
 const saved=existing?.preset;
 const item=saved&&saved.key===preset.key&&saved.version===preset.version?saved:catalog.items.find(i=>i.key===preset.key&&i.version===preset.version);
 requireThat(item,'PRESET_CHANGED','This theme changed or is unavailable. Check for updates and choose it again.');
 requireThat(request.kind==='brief'&&request.prompt===item.direction&&!request.sourceUrl,'INVALID_RESEARCH_REQUEST','The saved direction must match the selected theme.');
 return {input:request,preset:item};
}
