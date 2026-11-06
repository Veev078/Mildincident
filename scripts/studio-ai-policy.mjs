import {maintainAiPolicy} from '../src/workspace/ai-policy-maintenance.js';
const [command,...args]=process.argv.slice(2),options={command};
try{
 for(let i=0;i<args.length;i++){
  const key=args[i];if(key==='--confirm-reviewed-policy')options.confirm=true;else if(key==='--clear-stop')options.clearStop=true;
  else if(['--graph-sha','--worker-version','--dispatch-secret-file','--operations'].includes(key)){
   const value=args[++i];if(!value||value.startsWith('--'))throw Error();const names={'--graph-sha':'graphSha256','--worker-version':'workerVersion','--dispatch-secret-file':'secretFile','--operations':'operations'};options[names[key]]=key==='--operations'?value.split(','):value;
  }else throw Error();
 }
 console.log(JSON.stringify(await maintainAiPolicy(options),null,2));
}catch(error){console.error(/^[A-Z_]+$/.test(error.code||'')?error.code+': '+error.message:'Policy maintenance stopped. No model operation was requested.');process.exitCode=1;}
