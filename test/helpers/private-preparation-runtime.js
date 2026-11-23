// Isolated replay of captured native node parameters. This is NOT n8n Cloud.
// No network, provider, credentials, production records or photograph fixtures.
import vm from 'node:vm';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export class PrivatePreparationReplay {
 constructor(graph,tables,{secret='f'.repeat(64),beforeUpdate=null}={}){Object.assign(this,{graph,tables,secret,beforeUpdate});this.executions=new Map();this.sequence=99000;this.writes=[];this.calls=[];}
 async run(body,token){
  const [h,p,s]=String(token).split('.'),signature=createHmac('sha256',this.secret).update(h+'.'+p).digest(),got=Buffer.from(s||'','base64url');if(got.length!==signature.length||!timingSafeEqual(got,signature))throw Error('JWT_SIGNATURE_INVALID');
  const id=String(++this.sequence),outputs=new Map(),responses=[],runtime=this;
  const read=name=>({get isExecuted(){return outputs.has(name);},first:()=>{if(!outputs.has(name))throw Error('NODE_NOT_EXECUTED '+name);return outputs.get(name)[0];},all:()=>{if(!outputs.has(name))throw Error('NODE_NOT_EXECUTED '+name);return outputs.get(name);}});
  const context=(input=[])=>({$:read,$input:{first:()=>input[0],all:()=>input},$json:input[0]?.json,$execution:{id},$now:{toISO:()=>new Date().toISOString(),toISODate:()=>new Date().toISOString().slice(0,10)},Buffer,URL});
  const evaluate=(value,input)=>typeof value==='string'&&value.startsWith('={{')?vm.runInNewContext("("+value.slice(3,-2)+")",context(input)):value;
  const next=[{name:'Studio Publishing Request',input:[{json:{body,headers:{authorization:'Bearer '+token}}}]}];let error;
  try{while(next.length){const {name,input}=next.shift(),n=this.graph.nodes.find(n=>n.name===name);if(!n)throw Error('MISSING_NODE '+name);let out=input,port=0;
   if(n.type==='n8n-nodes-base.code')out=await vm.runInNewContext('(async function(){'+n.parameters.jsCode+'})()',context(input),{timeout:1500});
   else if(n.type==='n8n-nodes-base.crypto'){const text=evaluate(n.parameters.value,input);out=input.map(i=>({json:{...i.json,[n.parameters.dataPropertyName]:createHash('sha256').update(String(text)).digest('hex')}}));}
   else if(n.type==='n8n-nodes-base.if'){port=evaluate(n.parameters.conditions.conditions[0].leftValue,input)===true?0:1;}
   else if(n.type==='n8n-nodes-base.dataTable'){
    const table=n.parameters.dataTableId.value,rows=this.tables[table]||=[];
    const matches=row=>(n.parameters.filters?.conditions||[]).every(c=>{if(c.condition!=='eq')throw Error('UNSUPPORTED_FILTER');return row[c.keyName]===evaluate(c.keyValue,input);});
    if(n.parameters.operation==='get')out=rows.filter(matches).map(json=>({json:structuredClone(json)}));
    else {this.beforeUpdate?.(n,this.tables);const changed=[];for(const item of input){const current=[item],values=Object.fromEntries(Object.entries(n.parameters.columns.value).map(([k,v])=>[k,evaluate(v,current)]));
     if(n.parameters.operation==='insert'){const row={...values,id:Math.max(0,...rows.map(r=>r.id||0))+1,updatedAt:new Date().toISOString()};rows.push(row);changed.push(row);}
     else if(n.parameters.operation==='update')for(const row of rows.filter(matches)){Object.assign(row,values,{updatedAt:new Date().toISOString()});changed.push(row);}
     else throw Error('UNSUPPORTED_TABLE_WRITE');}
     this.writes.push({node:name,table,rows:changed.length});out=changed.map(json=>({json:structuredClone(json)}));
    }
    if(!out.length&&n.alwaysOutputData)out=[{json:{}}];
   }else if(n.type==='n8n-nodes-base.respondToWebhook'){responses.push({status:n.parameters.options.responseCode,body:evaluate(n.parameters.responseBody,input)});}
   else if(n.type==='@n8n/n8n-nodes-langchain.mcpClient'){
    if(n.parameters.tool.value!=='get_channel')throw Error('PROVIDER_WRITE_DENIED');this.calls.push('get_channel');out=[{json:{channel:{id:input[0].json.channelId,isDisconnected:false,isLocked:false}}}];
   }else if(n.type!=='n8n-nodes-base.webhook')throw Error('REPLAY_UNSUPPORTED_NODE '+n.type);
   outputs.set(name,JSON.parse(JSON.stringify(out)));for(const e of this.graph.connections[name]?.main?.[port]||[])next.push({name:e.node,input:out});
  }}catch(e){error=e;}
  const runData=Object.fromEntries([...outputs].map(([name,items])=>[name,[{data:{main:[items]}}]])),execution={id,status:error?'error':'success',workflowId:this.graph.id,startedAt:new Date().toISOString(),data:{resultData:{runData}}};this.executions.set(id,execution);
  this.lastError=error;if(error)throw Object.assign(error,{executionId:id,acknowledged:responses.some(r=>r.status===202)});
  return {id,responses,result:outputs.get('Store Studio Operation Result')?.[0]?.json,execution};
 }
 async fetch(url,options){if(!url.endsWith('/webhook/mildincident-studio-private-preparation'))throw Error('UNEXPECTED_ENDPOINT');const r=await this.run(JSON.parse(options.body),options.headers.Authorization.slice(7)),response=r.responses[0];return Response.json(response.body,{status:response.status});}
 async readExecution(url){const id=url.match(/executions\/(\d+)/)?.[1];if(id)return this.executions.get(id);return{data:[...this.executions.values()],nextCursor:null};}
}
