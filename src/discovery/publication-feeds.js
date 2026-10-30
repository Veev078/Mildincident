import Parser from 'rss-parser';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {safePhotoReference as safe} from '../n8n/photo-url-guard.js';
import {requireThat} from '../errors.js';
export const PUBLICATION_FEEDS=[
 {key:'booooooom',name:'Booooooom',url:'https://www.booooooom.com/feed/',focus:'Independent photography, artists and visual culture',verification:'not_live_verified'},
 {key:'its_nice_that',name:"It’s Nice That",url:'https://www.itsnicethat.com/rss',focus:'Contemporary creative projects and original visual work',verification:'not_live_verified'},
];
const clean=(value,max=1200)=>String(value||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,max);
export async function parsePublicationFeed(xml,source,observedAt=new Date().toISOString()) {
 requireThat(typeof xml==='string'&&Buffer.byteLength(xml)<=1048576&&!/<!DOCTYPE|<!ENTITY/i.test(xml),'INVALID_FEED','Feed is oversized or declares unsupported XML entities.');
 const parsed=await new Parser().parseString(xml);const entries=Array.isArray(parsed.items)?parsed.items:[];
 return entries.map(item=>{
  const url=safe(item.link),identity=url||String(item.guid||item.id||'');if(!identity)return null;
  const html=String(item.content||item.description||''),image=safe(item.enclosure?.type?.startsWith('image/')?item.enclosure.url:(html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)||[])[1]);
  const published=String(item.isoDate||item.pubDate||item.published||'');return {id:'feed:'+createHash('sha256').update(source.key+'\n'+identity).digest('hex').slice(0,32),kind:'source_lead',sourceKey:source.key,sourceName:source.name,title:clean(item.title,400)||'Untitled publication entry',url,summary:clean(item.contentSnippet||item.summary||html,1200),authorReported:clean(item.creator||item.author,200),photographer:'',publishedAt:Number.isFinite(Date.parse(published))?new Date(published).toISOString():null,photographDate:null,previewUrl:image,previewBasis:image?'feed_supplied_unverified':'no_preview_reference',observedAt,editorialAngle:null,aiGenerated:false,rightsGranted:false,publicationApproved:false,evidenceBasis:'publication_feed_metadata_not_independently_verified'};
 }).filter(Boolean);
}
export function currentSourcePolicy(){try{return JSON.parse(readFileSync('/etc/codex/network-policy.json','utf8')).http_network_policy;}catch{return null;}}
export class PublicationFeeds {
 constructor(research,{fetchImpl=fetch,policy=currentSourcePolicy(),sources=PUBLICATION_FEEDS,now=()=>Date.now()}={}){
  this.db=research.db;this.research=research;this.fetch=fetchImpl;this.policy=policy;this.sources=sources;this.now=now;this.running=false;
  this.db.exec('CREATE TABLE IF NOT EXISTS publication_lead_versions(id TEXT NOT NULL,data_json TEXT NOT NULL,observed_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS publication_leads(id TEXT PRIMARY KEY,source_key TEXT NOT NULL,data_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS publication_feed_reads(id INTEGER PRIMARY KEY,source_key TEXT NOT NULL,status TEXT NOT NULL,data_json TEXT NOT NULL,observed_at TEXT NOT NULL)');
 }
 allowed(source){return !this.policy||this.policy.type==='unrestricted'||this.policy.egress_rules?.some(r=>r.host===new URL(source.url).hostname);}
 latest(key){const row=this.db.prepare('SELECT * FROM publication_feed_reads WHERE source_key=? ORDER BY id DESC LIMIT 1').get(key);return row?{status:row.status,observedAt:row.observed_at,...JSON.parse(row.data_json)}:null;}
 list(){return this.db.prepare("SELECT data_json FROM publication_leads ORDER BY json_extract(data_json,'$.publishedAt') DESC,rowid DESC LIMIT 60").all().map(r=>JSON.parse(r.data_json));}
 status(){return this.sources.map(s=>({...s,network:this.allowed(s)?'not_blocked_by_available_policy':'blocked',lastRead:this.latest(s.key)}));}
 async refresh(){requireThat(!this.running,'EDIT_CONFLICT','Publication intake is already running.');this.running=true;try{
  for(const source of this.sources){
   const latest=this.latest(source.key);if(latest?.status==='retrieved'&&this.now()-Date.parse(latest.observedAt)<900000)continue;
   const at=new Date(this.now()).toISOString();let outcome={status:'unavailable',sourceCalls:0,records:0,paidCalls:0};
   if(!this.allowed(source))outcome.status='network_blocked';else try{
    outcome.sourceCalls=1;const response=await this.fetch(source.url,{headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml','User-Agent':'MILDINCIDENT/2.0 (private source research)'},redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('SOURCE_HTTP');let bytes=0,chunks=[];for await(const part of response.body){bytes+=part.byteLength;if(bytes>1048576)throw new Error('FEED_TOO_LARGE');chunks.push(part);}const leads=await parsePublicationFeed(Buffer.concat(chunks).toString('utf8'),source,at);
    this.db.exec('BEGIN IMMEDIATE');try{for(const lead of leads){const encoded=JSON.stringify(lead);this.db.prepare('INSERT INTO publication_lead_versions VALUES(?,?,?)').run(lead.id,encoded,at);this.db.prepare('INSERT INTO publication_leads VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json').run(lead.id,source.key,encoded);}this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}outcome={...outcome,status:'retrieved',records:leads.length};
   }catch{outcome={...outcome,status:'unavailable'};}
   this.db.prepare('INSERT INTO publication_feed_reads(source_key,status,data_json,observed_at) VALUES(?,?,?,?)').run(source.key,outcome.status,JSON.stringify(outcome),at);
  }return this.status();
 }finally{this.running=false;}}
 context(){const used=new Set(this.research.all().flatMap(r=>(r.engineJob?.candidates||[]).flatMap(c=>(c.claims||[]).map(claim=>claim.url))));return this.list().filter(l=>!used.has(l.url)).slice(0,6).map(l=>({title:l.title.slice(0,180),url:l.url,source:l.sourceName,summary:l.summary.slice(0,300),publishedAt:l.publishedAt,observedAt:l.observedAt,availability:this.latest(l.sourceKey)?.status||'unverified',photographDate:null,basis:'feed_metadata_not_verified',isGeneratedStory:false}));}
}
