#!/usr/bin/env node
// Actual Phase 9 dossier builder against synthetic real-shaped D1 records.
// No external requests, LLM inference, code execution or founder decisions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync('src/hq-worker.mjs','utf8');
const from=src.indexOf('/* Nano Phase 9: zero-inference, evidence-aware opportunity dossiers.');
const to=src.indexOf('/* Nano Phase 6 — low-cost, source-specific, bounded public investigations.',from);
const qaStart=src.indexOf('function nano8Quality('),qaEnd=src.indexOf('function nano8Keywords(',qaStart);
assert.ok(from>0&&to>from&&qaStart>0&&qaEnd>qaStart,'Source module boundaries');
const code=src.slice(qaStart,qaEnd)+'\n'+src.slice(from,to);
assert.ok(!code.includes('env.AI.run')&&!code.includes('fetch(')&&!code.includes('deploy('),'No AI/external execution');
assert.ok(src.includes('await nano9Scheduled(env,scheduledTime)'),'Cron hook absent');
assert.ok(src.includes('opportunityBriefs:{...nano9Report('),'Report hook absent');
const fixed='2026-11-16T15:10:00.000Z';
const sample=(id,title,extra={})=>({
 memory_id:'memory-opportunity-'+id,run_id:'opportunity-'+id,source_id:id,
 source_kind:'opportunity',department:'Research & Innovation',
 title,source_url:'https://news.ycombinator.com/item?id=50503017',
 recommendation:'Investigate evidence before recommending investment.',
 recorded_at:fixed,opportunity_kind:'catalog-unverified',listing_kind:null,
 listing_summary:'',triage_fingerprint:'triage-'+id,
 investigation_state:'',investigation_facts:'[]',brief_fingerprint:null,...extra
});
const input=[
 sample('aaa1','How to automate QA workflows for developers',{
  listing_kind:'community',source_url:'https://dev.to/author/automate-qa'}),
 sample('bbb2','Show HN: Skillset: easily curate agent skills collection',{
  source_url:'https://github.com/itsmeyaw/skillset',
  investigation_state:'primary-metadata-confirmed',
  investigation_facts:JSON.stringify([{provider:'GitHub',url:'https://github.com/itsmeyaw/skillset',
   notes:'Repository metadata only; functionality and license unverified'}])}),
 sample('ccc3','Which open source LLM runs best locally on limited hardware?',{
  source_url:'https://news.ycombinator.com/item?id=50508142'}),
 sample('ddd4','Show HN browser multiplayer RTS game',{
  source_url:'https://example.org/browser-game'}),
 sample('ee55','Congrats to the Hacktoberfest AI Challenge Winners!',{
  listing_kind:'community',source_url:'https://dev.to/author/winners'}),
 sample('ff66','Model: uncensored heretic AI agent release',{
  listing_kind:'model',source_url:'https://huggingface.co/open-org/model'})
];
const saved=new Map(),writes=[];
const db={prepare(sql){
 if(sql.startsWith('SELECT COUNT(*) n FROM nano_opportunity_briefs')){
  return {first:async()=>({n:saved.size})};
 }
 if(sql.startsWith('SELECT m.memory_id,m.run_id,m.source_id')){
  return {all:async()=>({results:input.map(x=>({...x,brief_fingerprint:saved.get(x.memory_id)?.source_fingerprint||null}))})};
 }
 if(sql.startsWith('INSERT INTO nano_opportunity_briefs')){
  return {bind:(memory_id,source_id,title,category,stage,priority,source_fingerprint,brief_json,created_at,updated_at)=>({
   run:async()=>{if(saved.size>=250&&!saved.has(memory_id))return {meta:{changes:0}};
    const old=saved.get(memory_id);
    if(old?.source_fingerprint===source_fingerprint)return {meta:{changes:0}};
    assert.ok(brief_json.length<=7500);const parsed=JSON.parse(brief_json);
    assert.equal(parsed.independentlyVerifiedDemand,false);
    assert.equal(parsed.founderApproved,false);
    saved.set(memory_id,{memory_id,source_id,title,category,stage,priority,source_fingerprint,brief_json,created_at,updated_at});
    writes.push(memory_id);return {meta:{changes:1}};}
  })};
 }
 throw Error('Unexpected D1 query: '+sql);
}};
const sandbox={Map,Set,String,Number,Date,JSON,console,
 nowIso:()=>fixed,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 fnv:value=>{let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}};
