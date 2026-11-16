#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const begin=source.indexOf('/* Phase 10 — independent academic research journals');
const finish=source.indexOf('/* Nano Phase 9: zero-inference',begin);
assert.ok(begin>0&&finish>begin);
const code=source.slice(begin,finish);
assert.ok(!code.includes('env.AI.run')&&!code.includes('deploy('));
assert.ok(source.includes('await nano10Scheduled(env,scheduledTime)'));
assert.ok(source.includes('researchJournals:{...nano10Report('));
const at='2026-11-16T16:35:00.000Z';
const atom=['<?xml version="1.0"?>','<feed xmlns="http://www.w3.org/2005/Atom">',
 '<entry><id>http://arxiv.org/abs/2605.12345v2</id>',
 '<title>Self-hosted intelligent robot workflows &amp; automation</title>',
 '<summary>Testing private local models with lightweight control systems.</summary>',
 '<published>2026-11-15T10:00:00Z</published></entry>',
 '<entry><id>https://evil.example/abs/2605.99999</id><title>Malicious source must be ignored</title></entry></feed>'].join('');
const crossref={message:{items:[
 {DOI:'10.1234/ai.agents-2026',title:['Autonomous AI agents for software automation'],
  type:'journal-article',published:{'date-parts':[[2026,11,13]]},'is-referenced-by-count':4},
 {DOI:'10.1234/oldpaper',title:['Suspicious non-article entry'],type:'dataset'}]}};
let budget=0,shared=0,called=0;
const papers=new Map(),scans=new Map(),requests=[];
const db={prepare(sql){
 if(sql.startsWith('SELECT source_id,next_check_at FROM nano_journal_scans'))
  return {all:async()=>({results:[...scans.values()]})};
 if(sql.startsWith('SELECT state,detail,next_check_at FROM nano_journal_scans'))
  return {bind:id=>({first:async()=>scans.get(id)||null})};
 if(sql.startsWith('INSERT INTO quota(day,kind,used)')){
  assert.ok(sql.includes('nano_journal_fetches'));
  return {bind:()=>({first:async()=>budget++<2?{used:budget}:null})};
 }
 if(sql.startsWith('INSERT INTO nano_journal_papers')){
  return {bind:(paper_id,source_id,topic_id,title,source_url,source_type,abstract_text,published_at,citation_count,assessment_json,first_seen,last_seen)=>({
   run:async()=>{const old=papers.get(paper_id);
    papers.set(paper_id,{paper_id,source_id,topic_id,title,source_url,source_type,abstract_text,published_at,citation_count,assessment_json,first_seen:old?.first_seen||first_seen,last_seen});
    return {meta:{changes:1}};}
  })};
 }
 if(sql.startsWith('INSERT INTO nano_journal_scans')){
  return {bind:(source_id,state,detail,topic_id,added,checked_at,next_check_at)=>({
   run:async()=>{scans.set(source_id,{source_id,state,detail,topic_id,added,checked_at,next_check_at});
    return {meta:{changes:1}};}
  })};
 }
 throw Error('Unexpected SQL '+sql);
}};
const sandbox={URL,Date,Map,Set,String,Number,JSON,AbortSignal,Response,console,
 nowIso:()=>at,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 fnv:x=>{let h=2166136261;for(const ch of String(x)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);},
 reserveFetch:async()=>{shared++;return true;},
 boundedText:async(r,max)=>{const t=await r.text();return t.length<=max?t:null;},
 fetch:async(url,options)=>{
  called++;requests.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
  assert.ok(!options.headers.authorization);
  if(url.includes('api.crossref.org'))return new Response(JSON.stringify(crossref),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('export.arxiv.org'))return new Response(atom,{status:200,headers:{'content-type':'application/atom+xml; charset=utf-8'}});
  throw Error('Forbidden endpoint '+url);
 }};
