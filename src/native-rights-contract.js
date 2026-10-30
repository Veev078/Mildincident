/** Native recorded-review compatibility. This reports evidence, never grants permission. */
export function nativeImageRightsEvidence(status,notes){
 const text=String(notes||'');const clearance=status==='reviewed_cleared'&&text.includes('HUMAN IMAGE REVIEW');const exception=status==='editorial_exception_authorized'&&text.includes('HUMAN EDITORIAL EXCEPTION REVIEW')&&['purpose','nature','amount','market'].every(k=>text.includes(' | '+k+': '));return {reviewed:clearance||exception,kind:clearance?'recorded_human_clearance':exception?'recorded_editorial_exception':'not_established',rightsGranted:false};
}
