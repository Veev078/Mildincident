import test from 'node:test';
import assert from 'node:assert/strict';
import {leadPhoto,mediaFor,image,storyCard} from '../components.js';
import {proposalCard} from '../review.js';
import {home} from '../today.js';

const hash='a'.repeat(64);
const local=(id)=>`/api/stories/CON-VISUAL/assets/${id}/preview?hash=${hash}`;
const story=other=>({id:'CON-VISUAL',title:'A cultural photographic project',revision:'source-v1',origin:'n8n_development',media:[],selectedAssetIds:[],...other});

test('cover selection finds a later preview-bearing selected frame without changing the opening sequence',()=>{
 const value=story({selectedAssetIds:['no-preview','chosen'],media:[{id:'candidate',previewUrl:'https://example.org/candidate.jpg'},{id:'no-preview'},{id:'chosen',previewUrl:'https://example.org/chosen.jpg'}]});
 const before=structuredClone(value);assert.equal(leadPhoto(value),value.media[2]);assert.deepEqual(mediaFor(value).map(a=>a.id),['no-preview','chosen']);assert.deepEqual(value,before);
 const working={...value,localDraft:{version:1,selectedAssetIds:['candidate']}};assert.equal(leadPhoto(working),value.media[0]);assert.deepEqual(value,before);
});

test('private preview references take priority within selected frames while selected references outrank other candidates',()=>{
 const value=story({selectedAssetIds:['source','private'],media:[{id:'source',previewUrl:'https://example.org/source.jpg'},{id:'private',previewUrl:local('private'),localPreview:{sha256:hash}},{id:'unselected-private',previewUrl:local('unselected-private')}]});
 assert.equal(leadPhoto(value).id,'private');
 assert.equal(leadPhoto({...value,selectedAssetIds:['source']}).id,'source');
 assert.equal(leadPhoto({...value,selectedAssetIds:[]}).id,'private');
});

test('missing selected previews fall back to safe candidates, then retain selected or original metadata identity',()=>{
 const first={id:'first'},selected={id:'selected'},preview={id:'preview',previewUrl:'https://example.org/frame.jpg'};
 assert.equal(leadPhoto(story({media:[first,selected,preview],selectedAssetIds:['selected']})),preview);
 assert.equal(leadPhoto(story({media:[first,selected],selectedAssetIds:['selected']})),selected);
 assert.equal(leadPhoto(story({media:[first,selected]})),first);
 assert.equal(leadPhoto(story({})),undefined);
});

test('unsafe references never displace a valid preview or get rendered as source images',()=>{
 for(const unsafe of ['javascript:alert(1)','http://example.org/frame.jpg','https://user:password@example.org/frame.jpg','//example.org/frame.jpg','/private/frame.jpg','/api/stories/CON-VISUAL/assets/x/preview?hash=invalid']){
  const bad={id:'bad',previewUrl:unsafe},good={id:'good',previewUrl:'https://example.org/good.jpg'};
  assert.equal(leadPhoto(story({media:[bad,good],selectedAssetIds:['bad']})),good);
  assert.ok(!image(bad).includes('<img '));
 }
 const html=image({id:'private',previewUrl:local('private')});
 assert.ok(html.includes('alt="Photographic reference"'));assert.ok(html.includes('Loading preview'));assert.ok(!html.includes('verified'));assert.ok(!html.includes('Archival'));
});

test('proposal feedback and source attribution bind the exact displayed cover even when another frame opens the sequence',()=>{
 const value=story({selectedAssetIds:['opening','displayed'],media:[{id:'opening',creator:'Other source credit'},{id:'displayed',title:'Visible reference',creator:'Displayed source credit',sourceUrl:'https://example.org/displayed',previewUrl:local('displayed'),localPreview:{sha256:hash}}]});
 const html=proposalCard(value);
 assert.ok(html.includes(`src="${local('displayed')}"`));assert.ok(html.includes('data-asset="displayed"'));assert.ok(html.includes(`data-preview-hash="${hash}"`));
 assert.ok(html.includes('Displayed source credit'));assert.ok(!html.includes('Other source credit'));assert.ok(!html.includes('Metadata only · preview unavailable'));
 assert.deepEqual(value.selectedAssetIds,['opening','displayed']);
 const missing=proposalCard(story({media:[{id:'metadata'}]}));assert.ok(missing.includes('Metadata only · preview unavailable'));assert.ok(!missing.includes('<img '));
});

test('story cards and Today share the same available cover reference without claiming photographic verification',()=>{
 const value=story({selectedAssetIds:['opening'],media:[{id:'opening'},{id:'visible',previewUrl:'https://example.org/visible.jpg'}]});
 for(const html of [storyCard(value),home({workspace:{stories:[value]}})]){
  assert.ok(html.includes('src="https://example.org/visible.jpg"'));assert.ok(html.includes('Loading preview'));assert.ok(!html.includes('Image verified'));
 }
});
