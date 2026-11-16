#!/usr/bin/env node
// Actual Phase 6 source functions, fake first-party APIs and fake D1; no real network or secrets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Nano Phase 6 — low-cost, source-specific, bounded public investigations.');
const end=source.indexOf('/* Nano Phase 5 — automated, deterministic triage.',start);
assert.ok(start>=0&&end>start,'Phase 6 source missing');
const code=source.slice(start,end);
assert.ok(!code.includes('env.AI.run')&&!code.includes('deploy('),'No LLM inference or deployment in source investigations');
assert.ok(source.includes('await nanoInvestigationScheduled(env,scheduledTime)'),'Cron is not connected');
assert.ok(source.includes('SELECT * FROM nano_investigations'),'HQ report not connected');

const now='2026-11-16T00:20:00.000Z';
const hash=x=>{let h=2166136261;for(const c of String(x).slice(0,700)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const memory=(id,url)=>({memory_id:'memory-opportunity-'+id,run_id:'opportunity-'+id,source_id:id,
  source_kind:'opportunity',department:'Research & Innovation',title:'Show HN: AI skill collection for developers',
  source_url:url,recorded_at:now});
const candidates=[
  memory('hn1','https://news.ycombinator.com/item?id=123'),
  memory('repo','https://github.com/acme/freedom-tools'),
  memory('unsupported','https://unknown.example/product')
];
const investigations=[];
const calls=[];
let paidFetchCount=0,investigationDaily=0;
const fetchStub=async (url,options)=>{
  calls.push({url,options});
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'manual');
  assert.ok(!('authorization' in options.headers));
  if(url==='https://hacker-news.firebaseio.com/v0/item/123.json'){
    return new Response(JSON.stringify({id:123,type:'story',title:'Show HN: AI skill collection',
      score:28,descendants:6,time:1794787200,url:'https://github.com/acme/freedom-tools'}),
      {status:200,headers:{'content-type':'application/json'}});
  }
  if(url==='https://api.github.com/repos/acme/freedom-tools'){
    return new Response(JSON.stringify({full_name:'acme/freedom-tools',
      html_url:'https://github.com/acme/freedom-tools',description:'Agent skills project',
      stargazers_count:120,forks_count:9,pushed_at:'2026-11-16T00:00:00Z',
      license:{spdx_id:'MIT'},archived:false,disabled:false}),
      {status:200,headers:{'content-type':'application/json'}});
  }
  throw Error('Forbidden external URL '+url);
};
const env={DB:{prepare(sql){
  if(sql.startsWith('SELECT memory_id FROM nano_investigations LIMIT 1'))
    return {first:async()=>investigations[0]||null};
  if(sql.startsWith('SELECT m.memory_id,m.run_id,m.source_id')){
    return {bind:stamp=>({first:async()=>candidates.find(x=>{
      const old=investigations.find(r=>r.memory_id===x.memory_id);
      return !old||old.next_check_at<=stamp;
    })||null})};
  }
  if(sql.startsWith("INSERT INTO quota(day,kind,used)")){
    return {bind:day=>({first:async()=>investigationDaily<4?{used:++investigationDaily}:null})};
  }
  if(sql.startsWith('INSERT INTO nano_investigations')){
    return {bind:(memory_id,source_id,title,department,state,primary_url,secondary_url,facts_json,checklist_json,error_code,source_fingerprint,checked_at,next_check_at,memory_check)=>({
      run:async()=>{
        assert.equal(memory_id,memory_check);
        const row={memory_id,source_id,title,department,state,primary_url,secondary_url,
          facts_json,checklist_json,error_code,source_fingerprint,checked_at,next_check_at};
        const old=investigations.findIndex(x=>x.memory_id===memory_id);
        if(old<0)investigations.push(row);else investigations[old]=row;
        return {meta:{changes:1}};
      }
    })};
  }
  throw Error('Unexpected query '+sql);
}}};
const sandbox={URL,URLSearchParams,AbortSignal,Date,JSON,Number,String,Map,console,Response,
  nowIso:()=>now,fnv:hash,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
  boundedText:async(response,max)=>{const t=await response.text();return t.length>max?null:t;},
  reserveFetch:async()=>{paidFetchCount++;return true;},fetch:fetchStub};
runInNewContext(code+'\nthis.target=nanoInvestigationTarget;this.investigate=nanoInvestigateOne;this.run=nanoInvestigationScheduled;this.report=nanoInvestigationReport;this.sourceJson=nanoSourceJson;',sandbox);

for(const bad of [
  'http://github.com/acme/example','https://evil.example/acme/example',
  'https://github.com.evil.example/acme/example','https://github.com/acme/example/extra',
  'https://github.com/acme/example?redirect=https://evil.example',
  'https://username:secret@github.com/acme/example','https://news.ycombinator.com/item?id=0',
  'https://news.ycombinator.com/item?id=123&foo=1',
  'https://127.0.0.1/','https://localhost:8080/']){
  assert.equal(sandbox.target(bad),null,'Unsafe source accepted: '+bad);
}
assert.equal(sandbox.target(candidates[0].source_url).kind,'hn');
assert.equal(sandbox.target(candidates[1].source_url).url,'https://api.github.com/repos/acme/freedom-tools');
// A brand-new installation bootstraps on the next five-minute Cron.
assert.equal(await sandbox.run(env,'2026-11-16T00:15:00Z'),'cross-platform-metadata-confirmed');
assert.equal(calls.length,2);
assert.equal(await sandbox.run(env,'2026-11-16T00:15:00Z'),'outside-window');
assert.equal(investigations[0].state,'cross-platform-metadata-confirmed');
assert.equal(JSON.parse(investigations[0].facts_json).length,2);
assert.equal(calls.length,2);
assert.equal(await sandbox.run(env,'2026-11-16T00:20:00Z'),'primary-metadata-confirmed');
assert.equal(calls.length,3);
assert.equal(await sandbox.run(env,'2026-11-16T00:20:00Z'),'unsupported-source');
assert.equal(calls.length,3,'Unknown domains must perform no fetch');
assert.equal(paidFetchCount,3);
assert.equal(investigationDaily,3);
assert.equal(await sandbox.run(env,'2026-11-16T00:20:00Z'),'nothing-due');
const view=sandbox.report(investigations);
assert.equal(view.checked,3);assert.equal(view.crossPlatform,1);
assert.equal(view.confirmed,2);assert.equal(view.pending,1);
assert.equal(view.entries[0].demandVerified,false);
assert.equal(view.entries[0].revenueVerified,false);
assert.equal(view.entries[0].productFunctionalityVerified,false);
assert.ok(view.entries[0].checklist.some(x=>x.department==='Security & Independent QA'));
assert.ok(!('executor' in view.entries[0]));

const remote={...env,DB:{prepare:sql=>sql.startsWith("INSERT INTO quota")?{
  bind:()=>({first:async()=>null})}:env.DB.prepare(sql)}};
const t=sandbox.target('https://github.com/acme/freedom-tools');
await assert.rejects(()=>sandbox.sourceJson(remote,t),/investigation-budget-reached/);
assert.equal(calls.length,3,'Exhausted quota must never fetch another URL');
assert.equal(investigations.every(x=>!x.facts_json.includes('token')),true);
console.log('PASS: source allowlist rejects redirect-like, nested, localhost, username, extra path URLs');
console.log('PASS: only fixed HN/GitHub first-party APIs contacted via GET/no redirects');
console.log('PASS: two-platform metadata corroboration, never customer demand or functionality');
console.log('PASS: unsupported source creates a record without a single outbound request');
console.log('PASS: next-Cron bootstrap, half-hour offset scheduler, due-record dedupe, max four requests/day design');
console.log('PASS: departmental checklist and strict founder-only advisory outcomes');
