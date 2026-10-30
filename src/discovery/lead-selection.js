import {safePhotoReference} from '../n8n/photo-url-guard.js';

// URL identity for research memory only. This never fetches a URL or establishes image identity.
export function sourceIdentity(value) {
  const safe=safePhotoReference(value);if(!safe)return '';
  const url=new URL(safe);url.hash='';
  for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key.toLowerCase()))url.searchParams.delete(key);
  url.searchParams.sort();return url.href;
}
export function developedSourceIdentities(requests) {
  const used=new Set();
  for(const request of requests)for(const candidate of request.engineJob?.candidates||[]){
    for(const record of [...(candidate.claims||[]),...(candidate.media||[]),...(candidate.sourceEvidence||[])]){
      const id=sourceIdentity(record.url||record.source_url||record.sourceUrl||record.source_page_url);
      if(id)used.add(id);
    }
  }
  return used;
}

/** Source diversity is a research aid, not a taste score or an invented cultural classification. */
export function selectPublicationLeads(leads,{used=new Set(),limit=6}={}) {
  const buckets=new Map(),seen=new Set();
  for(const lead of leads){
    const id=sourceIdentity(lead.url);
    if(!id||seen.has(id)||used.has(id))continue;
    seen.add(id);
    const source=lead.sourceKey||new URL(id).hostname;
    if(!buckets.has(source))buckets.set(source,[]);
    buckets.get(source).push(lead);
  }
  const result=[];
  while(result.length<limit){
    let added=false;
    for(const bucket of buckets.values())if(bucket.length&&result.length<limit){result.push(bucket.shift());added=true;}
    if(!added)break;
  }
  return result;
}
