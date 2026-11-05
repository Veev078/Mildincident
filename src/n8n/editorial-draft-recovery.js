import {createHash} from 'node:crypto';
import {requireThat} from '../errors.js';
import {CAPTION_DIRECTIONS} from '../workspace/caption-generation.js';
import {editorialSelectionTools} from '../editorial-selection.js';
import {editorialPrinciples,separateEditorialCopy} from '../editorial-principles.js';

export const DRAFT_RECOVERY_BUDGET=Object.freeze({maxResearchCalls:0,maxDraftCalls:1,maxResearchToolCalls:0,maxCandidates:1,maxInputCharactersPerCall:30000,maxDraftOutputTokens:1800,priceVerified:false});
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

/** Prepare a temporary graph for the SAME development worker. No remote operation. */
export function buildCapturedDraftRecovery({worker,execution,jobId,requestHash,expiresAt,direction='initial',now=Date.now()}){
 requireThat(worker?.id===execution?.workflowId&&worker?.name==='MILDINCIDENT DEV — bounded editorial generation'&&worker.active===false,'RECOVERY_WORKER_REQUIRED','Capture the inactive existing Studio worker and its own execution.');
 requireThat(uuid.test(jobId)&&/^[a-f0-9]{64}$/.test(requestHash)&&Date.parse(expiresAt)>now&&Date.parse(expiresAt)-now<=86400000,'INVALID_DRAFT_RECOVERY','A new exact job, request hash and bounded expiry are required.');
 requireThat(Object.hasOwn(CAPTION_DIRECTIONS,direction),'INVALID_DRAFT_DIRECTION','Choose one reviewed editorial direction.');
 const data=execution.data?.resultData?.runData||{};
 const items=name=>(data[name]||[]).flatMap(r=>r.data?.main?.[0]||[]).map(i=>i.json);
 const one=name=>{const rows=items(name);requireThat(rows.length===1,'RECOVERY_EVIDENCE_REQUIRED','Exactly one captured '+name+' record is required.');return structuredClone(rows[0]);};
 const oldJob=one('Verify Development Claim'),dispatch=one('Validate Development Dispatch'),captured=one('Collect Link Checks'),prompt=one('Build Research Prompt');
 requireThat(execution.status==='success'&&String(execution.id)===String(oldJob.execution_id)&&oldJob.job_id===dispatch.job_id&&oldJob.request_hash===dispatch.request_hash&&jobId!==oldJob.job_id,'RECOVERY_IDENTITY_MISMATCH','Original execution/claim must correlate; never reset or reuse its job.');
 requireThat(direction!=='initial'||!items('Draft Editorial Concept').some(r=>r.usage||r.output)&&!one('Finalize Development Candidate').candidate_json.includes('"editorialStage":"drafted"'),'RECOVERY_ALREADY_DRAFTED','This recovery requires research without a successful prior draft response.');
 const photos=items('Extract Original-Page Image Previews').filter(m=>m.asset_id);
 const readiness=editorialSelectionTools().draftReadiness(captured,{sources:captured.sourceEvidence||[],photos,feedback:prompt.founderFeedback||[]});
 requireThat(readiness.canDraft&&typeof prompt.brandText==='string'&&prompt.brandText.length>20,'RECOVERY_EVIDENCE_REQUIRED','Substantive source-bound facts and captured brand guidance must qualify independently.');
 const research={brandText:prompt.brandText,founderFeedback:prompt.founderFeedback||[],discoveryPlan:prompt.discoveryPlan||null};
 const evidenceSha256=sha({research,candidate:captured,photos});
 const recovery={mode:'draft_only',direction,sourceExecutionId:String(execution.id),sourceJobId:oldJob.job_id,sourceCandidateId:'DEV-'+oldJob.job_id+'-1',sourceCapturedAt:execution.stoppedAt||execution.startedAt,evidenceSha256};
 const workflow=Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,structuredClone(worker[k])]));
 const node=name=>{const n=workflow.nodes.find(n=>n.name===name);requireThat(n,'NODE_DRIFT','Missing recovery processor '+name);return n;};
 // Put the restriction before the original validator can return or claim any row.
 const validator=node('Validate Development Dispatch');
 validator.parameters.jsCode=`const exact=$input.first().json.body;if(!exact||exact.job_id!==${JSON.stringify(jobId)}||exact.request_hash!==${JSON.stringify(requestHash)}||Date.now()>=${Date.parse(expiresAt)})throw new Error('DRAFT_RECOVERY_NOT_AUTHORIZED');\n`+worker.nodes.find(n=>n.name===validator.name).parameters.jsCode;
 for(const [name,rows]of [['Build Research Prompt',[research]],['Collect Link Checks',[captured]],['Extract Original-Page Image Previews',photos]]){
  const n=node(name);n.type='n8n-nodes-base.code';n.typeVersion=2;delete n.credentials;n.parameters={jsCode:`return ${JSON.stringify(rows)}.map(json=>({json}));`};
 }
 const draft=node('Draft Editorial Concept'),originalMessageSize=JSON.stringify(draft.parameters.responses).length;draft.retryOnFail=false;draft.parameters.options.maxTokens=1800;delete draft.parameters.builtInTools;delete draft.parameters.options.maxToolCalls;delete draft.parameters.options.maxToolsIterations;
 const principles=editorialPrinciples();if(!draft.parameters.responses.values[0].content.includes(principles.version))draft.parameters.responses.values[0].content+='\nEDITORIAL PRINCIPLES '+principles.version+': '+principles.drafting+'\nPHOTOGRAPHIC FIT: '+principles.photography;
 draft.parameters.responses.values[0].content+='\nDRAFT-ONLY RECOVERY: The passages below were captured in an earlier research execution, not fetched today. Generate exactly three supported hook_options, one per declared approach, and recommend one. The visual_cultural option may discuss the project’s social context; it must not describe an uninspected frame. Treat the proposed hook/why_interesting as editorial suggestions, never extra factual evidence. Do not invent facts to distinguish angles. Keep all mandatory fields concise, a source-grounded caption whose length fits its substance, single_image provisionally, and all three hooks within this same 1800-output-token response. Missing image verification is a visual_direction gap, not a reason to abandon an adequately supported preliminary caption.';
 draft.parameters.responses.values[0].content+='\nREVIEWED EDITORIAL DIRECTION: '+CAPTION_DIRECTIONS[direction]+'. This is a writing preference, not additional evidence. Reuse only the supported claims. Preserve attribution, uncertainty and the private/public-copy distinction.';
 const quality=node('Quality Gate');if(!quality.parameters.jsCode.includes('function separateEditorialCopy'))quality.parameters.jsCode=`const rows=(function(){${quality.parameters.jsCode}\n})();return rows.map(i=>{const g=i.json;if(g.concept){const copy=(${separateEditorialCopy.toString()})(g.concept);g.concept.caption=copy.caption;g.internalProductionNotes=copy.notes;}return i;});`;
 const finalize=node('Finalize Development Candidate');
 finalize.parameters.jsCode=`const rows=(function(){${finalize.parameters.jsCode}\n})();return rows.map(i=>{const c=JSON.parse(i.json.candidate_json);c.recovery=${JSON.stringify(recovery)};c.editorialPrinciplesVersion=${JSON.stringify(principles.version)};try{c.internalProductionNotes=$('Quality Gate').first().json.internalProductionNotes||c.internalProductionNotes||[];}catch{}i.json.candidate_json=JSON.stringify(c);return i;});`;
 const link=(from,to)=>{workflow.connections[from].main[0]=[{node:to,type:'main',index:0}];};
 link('Development Job Claimed?','Build Research Prompt');link('Build Research Prompt','Collect Link Checks');link('Passed Prechecks?','Extract Original-Page Image Previews');
 const reachable=new Set(),visit=name=>{if(reachable.has(name))return;reachable.add(name);for(const branch of workflow.connections[name]?.main||[])for(const edge of branch||[])visit(edge.node);};visit('Development Job Request');
 workflow.nodes=workflow.nodes.filter(n=>reachable.has(n.name));workflow.connections=Object.fromEntries(Object.entries(workflow.connections).filter(([name])=>reachable.has(name)));
 requireThat(workflow.nodes.filter(n=>n.type.includes('openAi')).length===1&&!workflow.nodes.some(n=>n.type==='n8n-nodes-base.httpRequest'||/scheduleTrigger|executeWorkflow/.test(n.type)||n.name==='Research Candidates'),'UNSAFE_DRAFT_RECOVERY','Recovery may contain only the existing drafting model, no research/fetch/subworkflow.');
 const guard=node('Guard Draft Input Budget');
 // Include the extra recovery instructions in the existing character budget.
 requireThat(guard.parameters.jsCode.includes('>30000'),'NODE_DRIFT','Existing draft character budget is required.');
 guard.parameters.jsCode=guard.parameters.jsCode.replace('>30000',`+${JSON.stringify(draft.parameters.responses).length-originalMessageSize}>30000`);
 return {workflow,recovery,review:{...DRAFT_RECOVERY_BUDGET,direction,jobId,requestHash,expiresAt,evidenceSha256,supportedClaimIndices:readiness.supportedClaimIndices,workflowSha256:sha(workflow),productionWrites:0,automaticNodeRetries:0,providerSdkRetriesVerified:false}};
}
