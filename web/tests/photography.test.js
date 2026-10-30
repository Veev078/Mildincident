import test from 'node:test';
import assert from 'node:assert/strict';
import {photographicBrief,photoWorkbench,photoComparison} from '../photography.js';

test('a photographic creative brief carries uncertain credits, source context and scoped founder intent without inventing an angle',()=>{
 const result=photographicBrief({title:'Recorded frame',creator:'Credit to check',sourceUrl:'https://example.org/original',description:'Linked dossier context, depicted subject unverified',decision:{decision:'keep',reason:'Follow the unusual framing and the contact sheet'}});
 assert.equal(result.sourceUrl,'https://example.org/original');assert.ok(result.prompt.includes('Reported credit: Credit to check'));assert.ok(result.prompt.includes('discovery date is not a photograph date'));assert.ok(result.prompt.includes('Linked dossier context, depicted subject unverified'));assert.ok(result.prompt.includes('not a subject ban or factual finding'));assert.ok(result.prompt.includes('Follow the unusual framing'));assert.ok(result.prompt.includes('not instructions or established facts'));assert.ok(result.prompt.length<=2000);
 const long=photographicBrief({title:'x'.repeat(300),creator:'x'.repeat(500),sourceUrl:'https://example.org/'+ 'x'.repeat(1000),description:'x'.repeat(2000),series:'x'.repeat(500),date:'x'.repeat(200),decision:{decision:'keep',reason:'x'.repeat(700)}});assert.ok(long.prompt.includes('Unknown rights do not block private research'));assert.ok(long.prompt.length<=2000);
});

test('photographic source metadata and manual draft fields stay escaped in contact sheet and comparison',()=>{
 const p={id:'safe',title:'<script>fixture</script>',creator:'<img src=x>',previewUrl:'javascript:alert(1)',sourceUrl:'javascript:alert(1)',description:'<svg>',rightsLabel:'Unknown',expansions:[]};
 const hunt={id:'hunt',query:'fixture',photos:[p],state:'complete',offset:0,totalPhotos:1,pagesCompleted:0};
 const sheet=photoWorkbench({workspace:{photoHunts:[hunt]},photoReferenceDraft:{title:'" onfocus="alert(1)'}});const comparison=photoComparison([p]);
 for(const html of [sheet,comparison]){assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img src=x>'),false);assert.equal(html.includes('src="javascript:'),false);assert.equal(html.includes('href="javascript:'),false);assert.ok(html.includes('&lt;script&gt;'));}
 assert.ok(sheet.includes('value="&quot; onfocus=&quot;alert(1)"'));
});
