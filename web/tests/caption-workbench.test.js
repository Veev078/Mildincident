import test from 'node:test';import assert from 'node:assert/strict';
import {captionWorkspace} from '../caption.js';
const story={id:'CON-CAPTION-FIXTURE',title:'Synthetic caption story',hook:'A source-led cultural connection',caption:'Original source caption',revision:'r1',selectedAssetIds:['frame-b','frame-a'],media:[{id:'frame-a',title:'A reference without a preview'},{id:'frame-b',title:'A reference with an uninspected preview',previewUrl:'https://example.org/frame-b.jpg'}],research:[{claim:'A recorded claim',sourceName:'Original publication',url:'https://example.org/source'},{claim:'A second claim from the same page',url:'https://example.org/source'},{claim:'Unsafe source reference',url:'javascript:alert(1)'}]};
test('caption workbench retains the working editor contract and shows actual selected photographs in saved order',()=>{
 const working={...story,localDraft:{version:3,caption:'Working caption\nSecond paragraph',selectedAssetIds:['frame-b','frame-a']}};const before=JSON.stringify(working);
 const html=captionWorkspace({workspace:{hosted:true}},working,{renderChecks:()=>'<p>Existing checks preserved</p>'});
 assert.match(html,/id="caption-editor" aria-label="Local caption draft" data-draft-field="caption"/);assert.match(html,/Working caption\nSecond paragraph/);assert.match(html,/data-action="copy-caption"/);assert.match(html,/Autosaves to your private Studio/);assert.match(html,/Existing checks preserved/);assert.match(html,/Original source caption/);
 assert.ok(html.indexOf('data-asset="frame-b"')<html.indexOf('data-asset="frame-a"'));assert.match(html,/No preview available/);assert.match(html,/Preview availability does not establish identity or image rights/);assert.equal(JSON.stringify(working),before);
});
test('caption context deduplicates safe source links and preserves empty, stale and publication boundaries',()=>{
 const html=captionWorkspace({}, {...story,selectedAssetIds:[],localDraft:{caption:'',selectedAssetIds:[],stale:true}});
 assert.equal((html.match(/href="https:\/\/example.org\/source"/g)||[]).length,1);assert.ok(!html.includes('javascript:'));assert.match(html,/No photographs selected yet/);assert.match(html,/Choose your images/);assert.match(html,/rows="13" disabled/);assert.match(html,/does not approve or publish/);
 assert.ok(!html.includes('src="https://example.org/frame-b.jpg"'));
});
test('caption length and internal-marker warnings remain accurate and stored text stays escaped',()=>{
 const html=captionWorkspace({}, {...story,localDraft:{caption:'<script>DO NOT PUBLISH</script>'}});assert.match(html,/&lt;script&gt;DO NOT PUBLISH&lt;\/script&gt;/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('data-caption-warning class="inline-warning" hidden'));
 const long=captionWorkspace({}, {...story,localDraft:{caption:'x'.repeat(2201)}});assert.match(long,/2201 \/ 2,200 characters/);assert.match(long,/data-caption-count class="error-text"/);
});
