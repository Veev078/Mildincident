/** Keep a burst of reviews on one story from erasing all other founder context. */
export function selectEditorialFeedback(records,limit=6) {
  const sorted=[...records].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const seen=new Set(),groups=new Map();
  for(const record of sorted){
    if(record.candidateId&&seen.has(record.candidateId))continue;
    if(record.candidateId)seen.add(record.candidateId);
    const key=record.photograph?.storyId||record.storyId||record.candidateId;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);
  }
  const selected=[];
  while(selected.length<limit){let added=false;for(const group of groups.values())if(group.length&&selected.length<limit){selected.push(group.shift());added=true;}if(!added)break;}
  return selected;
}
