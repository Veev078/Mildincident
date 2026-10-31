import {preparePhotoContinuation} from '../photography/continuation.js';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,openSync,closeSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireThat} from '../errors.js';
import {browserUrl} from './model.js';
import {defaultDiscoveryKey} from '../../web/discovery-request.js';

const ORIGIN='https://rickywelch.app.n8n.cloud';
export class LocalResearchStore {
  constructor(filename){mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});try{closeSync(openSync(filename,'wx',0o600));}catch(e){if(e.code!=='EEXIST')throw e;}chmodSync(filename,0o600);
    this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS research_requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL,prompt TEXT NOT NULL,source_url TEXT NOT NULL,baseline_json TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_request_events(request_id TEXT NOT NULL,version INTEGER NOT NULL,event TEXT NOT NULL,story_id TEXT,created_at TEXT NOT NULL,PRIMARY KEY(request_id,version));
      CREATE TABLE IF NOT EXISTS research_request_equivalence(request_id TEXT PRIMARY KEY,default_key TEXT NOT NULL,baseline_context TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_request_aliases(idempotency_key TEXT PRIMARY KEY,request_id TEXT NOT NULL,kind TEXT NOT NULL,prompt TEXT NOT NULL,source_url TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_delivery_state(id INTEGER PRIMARY KEY CHECK(id=1),data_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_continuations(request_id TEXT PRIMARY KEY,context_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_engine_jobs(request_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,data_json TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_engine_events(request_id TEXT NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL,data_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(request_id,version));`);
  }
  get(id){const row=this.db.prepare('SELECT * FROM research_requests WHERE id=?').get(id);if(!row)return null;
    const events=this.db.prepare('SELECT * FROM research_request_events WHERE request_id=? ORDER BY version').all(id);
    const url=new URL(row.kind==='discovery'?'/form/mildincident-start-editorial-discovery':'/form/submit-idea',ORIGIN);
    if(row.kind==='brief'){url.searchParams.set('request',row.prompt);if(row.source_url)url.searchParams.set('url',row.source_url);}
    return {id:row.id,kind:row.kind,prompt:row.prompt,sourceUrl:row.source_url,createdAt:row.created_at,baselineIds:JSON.parse(row.baseline_json),
      version:events.at(-1)?.version||0,events:events.map(e=>({version:e.version,event:e.event,storyId:e.story_id,createdAt:e.created_at})),
      linkedStoryId:events.filter(e=>e.event==='story_linked').at(-1)?.story_id||null,handoffUrl:this.db.prepare('SELECT request_id FROM research_continuations WHERE request_id=?').get(row.id)?null:url.href,
      continuation:JSON.parse(this.db.prepare('SELECT context_json FROM research_continuations WHERE request_id=?').get(row.id)?.context_json||'null'),engineJob:this.engineJob(row.id),executionConfirmed:false,productionApplied:false};
  }
  all(){return this.db.prepare('SELECT id FROM research_requests ORDER BY rowid DESC LIMIT 100').all().map(row=>this.get(row.id));}
  create(input,stories,{reuseDefault=false}={}){requireThat(input&&Object.keys(input).every(k=>['kind','prompt','sourceUrl','idempotencyKey'].includes(k)),'INVALID_RESEARCH_REQUEST','Unsupported research request fields.');
    requireThat(['discovery','brief'].includes(input.kind),'INVALID_RESEARCH_REQUEST','Choose discovery or creative brief.');
    const prompt=String(input.prompt||'').trim();requireThat(prompt.length>=12&&prompt.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(prompt),'INVALID_RESEARCH_REQUEST','Use a direction between 12 and 2000 characters.');
    const sourceUrl=String(input.sourceUrl||'').trim();requireThat(!sourceUrl||browserUrl(sourceUrl),'INVALID_RESEARCH_REQUEST','Use an HTTPS source link without credentials.');
    requireThat(input.idempotencyKey === undefined || typeof input.idempotencyKey === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.idempotencyKey), 'INVALID_RESEARCH_REQUEST', 'Use a valid local request identity.');
    const id=input.idempotencyKey || randomUUID();
    // The write lock covers lookup, reuse and alias binding across connections.
    // Nested callers already own the private review/continuation transaction.
    const outer=!this.db.isTransaction;
    this.db.exec(outer?'BEGIN IMMEDIATE':'SAVEPOINT create_research_request');
    try{
      const alias=this.db.prepare('SELECT * FROM research_request_aliases WHERE idempotency_key=?').get(id),existing=this.get(id);
      if(existing||alias){
        // Native observations own their exact IDs. Only the opted-in Studio save
        // may resolve an alias created by an earlier equivalent default save.
        requireThat(!alias||reuseDefault,'EDIT_CONFLICT','This identity is a private save retry, not an authoritative research job. Preserve the original request.');
        const identity=existing||{kind:alias.kind,prompt:alias.prompt,sourceUrl:alias.source_url};
        requireThat(identity.kind===input.kind&&identity.prompt===prompt&&identity.sourceUrl===sourceUrl,'EDIT_CONFLICT','This request identity belongs to a different brief. Preserve it and create a new request.');
        const result=existing||this.get(alias.request_id);
        requireThat(result,'EDIT_CONFLICT','The original request is unavailable. Preserve this request identity.');
        this.db.exec(outer?'COMMIT':'RELEASE create_research_request');return result;
      }
      const defaultKey=reuseDefault?defaultDiscoveryKey({kind:input.kind,prompt,sourceUrl}):null;
      const baselineContext=JSON.stringify(stories.map(s=>[s.id,s.revision??null,s.localDraft?.version??0]).sort((a,b)=>a[0].localeCompare(b[0])));
      const equivalent=defaultKey?this.db.prepare(`SELECT r.id FROM research_requests r JOIN research_request_equivalence q ON q.request_id=r.id
        WHERE q.default_key=? AND q.baseline_context=?
        AND NOT EXISTS(SELECT 1 FROM research_request_events e WHERE e.request_id=r.id)
        AND NOT EXISTS(SELECT 1 FROM research_engine_jobs j WHERE j.request_id=r.id)
        AND NOT EXISTS(SELECT 1 FROM research_engine_events h WHERE h.request_id=r.id)
        AND NOT EXISTS(SELECT 1 FROM research_continuations c WHERE c.request_id=r.id)
        ORDER BY r.rowid DESC LIMIT 1`).get(defaultKey,baselineContext):null;
      if(equivalent){
        if(input.idempotencyKey)this.db.prepare('INSERT INTO research_request_aliases VALUES(?,?,?,?,?)').run(id,equivalent.id,input.kind,prompt,sourceUrl);
        const result=this.get(equivalent.id);this.db.exec(outer?'COMMIT':'RELEASE create_research_request');return result;
      }
      this.db.prepare('INSERT INTO research_requests VALUES(?,?,?,?,?,?)').run(id,input.kind,prompt,sourceUrl,JSON.stringify(stories.map(s=>s.id)),new Date().toISOString());
      if(defaultKey)this.db.prepare('INSERT INTO research_request_equivalence VALUES(?,?,?)').run(id,defaultKey,baselineContext);
      const result=this.get(id);this.db.exec(outer?'COMMIT':'RELEASE create_research_request');return result;
    }catch(error){this.db.exec(outer?'ROLLBACK':'ROLLBACK TO create_research_request');if(!outer)this.db.exec('RELEASE create_research_request');throw error;}
  }
  createPhotoContinuation(story,input,stories){
    const {request,continuation}=preparePhotoContinuation(story,input),encoded=JSON.stringify(continuation);
    this.db.exec('SAVEPOINT prepare_photo_continuation');try{
      const existing=request.idempotencyKey?this.get(request.idempotencyKey):null;
      requireThat(!existing||existing.continuation&&JSON.stringify(existing.continuation)===encoded,'EDIT_CONFLICT','This request identity belongs to different research context.');
      const saved=this.create(request,stories);this.db.prepare('INSERT OR IGNORE INTO research_continuations VALUES(?,?)').run(saved.id,encoded);
      this.db.exec('RELEASE prepare_photo_continuation');return this.get(saved.id);
    }catch(error){this.db.exec('ROLLBACK TO prepare_photo_continuation');this.db.exec('RELEASE prepare_photo_continuation');throw error;}
  }
  event(id,input,stories){const request=this.get(id);requireThat(request,'RESEARCH_REQUEST_NOT_FOUND','Research request is unavailable.');
    requireThat(Object.keys(input).every(k=>['event','storyId','expectedVersion'].includes(k))&&['handoff_requested','story_linked'].includes(input.event),'INVALID_RESEARCH_REQUEST','Unsupported request action.');
    requireThat(Number.isSafeInteger(input.expectedVersion)&&input.expectedVersion===request.version,'EDIT_CONFLICT','This request changed in another window. Reload before continuing.');
    const storyId=input.event==='story_linked'?input.storyId:null;
    if(storyId)requireThat(stories.some(s=>s.id===storyId),'INVALID_RESEARCH_REQUEST','Link an existing story from the current source snapshot.');
    requireThat(input.event!=='story_linked'||typeof storyId==='string'&&storyId.length>0,'INVALID_RESEARCH_REQUEST','Choose an existing story.');
    this.db.prepare('INSERT INTO research_request_events VALUES(?,?,?,?,?)').run(id,request.version+1,input.event,storyId,new Date().toISOString());return this.get(id);
  }
  engineJob(id){const row=this.db.prepare('SELECT * FROM research_engine_jobs WHERE request_id=?').get(id);return row?{requestId:id,requestHash:row.request_hash,state:row.state,version:row.version,...JSON.parse(row.data_json),updatedAt:row.updated_at}:null;}
  claimEngineQueue(id,hash){requireThat(this.get(id),'RESEARCH_REQUEST_NOT_FOUND','Save a local research request first.');const now=new Date().toISOString();
    const result=this.db.prepare("INSERT OR IGNORE INTO research_engine_jobs VALUES(?,?,'queueing',0,'{}',?)").run(id,hash,now);const job=this.engineJob(id);requireThat(job.requestHash===hash,'EDIT_CONFLICT','This engine identity belongs to different request content.');return {claimed:result.changes===1,job};
  }
  recordEngineState(id,state,data={},expectedVersion){
    const allowed=['queueing','queued','queue_uncertain','dispatching','dispatch_uncertain','generating','ready_to_review','needs_research','failed','rejected','approved'];
    requireThat(allowed.includes(state),'INVALID_ENGINE_STATE','Unknown development job state.');
    this.db.exec('BEGIN IMMEDIATE');try{const previous=this.engineJob(id);requireThat(previous,'RESEARCH_REQUEST_NOT_FOUND','Engine job is unavailable.');requireThat(expectedVersion===undefined||expectedVersion===previous.version,'EDIT_CONFLICT','Engine state changed in another window.');
      const merged={...previous,...data};for(const key of ['requestId','requestHash','state','version','updatedAt'])delete merged[key];const encoded=JSON.stringify(merged);const now=new Date().toISOString();const version=previous.version+1;
      this.db.prepare('UPDATE research_engine_jobs SET state=?,version=?,data_json=?,updated_at=? WHERE request_id=?').run(state,version,encoded,now,id);
      this.db.prepare('INSERT INTO research_engine_events VALUES(?,?,?,?,?)').run(id,version,state,encoded,now);this.db.exec('COMMIT');return this.engineJob(id);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  claimEngineDispatch(id,version,dispatchId){const previous=this.engineJob(id);requireThat(previous?.state==='queued'&&!previous.dispatchId&&!previous.receiptExecutionId&&!previous.executionId,'ENGINE_ALREADY_DISPATCHED','Only an undispatched queued job can start. Reconcile existing work.');return this.recordEngineState(id,'dispatching',{dispatchId},version);}
  engineHistory(id){return this.db.prepare('SELECT version,state,created_at FROM research_engine_events WHERE request_id=? ORDER BY version DESC LIMIT 30').all(id).map(r=>({version:r.version,state:r.state,createdAt:r.created_at}));}
  founderTasteFeedback(){
    const byCandidate=new Map();
    const rows=this.db.prepare("SELECT request_id,data_json FROM research_engine_events WHERE json_type(data_json,'$.reviewDecisions')='object' ORDER BY rowid DESC LIMIT 2000").all();
    for(const row of rows){const data=JSON.parse(row.data_json);for(const [candidateId,review] of Object.entries(data.reviewDecisions||{}))if(review.reviewer==='founder'&&review.basis==='editorial_taste'&&!byCandidate.has(candidateId)){const candidate=this.engineJob(row.request_id)?.candidates?.find(c=>c.id===candidateId);if(candidate)byCandidate.set(candidateId,{candidateId,subject:candidate.subject||candidate.title,decision:review.decision,reason:review.reason.slice(0,700),basis:review.basis,reviewer:'founder',createdAt:review.createdAt});}}
    if(this.db.prepare("SELECT name FROM sqlite_master WHERE name='photo_decisions'").get()){const photos=this.db.prepare('SELECT d.photo_id,d.decision,d.reason,d.created_at,c.data_json FROM photo_decisions d JOIN photo_candidates c ON c.id=d.photo_id ORDER BY d.rowid DESC LIMIT 300').all();for(const r of photos){const key='photo:'+r.photo_id;if(!byCandidate.has(key)){const p=JSON.parse(r.data_json);byCandidate.set(key,{candidateId:key,subject:p.title,decision:r.decision==='keep'?'approved':r.decision==='hold'?'needs_research':'rejected',reason:r.reason,basis:'editorial_taste',reviewer:'founder',scope:'specific_photograph_selection',createdAt:r.created_at});}}}
    if(this.db.prepare("SELECT name FROM sqlite_master WHERE name='founder_review_events'").get()){
      const rows=this.db.prepare('SELECT e.target_id,e.data_json,e.created_at FROM founder_review_events e WHERE version=(SELECT MAX(version) FROM founder_review_events WHERE target_id=e.target_id)').all();
      for(const row of rows){const r=JSON.parse(row.data_json);if(r.decision==='reset')continue;byCandidate.set('review:'+row.target_id,{candidateId:'review:'+row.target_id,storyId:row.target_id,subject:r.subject,decision:r.decision==='pass'?'rejected':['develop','save'].includes(r.decision)?'approved':'needs_research',reason:r.reason||'Founder chose '+r.decision+'; no explanatory note supplied.',basis:['factual_issue','source_issue','rights_issue','retrieval_issue','interface_issue'].includes(r.basis)?'reported_'+r.basis:'editorial_taste',reviewer:'founder',scope:r.scope||'specific_editorial_proposal',decisionBasis:r.basis,dimensions:r.dimensions,...(r.photograph?{photograph:r.photograph}:{}),sourceRevision:r.sourceRevision,workingVersion:r.workingVersion,createdAt:row.created_at});}
    }
    return [...byCandidate.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,6);
  }
  deliveryState(){return JSON.parse(this.db.prepare('SELECT data_json FROM research_delivery_state WHERE id=1').get()?.data_json||'null');}
  saveDeliveryState(state){this.db.prepare('INSERT INTO research_delivery_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json').run(JSON.stringify(state));return state;}
  close(){this.db.close();}
}
