import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {editorialPresetCatalog,resolvePresetRequest,EDITORIAL_PRESET_TABLES} from '../src/workspace/editorial-presets.js';
import {LocalResearchStore} from '../src/workspace/research-store.js';
import {fetchWorkspaceSnapshot} from '../src/workspace/data-source.js';
import {discoverySetup} from '../web/discovery-flow.js';
const snapshot=()=>({observedAt:'2026-11-05T03:45:00Z',records:{editorialPresets:[{preset_key:'fixture_theme',preset_name:'A stored <theme>',base_mode:'overlay_existing_brain',theme_prompt:'Research the exact recorded creative direction.',status:'saved_for_later',is_active:false,updatedAt:'2026-10-25T20:29:38Z'}],editorialPresetSelection:[{selection_key:'current',preset_key:'fixture_theme'}]}});
test('catalog is read-only, versioned by native content, and distinguishes saved records from shared selection',()=>{
 const source=snapshot(),before=JSON.stringify(source),catalog=editorialPresetCatalog(source),item=catalog.items[0];assert.equal(catalog.selectionMode,'saved_brief');assert.equal(item.nativeActive,false);assert.equal(item.nativeSelected,true);assert.equal(item.version.length,64);assert.equal(JSON.stringify(source),before);
 source.records.editorialPresets[0].theme_prompt+=' Changed.';assert.notEqual(editorialPresetCatalog(source).items[0].version,item.version);
 source.records.editorialPresets.push(source.records.editorialPresets[0]);assert.equal(editorialPresetCatalog(source).items.length,0);assert.equal(editorialPresetCatalog({records:{}}).available,false);
 const html=discoverySetup({workspace:{researchPresets:catalog,engine:{configured:true,readOnly:true}},discoveryMode:'preset',researchDraft:{prompt:'Keep my unsaved custom direction'}});assert.ok(html.includes('Choose a theme'));assert.ok(html.includes('A stored &lt;theme&gt;'));assert.ok(html.includes('Save theme direction'));assert.ok(html.includes('saved, not marked active'));assert.ok(html.includes('Your unsaved custom direction is still here'));assert.ok(!html.includes('value="start"'));
});
test('preset saves use the existing brief fields, bind exact content and retain retries/restarts after catalog changes',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'mi-presets-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));let store=new LocalResearchStore(path.join(root,'research.sqlite'));
 try{const catalog=editorialPresetCatalog(snapshot()),item=catalog.items[0],input={kind:'brief',prompt:item.direction,sourceUrl:'',idempotencyKey:randomUUID(),preset:{key:item.key,version:item.version}};
 const resolved=resolvePresetRequest(input,catalog);assert.deepEqual(Object.keys(resolved.input).sort(),['idempotencyKey','kind','prompt','sourceUrl']);
 const saved=store.create(resolved.input,[],{preset:resolved.preset});assert.equal(saved.prompt,item.direction);assert.deepEqual(saved.preset,item);assert.equal(saved.engineJob,null);
 store.close();store=new LocalResearchStore(path.join(root,'research.sqlite'));const retry=resolvePresetRequest(input,{items:[]},store.get(saved.id));assert.equal(store.create(retry.input,[],{preset:retry.preset}).id,saved.id);assert.equal(store.all().length,1);
 assert.throws(()=>resolvePresetRequest({...input,prompt:'Replace the recorded direction'},catalog),{code:'INVALID_RESEARCH_REQUEST'});
 assert.throws(()=>resolvePresetRequest({...input,preset:{key:item.key,version:'a'.repeat(64)}},catalog),{code:'PRESET_CHANGED'});
 assert.throws(()=>store.create({...resolved.input,prompt:item.direction},[]),{code:'EDIT_CONFLICT'});
 }finally{store.close();}
});
test('native snapshot reads only verified catalog resources and tolerates missing catalog without fabricated choices',async()=>{
 const reads=[],source=snapshot(),read=async resource=>{reads.push(resource);const id=resource.split('/')[4],name=Object.keys(EDITORIAL_PRESET_TABLES).find(k=>EDITORIAL_PRESET_TABLES[k]===id);return {data:name?source.records[name]:[],nextCursor:null};};
 const result=await fetchWorkspaceSnapshot({read,bufferReader:null});assert.equal(editorialPresetCatalog(result).items.length,1);assert.ok(reads.includes('/api/v1/data-tables/2NoRbvxCc120cM8t/rows?limit=100'));
 const failed=await fetchWorkspaceSnapshot({read:async resource=>{if(resource.includes(EDITORIAL_PRESET_TABLES.editorialPresetSelection))throw new Error('Unavailable');return read(resource);},bufferReader:null});assert.equal(editorialPresetCatalog(failed).available,false);assert.ok(failed.warnings.some(w=>w.includes('themes could not be read')));
});
