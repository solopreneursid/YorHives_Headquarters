#!/usr/bin/env node
// Actual Phase 7 functions; synthetic D1 and provider responses; zero outside network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const a=source.indexOf('/* Phase 7: provider-neutral, self-hostable direct public-source registry.');
const b=source.indexOf('/* Nano Phase 6 — low-cost, source-specific, bounded public investigations.',a);
assert.ok(a>0&&b>a,'Global source registry not found');
const module=source.slice(a,b);
assert.ok(!module.includes('env.AI.run')&&!module.includes('deploy('));
assert.ok(source.includes('await nano7Scheduled(env,scheduledTime)'));
assert.ok(source.includes('nano7Report(sourceScanRows.results||[],sourceLeadRows.results||[])'));
const scans=[],leads=[],opportunities=[],requests=[];let budget=0,shared=0;
const now='2026-11-16T14:30:00.000Z';
const providerBodies={
 dev:[{id:123,title:'How to build an autonomous AI agent workflow',url:'https://dev.to/author/ai-agent-workflow',
   description:'Public contributor article, not verified.',public_reactions_count:20,comments_count:3}],
 hf:[{id:'open-org/great-model',private:false,gated:false,downloads:1000,likes:18}],
 openalex:{results:[{id:'https://openalex.org/W1234567',title:'Autonomous AI agents and language models',cited_by_count:10}]},
 crossref:{message:{items:[{DOI:'10.1234/autonomous-agents-2026',title:['Autonomous AI agents in scientific research'], 'is-referenced-by-count':5}]}}
};
const endpoints={
 'https://dev.to/api/articles?tag=ai&per_page=8&top=7':'dev',
 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=8':'hf',
 'https://api.openalex.org/works?search=autonomous%20AI%20agents&per_page=8&select=id,title,publication_date,cited_by_count':'openalex',
 'https://api.crossref.org/works?query.bibliographic=autonomous%20AI%20agents&sort=published&order=desc&rows=8&select=DOI,title,URL,is-referenced-by-count':'crossref'
};
const fetch=async(url,options)=>{
 const id=endpoints[url];assert.ok(id,'Unregistered endpoint fetched: '+url);
 assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
 assert.equal(options.headers.authorization,undefined);
 requests.push(id);
 return new Response(JSON.stringify(providerBodies[id]),{status:200,headers:{'content-type':'application/json'}});
};
const db={prepare(sql){
 if(sql.startsWith('SELECT source_id,next_check_at FROM nano_source_scans'))return {all:async()=>({results:scans})};
 if(sql.startsWith('SELECT detail,next_check_at FROM nano_source_scans'))return {bind:id=>({first:async()=>scans.find(x=>x.source_id===id)||null})};
 if(sql.startsWith('INSERT INTO quota(day,kind,used)'))return {bind:()=>({first:async()=>budget++<3?{used:budget}:null})};
 if(sql.startsWith('INSERT INTO nano_source_leads'))return {bind:(id,sourceId,kind,title,url,summary,signals,evidence,at)=>({
  run:async()=>{if(leads.some(x=>x.lead_id===id))return {meta:{changes:0}};
   leads.push({lead_id:id,source_id:sourceId,kind,title,source_url:url,summary,signals_json:signals,evidence_state:evidence,observed_at:at});
   return {meta:{changes:1}};}})};
 if(sql.startsWith('INSERT OR IGNORE INTO opportunities'))return {bind:(id,title,description,recommendation,url,at,score,kind)=>({
  run:async()=>{opportunities.push({id,title,description,recommendation,source_url:url,observed_at:at,score,kind});return {meta:{changes:1}};}})};
 if(sql.startsWith('INSERT INTO nano_source_scans'))return {bind:(sourceId,state,detail,added,checkedAt,nextAt)=>({
  run:async()=>{const prev=scans.find(x=>x.source_id===sourceId);
   const value={source_id:sourceId,state,detail,added,checked_at:checkedAt,next_check_at:nextAt};
   if(prev)Object.assign(prev,value);else scans.push(value);
   return {meta:{changes:1}};}})};
 throw Error('Unknown SQL: '+sql);
}};
let count=0;const sandbox={URL,Date,Map,Set,Number,String,JSON,AbortSignal,Response,
 nowIso:()=>now,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 fnv:x=>{let h=2166136261;for(const c of String(x).slice(0,700)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);},
 boundedText:async(r,limit)=>{const x=await r.text();return x.length<=limit?x:null;},
 reserveFetch:async()=>{shared++;return true;},fetch,console};
runInNewContext(module+'\nthis.reg=NANO7_REGISTRY;this.link=nano7Link;this.normalize=nano7Normalize;this.scheduled=nano7Scheduled;this.report=nano7Report;this.scan=nano7Scan;this.get=nano7Fetch;',sandbox);
for(const bad of [
  ['https://evil.example/author/ai-agent','dev'],
  ['https://dev.to.evil.example/author/ai-agent','dev'],
  ['https://dev.to/author/article?fake=1','dev'],
  ['http://dev.to/author/article','dev'],
  ['https://user:password@dev.to/author/article','dev'],
  ['https://huggingface.co/private/model/extra','hf'],
  ['https://huggingface.co/private/model#token','hf'],
  ['https://openalex.org/W123?next=2','openalex']
]) assert.equal(sandbox.link(...bad),null,'Unsafe lead accepted: '+bad[0]);
assert.equal(sandbox.normalize(sandbox.reg[1],[{id:'open-org/gated',gated:true}]).length,0,'Gated models must be ignored');
const env={DB:db};
assert.equal(await sandbox.scheduled(env,'2026-11-16T14:30:00Z'),'listing-recorded:dev:new:1');
assert.equal(await sandbox.scheduled(env,'2026-11-16T14:35:00Z'),'listing-recorded:hf:new:1');
assert.equal(await sandbox.scheduled(env,'2026-11-16T14:40:00Z'),'listing-recorded:openalex:new:1');
assert.equal(scans.length,3);assert.equal(leads.length,3);assert.equal(opportunities.length,3);
assert.deepEqual(requests,['dev','hf','openalex']);
assert.equal(opportunities.every(x=>x.kind==='research-unverified'),true);
assert.equal(await sandbox.scheduled(env,'2026-11-16T14:45:00Z'),'budget-reached');
assert.equal(await sandbox.scheduled(env,'2026-11-16T17:25:00Z'),'budget-reached');
await assert.rejects(()=>sandbox.get(env,sandbox.reg[0]),/daily-budget-reached/);
assert.equal(requests.length,3,'Daily budget must block extra network');
assert.equal(shared,3);
const report=sandbox.report(scans,leads);
assert.equal(report.sources.length,4);assert.equal(report.active,3);assert.equal(report.entries.length,3);
assert.equal(report.entries.every(x=>x.verifiedRevenue===false&&x.verifiedDemand===false),true);
assert.equal(report.sources.filter(x=>x.status==='listing-recorded').length,3);
assert.equal(report.sources.find(x=>x.id==='crossref').status,'not-attempted');
const cross=sandbox.normalize(sandbox.reg[3],providerBodies.crossref);
assert.equal(cross.length,1);
assert.equal(cross[0].url,'https://doi.org/10.1234/autonomous-agents-2026');
console.log('PASS: provider-level strict URL and source allowlists, gated model filters');
console.log('PASS: fixed direct-source GETs, no redirects, credentials or SaaS intermediaries');
console.log('PASS: one registered provider per Cron bootstrap, then staggered daily cadence');
console.log('PASS: three-per-day atomic budget, shared fetch quota, zero further calls');
console.log('PASS: unverified leads and next Nano evidence workflow; no business conclusions');
