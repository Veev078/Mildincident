import {requireThat} from '../errors.js';
import {editorialGraphSha} from './v14-editorial-patch.js';
import {planDevelopmentResearch} from './development-discovery-plan.js';
import {fitResearchContext,researchContextParts} from './research-context-budget.js';
import {developmentFailureCode,developmentFailureResponse} from './editorial-failure.js';

/** Offline patch of the captured recurring worker. No installation/activation API. */
export function prepareResearchBudgetPatch(worker,{expectedVersion,expectedSha256}){
 requireThat(worker?.id==='6CkqfYc4Pyd4k8vi'&&worker.active&&worker.versionId===expectedVersion&&worker.activeVersionId===expectedVersion&&editorialGraphSha(worker)===expectedSha256,'WORKFLOW_DRIFT','Use the exact saved and active recurring worker.');
 const workflow=Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,structuredClone(worker[k])])),node=name=>{const found=workflow.nodes.filter(n=>n.name===name);requireThat(found.length===1,'NODE_DRIFT','Expected one '+name+' node.');return found[0];};
 const prompt=node('Build Research Prompt'),code=prompt.parameters.jsCode,start=code.indexOf('const plan='),end=code.indexOf(';let planned;',start);
 const guard="for(const item of planned)if(item.json.userPrompt.length+String(item.json.instructions||'').length>30000)throw new Error('RESEARCH_INPUT_BUDGET_EXCEEDED');return planned;";
 requireThat(start>=0&&end>start&&code.indexOf('const plan=',start+1)===-1&&code.split(guard).length===2,'PROMPT_LAYOUT_DRIFT','Patch only the reviewed plan and final budget guard.');
 prompt.parameters.jsCode=code.slice(0,start)+`const fitResearchContext=${fitResearchContext.toString()};const researchContextParts=${researchContextParts.toString()};const plan=${planDevelopmentResearch.toString()}`+code.slice(end);
 prompt.parameters.jsCode=prompt.parameters.jsCode.replace(guard,"for(const item of planned){item.json=fitResearchContext(item.json);if(item.json.userPrompt.length+String(item.json.instructions||'').length>30000)throw new Error('RESEARCH_INPUT_BUDGET_EXCEEDED');}return planned;");
 node('Prepare Development Failure').parameters.jsCode=developmentFailureCode;
 const failed=node('Fail Development Job');requireThat(failed.parameters.columns.value.error==='DEVELOPMENT_EXECUTION_FAILED','FAILURE_LAYOUT_DRIFT','Preserve the existing failure writer.');failed.parameters.columns.value.error='={{ $json.error }}';
 node('Return Development Failure').parameters.responseBody=developmentFailureResponse;
 const changes=workflow.nodes.filter((n,i)=>JSON.stringify(n)!==JSON.stringify(worker.nodes[i])).map(n=>n.name);
 requireThat(changes.length===4,'PATCH_SCOPE_DRIFT','Only research preparation and failure reporting may change.');
 return {workflow,review:{baselineVersion:expectedVersion,baselineSha256:expectedSha256,proposedSha256:editorialGraphSha(workflow),changes,inputLimit:30000,modelsChanged:false,credentialsChanged:false,settingsChanged:false,connectionsChanged:false,automaticNodeRetries:0,hiddenTransportRetriesVerified:false,installed:false,paidCalls:0,requiresSeparateInstallationApproval:true}};
}
