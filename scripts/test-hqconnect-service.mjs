#!/usr/bin/env node
// Local-only inbox contract tests: never connects to Cloudflare or deletes real messages.
import assert from 'node:assert/strict';
import worker from '../src/hqconnect-inbox-service.mjs';

const id='11111111-1111-4111-8111-111111111111';
let rows=[{id,sequence:1,created_at:'2026-11-22T05:00:00Z',request_type:'Other',name:'Synthetic only',email:'demo@example.test',project:'Demo',message:'Hi',timeline:'',budget:'',status:'new'}];
const env={HQCONNECT_DB:{prepare(sql){
 let bind=[];
 return {
  bind(...values){bind=values;return this},
  async all(){
   if(!sql.includes('FROM hqconnect_requests'))throw Error('Unknown read: '+sql);
   return {results:rows.filter(x=>x.sequence<bind[0]).slice().reverse()};
  },
  async first(){
   if(sql.includes('hqconnect_notification_checkpoint'))return {last_attempt_at:null,last_accepted_at:null,last_error_at:null};
   if(sql.includes('hqconnect_notification_health'))return {last_checked_at:'2026-11-22T05:00:00Z',last_result:'ok'};
   throw Error('Unknown first: '+sql);
  },
  async run(){
   if(sql!=='DELETE FROM hqconnect_requests WHERE id=?')throw Error('Unexpected mutation: '+sql);
   const before=rows.length;rows=rows.filter(x=>x.id!==bind[0]);
   return {meta:{changes:before-rows.length}};
  }
 };
}}};
const get=()=>worker.fetch(new Request('https://inbox.internal/inbox'),env);
let res=await get(),feed=await res.json();
assert.equal(res.status,200);
assert.equal(feed.available,true);
assert.equal(feed.canDelete,true);
assert.equal(feed.records.length,1);
assert.equal(feed.records[0].id,id);
assert.equal(feed.records[0].name,'Synthetic only');
assert.equal(feed.records[0].sequence,undefined,'Internal pagination sequence must remain private');

res=await worker.fetch(new Request('https://inbox.internal/inbox/invalid',{method:'DELETE'}),env);
assert.notEqual(res.status,200,'Malformed delete path must fail closed');
assert.equal(rows.length,1,'Invalid request must not mutate data');

res=await worker.fetch(new Request('https://inbox.internal/inbox/'+id,{method:'DELETE'}),env);
assert.equal(res.status,200);
assert.equal((await res.json()).deleted,true);
assert.equal(rows.length,0);
feed=await (await get()).json();
assert.equal(feed.records.length,0,'Deleted message must disappear from next fetch');

res=await worker.fetch(new Request('https://inbox.internal/inbox/'+id,{method:'DELETE'}),env);
assert.equal(res.status,404,'Repeat delete must not claim a second deletion');
console.log('PASS HQconnect private service: exact record GET + safe DELETE, mocked D1, zero production writes');
