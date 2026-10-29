import test from 'node:test';
import assert from 'node:assert/strict';
import { previewUrl, image } from '../components.js';
import { assetDialog } from '../views.js';

test('only scoped hashed local preview paths are allowed alongside HTTPS images', () => {
 const url='/api/stories/CON-EXISTING-01/assets/asset-1/preview?hash='+'a'.repeat(64);
 assert.equal(previewUrl(url),url);
 for (const unsafe of ['//evil.example/x','/api/stories/CON-1/assets/a/preview?hash=x','/private.jpg','javascript:alert(1)','/api/stories/CON-1/assets/../preview?hash=aaa']) assert.equal(previewUrl(unsafe),'');
 assert.match(image({previewUrl:url,title:'<unsafe>'}),/src="\/api\/stories/);
 assert.ok(!image({previewUrl:url,title:'<unsafe>'}).includes('alt="<unsafe>'));
});
test('private preview review discloses rights and identity uncertainty and escapes filenames', () => {
 const html=assetDialog({id:'CON-1',title:'Story'}, {id:'asset-1',title:'<unsafe>',localPreview:{width:900,height:1200},rightsStatus:'preview_unreviewed'});
 assert.match(html,/Identity and rights remain unverified/);
 assert.match(html,/private review only/);
 assert.match(html,/data-preview-upload/);
 assert.ok(!html.includes('<unsafe>'));
});
