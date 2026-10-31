// One bounded default direction; custom requests retain their own identities.
export const DEFAULT_DISCOVERY_PROMPT='Discover fresh photographic cultural proposals under the actual n8n editorial preset. Explore independent photographers, contemporary editorial publications, fashion, music, nightlife, youth culture and original photographic series across current and historical contexts. Compare distinct source-supported leads. Do not recycle prior demonstration subjects or default to institutional archives; use archives selectively. Preserve source provenance, uncertainty and specific cultural payoff.';

const normalize=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
export function defaultDiscoveryKey(request){
 return request?.kind==='discovery'&&!String(request.sourceUrl||'').trim()&&normalize(request.prompt)===normalize(DEFAULT_DISCOVERY_PROMPT)?'default-discovery-v1':null;
}
