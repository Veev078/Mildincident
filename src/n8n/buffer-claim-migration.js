import {requireThat} from '../errors.js';
import {priorBufferHandoff} from './buffer-native-contract.js';
import {PUBLISHING_TABLES} from './buffer-release-patch.js';

export const BUFFER_CLAIM_COLUMNS=Object.freeze(['buffer_claim_state','buffer_claim_owner','buffer_claim_digest']);

/** Review-only plan. No writes or reset operations. All native history versions
 * count; an unknown outcome is never made sendable by migration. */
export function prepareBufferClaimMigration({packages,manual,guarded}){
 const seen=new Set(),rows=[];
 for(const p of packages){
  requireThat(p.id&&p.concept_id&&!seen.has(p.concept_id),'NATIVE_PACKAGE_AMBIGUOUS','Resolve duplicate canonical production packages before publishing setup.');seen.add(p.concept_id);
  if(BUFFER_CLAIM_COLUMNS.some(k=>p[k]!==null&&p[k]!==undefined&&p[k]!=='')){rows.push({rowId:p.id,storyId:p.concept_id,action:'preserve_existing_claim'});continue;}
  rows.push({rowId:p.id,storyId:p.concept_id,packageVersion:p.production_version,action:'initialize_empty_only',expected:Object.fromEntries(BUFFER_CLAIM_COLUMNS.map(k=>[k,p[k]??null])),values:{buffer_claim_state:priorBufferHandoff([...manual,...guarded],p.concept_id)?'blocked_existing_handoff':'idle',buffer_claim_owner:'',buffer_claim_digest:''}});
 }
 return {columns:BUFFER_CLAIM_COLUMNS.map(name=>({name,type:'string'})),rows,liveApplied:false};
}

/** Exact native parameters for later approved initialization. Empty columns are
 * a precondition, so concurrent or existing claims can never be reset. */
export function nativeClaimInitialization(row){
 requireThat(row.action==='initialize_empty_only','CLAIM_INITIALIZATION_DENIED','Preserve existing claim and delivery records.');
 return {resource:'row',operation:'update',dataTableId:{__rl:true,mode:'id',value:PUBLISHING_TABLES.packages},matchType:'allConditions',filters:{conditions:[{keyName:'id',condition:'eq',keyValue:'={{ '+row.rowId+' }}'},{keyName:'concept_id',condition:'eq',keyValue:row.storyId},{keyName:'production_version',condition:'eq',keyValue:'={{ '+row.packageVersion+' }}'},...BUFFER_CLAIM_COLUMNS.map(keyName=>({keyName,condition:'isEmpty'}))]},columns:{mappingMode:'defineBelow',value:row.values}};
}
