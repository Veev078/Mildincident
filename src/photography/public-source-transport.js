import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import https from 'node:https';
import {safePhotoReference} from '../n8n/photo-url-guard.js';
import {requireThat} from '../errors.js';

// A story URL grants one bounded public read, never access to a private network.
// DNS is checked on every hop and the TLS socket uses that checked address.
export function publicSourceAddress(value){
 const family=isIP(value);if(!family)return false;
 if(family===4){const [a,b,c]=value.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
 // Accept global unicast only. Mapped, transition, documentation, link-local,
 // multicast and unique-local IPv6 cannot smuggle a private IPv4 destination.
 const parts=value.toLowerCase().split(':');const first=parseInt(parts[0],16);
 if(!Number.isFinite(first)||first<0x2000||first>0x3fff)return false;
 const second=parseInt(parts[1]||'0',16);
 return !(first===0x2001&&(second<=0x1ff||second===0xdb8))&&first!==0x2002&&first!==0x3fff;
}

export async function resolvePublicSource(hostname,{lookupImpl=lookup}={}){
 let answers;try{answers=await lookupImpl(hostname,{all:true,verbatim:true});}catch{throw Error('SOURCE_DNS_UNAVAILABLE');}
 requireThat(Array.isArray(answers)&&answers.length>0&&answers.length<=32&&answers.every(a=>publicSourceAddress(a.address)&&Number(a.family)===isIP(a.address)),'SOURCE_NONPUBLIC_ADDRESS','Every source DNS answer must be a public address.');
 return answers.map(a=>({address:a.address,family:Number(a.family)})).sort((a,b)=>a.family-b.family);
}

export const normalizedSourceAddress=value=>isIP(value)===6?new URL('http://['+value+']/').hostname.slice(1,-1):value;

export function pinnedSourceRequest(url,{address,headers,signal}){
 return new Promise((resolve,reject)=>{
  const target=new URL(url),request=https.request(target,{method:'GET',headers,signal,agent:false,family:address.family,autoSelectFamily:false,servername:target.hostname,lookup:(host,options,callback)=>{if(host!==target.hostname)return callback(Error('SOURCE_DNS_CHANGED'));if(options.all)callback(null,[address]);else callback(null,address.address,address.family);}},response=>{
   // Check the connected endpoint as well as lookup; no ambient Agent, socket
   // reuse or environment proxy may choose a different endpoint.
   const remote=response.socket?.remoteAddress?.replace(/^::ffff:/i,'');
   if(!remote||normalizedSourceAddress(remote)!==normalizedSourceAddress(address.address)){response.destroy();reject(Error('SOURCE_DNS_CHANGED'));return;}
   const responseHeaders=new Headers();for(const [k,v]of Object.entries(response.headers))if(v!==undefined)responseHeaders.set(k,Array.isArray(v)?v.join(', '):v);
   resolve({status:response.statusCode,headers:responseHeaders,body:response});
  });
  request.once('error',reject);request.end();
 });
}

const safeUrl=value=>{const valid=safePhotoReference(value);requireThat(valid,'SOURCE_UNSAFE_URL','Use a public HTTPS source without credentials.');return valid;};
export function publisherAliasRedirect(from,to){const a=new URL(from),b=new URL(to);return a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'')&&a.search===b.search;}
const cancel=async body=>{if(body?.destroy)body.destroy();else try{await body?.cancel?.();}catch{/* Already consumed. */}};

