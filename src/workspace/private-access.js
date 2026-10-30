import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';import {promisify} from 'node:util';import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import path from 'node:path';import {requireThat} from '../errors.js';
const scrypt=promisify(scryptCallback),hash=v=>createHash('sha256').update(v).digest('hex'),cookieName='__Host-mildincident_session',csrfName='__Host-mildincident_login';
export async function passwordHash(password){requireThat(typeof password==='string'&&password.length>=16&&password.length<=256,'INVALID_STUDIO_PASSWORD','Use a unique password of16–256 characters.');const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});return 'scrypt-v1:'+salt+':'+key.toString('hex');}
function parseHash(value){const m=String(value||'').match(/^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{64})$/);requireThat(m,'INVALID_STUDIO_CONFIG','A generated Studio password hash is required.');return {salt:m[1],key:Buffer.from(m[2],'hex')};}
const cookies=request=>Object.fromEntries(String(request.headers.cookie||'').split(';').map(v=>v.trim().split('=')).filter(v=>v.length===2));
const setCookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
const loginPage=(csrf,error='')=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MILDINCIDENT · Private Studio</title><link rel="stylesheet" href="/auth.css"><body><main><p>MILDINCIDENT</p><h1>Your private Studio.</h1><form method="post" action="/auth/login"><input type="hidden" name="csrf" value="${csrf}"><label>Studio password<input type="password" name="password" autocomplete="current-password" maxlength="256" required autofocus></label><button>Sign in</button><p role="status">${error}</p></form></main></body></html>`;
export class PrivateAccess {
 constructor({origin,filename,passwordHash:encoded,now=()=>Date.now()}){
  const url=new URL(origin);requireThat(url.protocol==='https:'&&url.origin===origin,'INVALID_STUDIO_CONFIG','Hosted access requires an exact HTTPS origin.');this.origin=origin;this.password=parseHash(encoded);this.credentialVersion=hash(encoded);this.now=now;this.pending=0;
  fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});this.db=new DatabaseSync(filename);fs.chmodSync(filename,0o600);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS private_sessions(token_hash TEXT PRIMARY KEY,credential_version TEXT NOT NULL,expires_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS login_attempts(address_hash TEXT PRIMARY KEY,window_start INTEGER NOT NULL,failures INTEGER NOT NULL)');
 }
 originFor(request){requireThat(request.headers.host===new URL(this.origin).host,'INVALID_HOST','This private Studio accepts only its configured host.');if(request.headers.origin)requireThat(request.headers.origin===this.origin,'INVALID_ORIGIN','Cross-origin access is not permitted.');return this.origin;}
 session(request){const token=cookies(request)[cookieName];if(!/^[a-f0-9]{64}$/.test(token||''))return null;return this.db.prepare('SELECT token_hash FROM private_sessions WHERE token_hash=? AND credential_version=? AND expires_at>?').get(hash(token),this.credentialVersion,this.now())||null;}
 form(response,status,error=''){const nonce=randomBytes(32).toString('hex');response.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Set-Cookie':setCookie(csrfName,nonce,600)});response.end(loginPage(nonce,error));}
 async handle(request,response,url){
  response.setHeader('Vary','Cookie');response.setHeader('Strict-Transport-Security','max-age=31536000');
  // Render terminates TLS at its private ingress. No forwarded host/identity header is trusted.
  if(!request.socket.encrypted&&request.headers['x-forwarded-proto']!=='https'){response.writeHead(308,{Location:this.origin+url.pathname+url.search});response.end();return true;}
  if(url.pathname==='/auth.css'&&request.method==='GET'){response.writeHead(200,{'Content-Type':'text/css'});response.end('body{background:#f6f8ff;color:#142c63;font:16px system-ui;margin:0}main{max-width:420px;margin:12vh auto;padding:28px}h1{font:42px Georgia}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{padding:14px;margin-top:12px;border:1px solid #c4cee5}button{background:#173c89;color:white;cursor:pointer}input{margin-bottom:20px}');return true;}
  if(url.pathname==='/login'&&request.method==='GET'){if(this.session(request)){response.writeHead(303,{Location:'/'});response.end();}else this.form(response,200);return true;}
  if(url.pathname==='/auth/login'&&request.method==='POST'){
   requireThat(request.headers.origin===this.origin&&String(request.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'),'INVALID_ORIGIN','Submit the private sign-in form from this Studio.');
   let size=0,chunks=[];for await(const chunk of request){size+=chunk.length;requireThat(size<=4096,'BODY_TOO_LARGE','Sign-in form is too large.');chunks.push(chunk);}const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8')),csrf=form.get('csrf'),expected=cookies(request)[csrfName];requireThat(/^[a-f0-9]{64}$/.test(csrf||'')&&csrf===expected,'INVALID_ORIGIN','Reload the private sign-in form.');
   const address=hash(request.socket.remoteAddress||'single-proxy'),now=this.now();let attempt=this.db.prepare('SELECT * FROM login_attempts WHERE address_hash=?').get(address);if(!attempt||now-attempt.window_start>60000)attempt={window_start:now,failures:0};
   if(attempt.failures>=5||this.pending>=2){response.setHeader('Retry-After','60');this.form(response,429,'Too many sign-in attempts. Wait a minute and retry.');return true;}
   this.db.prepare('INSERT INTO login_attempts VALUES(?,?,?) ON CONFLICT(address_hash) DO UPDATE SET window_start=excluded.window_start,failures=excluded.failures').run(address,attempt.window_start,attempt.failures+1);
   const password=form.get('password')||'';this.pending++;let matches=false;try{if(password.length<=256){const key=await scrypt(password,this.password.salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});matches=timingSafeEqual(key,this.password.key);}}finally{this.pending--;}
   if(!matches){this.form(response,401,'Sign-in failed.');return true;}
   this.db.prepare('DELETE FROM private_sessions WHERE expires_at<=? OR credential_version<>?').run(now,this.credentialVersion);this.db.prepare('DELETE FROM login_attempts WHERE address_hash=?').run(address);
   const token=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO private_sessions VALUES(?,?,?)').run(hash(token),this.credentialVersion,now+12*3600000);
   response.writeHead(303,{Location:'/','Set-Cookie':[setCookie(cookieName,token,43200),setCookie(csrfName,'',0)]});response.end();return true;
  }
  const session=this.session(request);
  if(!session){if(url.pathname.startsWith('/api/')){response.writeHead(401,{'Content-Type':'application/json'});response.end(JSON.stringify({error:{code:'LOGIN_REQUIRED',message:'Sign in to your private Studio.'}}));}else{response.writeHead(303,{Location:'/login'});response.end();}return true;}
  if(url.pathname==='/auth/logout'&&request.method==='POST'){requireThat(request.headers.origin===this.origin,'INVALID_ORIGIN','Sign out from your Studio.');this.db.prepare('DELETE FROM private_sessions WHERE token_hash=?').run(session.token_hash);response.writeHead(303,{Location:'/login','Clear-Site-Data':'"cache", "cookies"','Set-Cookie':setCookie(cookieName,'',0)});response.end();return true;}
  return false;
 }
 close(){this.db.close();}
}
