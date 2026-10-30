import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),[major,minor]=process.versions.node.split('.').map(Number);
if(major!==24||minor<17)throw new Error('MILDINCIDENT needs Node 24.17 or newer within Node 24. Install Node 24 LTS, then retry.');
const studioPort=Number(process.env.PORT||4174);if(!Number.isInteger(studioPort)||studioPort<1||studioPort>65535)throw new Error('PORT must be between 1 and 65535.');
const browserUrl='http://localhost:'+studioPort+'/',healthUrl='http://127.0.0.1:'+studioPort+'/api/health';
async function health(){try{const r=await fetch(healthUrl,{signal:AbortSignal.timeout(600)});return r.ok?await r.json():null;}catch{return null;}}
function openBrowser(){if(process.argv.includes('--no-open'))return;let command,args;if(process.platform==='win32'){command='rundll32.exe';args=['url.dll,FileProtocolHandler',browserUrl];}else if(process.platform==='darwin'){command='open';args=[browserUrl];}else if(process.env.DISPLAY||process.env.WAYLAND_DISPLAY){command='xdg-open';args=[browserUrl];}else{console.log('No desktop browser in this process. Open the URL on this same computer. A cloud localhost URL is not a public preview.');return;}const p=spawn(command,args,{stdio:'ignore',detached:true});p.on('error',()=>console.log('Open the URL in your browser on this computer.'));p.unref();}
const previous=await health();
if(previous?.mode==='local_editorial_workspace'&&previous.productionMutationsEnabled===false){console.log('Existing private Studio: '+browserUrl);openBrowser();}
else{
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));const command=pkg.scripts['workspace:local'];if(!command.startsWith('node ')||/[;&|`$]/.test(command))throw new Error('The verified workspace:local startup command changed. Review package.json.');
 try{await fs.access(path.join(root,'node_modules','sharp'));await fs.access(path.join(root,'node_modules','rss-parser'));}catch{throw new Error('Dependencies are missing. Run npm ci in the project folder, then npm run studio:open.');}
 const child=spawn(process.execPath,command.split(' ').slice(1),{cwd:root,env:process.env,stdio:'inherit'});let exited=false;child.on('error',()=>{exited=true;process.exitCode=1;console.error('Studio could not start. Check Node and the project folder.');});child.on('exit',code=>{exited=true;process.exitCode=code||0;});process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
 let ready=false;for(let attempt=0;attempt<40&&!exited;attempt++){const state=await health();if(state?.mode==='local_editorial_workspace'&&state.productionMutationsEnabled===false){ready=true;console.log('Private Studio ready: '+browserUrl+' (on this computer)');openBrowser();break;}await new Promise(r=>setTimeout(r,250));}
 if(!ready&&!exited)console.error('Startup is still pending. Check the server output above; this launcher has not opened another service.');
}
