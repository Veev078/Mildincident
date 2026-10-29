/** Serializable extraction from an already-fetched response. No network or factual-verification claim. */
export function recordedSourceEvidence(response,decode,claim='',maximum=1800) {
  const status=Number(response?.statusCode)||null;
  const headers=Object.fromEntries(Object.entries(response?.headers||{}).map(([key,value])=>[key.toLowerCase(),String(value)]));
  const body=response?.body??response?.data??'';
  const contentType=(headers['content-type']||'').split(';')[0].trim().toLowerCase();
  const base={httpStatus:status,contentType,title:'',textExcerpt:'',access:'access_unconfirmed',maintenancePage:false,excerptBasis:'captured_source_text_not_fact_verification',humanFactVerification:false};
  if(status===404||status===410)return {...base,access:'dead_reference'};
  if(typeof body!=='string'||body.length>2500000)return {...base,reason:'unavailable_or_oversized_text'};
  if(/^(?:application\/pdf|image\/|audio\/|video\/)/.test(contentType)||/^%PDF-|\x00/.test(body))return {...base,reason:'non_text_source_not_extracted'};
  const strip=value=>decode(String(value||'').replace(/<(script|style|noscript|svg|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
  const title=strip((body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').slice(0,400);
  const text=strip(body);
  const maintenance=/maintenance|access denied|just a moment|attention required|service unavailable|page not found/i.test(title)||/temporairement en maintenance|temporarily unavailable|verify you are human|enable javascript and cookies/i.test(text.slice(0,1500));
  if(!(status>=200&&status<300)||maintenance||!text)return {...base,title,maintenancePage:maintenance,reason:maintenance?'maintenance_or_access_page':'source_text_unavailable'};
  const keywords=[...new Set(String(claim).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word=>word.length>=4&&!['this','that','with','from','were','have','their','which','about'].includes(word)))];
  // Prefer the publisher's article body; navigation and reader guesses are not source evidence.
  const article=(body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)||[])[1];
  const corpus=(article||body).split(/<(?:section|div|ol)\b[^>]*(?:id|class)=["'][^"']*\bcomments(?:-area|-list)?\b[^"']*["'][^>]*>/i)[0];
  const passages=corpus.replace(/<(script|style|noscript|svg|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').split(/<\/(?:p|div|li|h[1-6]|section|article)>/i).map(strip).filter(Boolean).map((passage,index)=>({passage,index,score:keywords.filter(word=>passage.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(word)).length}));
  const ranked=passages.sort((a,b)=>b.score-a.score||a.index-b.index);
  const attribution=/identif|solv|discover|invent|creat|credit/i.test(claim)?ranked.filter(p=>/identified by|suggested by|credited to|first suggested|guess from|suggested .{0,80} in the first place/i.test(p.passage)).slice(0,1):[];
  const chosen=[...attribution,...ranked.filter(p=>p.score>0&&!attribution.includes(p)).slice(0,3-attribution.length)].sort((a,b)=>Number(attribution.includes(b))-Number(attribution.includes(a))||a.index-b.index);
  const excerpt=(chosen.length?chosen.map(p=>p.passage).join('\n\n'):text).slice(0,Math.max(100,Math.min(10000,maximum)));
  return {...base,title,access:'source_text_captured',textExcerpt:excerpt,keywordMatches:ranked[0]?.score||0,excerptBasis:chosen.length?'claim_keyword_passages_not_fact_verification':'page_text_not_fact_verification'};
}

/** Provider accounting and emitted tool records are distinct evidence. */
export function providerWebSearchUsage(response){
 if(!response?.usage&&response?.object!=='response')return {calls:null,basis:'unavailable',emitted:null,completed:null,incomplete:null};
 const records=(response.output||[]).filter(r=>r.type==='web_search_call');const completed=records.filter(r=>r.status==='completed').length;const reported=response.tool_usage?.web_search?.num_requests;
 return {calls:Number.isInteger(reported)&&reported>=0?reported:records.every(r=>r.status==='completed')?completed:null,basis:Number.isInteger(reported)&&reported>=0?'provider_reported_requests':records.every(r=>r.status==='completed')?'completed_output_records':'unresolved_tool_records',emitted:records.length,completed,incomplete:records.length-completed};
}

export function attributionReviewSignals(concept,sources=[]){
 const copy=[concept.title,concept.hook,concept.caption].filter(Boolean).join(' ');
 if(/(?:solved|identified|discovered)\s+(?:it\s+)?(?:herself|himself|themselves)|solved by (?:its|the) subject/i.test(copy)&&sources.some(s=>s.access==='source_text_captured'&&/identified by|guess from|suggested .{0,80} in the first place/i.test(s.textExcerpt||'')))return [{code:'ATTRIBUTION_ROLES_NEED_REVIEW',message:'The source names a separate contributor. Preserve who suggested the identification and who confirmed it; do not credit the subject alone.'}];
 return [];
}
