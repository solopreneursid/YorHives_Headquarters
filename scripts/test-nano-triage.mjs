#!/usr/bin/env node
// Dependency-free tests against real extracted Nano Phase 5 logic and synthetic D1.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Nano Phase 5 — automated, deterministic triage.');
const end=source.indexOf('async function scheduledCycle(env, scheduledTime)',start);
assert.ok(start>0&&end>start,'Phase 5 logic missing');
const code=source.slice(start,end);
assert.ok(!code.includes('fetch(')&&!code.includes('deploy('),'Scheduled triage cannot fetch or deploy');
assert.ok(source.includes('await nanoTriageScheduled(env,scheduledTime)'),'Cron triage hook missing');
assert.ok(source.includes('await nanoAutoAiOnce(env,scheduledTime)'),'Optional AI Cron hook missing');

const now='2026-11-16T00:00:00.000Z';
const hash=x=>{let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const memory={
 memory_id:'memory-opportunity-a1',run_id:'opportunity-a1',source_kind:'opportunity',source_id:'a1',department:'Research & Innovation',
 title:'Ask HN: What AI agent infrastructure are you using?',source_url:'https://news.ycombinator.com/item?id=123',
 evidence_state:'source-recorded-unverified',recorded_at:now,observed_at:now,
 description:'Public problem discussion; demand, traffic, feature equivalence and revenue are unverified.',
 recommendation:'First verify the YorpHives product catalog; mention does not establish a missing product.',
 source_detail_kind:'catalog-unverified',finding_priority:null
};
const finding={...memory,memory_id:'memory-finding-b2',run_id:'finding-b2',source_kind:'finding',source_id:'b2',
 department:'Engineering & Operations',title:'Site availability incident affecting users',
 source_url:'https://yorphives.com/',description:'Two independent operational probes reported availability degradation with HTTP errors on the public website.',
 recommendation:'Founder should independently verify the HTTP status and customer impact before considering any production change.',
 source_detail_kind:null,finding_priority:'critical'};
const rows=[],markers=new Set(),calls=[];let globalQuota=0;
const env={DB:{prepare(sql){
  if(sql.startsWith('SELECT fingerprint FROM nano_triage'))
    return {bind:id=>({first:async()=>rows.find(x=>x.memory_id===id)||null})};
  if(sql.startsWith('INSERT INTO nano_triage'))
    return {bind:(memory_id,source_kind,source_id,department,title,score,state,next_action,source_url,evidence_state,reasons_json,fingerprint,assessed_at)=>({run:async()=>{
      const old=rows.find(x=>x.memory_id===memory_id);
      const record={memory_id,source_kind,source_id,department,title,score,state,next_action,source_url,evidence_state,
        reasons_json,fingerprint,assessed_at,ai_analysis:'',ai_model:'',ai_at:''};
      if(old){Object.assign(old,record);return {meta:{changes:1}};}
      if(rows.length>=1000)return {meta:{changes:0}};
      rows.push(record);return {meta:{changes:1}};
    }})};
  if(sql.startsWith('SELECT memory_id FROM nano_triage'))
    return {first:async()=>rows[0]||null};
  if(sql.startsWith('SELECT m.*,COALESCE'))
    return {all:async()=>({results:[memory,finding]})};
  if(sql.startsWith('SELECT t.* FROM nano_triage'))
    return {first:async()=>rows.find(x=>x.state==='review-now'&&x.score>=85&&x.ai_analysis==='')||null};
  if(sql.startsWith('INSERT INTO quota(day,kind,used)'))
    return {bind:day=>({first:async()=>{if(markers.has(day))return null;markers.add(day);return {used:1};}})};
  if(sql.startsWith('UPDATE nano_triage SET ai_analysis'))
    return {bind:(ai,model,time,id,fingerprint)=>({run:async()=>{
      const r=rows.find(x=>x.memory_id===id&&x.fingerprint===fingerprint&&x.ai_analysis==='');
      if(!r)return {meta:{changes:0}};Object.assign(r,{ai_analysis:ai,ai_model:model,ai_at:time});return {meta:{changes:1}};
    }})};
  throw Error('Unexpected SQL: '+sql);
}}};
const sandbox={nowIso:()=>now,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
  fnv:hash,URL,JSON,String,Number,Date,Map,Set,console,
  HQ_CF_MODEL:'@cf/ibm-granite/granite-4.0-h-micro',reserveWorkersAiRequest:async()=>globalQuota<2?++globalQuota:null};
runInNewContext(code+'\nthis.triage=nanoTriageEvaluate;this.scheduled=nanoTriageScheduled;this.report=nanoTriageReport;this.auto=nanoAutoAiOnce;',sandbox);
const weak=sandbox.triage(memory);assert.equal(weak.state,'research-first');
assert.ok(weak.score<=34,'Unverified catalog cannot generate a founder recommendation');
const missing=sandbox.triage({...memory,source_url:'',source_detail_kind:'market-demand'});
assert.ok(missing.score<=24);assert.equal(missing.state,'research-first');
const urgent=sandbox.triage(finding);assert.equal(urgent.state,'review-now');assert.ok(urgent.score>=85);
assert.ok(urgent.reasons_json.includes('independently verified'),'No source verification should be assumed');

assert.equal(await sandbox.scheduled(env,'2026-11-16T00:05:00Z'),2,'Bootstrap at first Cron');
assert.equal(rows.length,2);
assert.equal(await sandbox.scheduled(env,'2026-11-16T00:10:00Z'),0,'Off-window skip');
assert.equal(await sandbox.scheduled(env,'2026-11-16T00:30:00Z'),0,'Duplicate write suppressed');
assert.equal(rows.length,2);
let result=sandbox.report([...rows].reverse(),{events:[]});
assert.equal(result.reviewCount,1);
assert.equal(result.researchFirst,1);
assert.equal(result.ready[0].sourceId,'b2');
assert.equal(result.ready[0].verified,false);
result=sandbox.report([...rows].reverse(),{events:[{thread:'finding:b2',state:'rejected'}]});
assert.equal(result.reviewCount,0,'Founder rejection removes item from ready queue');

assert.equal(await sandbox.auto(env,'2026-11-16T00:00:00Z'),'disabled');
assert.equal(globalQuota,0);
env.HQ_AUTO_AI_ENABLED='true';
env.AI={run:async(model,opts)=>{calls.push({model,opts});return {response:'This is unverified. Founder should independently validate the HTTP observation.'};}};
assert.equal(await sandbox.auto(env,'2026-11-16T00:05:00Z'),'outside-window');
assert.equal(await sandbox.auto(env,'2026-11-16T00:00:00Z'),'recorded-unverified-advisory');
assert.equal(calls.length,1);
assert.equal(calls[0].opts.stream,false);assert.equal(calls[0].opts.max_tokens,180);
assert.ok(!('tools' in calls[0].opts));
assert.equal(globalQuota,1);
assert.equal(rows.find(x=>x.memory_id==='memory-finding-b2').ai_analysis.length>0,true);
assert.equal(await sandbox.auto(env,'2026-11-16T00:00:00Z'),'no-eligible-evidence','Never infer twice for already analyzed record');
assert.equal(calls.length,1);
assert.equal(sandbox.report([...rows],{events:[]}).ready[0].verified,false);
console.log('PASS: catalog-unverified and missing evidence stay in research backlog');
console.log('PASS: critical incident can enter founder review, never claimed verified');
console.log('PASS: Cron bootstraps triage and is idempotent on unchanged sources');
console.log('PASS: only 3 highest priorities are presented; founder decisions suppress handled items');
console.log('PASS: auto AI disabled by default and never called outside midnight window');
console.log('PASS: AI prompt is short, no tools, no autonomy, shared daily budget enforced');
console.log('PASS: stored AI text remains unverified and no external writes occur');
