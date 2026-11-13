import test from 'node:test';import assert from 'node:assert/strict';
import {recordedPublisherAlternatives} from '../src/photography/publisher-alternatives.js';
import {automaticPhotoPlan,permittedProjectPage,projectPageReferences} from '../src/photography/project-sources.js';
import {photoRelevance,storyPhotoIdentity} from '../src/photography/story-intelligence.js';
const original='https://staging.dazeddigital.com/art-photography/article/62145/1/michael-joseph-lost-found-american-young-travellers-wanderlust',publicUrl=original.replace('staging.','www.');
test('the actual Lost & Found staging reference has one verified public alternative, without rewriting its failed evidence',()=>{
 const story={subject:'Michael Joseph, Lost & Found (2024)',research:[{url:original,capturedHttpStatus:401}],media:[]},before=JSON.stringify(story),links=recordedPublisherAlternatives(story);assert.equal(links.length,1);assert.equal(links[0].url,publicUrl);assert.equal(links[0].destinationFetched,false);assert.equal(permittedProjectPage(story,publicUrl),true);assert.equal(permittedProjectPage(story,original),false);assert.equal(automaticPhotoPlan(story).sourceUrl,publicUrl);assert.equal(JSON.stringify(story),before);
 const parsed=projectPageReferences(story,{url:publicUrl,html:'<figure><img src="https://images-prod.dazeddigital.com/fixture-joseph.jpg"><figcaption>Michael Joseph, Lost &amp; Found (2024). Photography Michael Joseph</figcaption></figure>'});assert.equal(photoRelevance(parsed.photos[0],storyPhotoIdentity(story)).category,'direct');
 for(const changed of [{...story,subject:'An unrelated project'},{...story,research:[{url:original.replace('/62145/','/99999/')}]},{...story,research:[{url:original.replace('staging.dazeddigital.com','private.example')}]}]){assert.deepEqual(recordedPublisherAlternatives(changed),[]);assert.equal(permittedProjectPage(changed,publicUrl),false);}
});
