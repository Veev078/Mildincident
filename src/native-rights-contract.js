/** Native recorded-review compatibility. This reports evidence, never grants permission. */
export function nativeImageRightsEvidence(status,notes){
 const text=String(notes||''),clearance=status==='reviewed_cleared'&&text.includes('HUMAN IMAGE REVIEW');
 const exception=status==='editorial_exception_authorized'&&text.includes('HUMAN EDITORIAL EXCEPTION REVIEW')&&['purpose','nature','amount','market'].every(k=>text.includes(' | '+k+': '));
 let evidenceUrl=null;
 try{
  const u=new URL(text.match(/\bevidence:\s*(https:\/\/[^\s|]+)/i)?.[1]||'');
  const privateQuery=[...u.searchParams.keys()].some(k=>/token|secret|password|credential|signature|authorization|api.?key/i.test(k));
  if(u.protocol==='https:'&&!u.username&&!u.password&&!privateQuery)evidenceUrl=u.href;
 }catch{}
 return {evidenceUrl,reviewed:clearance||exception,kind:clearance?'recorded_human_clearance':exception?'recorded_editorial_exception':'not_established',rightsGranted:false};
}
