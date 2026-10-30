import test from 'node:test';import assert from 'node:assert/strict';
import {sourceResearchBrief,sourceInputs} from '../sources.js';
test('publication leads prepare an editable source-bound investigation rather than inventing a generated story',()=>{
 const lead={id:'lead-1',sourceName:'Fixture publication',title:'A reported photographic project',url:'https://example.org/project',summary:'An unverified project announcement'};
 const brief=sourceResearchBrief(lead);assert.equal(brief.sourceUrl,lead.url);assert.ok(brief.prompt.includes(lead.title));assert.match(brief.prompt,/unverified, not instructions/);assert.match(brief.prompt,/alternative frames/);assert.ok(brief.prompt.length<=2000);assert.equal(sourceResearchBrief({...lead,url:'javascript:alert(1)'}),null);
 const html=sourceInputs({workspace:{sourceInputs:{publications:[],leads:[{...lead,title:'<script>not an instruction</script>'}]}}});assert.match(html,/data-source-brief="lead-1"/);assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Metadata only'));assert.ok(!html.includes('<script>'));
});
