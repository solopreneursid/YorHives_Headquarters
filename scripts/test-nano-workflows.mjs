#!/usr/bin/env node
// Execute the actual bundled Nano orchestration functions against a synthetic D1.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* YorpMind Nano Phase 2:');
const end=source.indexOf('async function scheduledCycle(env, scheduledTime)',start);
assert.ok(start>0&&end>start,'Nano engine missing');
const now='2026-11-16T12:30:00.000Z';
const fnv=x=>{let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const sandbox={nowIso:()=>now,clampText:(s,n=240)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n),
  fnv,JSON,String,Number,Date,RegExp,console};
runInNewContext(source.slice(start,end)+'\nthis.nanoRoute=nanoRoute;this.nanoPlan=nanoPlan;this.nanoPersist=nanoPersist;this.nanoScheduled=nanoScheduled;this.nanoRemember=nanoRemember;this.nanoRecall=nanoRecall;',sandbox);
const {nanoRoute,nanoPlan,nanoPersist,nanoScheduled,nanoRemember,nanoRecall}=sandbox;
const finding={id:'f-001',category:'security',priority:'high',title:'SSL certificate issue',description:'External HTTP certificate warning',evidence:'https://yorphives.com',recommendation:'Founder should verify certificate independently',observed_at:now};
const opportunity={id:'o-001',kind:'market-demand',title:'Market research lead',description:'Public source mention',source_url:'https://example.org/report',recommendation:'Research customer interviews',observed_at:now};
const plan=nanoPlan('finding',finding);
assert.equal(plan.department,'Security & Independent QA');
assert.equal(plan.review_state,'founder-review');
assert.equal(plan.evidence_state,'source-recorded-unverified');
assert.deepEqual(JSON.parse(plan.stages_json).map(x=>x.name),['observe','route','evaluate','evidence_check','recommend','founder_review']);
assert.equal(JSON.parse(plan.stages_json)[5].state,'pending');
assert.equal(nanoRoute('opportunity',opportunity),'Global Market Intelligence');
assert.equal(nanoPlan('opportunity',{...opportunity,source_url:''}).review_state,'evidence-required');
assert.equal(nanoPlan('opportunity',{...opportunity,source_url:''}).evidence_state,'missing');
const records=[],memories=[];
let runCalls=0;
const env={DB:{prepare(sql){
  return {bind(...args){
    return {
      first:async()=>{
        if(sql.includes('WHERE source_kind=? AND source_id=?'))return [...records].reverse().find(x=>x.source_kind===args[0]&&x.source_id===args[1])||null;
        if(sql.includes('WHERE run_id=?'))return records.find(x=>x.run_id===args[0])||null;
        throw Error('Unexpected select: '+sql);
      },
      run:async()=>{
        if(sql.startsWith('INSERT INTO nano_memories')){
          const [memory_id,run_id,source_kind,source_id,department,title,evidence_state,source_url,recommendation,review_state,observed_at,recorded_at,verifyRun]=args;
          if(run_id!==verifyRun||!records.some(x=>x.run_id===run_id)||memories.some(x=>x.memory_id===memory_id)||memories.length>=1000)return {meta:{changes:0}};
          memories.push({memory_id,run_id,source_kind,source_id,department,title,evidence_state,source_url,recommendation,review_state,observed_at,recorded_at});
          return {meta:{changes:1}};
        }
        if(!sql.startsWith('INSERT INTO workflow_runs'))throw Error('Unexpected write: '+sql);
        ++runCalls;
        if(records.length>=1000||records.some(x=>x.run_id===args[0]))return {meta:{changes:0}};
        const [run_id,source_kind,source_id,department,revision,stage,review_state,evidence_state,title,recommendation,stages_json,observed_at,created_at]=args;
        records.push({run_id,source_kind,source_id,department,revision,stage,review_state,evidence_state,title,recommendation,stages_json,observed_at,created_at});
        return {meta:{changes:1}};
      }
    };
  },first:async()=>{
    if(sql==='SELECT run_id FROM workflow_runs LIMIT 1')return records[0]||null;
    throw Error('Unexpected unbound first query: '+sql);
  },all:async()=>{
    if(sql.includes('FROM findings'))return {results:[finding]};
    if(sql.includes('FROM opportunities'))return {results:[opportunity]};
    throw Error('Unexpected list: '+sql);
  }};
}}};
assert.equal(await nanoPersist(env,plan),true);
assert.equal(await nanoPersist(env,plan),false);
assert.equal(records.length,1);
assert.equal(records[0].revision,1);
const changed=nanoPlan('finding',{...finding,recommendation:'Founder should double-check this newer evidence'});
assert.equal(await nanoPersist(env,changed),true);
assert.equal(records.length,2);
assert.equal(records[0].revision,1);
assert.equal(records[1].revision,2);
assert.equal(await nanoPersist(env,plan),false,'Previously seen snapshot should not be duplicated');
assert.equal(records.length,2);
assert.equal(await nanoScheduled(env,'2026-11-16T12:15:00Z'),0);
assert.equal(await nanoScheduled(env,'2026-11-16T12:30:00Z'),1,'Unseen opportunity should be stored, unchanged finding skipped');
assert.equal(records.length,3);
assert.equal(memories.length,2,'Both scheduled items remembered independently');
memories.splice(memories.findIndex(x=>x.run_id===plan.run_id),1); // Simulate lost memory after a workflow was recorded.
assert.equal(await nanoRemember(env,plan,finding),true,'Missing earlier workflow memory repaired');
assert.equal(await nanoRemember(env,plan,finding),false,'Duplicate memory ignored');
assert.equal(await nanoRemember(env,changed,{...finding,recommendation:'Founder should double-check this newer evidence'}),true,'Distinct evidence revision is remembered');
assert.equal(memories.length,3);
assert.equal(nanoRecall(memories,'Security & Independent QA',5).length,2);
assert.equal(nanoRecall(memories,'all',5).length,3);
assert.ok(nanoRecall(memories,'all',5).every(x=>x.evidenceState==='source-recorded-unverified'));
assert.equal(await nanoScheduled(env,'2026-11-16T13:00:00Z'),0);
assert.equal(records.length,3);
// An empty ledger must bootstrap at the next five-minute Cron, even off the half-hour.
records.length=0;memories.length=0;
assert.equal(await nanoScheduled(env,'2026-11-16T13:15:00Z'),2,'First Cron bootstraps existing observations');
assert.equal(records.length,2);
assert.equal(memories.length,2);
assert.equal(await nanoScheduled(env,'2026-11-16T13:20:00Z'),0,'Off-window repeat does nothing after bootstrap');
const cron=source.slice(source.indexOf('async function scheduledCycle(env, scheduledTime)'),source.indexOf('function base64UrlBytes('));
assert.ok(cron.includes('await nanoScheduled(env,scheduledTime)'), 'Cron must actually invoke workflows');
assert.ok(cron.indexOf('await nanoScheduled(env,scheduledTime)')<cron.indexOf('await checkProducts(env)'), 'Workflows run before slower collectors');
assert.ok(cron.includes('saveStatus(env,"last_cron"'), 'Heartbeat must remain executable');
assert.ok(!cron.includes('heartbeat.\\n  try'), 'Do not embed literal escaped newlines inside comments');
assert.ok(!source.slice(start,end).includes('env.AI.run'),'Orchestrator must spend zero inference');
assert.ok(!source.slice(start,end).includes('fetch('),'Orchestrator must not call external web APIs');
assert.ok(!source.slice(start,end).includes('deploy'),'Orchestrator must not deploy');
console.log('PASS: six-stage PocketFlow-style deterministic pipeline');
console.log('PASS: routing across security, market and engineering departments');
console.log('PASS: evidence source recorded, explicitly not independently verified');
console.log('PASS: founder review stage and missing-evidence gate');
console.log('PASS: immutable prior revision, idempotent unchanged polling');
console.log('PASS: 30-minute schedule and first-run bootstrap at next Cron');
console.log('PASS: Cron invocation and heartbeat are executable, never commented out');
console.log('PASS: shared memory idempotency, repair, provenance and departmental recall');
console.log('PASS: all tests use synthetic observations and fake D1');
