import {requireThat} from '../errors.js';
import {publishingGraphSha} from './buffer-handoff-security.js';
export const PREPARATION_COORDINATOR='v5ThKs5ZYP3RhZop';
const EXISTING_FINAL_REVIEW='rhZU4CyF5t0kYMzz';
export function preparationPolicyValid(p){return p?.scope==='preparation_only'&&p.operations?.nativeReview===true&&Object.entries(p.operations).every(([k,v])=>k==='nativeReview'||v===false);}
export function preparationPinMatches(w,pin,{standalone=false}={}){if(!pin)return false;const active=pin.id===EXISTING_FINAL_REVIEW||!standalone&&pin.id===PREPARATION_COORDINATOR;return w?.versionId===pin.version&&w.active===active&&(active?w.activeVersionId===pin.version:!w.activeVersionId)&&publishingGraphSha(w)===pin.sha256;}
export function prepareOnlyCoordinator(prepared){
 const w=structuredClone(prepared),legacy=w.nodes.filter(n=>n.name==='Founder Finalize and Send'),envelope=w.nodes.filter(n=>n.name==='Read Authenticated Studio Publishing Envelope');
 requireThat(legacy.length===1&&envelope.length===1&&w.nodes.find(n=>n.name==='Studio Publishing Request')?.parameters.authentication==='jwtAuth','PREPARATION_GRAPH_DRIFT','Use the reviewed JWT coordinator.');
 legacy[0].disabled=true;
 envelope[0].parameters.jsCode="const preparationRequest=$('Canonical Studio Publishing Body').first().json.body;if(!['review','file','connection'].includes(preparationRequest?.action))throw Error('PREPARATION_ONLY_ACTION_DENIED');\n"+envelope[0].parameters.jsCode;
 return {update:w,review:{graphSha256:publishingGraphSha(w),changes:['Founder Finalize and Send: disabled','Read Authenticated Studio Publishing Envelope: review/file/connection only'],bufferCreate:false,publicStaging:false,finalApproval:false,credentialsChanged:false,installed:false}};
}
