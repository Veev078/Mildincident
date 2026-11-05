/** Conservative source-selection warning, not a URL rewrite or accessibility claim. */
export function sourceSelectionConcern(url){
 const host=String(url||'').match(/^https:\/\/([^/?#:]+)/i)?.[1]?.toLowerCase()||'';
 const publicHost=host.replace(/^www\./,'');
 return publicHost.split('.').length>=3&&/^(?:staging|stage|preview|dev|development|login|auth)\./.test(publicHost)?'NON_PUBLIC_SOURCE_HOST':'';
}
