import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
class DatabaseSync {
  constructor(){this.dir=mkdtempSync(join(tmpdir(),'hq-decisions-test-'));this.path=join(this.dir,'test.sqlite');process.once('exit',()=>rmSync(this.dir,{recursive:true,force:true}));}
  query(sql,args=[],mode='all'){
    const code=`import sqlite3,json,sys
p=json.load(sys.stdin)
c=sqlite3.connect(p['path'])
c.row_factory=sqlite3.Row
if p['mode']=='exec':
 c.executescript(p['sql']);out=None
else:
 cur=c.execute(p['sql'],p['args'])
 out={'changes':cur.rowcount} if p['mode']=='run' else [dict(r) for r in cur.fetchall()]
c.commit()
print(json.dumps(out))`;
    const result=spawnSync('python3',['-c',code],{input:JSON.stringify({path:this.path,sql,args,mode}),encoding:'utf8'});
    if(result.status!==0)throw Error(result.stderr);return JSON.parse(result.stdout);
  }
  exec(sql){return this.query(sql,[],'exec');}
  prepare(sql){return {get:(...args)=>this.query(sql,args)[0],all:(...args)=>this.query(sql,args),run:(...args)=>this.query(sql,args,'run')};}
}
import {readFileSync,readdirSync} from 'node:fs';
import worker,{decisionTransition,evidenceContract,operatingBrief,makeFounderBriefing} from '../src/worker.mjs';
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).sort())sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  for(let i=1;i<=5;i++)sqlite.prepare('INSERT INTO opportunities(id,title,description,recommendation,source_url,observed_at) VALUES(?,?,?,?,?,?)').run('o'+i,'Idea '+i,'Problem','Interview users','https://example.com/'+i,new Date().toISOString());
  const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:sqlite.prepare(sql).run(...args)};}};}};
  return {sqlite,env:{DB:db,HQ_DECISIONS_ENABLED:'true',ACCESS_OWNER_EMAIL:'founder@example.com',ACCESS_AUD:'long-audience-for-tests'},ctx:{access:{aud:'long-audience-for-tests',async getIdentity(){return {email:'founder@example.com'};}}}};
}
function request(data,headers={}){return new Request('https://hq.example.com/api/decisions',{method:'POST',headers:{origin:'https://hq.example.com','content-type':'application/json','x-hq-founder-action':'decision-v1',...headers},body:JSON.stringify({kind:'opportunity',id:'o1',revision:0,state:'accepted',note:'Validate first',experiment:{audience:'Creators',problem:'Slow workflow',hypothesis:'Users need a faster option',metric:'Interviews',target:3,effortHours:2,stopCondition:'Stop if no repeated need',reviewBy:new Date(Date.now()+86400000).toISOString()},...data})});}
test('only valid state transitions are allowed; implementation is separate from success',()=>{
  assert(decisionTransition('proposed','accepted'));assert(!decisionTransition('proposed','verified'));assert(!decisionTransition('accepted','verified'));
});
test('founder journal rejects anonymous, cross-origin, oversized, and arbitrary writes',async()=>{
  const {env,ctx}=fixture();
  assert.equal((await worker.fetch(request(),env,{})).status,403);
  assert.equal((await worker.fetch(request({}, {origin:'https://evil.example'}),env,ctx)).status,403);
  assert.equal((await worker.fetch(request({note:'x'.repeat(9000)}),env,ctx)).status,413);
  assert.equal((await worker.fetch(request({kind:'deploy'}),env,ctx)).status,400);
  assert.equal((await worker.fetch(new Request('https://hq.example.com/api/report',{method:'POST'}),env,ctx)).status,405);
  assert.equal((await worker.fetch(request(),{...env,HQ_DECISIONS_ENABLED:'false'},ctx)).status,503);
});
test('atomic decision history persists and rejects stale tabs without overwriting evidence',async()=>{
  const {env,ctx,sqlite}=fixture();
  let res=await worker.fetch(request(),env,ctx);assert.equal(res.status,201);assert.equal((await res.json()).executionTriggered,false);
  assert.equal((await worker.fetch(request(),env,ctx)).status,409);
  assert.equal((await worker.fetch(request({revision:1,state:'implemented',note:'Founder completed experiment'}),env,ctx)).status,201);
  assert.equal((await worker.fetch(request({revision:2,state:'verified'}),env,ctx)).status,400);
  assert.equal((await worker.fetch(request({revision:2,state:'verified',successCondition:'Three interviews',outcome:'Three completed',evidenceUrl:'https://example.com/results'}),env,ctx)).status,201);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM founder_decisions').get().n,3);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM opportunities').get().n,5);
});
test('concurrent fourth opportunity cannot bypass the three-work-item limit',async()=>{
  const {env,ctx}=fixture();
  const responses=await Promise.all([1,2,3,4].map(i=>worker.fetch(request({id:'o'+i}),env,ctx)));
  assert.equal(responses.filter(r=>r.status===201).length,3);assert.equal(responses.filter(r=>r.status===409).length,1);
});
test('rejected ideas stay quiet until content changes, not just polling time',()=>{
  const item={id:'o1',title:'Idea',description:'Problem',recommendation:'Interview',source_url:'https://example.com',observed_at:new Date().toISOString()};
  const event={thread:'opportunity:o1',kind:'opportunity',state:'rejected',snapshot:JSON.stringify([item.title,item.description,item.recommendation,item.source_url]),revision:1};
  assert.equal(operatingBrief([], [item],{events:[event]}).pending,0);
  item.observed_at='2000-01-01';assert.equal(operatingBrief([], [item],{events:[event]}).pending,0);
  item.description='New customer evidence';assert.equal(operatingBrief([], [item],{events:[event]}).pending,1);
});
test('freshness rejects future timestamps and revenue remains unknown',()=>{
  assert.equal(evidenceContract({observedAt:'2099-01-01',evidence:['https://example.com']},'finding').freshness,'unknown');
  assert.equal(evidenceContract({observedAt:'2000-01-01'},'finding').freshness,'stale');
  const b=makeFounderBriefing([],[],[],[],[{key:'discovery',value:'observed:manifest-complete:',checked_at:'2099-01-01'}],0);
  assert.equal(b.coverage.inventoryComplete,false);assert.equal(b.research.verifiedRevenue,null);
});
test('authenticated report includes durable decision history and bounded recommendations',async()=>{
  const {env,ctx}=fixture();await worker.fetch(request(),env,ctx);
  const response=await worker.fetch(new Request('https://hq.example.com/api/report'),env,ctx);const report=await response.json();
  assert.equal(report.decisionJournal.events.length,1);assert.equal(report.operating.queue.length,3);
  assert.equal(report.operating.activeOpportunities,1);assert.equal(report.operating.pending,4);
});
test('opportunity acceptance requires bounded experiment criteria',async()=>{
  const {env,ctx}=fixture();
  assert.equal((await worker.fetch(request({experiment:null}),env,ctx)).status,400);
  assert.equal((await worker.fetch(request({experiment:{audience:'Everyone'}}),env,ctx)).status,400);
  assert.equal((await worker.fetch(request(),env,ctx)).status,201);
  const response=await worker.fetch(new Request('https://hq.example.com/api/report'),env,ctx);
  const data=await response.json();assert.equal(JSON.parse(data.decisionJournal.events[0].experiment_json).target,3);
});
