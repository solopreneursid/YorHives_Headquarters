import assert from 'node:assert/strict';
import {inbox,notify} from '../src/hqconnect-inbox-worker.mjs';
import hq from '../src/hq-worker.mjs';
import {planInboxBinding} from './hq-binding-policy.mjs';

const sample={sequence:12,created_at:'2026-11-22T00:00:00.000Z',request_type:'Other',name:'Synthetic test',email:'synthetic@example.test',project:'Test',message:'A synthetic message that is never sent.',timeline:'',budget:'',status:'new'};
function fakeDb({records=[sample],last=0}={}){
 const state={records,last,lastCreated:'',updates:[],failRead:false};
 return {state,prepare(sql){
  let params=[];
  const stmt={bind(...values){params=values;return stmt},async all(){
   if(state.failRead)throw Error('offline');
   assert.match(sql,/^SELECT rowid AS sequence,created_at/);
   return {results:state.records.filter(x=>x.sequence<params[0]).sort((a,b)=>b.sequence-a.sequence).slice(0,26)};
  },async first(){
   if(state.failRead)throw Error('offline');
   if(sql.startsWith('SELECT last_attempt_at'))return null;
   if(sql.startsWith('SELECT last_rowid'))return {last_rowid:state.last,last_created_at:state.lastCreated};
   if(sql.startsWith('SELECT MAX(rowid)'))return {sequence:Math.max(0,...state.records.map(x=>x.sequence)),created_at:state.records.map(x=>x.created_at).sort().at(-1)||null};
   throw Error('Unexpected query');
  },async run(){state.updates.push({sql,params});if(sql.includes('last_accepted_at')){state.last=params[0];state.lastCreated=params[1]}return {success:true}}};
  return stmt;
 }};
}
const db=fakeDb(),get=path=>new Request('https://inbox.internal'+path);
let res=await inbox(get('/inbox'),{HQCONNECT_DB:db});
assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store, private');
const data=await res.json();assert.equal(data.records[0].email,sample.email);assert.ok(!('sequence' in data.records[0]));
assert.equal((await inbox(new Request('https://inbox.internal/inbox',{method:'POST'}),{HQCONNECT_DB:db})).status,405);
assert.equal((await inbox(get('/inbox?before=12%20OR%201=1'),{HQCONNECT_DB:db})).status,400);
assert.equal((await inbox(get('/inbox?extra=1'),{HQCONNECT_DB:db})).status,400);
assert.equal((await inbox(get('/inbox'),{})).status,503);
const many=fakeDb({records:Array.from({length:30},(_,i)=>({...sample,sequence:i+1}))});
res=await inbox(get('/inbox'),{HQCONNECT_DB:many});const first=await res.json();
assert.equal(first.records.length,25);assert.equal(first.next,'6');
res=await inbox(get('/inbox?before='+first.next),{HQCONNECT_DB:many});assert.equal((await res.json()).records.length,5);

let sent=[];
const env={HQCONNECT_DB:db,NOTIFY_TO:'owner@example.test',NOTIFY_FROM:'alerts@example.test',NOTIFY_EMAIL:{send:async mail=>sent.push(mail)}};
assert.deepEqual(await notify(env),{newEnquiries:true,accepted:true});assert.equal(db.state.last,12);
assert.equal(sent.length,1);assert.ok(!JSON.stringify(sent).includes(sample.email));assert.ok(!JSON.stringify(sent).includes(sample.message));
assert.deepEqual(await notify(env),{newEnquiries:false});assert.equal(sent.length,1);
db.state.records=[{...sample,sequence:1,created_at:'2026-11-23T00:00:00.000Z'}];
assert.deepEqual(await notify(env),{newEnquiries:true,accepted:true},'A new enquiry remains detectable after old rows are removed');
const failed=fakeDb();
await assert.rejects(notify({...env,HQCONNECT_DB:failed,NOTIFY_EMAIL:{send:async()=>{throw Error('offline')}}}));
assert.equal(failed.state.last,0);assert.equal(failed.state.updates.length,1);
assert.ok(failed.state.updates[0].sql.includes('last_error_at'));

let calls=0;
const hqenv={ACCESS_OWNER_EMAIL:'owner@example.test',ACCESS_AUD:'synthetic-audience-123',ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',HQCONNECT_INBOX:{fetch:async req=>{calls++;return inbox(req,{HQCONNECT_DB:fakeDb()})}}};
const req=()=>new Request('https://hq.example.test/api/hqconnect-inbox');
assert.equal((await hq.fetch(req(),hqenv,{})).status,403);assert.equal(calls,0);
const ctx={access:{aud:hqenv.ACCESS_AUD,getIdentity:async()=>({email:'owner@example.test'})}};
res=await hq.fetch(req(),hqenv,ctx);assert.equal(res.status,200);assert.equal(calls,1);assert.equal(res.headers.get('cache-control'),'no-store');
assert.equal((await hq.fetch(new Request(req(),{method:'POST'}),hqenv,ctx)).status,405);assert.equal(calls,1);
assert.equal((await hq.fetch(new Request('https://hq.example.test/api/hqconnect-inbox?before=oops'),hqenv,ctx)).status,400);
const oldBindings=[{name:'DB',type:'d1'},{name:'AI',type:'ai'}];
const expected=[...oldBindings,{name:'HQCONNECT_INBOX',type:'service'}];
const addition=planInboxBinding(oldBindings,expected,true);
assert.deepEqual(addition,[{name:'HQCONNECT_INBOX',type:'service',service:'yorphives-hqconnect-inbox'}]);
assert.throws(()=>planInboxBinding(oldBindings,expected,false),/founder-manual/);
assert.throws(()=>planInboxBinding([...oldBindings,{...addition[0],service:'other-worker'}],expected,true));
assert.throws(()=>planInboxBinding([...oldBindings,{name:'UNEXPECTED',type:'d1'}],expected,true));
assert.deepEqual(planInboxBinding([...oldBindings,...addition],expected,false),[]);
console.log('PASS synthetic private inbox: founder guard, pagination, read-only access, no-store, alert retry and no customer details in email.');
