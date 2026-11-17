import {requireThat} from '../errors.js';
import {editorialGraphSha} from '../n8n/v14-editorial-patch.js';
import {reusableVisualModelRun} from './visual-assessment.js';

/** Reconcile a terminal failed photo operation using its original execution.
 * This is a read of evidence, never permission to dispatch again. Partial model
 * text is intentionally excluded: an incomplete judgment is not an assessment. */
export function captureVisualFailure(execution,packet,{approvedGraphSha256,approvedExecutionGraphSha256,approvedWorkerVersion}={}){
 const check=(v,m)=>requireThat(v,'INVALID_VISUAL_RESULT',m);
 check(execution?.workflowId===packet.workerId&&/^\d+$/.test(String(execution.id))&&execution.status==='success','Use the original completed native failure execution.');
 const expanded=approvedExecutionGraphSha256!=null;
 check(/^[a-f0-9]{64}$/.test(approvedGraphSha256||'')&&(!expanded||/^[a-f0-9]{64}$/.test(approvedExecutionGraphSha256)&&execution.workflowVersionId===approvedWorkerVersion)&&execution.workflowData&&editorialGraphSha(execution.workflowData)===(expanded?approvedExecutionGraphSha256:approvedGraphSha256),'The failed operation must match the reviewed full graph and native version.');
 const runs=execution.data?.resultData?.runData||{},one=name=>{
  const r=runs[name];check(r?.length===1,'Use one unambiguous run of '+name+'.');const entries=r[0].data?.main?.[0];check(entries?.length===1,'Use one captured output of '+name+'.');return entries[0].json;
 };
 check(execution.data.resultData.lastNodeExecuted==='Return Development Failure'&&!runs['Research Candidates']?.length&&!runs['Draft Editorial Concept']?.length,'The photo-only failure must be terminal with no research or drafting.');
 const validated=one('Validate Photo Assessment').packet,reusableModel=reusableVisualModelRun(execution,packet,{approvedWorkerVersion}),model=reusableModel||one('Assess Photo Pixels'),failed=one('Fail Development Job');
 check(validated?.jobId===packet.jobId&&validated.approvalId===packet.approvalId&&validated.authorization?.id===packet.authorization?.id&&validated.manifestSha256===packet.manifestSha256&&JSON.stringify(validated.manifest)===JSON.stringify(packet.manifest)&&JSON.stringify(validated.images)===JSON.stringify(packet.images),'The failure must bind the exact original manifest, image bytes and order.');
 check(failed.job_id===packet.jobId&&String(failed.execution_id)===String(execution.id)&&failed.status==='failed'&&failed.result_count===0&&!(runs['Finalize Photo Assessment']||[]).some(r=>r.data?.main?.[0]?.length),'Do not replace a successful or unrelated visual result with a failure.');
 const outputLimit=model.status==='incomplete'&&model.incomplete_details?.reason==='max_output_tokens';
 check(model.max_output_tokens===1200&&(outputLimit||reusableModel&&['completed','incomplete'].includes(model.status)),'Use a confirmed bounded model response rejected by the native finalizer.');
 const usage=model.usage;check(usage&&['input_tokens','output_tokens','total_tokens'].every(k=>Number.isSafeInteger(usage[k])&&usage[k]>=0)&&usage.output_tokens<=1200&&usage.total_tokens===usage.input_tokens+usage.output_tokens,'Use the provider-recorded token usage.');
 const code=outputLimit?'PHOTO_OUTPUT_LIMIT_EXCEEDED':model.status==='incomplete'?'PHOTO_RESPONSE_INCOMPLETE':'PHOTO_RESULT_REJECTED',message=outputLimit?'AI inspected the supplied images, but its response ran out of space. No complete review or sequence was accepted. It will not run again automatically.':'The bounded image operation returned an unusable review. No image assessment or sequence was accepted. It will not run again automatically.';
 return {purpose:'private_photo_visual_assessment_failure',jobId:packet.jobId,manifestSha256:packet.manifestSha256,executionId:String(execution.id),code,message,usage:Object.fromEntries(['input_tokens','output_tokens','total_tokens'].map(k=>[k,usage[k]])),modelOperationObserved:true,inputImageCount:packet.images.length,usableAssessment:false,automaticRetry:false};
}
