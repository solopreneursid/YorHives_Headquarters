import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/hq-worker.mjs';

const url='https://hq.example.test/api/growth-intelligence';
const env={ACCESS_OWNER_EMAIL:'founder@example.test',ACCESS_AUD:'synthetic-audience'};
const ctx={access:{aud:env.ACCESS_AUD,async getIdentity(){return {email:env.ACCESS_OWNER_EMAIL}}}};
test('growth API refuses anonymous, incorrect owner and write methods before data access',async()=>{
 let calls=0;
 const protectedEnv={...env,DB:{prepare(){calls++;throw Error('unexpected access')}}};
 assert.equal((await worker.fetch(new Request(url),protectedEnv,{})).status,403);
 assert.equal((await worker.fetch(new Request(url),protectedEnv,{access:{aud:env.ACCESS_AUD,
  async getIdentity(){return {email:'different@example.test'}}}})).status,403);
 for(const method of ['POST','PUT','PATCH','DELETE'])
  assert.equal((await worker.fetch(new Request(url,{method}),protectedEnv,ctx)).status,405);
 assert.equal((await worker.fetch(new Request(url+'?url=https://example.test'),protectedEnv,ctx)).status,400);
 assert.equal(calls,0);
});
test('founder receives evidence-only dossiers through actual route with read-only mocked D1',async()=>{
 const oldFetch=globalThis.fetch,queries=[],requests=[];
 const now=new Date().toISOString();
 const tax={title:'Tax filing calculation discussion',description:'Public tax filing and income tax deduction discussion',
  source_url:'https://news.ycombinator.com/item?id=123',kind:'revenue-research',score:60,observed_at:now};
 globalThis.fetch=async (url,opts)=>{
  requests.push({url,method:opts.method});
  return new Response('not connected',{status:503});
 };
 try{
  const DB={prepare(sql){queries.push(sql);return {async all(){
   if(sql.includes("kind IN ('revenue-research'"))return {results:[tax]};
   if(sql.includes("FROM status"))return {results:[{key:'revenue_research_hn_pricing',value:'ok:1',checked_at:now}]};
   return {results:[]};
  }}}};
  const response=await worker.fetch(new Request(url),{...env,DB},ctx);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const data=await response.json();
  assert.equal(data.readOnly,true);
  assert.equal(data.autoOutreach,false);
  assert.equal(data.persistence,'not-connected');
  assert.equal(data.dossiers.length,3);
  const card=data.dossiers.find(d=>d.project.id==='taxpulse').opportunities[0];
  assert.equal(card.title,tax.title);
  assert.equal(card.communicationDraft.sent,false);
  assert.equal(card.communicationDraft.recipient,null);
  assert.equal(card.verifiedRevenue,null);
  assert.equal(data.dossiers.find(d=>d.project.id==='yorphives').analytics.available,false);
  assert.equal(queries.length,3);
  assert.ok(queries.every(q=>q.startsWith('SELECT ')));
  assert.deepEqual(requests,[{url:'https://yorphives.com/api/insights/growth',method:'GET'}]);
 }finally{globalThis.fetch=oldFetch}
});
test('missing database is an explicit unavailable state',async()=>{
 const r=await worker.fetch(new Request(url),env,ctx);
 assert.equal(r.status,503);
 assert.equal((await r.json()).available,false);
});
