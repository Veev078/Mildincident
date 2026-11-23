// Offline proposal builder only. Never installs, activates or executes n8n.
import fs from 'node:fs/promises';
import {buildPrivatePreparationEntry} from '../src/n8n/private-preparation-entry.js';
const [productionFile,coordinatorFile,guardedFile,productionSha,coordinatorSha,guardedSha,output,...extra]=process.argv.slice(2);
if(!output||extra.length)throw Error('Use: node scripts/prepare-private-entry.mjs production.json coordinator.json guarded.json production-sha coordinator-sha guarded-sha private-output.json');
const read=async file=>{const value=JSON.parse(await fs.readFile(file,'utf8'));return value.update||value;};
const proposal=buildPrivatePreparationEntry({production:await read(productionFile),coordinator:await read(coordinatorFile),guarded:await read(guardedFile),expected:{production:productionSha,coordinator:coordinatorSha,guarded:guardedSha}});
await fs.writeFile(output,JSON.stringify(proposal),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PREPARED_ONLY',graphSha256:proposal.review.graphSha256,nodes:proposal.review.nodeCount,workflowDependencies:proposal.review.workflowDependencies,installed:false,paidCalls:0,bufferWrites:0}));
