/** Serializable optional drafting data. Traceability is not factual verification. */
export function editorialHookOptions(concept,claims=[],sources=[]) {
 const modes=['discovery','visual_cultural','restrained'],options=[],issues=[];
 const normal=value=>String(value||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 for(const raw of (Array.isArray(concept?.hook_options)?concept.hook_options:[]).slice(0,3)){
  const text=typeof raw?.text==='string'?raw.text.trim():'';
  const indices=Array.isArray(raw?.claim_indices)?[...new Set(raw.claim_indices)]:[];
  const valid=modes.includes(raw?.approach)&&text.length>=12&&text.length<=300&&indices.length>0&&indices.length<=4&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<claims.length&&/^https:\/\//.test(claims[i].source_url||claims[i].url||''))&&!options.some(o=>o.approach===raw.approach||normal(o.text)===normal(text));
  if(!valid){issues.push('An alternative angle lacks a distinct approach, usable text or claim references.');continue;}
  const terms=new Set(normal(text).split(' ').filter(w=>w.length>3));
  if(options.some(o=>{const prior=new Set(normal(o.text).split(' ').filter(w=>w.length>3));return terms.size&&prior.size&&[...terms].filter(w=>prior.has(w)).length/Math.max(terms.size,prior.size)>.85;})){issues.push('Alternative angles repeat the same wording.');continue;}
  const recorded=indices.every(i=>sources.some(s=>s.claimIndex===i&&s.url===(claims[i].source_url||claims[i].url)&&s.access==='source_text_captured'));
  options.push({approach:raw.approach,text,claimIndices:indices,recommended:concept.recommended_hook===raw.approach,evidenceStatus:recorded?'source_passages_recorded':'source_review_needed',interpretation:typeof raw.interpretation==='string'?raw.interpretation.slice(0,400):'',factsVerifiedByHuman:false});
 }
 return {options,issues};
}

/** Bounded literal checks flag unresolved dates/quotes; they never certify other prose. */
export function draftEvidenceSignals(concept={},claims=[],sources=[]) {
 const text=[concept.title,concept.hook,concept.caption].filter(Boolean).join('\n'),issues=[];
 const sourceText=sources.filter(s=>s.access==='source_text_captured'&&claims[s.claimIndex]&&(claims[s.claimIndex].source_url||claims[s.claimIndex].url)===s.url).map(s=>s.textExcerpt||'').join(' ').normalize('NFKC');
 const years=[...new Set(text.match(/\b(?:18|19|20)\d{2}\b/g)||[])];
 if(years.some(y=>!new RegExp('\\b'+y+'\\b').test(sourceText)))issues.push({code:'DRAFT_DATE_SUPPORT_OPEN',message:'A date in the draft is absent from the recorded claim-source passages. Verify its role and source before approval.'});
 const quotes=[...text.matchAll(/[“"]([^”"\n]{16,300})[”"]/g)].map(m=>m[1]);
 const normal=value=>value.toLowerCase().replace(/\s+/g,' ').trim();
 if(quotes.some(q=>!normal(sourceText).includes(normal(q))))issues.push({code:'DRAFT_QUOTATION_SUPPORT_OPEN',message:'A quoted passage is absent from the recorded claim sources. Locate the exact wording or remove the quotation.'});
 return issues;
}
