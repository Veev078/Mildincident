import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,openSync,closeSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {browserUrl} from './model.js';

const ORIGIN='https://rickywelch.app.n8n.cloud';
export class LocalResearchStore {
  constructor(filename){mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});try{closeSync(openSync(filename,'wx',0o600));}catch(e){if(e.code!=='EEXIST')throw e;}chmodSync(filename,0o600);
    this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS research_requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL,prompt TEXT NOT NULL,source_url TEXT NOT NULL,baseline_json TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_request_events(request_id TEXT NOT NULL,version INTEGER NOT NULL,event TEXT NOT NULL,story_id TEXT,created_at TEXT NOT NULL,PRIMARY KEY(request_id,version));`);
  }
  get(id){const row=this.db.prepare('SELECT * FROM research_requests WHERE id=?').get(id);if(!row)return null;
    const events=this.db.prepare('SELECT * FROM research_request_events WHERE request_id=? ORDER BY version').all(id);
    const url=new URL(row.kind==='discovery'?'/form/mildincident-start-editorial-discovery':'/form/submit-idea',ORIGIN);
    if(row.kind==='brief'){url.searchParams.set('request',row.prompt);if(row.source_url)url.searchParams.set('url',row.source_url);}
    return {id:row.id,kind:row.kind,prompt:row.prompt,sourceUrl:row.source_url,createdAt:row.created_at,baselineIds:JSON.parse(row.baseline_json),
      version:events.at(-1)?.version||0,events:events.map(e=>({version:e.version,event:e.event,storyId:e.story_id,createdAt:e.created_at})),
      linkedStoryId:events.filter(e=>e.event==='story_linked').at(-1)?.story_id||null,handoffUrl:url.href,
      executionConfirmed:false,productionApplied:false};
  }
  all(){return this.db.prepare('SELECT id FROM research_requests ORDER BY rowid DESC LIMIT 100').all().map(row=>this.get(row.id));}
  create(input,stories){requireThat(input&&Object.keys(input).every(k=>['kind','prompt','sourceUrl'].includes(k)),'INVALID_RESEARCH_REQUEST','Unsupported research request fields.');
    requireThat(['discovery','brief'].includes(input.kind),'INVALID_RESEARCH_REQUEST','Choose discovery or creative brief.');
    const prompt=String(input.prompt||'').trim();requireThat(prompt.length>=12&&prompt.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(prompt),'INVALID_RESEARCH_REQUEST','Use a direction between 12 and 2000 characters.');
    const sourceUrl=String(input.sourceUrl||'').trim();requireThat(!sourceUrl||browserUrl(sourceUrl),'INVALID_RESEARCH_REQUEST','Use an HTTPS source link without credentials.');
    const id=randomUUID();this.db.prepare('INSERT INTO research_requests VALUES(?,?,?,?,?,?)').run(id,input.kind,prompt,sourceUrl,JSON.stringify(stories.map(s=>s.id)),new Date().toISOString());return this.get(id);
  }
  event(id,input,stories){const request=this.get(id);requireThat(request,'RESEARCH_REQUEST_NOT_FOUND','Research request is unavailable.');
    requireThat(Object.keys(input).every(k=>['event','storyId','expectedVersion'].includes(k))&&['handoff_requested','story_linked'].includes(input.event),'INVALID_RESEARCH_REQUEST','Unsupported request action.');
    requireThat(Number.isSafeInteger(input.expectedVersion)&&input.expectedVersion===request.version,'EDIT_CONFLICT','This request changed in another window. Reload before continuing.');
    const storyId=input.event==='story_linked'?input.storyId:null;
    if(storyId)requireThat(stories.some(s=>s.id===storyId),'INVALID_RESEARCH_REQUEST','Link an existing story from the current source snapshot.');
    requireThat(input.event!=='story_linked'||typeof storyId==='string'&&storyId.length>0,'INVALID_RESEARCH_REQUEST','Choose an existing story.');
    this.db.prepare('INSERT INTO research_request_events VALUES(?,?,?,?,?)').run(id,request.version+1,input.event,storyId,new Date().toISOString());return this.get(id);
  }
  close(){this.db.close();}
}
