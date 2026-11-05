import fs from 'node:fs/promises';import path from 'node:path';import {cacheRecordedImage} from '../src/photography/cache-recorded.js';import {LocalPreviewStore} from '../src/workspace/previews.js';
const [executionFile,jobId,assetId,dataRoot,...extra]=process.argv.slice(2);
if(!executionFile||!jobId||!assetId||!dataRoot||extra.length)throw new Error('Use: npm run media:cache-recorded -- private-execution.json job-id asset-id private-data-root');
const execution=JSON.parse(await fs.readFile(executionFile,'utf8')),data=execution.data?.resultData?.runData||{},first=name=>data[name]?.[0]?.data?.main?.[0]?.[0]?.json;
if(execution.workflowId!=='6CkqfYc4Pyd4k8vi'||first('Validate Development Dispatch')?.job_id!==jobId)throw new Error('Captured development execution does not match the requested scope.');
const row=first('Finalize Development Candidate');if(!row?.candidate_json||row.job_id!==jobId)throw new Error('Captured finalized candidate is unavailable.');
const root=path.resolve(dataRoot);await fs.mkdir(root,{recursive:true,mode:0o700});let store,report;
try{const policy=JSON.parse(await fs.readFile('/etc/codex/network-policy.json','utf8'));store=new LocalPreviewStore(path.join(root,'previews'));report=await cacheRecordedImage({rows:[row],scope:{job_id:jobId,asset_id:assetId},sourceExecutionId:String(execution.id),policy,store});}
catch(error){report={status:'unavailable',jobId,assetId,sourceExecutionId:String(execution.id),error:error.code||'SOURCE_ACQUISITION_FAILED',message:error.message,rightsGranted:false};process.exitCode=2;}finally{store?.close();}
await fs.writeFile(path.join(root,'last-source-acquisition.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