/** Injected fetchImpl is a fixture seam, never the default network transport. */
export async function readPublicSource(url,{accept,maxBytes,timeoutMs=12000,maxRedirects=2,allowedRedirectUrls=[],sameHostRedirects=true,fetchImpl=null,lookupImpl=lookup,requestImpl=pinnedSourceRequest,proxyConfigured=Boolean(process.env.HTTPS_PROXY||process.env.HTTP_PROXY||process.env.ALL_PROXY)}={}){
 safeUrl(url);requireThat(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=20000000,'SOURCE_INVALID_LIMIT','Use a bounded source read.');
 const injected=fetchImpl&&fetchImpl!==globalThis.fetch;
 // A CONNECT proxy resolves its own target; pretending local DNS pins that
 // endpoint would be unsafe. Refuse instead of bypassing inherited routing.
 requireThat(injected||requestImpl!==pinnedSourceRequest||!proxyConfigured,'SOURCE_PINNED_TRANSPORT_UNAVAILABLE','Public source verification is unavailable through this network proxy.');
 const signal=AbortSignal.timeout(timeoutMs),hops=[],seen=new Set();let current=url;
 const within=promise=>new Promise((resolve,reject)=>{const abort=()=>reject(Error('SOURCE_TIMEOUT'));if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(signal.aborted?Error('SOURCE_TIMEOUT'):error);});});
 for(let hop=0;hop<=maxRedirects;hop++){
  safeUrl(current);requireThat(!seen.has(current),'SOURCE_REDIRECT_LOOP','The source redirected in a loop.');seen.add(current);
  const answers=injected?[]:await within(resolvePublicSource(new URL(current).hostname,{lookupImpl}));signal.throwIfAborted();
  const headers={Accept:accept,'User-Agent':'MILDINCIDENT/1.0 (private editorial source review)','Accept-Encoding':'identity'};
  let response;try{response=await within(injected?fetchImpl(current,{method:'GET',redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer',headers,signal}):requestImpl(current,{address:answers[0],headers,signal}));}catch(error){if(/^SOURCE_/.test(error.code||error.message||''))throw error;throw Error(signal.aborted?'SOURCE_TIMEOUT':'SOURCE_CONNECTION_FAILED');}
  const status=Number(response.status);hops.push({url:current,status,address:answers[0]?.address||null});
  if([301,302,303,307,308].includes(status)){
   const location=response.headers.get('location');await cancel(response.body);
   requireThat(hop<maxRedirects&&location,'SOURCE_REDIRECT_LIMIT','The source redirect limit was reached.');
   let next;try{next=new URL(location,current).href;}catch{throw Error('SOURCE_UNSAFE_REDIRECT');}safeUrl(next);
   requireThat(sameHostRedirects&&(new URL(next).hostname===new URL(current).hostname||publisherAliasRedirect(current,next))||allowedRedirectUrls.includes(next),'SOURCE_REDIRECT_NOT_BOUND','A redirect must stay on its source host or another exact URL bound to this request.');
   current=next;continue;
  }
  try{
   requireThat(status===200,'SOURCE_HTTP_'+status,'SOURCE_HTTP_'+status);
   const declared=response.headers.get('content-length'),encoding=response.headers.get('content-encoding');
   requireThat(!encoding||encoding==='identity','SOURCE_ENCODED_RESPONSE','Compressed source transfer is not supported by this bounded reader.');
   requireThat(!declared||/^\d+$/.test(declared)&&Number(declared)>0&&Number(declared)<=maxBytes,'SOURCE_TOO_LARGE','The source exceeds its acquisition limit.');
   const chunks=[];let size=0;const iterable=response.body||[],iterator=iterable[Symbol.asyncIterator]?.()||iterable[Symbol.iterator]();for(;;){const {value:chunk,done}=await within(iterator.next());if(done)break;const bytes=Buffer.from(chunk);size+=bytes.length;requireThat(size<=maxBytes,'SOURCE_TOO_LARGE','The source exceeded its streaming limit.');chunks.push(bytes);}
   requireThat(size>0&&(!declared||size===Number(declared)),'SOURCE_SIZE_CHANGED','The source response length changed.');
   return {bytes:Buffer.concat(chunks),contentType:(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(),transport:{policy:'public_pinned_https_v1',networkValidation:injected?'injected_test_transport':'public_dns_pinned_socket',initialUrl:url,finalUrl:current,hops,requests:hops.length,cookiesForwarded:false,credentialsForwarded:false,automaticRetries:0}};
  }finally{await cancel(response.body);}
 }
 throw Error('SOURCE_REDIRECT_LIMIT');
}
