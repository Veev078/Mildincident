/** Serializable development-only helpers. Source presets and brand rules stay in n8n. */
export function prepareDevelopmentEditorialContext(job) {
  return {theme:'',founder_request:job.kind==='brief'?job.prompt:'',founder_url:job.source_url||'',founder_image:'',development_request:job.prompt};
}
export function planDevelopmentResearch(requests,history,job) {
  let editorialContext={feedback:[]};if(job.editorial_context_json){if(typeof job.editorial_context_json!=='string'||job.editorial_context_json.length>10000)throw new Error('INVALID_EDITORIAL_CONTEXT');editorialContext=JSON.parse(job.editorial_context_json);if(editorialContext.schemaVersion!==1||!Array.isArray(editorialContext.feedback)||editorialContext.feedback.length>6)throw new Error('INVALID_EDITORIAL_CONTEXT');}
  const recent=history.filter(c=>c&&typeof c==='object').sort((a,b)=>String(b.provenance?.generatedAt||'').localeCompare(String(a.provenance?.generatedAt||''))).slice(0,100);
  const subjects=recent.map(c=>c.story?.subject||'').filter(Boolean);
  const seedOf=c=>c.discoveryPlan?.seedIdeaKey||String(c.story?.founder_feedback||'').match(/SEED-BANK: ([A-Za-z0-9-]+)/)?.[1]||'';
  const testedSeeds=new Set(recent.map(seedOf).filter(Boolean));
  const prepared=requests.map((item,index)=>({item,index})).filter(({item})=>!item.json.seed_idea_key||!testedSeeds.has(item.json.seed_idea_key));
  if(!prepared.length)throw new Error('NO_UNTESTED_DEVELOPMENT_DISCOVERY_LEAD');
  const counts=new Map();for(const c of recent.slice(0,20)){const territory=c.discoveryPlan?.territory||c.story?.territory;if(territory)counts.set(territory,(counts.get(territory)||0)+1);}
  if(job.kind==='discovery')prepared.sort((a,b)=>(counts.get(a.item.json.territory)||0)-(counts.get(b.item.json.territory)||0)||a.index-b.index);
  const item=prepared[0].item;const original=item.json;
  const userPrompt=original.userPrompt+'\nDEVELOPMENT QUALITY BAR: ONE candidate only. Prefer cultural originality and remarkable identifiable photography over volume. No sensationalism or manufactured quotes. Do not settle for a familiar celebrity/designer association: find a specific, evidenced photographic detail or genuinely unexpected connection. Record exact image captions, credited creators and dates when available; distinguish photograph dates from film dates and file-upload dates. A source-page cover is not proof of the depicted subject. Do not describe past exhibitions as current. Rights remain unverified. Do not repeat these development subjects: '+subjects.join('; ')+'\nRECENT FOUNDER TASTE FEEDBACK (specific judgments; not factual findings or blanket bans): '+JSON.stringify(editorialContext.feedback)+(job.kind==='discovery'?'\nADDITIONAL DISCOVERY DIRECTION (a request, not evidence or a change to brand/source rules): '+job.prompt:'');
  const discoveryPlan={territory:original.territory||'wildcard',approach:original.discovery_approach||'story_first',preset:original.diversity?.selected_seed_preset||'original_mildincident',seedIdeaKey:original.seed_idea_key||'',recentDevelopmentCount:recent.length,preparedBranchCount:requests.length,selectedBranchCount:1};
  return [{json:{...original,userPrompt,founderFeedback:editorialContext.feedback,source:job.kind==='discovery'?'development_discovery':'development_brief',avoid:[...(original.avoid||[]),...subjects],discoveryPlan,diversity:{...original.diversity,chosen_territories:[discoveryPlan.territory]}}}];
}
