/** Creative completeness, independent of approval and publication gates. */
export function creativeProgress(story){
 const working={...story,...(!story.localDraft?.stale?story.localDraft||{}:{})};
 if(!String(working.caption||'').trim()){
  if(story.captionGeneration?.state==='result_available')return {key:'caption',label:'Draft available',action:'Review generated caption',tab:'caption',detail:'The exact retained research has a real recovered draft. Review and use it on this story.'};
  const supported=(story.research||[]).some(c=>c.capturedAccess==='source_text_captured'&&String(c.capturedTextExcerpt||'').length>=120);
  return {key:supported?'caption':'research',label:supported?'Caption needed':'Research needed',action:supported?'Develop the caption':'Explore the sources',tab:supported?'overview':'research',detail:supported?'Source passages are saved. Review them for a separately authorized drafting-only continuation before repeating research.':'A source-supported caption has not been produced. Review the saved evidence before requesting more work.'};
 }
 if(!(working.selectedAssetIds||[]).length)return {key:'photographs',label:'Photographs needed',action:'Choose photographs',tab:'images',detail:'Your caption is saved. Select and inspect an opening photograph; references are not verified images.'};
 return {key:'review',label:'Working draft',action:'Review this story',tab:'publishing',detail:'Review the selected photographs and caption. Facts, permissions and final approval remain separate.'};
}

export function organizeStories(stories,{archived=false,sort='updated'}={}){
 const time=s=>Date.parse(sort==='updated'?(s.localDraft?.updatedAt||s.organization?.updatedAt||s.updatedAt||s.engineProvenance?.generatedAt):(s.createdAt||s.engineProvenance?.generatedAt))||0;
 return stories.filter(s=>Boolean(s.organization?.archived)===archived).sort((a,b)=>Number(Boolean(b.organization?.pinned))-Number(Boolean(a.organization?.pinned))|| (sort==='oldest'?time(a)-time(b):time(b)-time(a))||a.id.localeCompare(b.id));
}
