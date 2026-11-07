// One bounded default direction; custom requests retain their own identities.
export const DEFAULT_DISCOVERY_PROMPT='Things you never knew you missed. Discover one source-grounded visual culture story under the actual n8n editorial preset. Explore contemporary fashion/streetwear, photography/art, film/TV, music/subcultures, internet oddities, design/objects, creative collaborations and human moments alongside historical material. Age is not the selection criterion. Compare actual leads for a clear reader entry point, surprise, cultural relevance, strength of story, distinctive imagery and feasible original-image sources; hold or reject a well-researched but boring premise. Consider whimsy and craft, unusual collections, rejection or origin stories and cultural contrasts. In editorial_case retain short reader_entry_point and why_now notes with supporting_claim_indices; lasting cultural interest is enough, never manufacture news. Choose minimal or story register when the material warrants it, never a default museum label. Do not recycle demonstration subjects, copied reference posts or engagement predictions. Preserve sources, quotes, uncertainty, native model/search budgets and founder approval; no automatic re-roll.';
// The existing native worker consumes founder_request for `brief`. Its legacy
// `discovery` branch uses native seed/preset text and ignores job.prompt. Use the
// supported founder-brief path so this direction actually reaches the model.
export const editorialDiscoveryRequest=()=>({kind:'brief',prompt:DEFAULT_DISCOVERY_PROMPT,sourceUrl:''});

const normalize=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
export function defaultDiscoveryKey(request,{founderBrief=false}={}){
 if(founderBrief&&request?.kind==='brief'&&!String(request.sourceUrl||'').trim()&&normalize(request.prompt)===normalize(DEFAULT_DISCOVERY_PROMPT))return 'founder-discovery-v14-brief';
 return request?.kind==='discovery'&&!String(request.sourceUrl||'').trim()&&normalize(request.prompt)===normalize(DEFAULT_DISCOVERY_PROMPT)?'default-discovery-v2':null;
}
