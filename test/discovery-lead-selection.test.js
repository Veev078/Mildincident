import test from 'node:test';import assert from 'node:assert/strict';
import {sourceIdentity,developedSourceIdentities,selectPublicationLeads} from '../src/discovery/lead-selection.js';
const lead=(source,n)=>({title:'Source metadata '+n,sourceKey:source,url:`https://${source}.example/project-${n}`});
test('a burst from one publisher no longer crowds other real source leads out of the research context',()=>{
 const leads=[...Array.from({length:8},(_,i)=>lead('publication-a',i)),lead('publication-b',1),lead('publication-c',1)];
 assert.deepEqual(selectPublicationLeads(leads).slice(0,3).map(l=>l.sourceKey),['publication-a','publication-b','publication-c']);
 assert.equal(selectPublicationLeads(leads).length,6);assert.equal(leads.length,10);
});
test('research memory excludes previously developed source pages across claim, photograph and captured evidence fields, without banning their publisher',()=>{
 const requests=[{engineJob:{candidates:[{claims:[{source_url:'https://publication-a.example/project-0?utm_source=mail#credit'}],media:[{source_page_url:'https://publication-b.example/project-1'}],sourceEvidence:[{url:'https://publication-c.example/project-1'}]}]}}];
 const used=developedSourceIdentities(requests),fresh=lead('publication-a',2);
 const selected=selectPublicationLeads([lead('publication-a',0),lead('publication-b',1),lead('publication-c',1),fresh],{used});
 assert.deepEqual(selected,[fresh]);assert.equal(used.size,3);
 assert.notEqual(sourceIdentity('https://publication-a.example/project-0?frame=2'),sourceIdentity('https://publication-a.example/project-0?frame=3'));
});
test('deduplication keeps source records intact and never promotes unsafe references or fabricates replacements',()=>{
 const original=lead('publication-a',1),tracked={...original,url:original.url+'?utm_campaign=feed#image'};
 assert.deepEqual(selectPublicationLeads([original,tracked,{url:'http://localhost/secret'},{url:'https://publication-a.example/?api_key=secret'}]),[original]);
 assert.deepEqual(selectPublicationLeads([]),[]);assert.ok(!Object.hasOwn(original,'tasteVerified'));
});
