import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRuntime,openDatabase} from './runtime.mjs';

test('SQLite migrations are repeatable and preserve founder history',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-state-'));
 try{let db=openDatabase(dir);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM schema_migrations').get().n,5);db.sqlite.close();db=openDatabase(dir);assert.equal(db.sqlite.prepare('SELECT count(*) n FROM schema_migrations').get().n,5);db.sqlite.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('weak credentials and state inside source are rejected',()=>{
 assert.throws(()=>createRuntime({stateDir:'/tmp/unused-hq',password:'short'}));
 assert.throws(()=>openDatabase(process.cwd()));
});
test('self-hosted login, same-origin protection, reports and real logout',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-auth-'));
 const runtime=createRuntime({stateDir:dir,password:'fixture-only-long-private-password',port:0});
 try{
  const address=await runtime.listen(),base='http://127.0.0.1:'+address.port;
  let result=await fetch(base+'/api/report',{redirect:'manual'});assert.equal(result.status,303);
  result=await fetch(base+'/login',{method:'POST',headers:{origin:'https://wrong.example','content-type':'application/x-www-form-urlencoded'},body:'password=fixture-only-long-private-password',redirect:'manual'});assert.equal(result.status,403);
  result=await fetch(base+'/login',{method:'POST',headers:{origin:base,'content-type':'application/x-www-form-urlencoded'},body:'password=fixture-only-long-private-password',redirect:'manual'});assert.equal(result.status,303);
  const cookie=result.headers.get('set-cookie').split(';')[0];assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  result=await fetch(base+'/api/report',{headers:{cookie},redirect:'manual'});assert.equal(result.status,200);assert.equal(result.headers.get('x-yorphives-hq-evidence'),'readonly-selfhost');
  const report=await result.json();assert.equal(report.decisionJournal.available,true);assert.equal(report.pipeline.readOnly,true);
  result=await fetch(base+'/README.md',{headers:{cookie}});assert.equal(result.status,404);
  result=await fetch(base+'/api/decisions',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'});assert.equal(result.status,403);
  result=await fetch(base+'/cdn-cgi/access/logout',{headers:{cookie},redirect:'manual'});assert.match(result.headers.get('set-cookie'),/Max-Age=0/);
  result=await fetch(base+'/api/report',{headers:{cookie},redirect:'manual'});assert.equal(result.status,303);
 }finally{await runtime.close();rmSync(dir,{recursive:true,force:true});}
});