runInNewContext(code+'\nthis.profile=nano9Profile;this.fingerprint=nano9Fingerprint;this.scheduled=nano9Scheduled;this.report=nano9Report;',sandbox);
const p=sandbox.profile(input[1]);
assert.equal(p.category,'agent-workforce');
assert.equal(p.stage,'research-needed');
assert.equal(p.metadataCheck,'Platform metadata checked, not underlying assertions');
assert.equal(p.evidence.length,2);
assert.ok(p.proposedValidation.includes('distinct sources'));
assert.ok(p.revenueHypothesis.toLowerCase().includes('possible'));
assert.equal(p.independentlyVerifiedDemand,false);
assert.equal(p.independentlyVerifiedRevenue,false);
assert.equal(p.technicalClaimsVerified,false);
assert.equal(p.automatedExecution,false);
assert.equal(p.departments.length,6);
assert.equal(p.evidenceGaps.some(x=>x.includes('founder approval')),true);
assert.ok(p.rank<=69);
assert.equal(sandbox.profile(input[4]).stage,'filtered');
assert.equal(sandbox.profile(input[5]).stage,'monitor');
assert.equal(sandbox.profile({...input[0],source_url:'javascript:alert(1)'}).evidence.length,0);
const env={DB:db};
assert.equal((await sandbox.scheduled(env,'2026-11-16T15:10:00Z')).startsWith('brief-recorded:'),true);
assert.equal((await sandbox.scheduled(env,'2026-11-16T15:10:00Z')).startsWith('brief-recorded:'),true);
assert.equal((await sandbox.scheduled(env,'2026-11-16T15:10:00Z')).startsWith('brief-recorded:'),true);
assert.equal(saved.size,3);
assert.equal(await sandbox.scheduled(env,'2026-11-16T15:20:00Z'),'outside-window','After bootstrap dossiers use two windows/hour');
assert.equal((await sandbox.scheduled(env,'2026-11-16T15:45:00Z')).startsWith('brief-recorded:'),true);
assert.equal(saved.size,4);
assert.equal(await sandbox.scheduled(env,'2026-11-16T15:45:00Z'),'up-to-date','Fingerprint must dedupe unchanged evidence');
const ranked=sandbox.report([...saved.values()]);
assert.equal(ranked.generated,4);
assert.equal(ranked.available,4);
assert.equal(ranked.top.length,3);
assert.equal(new Set(ranked.top.map(x=>x.category)).size,3,'Top briefs cover distinct research categories');
assert.equal(ranked.top.every(x=>!x.founderApproved&&!x.automatedExecution),true);
assert.equal(ranked.top.every(x=>!x.independentlyVerifiedDemand&&!x.independentlyVerifiedRevenue),true);
input[1].investigation_facts=JSON.stringify([{provider:'GitHub',url:'https://github.com/itsmeyaw/skillset',notes:'New repository metadata checked'}]);
assert.equal((await sandbox.scheduled(env,'2026-11-16T16:15:00Z')).startsWith('brief-recorded:'),true);
assert.equal(saved.size,4,'Changed evidence updates a dossier without duplicating its source memory');
assert.equal(writes.length,5);
console.log('PASS: source-linked, bounded dossiers, no unsupported factual or revenue claims');
console.log('PASS: four separate themes, founder-gated experiments and six department templates');
console.log('PASS: publicity and high-risk model listings cannot be elevated to research briefs');
console.log('PASS: bootstrap one dossier per Cron, then twice hourly; idempotent fingerprints');
console.log('PASS: evidence revision updates stored dossier without duplicate source records');
console.log('PASS: no LLM calls, new fetches, payments, founder approvals or production writes');
