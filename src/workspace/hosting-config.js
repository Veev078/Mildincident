import path from 'node:path';import {requireThat} from '../errors.js';
export function workspacePaths(env=process.env){const dataRoot=path.resolve(env.STUDIO_DATA_DIR||'.local');return {dataRoot,workspace:path.join(dataRoot,'workspace'),backups:path.join(dataRoot,'backups')};}
export function hostingConfig(env=process.env){
 const hosted=env.STUDIO_MODE==='hosted';requireThat(!env.STUDIO_MODE||['local','hosted'].includes(env.STUDIO_MODE),'INVALID_STUDIO_CONFIG','Use local or hosted mode.');
 const port=Number(env.PORT||4174);requireThat(Number.isInteger(port)&&port>0&&port<=65535,'INVALID_PORT','PORT must be from1 to65535.');
 let origin=null;if(hosted){try{const url=new URL(env.STUDIO_PUBLIC_ORIGIN);requireThat(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'INVALID_STUDIO_CONFIG','Set one HTTPS Studio origin.');origin=url.origin;}catch{throw Object.assign(new Error('Set STUDIO_PUBLIC_ORIGIN to the exact HTTPS application origin.'),{code:'INVALID_STUDIO_CONFIG'});}
 requireThat(path.isAbsolute(env.STUDIO_DATA_DIR||'')&&env.STUDIO_PASSWORD_HASH,'INVALID_STUDIO_CONFIG','Hosted mode requires an absolute persistent data directory and password hash.');}
 const {dataRoot,workspace,backups}=workspacePaths(env);
 const intervalMs=Number(env.STUDIO_SYNC_INTERVAL_MS||120000);requireThat(Number.isInteger(intervalMs)&&intervalMs>=30000&&intervalMs<=900000,'INVALID_STUDIO_CONFIG','Use a research sync interval from30 to900 seconds.');
 return {hosted,port,host:hosted?'0.0.0.0':'127.0.0.1',origin,dataRoot,workspace,backups,passwordHash:env.STUDIO_PASSWORD_HASH||null,intervalMs};
}