runInNewContext(code+'\nthis.sources=NANO10_SOURCES;this.topics=NANO10_TOPICS;this.link=nano10Link;this.atom=nano10ExtractAtom;this.crossref=nano10ExtractCrossref;this.fetchSource=nano10Fetch;this.schedule=nano10Scheduled;this.scan=nano10Scan;this.report=nano10Report;this.url=nano10Url;',sandbox);
assert.equal(sandbox.sources.length,2);
assert.equal(sandbox.topics.length,4);
assert.equal(sandbox.link('http://arxiv.org/abs/2605.12345v2','arxiv'),'https://arxiv.org/abs/2605.12345');
assert.equal(sandbox.link('https://evil.example/abs/2605.12345','arxiv'),null);
assert.equal(sandbox.link('http://doi.org/10.1234/test','crossref'),null);
assert.equal(sandbox.link('https://doi.org/10.1234/ai.agents-2026','crossref'),'https://doi.org/10.1234/ai.agents-2026');
assert.equal(sandbox.atom(atom).length,1);
assert.equal(sandbox.atom(atom)[0].title.includes('& automation'),true);
assert.equal(sandbox.crossref(crossref).length,1);
assert.throws(()=>sandbox.atom('<feed><entry>fake</entry></feed>'),/invalid-atom/);
assert.throws(()=>sandbox.url('https://bad.example',sandbox.sources[0]),/unapproved-journal-endpoint/);
const env={DB:db};
assert.equal(await sandbox.schedule(env,'2026-11-16T16:35:00Z'),'ok:crossref:saved:1');
assert.equal(await sandbox.schedule(env,'2026-11-16T16:40:00Z'),'ok:arxiv:saved:1');
assert.equal(called,2);assert.equal(shared,2);assert.equal(papers.size,2);
assert.equal(scans.size,2);
assert.equal(await sandbox.schedule(env,'2026-11-16T16:45:00Z'),'outside-window');
await assert.rejects(()=>sandbox.fetchSource(env,sandbox.sources[0],sandbox.topics[0]),/journal-budget-exhausted/);
assert.equal(called,2);
const view=sandbox.report([...scans.values()],[...papers.values()]);
assert.equal(view.sources.length,2);assert.equal(view.active,2);assert.equal(view.recordCount,2);
assert.equal(view.entries.every(x=>x.claimsReproduced===false&&x.customerDemandVerified===false&&x.licenseVerified===false),true);
assert.equal(view.entries.every(x=>x.founderApproved===false),true);
assert.equal(view.entries.every(x=>x.relevanceRank<=55),true);
const failures=new Map(),fdb={prepare(sql){
 if(sql.startsWith('SELECT state,detail,next_check_at'))return {bind:()=>({first:async()=>failures.get('crossref')||null})};
 if(sql.startsWith('INSERT INTO quota'))return {bind:()=>({first:async()=>({used:1})})};
 if(sql.startsWith('INSERT INTO nano_journal_scans'))return {bind:(source_id,state,detail,topic_id,added,checked_at,next_check_at)=>({
  run:async()=>{failures.set(source_id,{source_id,state,detail,next_check_at});return {meta:{changes:1}};}
 })};
 throw Error('Unexpected failed-source SQL '+sql);
}};
sandbox.fetch=async()=>new Response('rate limited',{status:429,headers:{'retry-after':'172800'}});
assert.equal(await sandbox.scan({DB:fdb},sandbox.sources[0],at),'rate-limited:crossref:saved:0');
assert.equal(failures.get('crossref').state,'rate-limited');
assert.ok(Date.parse(failures.get('crossref').next_check_at)-Date.parse(at)>=172800000);
assert.equal(await sandbox.scan({DB:fdb},sandbox.sources[0],at),'cooldown:crossref');
console.log('PASS: arXiv canonicalization, strict publisher URLs, no unsafe redirects');
console.log('PASS: Crossref JSON and arXiv Atom become source-linked, unverified publications');
console.log('PASS: independent 2/day journal quota plus existing shared public-fetch cap');
console.log('PASS: one-source-per-Cron bootstrap and schedule limits');
console.log('PASS: rate-limit Retry-After cooldown without fabricated publications');
console.log('PASS: no reproduced-science, license, market, AI inference or founder-approval claims');
