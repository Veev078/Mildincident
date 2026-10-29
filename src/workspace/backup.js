import fs from 'node:fs/promises';import path from 'node:path';import {DatabaseSync,backup} from 'node:sqlite';import {createHash,randomUUID} from 'node:crypto';import {requireThat} from '../errors.js';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function files(root,relative=''){
 const out=[];for(const entry of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const name=path.join(relative,entry.name);requireThat(!entry.isSymbolicLink(),'UNSAFE_BACKUP_PATH','Backups do not follow symbolic links.');if(entry.isDirectory())out.push(...await files(root,name));else {requireThat(entry.isFile(),'UNSAFE_BACKUP_PATH','Backups require regular files.');out.push(name);}}return out;
}
export async function verifyWorkspaceBackup(root){
 const manifest=JSON.parse(await fs.readFile(path.join(root,'backup-manifest.json'),'utf8'));
 requireThat(manifest.schemaVersion===1&&Array.isArray(manifest.files),'INVALID_BACKUP','Unknown private backup manifest.');
 const actual=(await files(root)).filter(name=>name!=='backup-manifest.json').sort();requireThat(JSON.stringify(actual)===JSON.stringify(manifest.files.map(f=>f.path).sort()),'INVALID_BACKUP','Backup file inventory changed.');
 for(const file of manifest.files){requireThat(!path.isAbsolute(file.path)&&!file.path.split(/[\\/]/).includes('..'),'INVALID_BACKUP','Invalid backup path.');const bytes=await fs.readFile(path.join(root,file.path));requireThat(bytes.length===file.bytes&&digest(bytes)===file.sha256,'INVALID_BACKUP','Backup checksum changed.');}
 return {verified:true,files:actual.length};
}
/** Private local backup only. Each SQLite snapshot is consistent; stores are not one global transaction. */
export async function backupWorkspace({source='.local/workspace',destinationRoot='.local/backups'}={}){
 const inventory=await files(source);const destination=path.join(destinationRoot,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));await fs.mkdir(destination,{recursive:true,mode:0o700});
 try{
  for(const name of inventory.filter(name=>name.endsWith('.sqlite'))){const target=path.join(destination,name);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});const db=new DatabaseSync(path.join(source,name),{readOnly:true});try{await backup(db,target);}finally{db.close();}await fs.chmod(target,0o600);}
  // Copy immutable media after database snapshots so their referenced blobs are present.
  for(const name of (await files(source)).filter(name=>!/(?:\.sqlite|\.sqlite-wal|\.sqlite-shm)$/.test(name))){const target=path.join(destination,name);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.copyFile(path.join(source,name),target);await fs.chmod(target,0o600);}
  const entries=[];for(const name of (await files(destination)).sort()){const bytes=await fs.readFile(path.join(destination,name));entries.push({path:name,bytes:bytes.length,sha256:digest(bytes)});}
  const manifest={schemaVersion:1,createdAt:new Date().toISOString(),scope:'private_workspace_only',globalTransaction:false,engineConnectionIncluded:false,files:entries};await fs.writeFile(path.join(destination,'backup-manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});await verifyWorkspaceBackup(destination);return {destination,files:entries.length,verified:true};
 }catch(error){throw error;} // Preserve an interrupted backup for inspection; never discard source data.
}
