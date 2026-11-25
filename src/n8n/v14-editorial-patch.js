import {createHash} from 'node:crypto';
import {requireThat} from '../errors.js';
import {editorialDirectionV14} from '../editorial-v14.js';
import {WRITING_DIRECTIONS} from '../../web/writing-directions.js';
import {fitResearchContext} from './research-context-budget.js';

export const editorialGraphSha=workflow=>createHash('sha256').update(JSON.stringify(Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,workflow[k]])))).digest('hex');

/** Offline proposal only. No client, credentials, network, permit or activation API. */
export function prepareV14EditorialPatch(worker,{expectedSha256}){
 requireThat(worker?.id==='6CkqfYc4Pyd4k8vi'&&worker.versionId===worker.activeVersionId&&editorialGraphSha(worker)===expectedSha256,'WORKFLOW_DRIFT','Use the exact captured, matching saved and active editorial worker.');
 const workflow=Object.fromEntries(['name','nodes','connections','settings'].map(k=>[k,structuredClone(worker[k])])),guidance=editorialDirectionV14();
 const node=name=>{const nodes=workflow.nodes.filter(n=>n.name===name);requireThat(nodes.length===1,'NODE_DRIFT','Expected one '+name+' node.');return nodes[0];};
 for(const [name,maxTokens] of [['Research Candidates',3500],['Draft Editorial Concept',1800]]){const n=node(name);requireThat(n.type.includes('openAi')&&n.retryOnFail===false&&n.parameters.modelId?.value==='gpt-5.4'&&n.parameters.options.maxTokens===maxTokens,'MODEL_DRIFT','Existing bounded, no-node-retry GPT operations must be preserved.');}
 requireThat(node('Research Candidates').parameters.options.maxToolCalls===2&&!node('Draft Editorial Concept').parameters.builtInTools,'MODEL_DRIFT','Preserve two research tools and tool-free drafting.');
 const research=node('Build Research Prompt');
 research.parameters.jsCode=`const fitResearchContext=${fitResearchContext.toString()};const rows=(function(){${research.parameters.jsCode}\n})();const direction=${JSON.stringify(guidance)};for(const item of rows){item.json.brandText=(item.json.brandText||'')+'\\nMILDINCIDENT V14 DIRECTION: '+direction.frame+' '+direction.standard;item.json.instructions=(item.json.instructions||'')+'\\nV14 EDITORIAL RANGE: '+direction.discovery+' Assess an immediate reader entry point and why attention is earned now (a cultural observation is enough; do not manufacture news). Preserve actual source claim indices. A weak premise can be rejected despite good documentation. No automatic research re-roll.';item.json=fitResearchContext(item.json);if(String(item.json.userPrompt||'').length+String(item.json.instructions).length>30000)throw Error('RESEARCH_INPUT_BUDGET_EXCEEDED');}return rows;`;
 const draft=node('Draft Editorial Concept'),original=draft.parameters.responses.values[0].content;
 const recipes=Object.fromEntries(Object.entries(WRITING_DIRECTIONS).map(([key,value])=>[key,value.brief]));
 draft.parameters.responses.values[0].content+='\nV14 READER-FACING WRITING: '+guidance.drafting+'\nWRITING OPERATION: {{ ('+JSON.stringify(recipes)+')[JSON.parse($("Verify Development Claim").first().json.editorial_context_json || "{}").captionImprovement?.direction] || "Choose a minimal or story register from supported substance. Do not force a template." }}\nRecord the chosen register and reason in optional private production_notes, not public copy. These preferences cannot override source/evidence, authorization, image identity, rights or output limits.';
 const added=draft.parameters.responses.values[0].content.length-original.length,guard=node('Guard Draft Input Budget');
 requireThat((guard.parameters.jsCode.match(/>30000/g)||[]).length===1,'BUDGET_GUARD_DRIFT','Keep the existing rendered-input guard.');
 // Count all added template characters (including its expression) conservatively.
 guard.parameters.jsCode=guard.parameters.jsCode.replace('>30000','+'+added+'>30000');
 const final=node('Finalize Development Candidate');
 final.parameters.jsCode=`const rows=(function(){${final.parameters.jsCode}\n})();for(const item of rows){const candidate=JSON.parse(item.json.candidate_json);candidate.editorialPrinciplesVersion=${JSON.stringify(guidance.version)};item.json.candidate_json=JSON.stringify(candidate);}return rows;`;
 const changes=workflow.nodes.filter((n,i)=>JSON.stringify(n)!==JSON.stringify(worker.nodes[i])).map(n=>n.name);
 return {workflow,review:{baselineVersion:worker.versionId,baselineSha256:expectedSha256,proposedSha256:editorialGraphSha(workflow),changes,credentialsChanged:false,connectionsChanged:false,settingsChanged:false,modelsChanged:false,modelNodesAdded:0,installed:false,paidCalls:0,liveWritingVerified:false,requiresSeparateInstallationApproval:true}};
}
