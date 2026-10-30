/** Periodic fixed-resource reads only. Never queues, starts, activates or retries a provider execution. */
export class ResearchDelivery {
 constructor(engine,{intervalMs=120000,now=()=>Date.now()}={}){
  if(!engine?.client?.readOnly)throw new Error('READ_ONLY_DELIVERY_REQUIRED');
  if(!Number.isInteger(intervalMs)||intervalMs<30000||intervalMs>900000)throw new Error('INVALID_DELIVERY_INTERVAL');
  this.engine=engine;this.intervalMs=intervalMs;this.now=now;this.inflight=null;this.stopped=true;this.timer=null;
 }
 status(){return this.engine.research.deliveryState();}
 tick(){
  if(this.inflight)return this.inflight;
  this.inflight=(async()=>{const before=this.status()||{},at=new Date(this.now()).toISOString();
   try{await this.engine.refresh();const observed=this.engine.status();return this.engine.research.saveDeliveryState({mode:'read_only',state:'connected',lastAttempt:at,lastSuccess:at,failures:0,unlinkedNativeJobs:observed.unlinkedNativeJobs||0,importedThisRead:observed.observedImports||0,nextAttempt:new Date(this.now()+this.intervalMs).toISOString(),errorCode:null});}
   catch(error){const failures=(before.failures||0)+1,delay=Math.min(900000,this.intervalMs*2**Math.min(failures,4));const code=/^[A-Z][A-Z0-9_]{0,80}$/.test(error.code||'')?error.code:'RESEARCH_READ_UNAVAILABLE';return this.engine.research.saveDeliveryState({...before,mode:'read_only',state:'unavailable',lastAttempt:at,failures,nextAttempt:new Date(this.now()+delay).toISOString(),errorCode:code});}
  })().finally(()=>{this.inflight=null;});return this.inflight;
 }
 start(){if(!this.stopped)return;this.stopped=false;const run=async()=>{try{await this.tick();}catch{this.stopped=true;return;}if(this.stopped)return;const delay=Math.max(1000,Date.parse(this.status().nextAttempt)-this.now());this.timer=setTimeout(run,delay);this.timer.unref?.();};const previous=this.status();if(previous?.state==='unavailable'&&Date.parse(previous.nextAttempt)>this.now()){this.timer=setTimeout(run,Date.parse(previous.nextAttempt)-this.now());this.timer.unref?.();}else run();}
 async stop(){this.stopped=true;clearTimeout(this.timer);if(this.inflight)await this.inflight;}
}
