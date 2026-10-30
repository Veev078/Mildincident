import {passwordHash} from '../src/workspace/private-access.js';import readline from 'node:readline';import {Writable} from 'node:stream';
// Run locally by the owner. Password never enters arguments, environment files or shell history.
if(!process.stdin.isTTY)throw new Error('Run this command in your private terminal. It prompts without echo.');
let muted=false;const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk,encoding);done();}}),rl=readline.createInterface({input:process.stdin,output,terminal:true});
const ask=prompt=>new Promise(resolve=>{muted=false;rl.question(prompt,value=>{muted=false;process.stdout.write('\n');resolve(value);});muted=true;});
try{const one=await ask('Choose a unique Studio password (16+ characters): '),two=await ask('Repeat password: ');if(one!==two)throw new Error('Passwords differ.');console.log('Set STUDIO_PASSWORD_HASH in the hosting provider’s secret settings to this verifier:');console.log(await passwordHash(one));}finally{rl.close();}
