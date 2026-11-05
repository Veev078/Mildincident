import {creativeProgress} from './story-progress.js';
import {productionSummary,hasPublishingActivity} from './readiness.js';
import {effective} from './components.js';

const tasks={
 revision:{label:'Compare source changes',detail:'Your saved work uses an older source. Compare both versions before continuing.',tab:'overview'},
 handoff:{label:'Check earlier publishing activity',detail:'Keep the existing provider IDs. Resolve the recorded outcome before another handoff; do not resend an uncertain or sent post.',tab:'publishing'},
 rights:{label:'Check image permissions',detail:'Check each selected photograph’s creator and permission evidence. Record the rights decision in the existing approval workflow.',tab:'images'},
 facts:{label:'Review the story’s facts',detail:'Compare the claims and attribution with their original sources, then record the factual review in the existing approval workflow.',tab:'research'},
 caption:{label:'Finalize the caption',detail:'Finish your working caption and compare it with the final copy and approval held in the existing workflow.',tab:'caption'},
 sequence:{label:'Refine the photograph sequence',detail:'Choose the photographs, opening frame and intended order. Check that the chosen format fits the selection.',tab:'carousel'},
 files:{label:'Check the production files',detail:'The existing production process must verify the exported files before a handoff.',tab:'publishing'},
 package:{label:'Prepare for final approval',detail:'The existing workflow must confirm the production package and version. A private working copy is not an approved package.',tab:'publishing'},
 source:{label:'Check the latest source records',detail:'Current source and provider observations are needed before production can proceed.',tab:'publishing'},
 other:{label:'Review the remaining requirement',detail:'An additional production requirement is recorded. Open its details before continuing.',tab:'publishing'},
};

/** An editorial path over existing gates; never changes a gate or grants approval. */
export function reviewPath(story){
 const summary=productionSummary(story),groups=[...summary.groups];
 // Missing gate evidence is not a completed review even when a sparse snapshot has no codes.
 for(const [requirement,key]of [['facts','facts'],['rights','rights'],['approval','caption']])if(!summary.requirements.find(r=>r.key===requirement)?.recorded&&!groups.some(g=>g.key===key))groups.push({key,codes:[],decisions:[]});
 const path=groups.map(g=>({...g,...(tasks[g.key]||tasks.other)}));
 const completed=[...summary.prepared,...summary.requirements.filter(r=>r.recorded).map(r=>`${r.label} recorded`)];
 return {...summary,tasks:path,next:path[0]||null,completed};
}

export function storyStep(story,tab='overview'){
 if(story.localDraft?.stale)return {label:'Compare source changes',tab:'overview',state:'Source changed'};
 const observed=story.publishing?.observed;
 if((tab==='images'||tab==='carousel')&&!story.publishing?.requiresReview&&!hasPublishingActivity(story)&&effective(story).selectedAssetIds.length&&effective(story).caption.trim())return {label:'Review post',tab:'publishing',state:'Photographs selected'};
 if(tab==='images'||tab==='carousel')return {label:'Edit story & caption',tab:'overview',state:observed==='buffer_sent'?'Buffer reports sent':observed==='buffer_unscheduled_draft'?'Existing Buffer draft':'Choosing photographs'};
 if(story.publishing?.requiresReview&&!hasPublishingActivity(story))return {label:'Review source records',tab:'publishing',state:'Source records need checking'};
 if(story.publishing?.requiresReview||story.publishing?.multipleHandoffs||['buffer_sent','buffer_unscheduled_draft','buffer_scheduled','instagram_posted_verified'].includes(observed))return {label:'Review existing activity',tab:'publishing',state:observed==='buffer_sent'?'Buffer reports sent':'Publishing activity to review'};
 if(!effective(story).caption.trim()&&story.origin==='n8n_development'){const p=creativeProgress(story);return {label:p.action,tab:p.tab,state:p.label};}
 if(!effective(story).selectedAssetIds.length)return {label:'Choose photographs',tab:'images',state:'Choose photographs'};
 if(!effective(story).caption.trim())return {label:'Write the caption',tab:'caption',state:'Caption needed'};
 return {label:'Review this story',tab:'publishing',state:'Working draft'};
}
