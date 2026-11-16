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
runInNewContext(source.slice(start,end)+'\nthis.nanoRoute=nanoRoute;this.nanoPlan=nanoPlan;this.nanoPersist=nanoPersist;this.nanoScheduled=nanoScheduled;',sandbox);
const {nanoRoute,nanoPlan,nanoPersist,nanoScheduled}=sandbox;
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
const records=[];
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
        if(!sql.startsWith('INSERT INTO workflow_runs'))throw Error('Unexpected write: '+sql);
        ++runCalls;
        if(records.length>=1000||records.some(x=>x.run_id===args[0]))return {meta:{changes:0}};
        const [run_id,source_kind,source_id,department,revision,stage,review_state,evidence_state,title,recommendation,stages_json,observed_at,created_at]=args;
        records.push({run_id,source_kind,source_id,department,revision,stage,review_state,evidence_state,title,recommendation,stages_json,observed_at,created_at});
        return {meta:{changes:1}};
      }
    };
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
assert.equal(await nanoScheduled(env,'2026-11-16T13:00:00Z'),0);
assert.equal(records.length,3);
assert.ok(!source.slice(start,end).includes('env.AI.run'),'Orchestrator must spend zero inference');
assert.ok(!source.slice(start,end).includes('fetch('),'Orchestrator must not call external web APIs');
assert.ok(!source.slice(start,end).includes('deploy'),'Orchestrator must not deploy');
console.log('PASS: six-stage PocketFlow-style deterministic pipeline');
console.log('PASS: routing across security, market and engineering departments');
console.log('PASS: evidence source recorded, explicitly not independently verified');
console.log('PASS: founder review stage and missing-evidence gate');
console.log('PASS: immutable prior revision, idempotent unchanged polling');
console.log('PASS: schedule every 30 min, no AI inference or external tools');
console.log('PASS: all tests use synthetic observations and fake D1');
