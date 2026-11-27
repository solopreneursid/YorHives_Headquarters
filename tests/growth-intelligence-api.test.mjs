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
  const DB={prepare(sql){queries.push(sql);return {bind(){return this;},async all(){
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
  assert.equal(data.dossiers.length,4);
  const card=data.dossiers.find(d=>d.project.id==='taxpulse').opportunities[0];
  assert.equal(card.title,tax.title);
  assert.equal(card.communicationDraft.sent,false);
  assert.equal(card.communicationDraft.recipient,null);
  assert.equal(card.verifiedRevenue,null);
  assert.equal(data.dossiers.find(d=>d.project.id==='yorphives').analytics.available,false);
  assert.equal(queries.length,5);
  assert.ok(queries.every(q=>q.startsWith('SELECT ')));
  assert.deepEqual(requests,[{url:'https://yorphives.com/api/insights/growth',method:'GET'}]);
 }finally{globalThis.fetch=oldFetch}
});
test('missing database is an explicit unavailable state',async()=>{
 const r=await worker.fetch(new Request(url),env,ctx);
 assert.equal(r.status,503);
 assert.equal((await r.json()).available,false);
});

test('founder journal denies unauthenticated and cross-origin writes and requires approved migration',async()=>{
 const target=url+'/review';
 const request=(headers={},body={opportunityId:'growth-abc',revision:0,decision:'approved-for-founder',note:'Review public evidence'})=>new Request(target,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 let calls=0;
 const DB={prepare(sql){calls++;return {async all(){return {results:[]}}};}};
 const enabled={...env,DB,HQ_DECISIONS_ENABLED:'true'};
 const permitted={'origin':'https://hq.example.test','x-hq-founder-action':'growth-review-v1'};
 assert.equal((await worker.fetch(request(permitted),enabled,{})).status,403);
 assert.equal((await worker.fetch(request(permitted),{...env,DB},ctx)).status,503);
 assert.equal((await worker.fetch(request({...permitted,origin:'https://attacker.example.test'}),enabled,ctx)).status,403);
 assert.equal((await worker.fetch(request({...permitted,'sec-fetch-site':'cross-site'}),enabled,ctx)).status,403);
 assert.equal((await worker.fetch(request(permitted,{opportunityId:'growth-abc',revision:0,decision:'approved-for-founder',note:'Review',actor:'founder'}),enabled,ctx)).status,400);
 assert.equal(calls,0);
});
test('review transitions are explicit and deny unauthorized action fields',async()=>{
 const {validateGrowthReview,allowedReviewTransitions}=await import('../src/growth-intelligence-review.mjs');
 const item={opportunityId:'growth-abc',revision:0,decision:'approved-for-founder',note:'Verify evidence person@example.org'};
 assert.ok(validateGrowthReview(item).note.includes('[redacted-contact]'));
 assert.equal(validateGrowthReview({...item,recipient:'person@example.org'}),null);
 assert.equal(validateGrowthReview({...item,revision:-1}),null);
 assert.equal(validateGrowthReview({...item,note:' '}),null);
 assert.ok(!allowedReviewTransitions('unreviewed').includes('founder-executed'));
 assert.ok(allowedReviewTransitions('approved-for-founder').includes('founder-executed'));
 assert.deepEqual(allowedReviewTransitions('founder-executed'),[]);
});
