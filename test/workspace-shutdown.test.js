import http from 'node:http';import test from 'node:test';import assert from 'node:assert/strict';
import {closeStudioServer} from '../src/workspace/shutdown.js';
test('shutdown drains a completing response before closing the Studio listener',async()=>{
 let began;const started=new Promise(resolve=>{began=resolve;});
 const server=http.createServer((req,res)=>{res.writeHead(200);res.flushHeaders();began();setTimeout(()=>res.end('saved response'),20);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const body=new Promise((resolve,reject)=>{http.get(`http://127.0.0.1:${server.address().port}`,res=>{let text='';res.on('data',chunk=>{text+=chunk;});res.on('end',()=>resolve(text));res.on('error',reject);}).on('error',reject);});
 await started;await closeStudioServer(server,{graceMs:1000});assert.equal(await body,'saved response');assert.equal(server.listening,false);
});
test('an unfinished connection cannot hold a Studio restart open indefinitely',async()=>{
 let began;const started=new Promise(resolve=>{began=resolve;});
 const server=http.createServer((req,res)=>{res.writeHead(200);res.flushHeaders();began();});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const ended=new Promise(resolve=>{const req=http.get(`http://127.0.0.1:${server.address().port}`,res=>{res.on('aborted',()=>resolve('aborted'));res.on('error',()=>{});res.resume();});req.on('error',()=>resolve('closed'));});
 await started;await closeStudioServer(server,{graceMs:20});assert.ok(['aborted','closed'].includes(await ended));assert.equal(server.listening,false);
});
