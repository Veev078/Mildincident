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
  const passages=body.replace(/<(script|style|noscript|svg|nav)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').split(/<\/(?:p|div|li|h[1-6]|section|article)>/i).map(strip).filter(Boolean).map((passage,index)=>({passage,index,score:keywords.filter(word=>passage.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(word)).length}));
  const ranked=passages.sort((a,b)=>b.score-a.score||a.index-b.index);
  const chosen=ranked.filter(p=>p.score>0).slice(0,3).sort((a,b)=>a.index-b.index);
  const excerpt=(chosen.length?chosen.map(p=>p.passage).join('\n\n'):text).slice(0,Math.max(100,Math.min(10000,maximum)));
  return {...base,title,access:'source_text_captured',textExcerpt:excerpt,keywordMatches:ranked[0]?.score||0,excerptBasis:chosen.length?'claim_keyword_passages_not_fact_verification':'page_text_not_fact_verification'};
}
