import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {inspect} from '../watchdog.mjs';
test('watchdog detects stale, healthy and missing independent heartbeats',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE state(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)');
 const env={DB:{prepare:(sql)=>({bind(...params){return{run:async()=>db.prepare(sql).run(...params)}},first:async()=>db.prepare(sql).get()})}};
 const before=globalThis.fetch;globalThis.fetch=async(url)=>new Response('ok',{status:String(url).includes('yorphiveshq-native-preview')?302:200});
 try{const a=await inspect(env,Date.now());assert.equal(a.state,'unknown');assert.equal(a.accessGuard,'protected');
 db.prepare('INSERT INTO state(key,value,updated_at) VALUES(?,?,?)').run('last_cron','{}',new Date(Date.now()-60*60000).toISOString());
 const b=await inspect(env,Date.now());assert.equal(b.state,'stale');
 db.prepare('UPDATE state SET updated_at=? WHERE key=?').run(new Date().toISOString(),'last_cron');
 const c=await inspect(env,Date.now());assert.equal(c.state,'online');
 globalThis.fetch=async(url)=>new Response('ok',{status:200});
 const exposed=await inspect(env,Date.now());assert.equal(exposed.accessGuard,'exposed');
 }finally{globalThis.fetch=before;}
});