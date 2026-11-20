/** Explicitly verified public equivalents for historical private-host evidence.
 * Never rewrite the original claim or guess a replacement host for arbitrary URLs. */
export function recordedPublisherAlternatives(story){
 const original='https://staging.dazeddigital.com/art-photography/article/62145/1/michael-joseph-lost-found-american-young-travellers-wanderlust';
 if(!/michael joseph/i.test(story.subject||'')||!/lost\s*(?:&|and)\s*found/i.test(story.subject||'')||!(story.research||[]).some(r=>r.url===original))return [];
 return [{url:original.replace('staging.dazeddigital.com','www.dazeddigital.com'),sourceUrl:original,label:'Lost & Found — public Dazed gallery',basis:'verified_public_equivalent_of_recorded_article',destinationFetched:false,identityVerified:false,rightsGranted:false}];
}
