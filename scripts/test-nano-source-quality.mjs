#!/usr/bin/env node
// Phase 8: current Worker source, synthetic D1/API; no network credentials or production writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync('src/hq-worker.mjs','utf8');
const start=code.indexOf('/* Phase 7: provider-neutral, self-hostable direct public-source registry.');
const end=code.indexOf('/* Nano Phase 6 — low-cost, source-specific, bounded public investigations.',start);
assert.ok(start>=0&&end>start,'Phase 8 source module missing');
const module=code.slice(start,end);
assert.ok(!module.includes('env.AI.run')&&!module.includes('deploy('),'No autonomous model call or deployment permitted');
const now='2026-11-16T14:50:00.000Z';
const records=[],scans=[];let opportunityWrites=0,fetchCalls=0,fetchQuota=0;
const db={prepare(sql){
 if(sql.startsWith('INSERT INTO nano_source_leads'))return {bind:(id,sourceId,kind,title,url,summary,signals,evidence,observedAt)=>({
  run:async()=>{records.push({id,sourceId,kind,title,url,summary,evidence});return {meta:{changes:1}};}})};
 if(sql.startsWith('INSERT OR IGNORE INTO opportunities'))return {bind:()=>({run:async()=>{opportunityWrites++;return {meta:{changes:1}};}})};
 if(sql.startsWith('SELECT detail,next_check_at FROM nano_source_scans'))return {bind:id=>({first:async()=>scans.find(x=>x.source_id===id)||null})};
 if(sql.startsWith('INSERT INTO quota(day,kind,used)'))return {bind:()=>({first:async()=>fetchQuota++<3?{used:fetchQuota}:null})};
 if(sql.startsWith('INSERT INTO nano_source_scans'))return {bind:(source_id,state,detail,added,checked_at,next_check_at)=>({
  run:async()=>{const value={source_id,state,detail,added,checked_at,next_check_at};const old=scans.find(x=>x.source_id===source_id);
   if(old)Object.assign(old,value);else scans.push(value);return {meta:{changes:1}};}})};
 throw Error('Unexpected SQL '+sql);
}};
const sandbox={URL,Date,Map,Set,Number,String,JSON,AbortSignal,Response,console,
 nowIso:()=>now,fnv:x=>String(x).slice(0,20),clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 reserveFetch:async()=>true,boundedText:async(r,max)=>{const t=await r.text();return t.length<=max?t:null;},
 fetch:async()=>{fetchCalls++;return new Response('rate limit',{status:429,headers:{'retry-after':'172800','content-type':'text/plain'}});}};
runInNewContext(module+'\nthis.reg=NANO7_REGISTRY;this.quality=nano8Quality;this.topics=nano8TopicSignals;this.backoff=nano8RetryDelay;this.scan=nano7Scan;this.save=nano7Save;this.report=nano7Report;this.normalize=nano7Normalize;',sandbox);
const q=sandbox.quality;
assert.equal(q({title:'Congrats to the Hacktoberfest Open-Source AI Challenge Week 4 Winners!',kind:'community'}).grade,'filtered');
assert.equal(q({title:'How to automate workflows for customer support teams',kind:'community'}).grade,'candidate');
assert.equal(q({title:'Model: open-org/model-uncensored-heretic',kind:'model'}).grade,'monitor');
assert.equal(q({title:'Autonomous AI agents in research',kind:'paper'}).grade,'monitor');
assert.equal(q({title:'We Keep Hearing About AI Productivity',kind:'community'}).grade,'monitor');
for(const title of ['Sponsored AI Giveaway','Best Open-Source AI Awards 2026','Weekly AI Roundup']){
 assert.equal(q({title,kind:'community'}).grade,'filtered');
}
assert.equal(q({title:'How to automate workflows',kind:'community'}).verified,false);

const topicA={sourceId:'dev',title:'Automating customer support workflows for remote teams',
 sourceUrl:'https://dev.to/author/automating-customer-support',kind:'community',quality:q({title:'Automating customer support workflows',kind:'community'})};
const topicB={sourceId:'crossref',title:'Customer support workflows for small remote teams',
 sourceUrl:'https://doi.org/10.1234/example',kind:'paper',quality:q({title:'Customer support workflows',kind:'paper'})};
const matched=sandbox.topics([topicA,topicB]);
assert.equal(matched.length,1);
assert.equal(matched[0].verifiedDemand,false);assert.equal(matched[0].verifiedRevenue,false);
assert.equal(sandbox.topics([topicA,{...topicB,sourceId:'dev'}]).length,0,'Same-source duplication is not corroboration');
assert.equal(sandbox.topics([{...topicA,title:'AI agents'},{...topicB,title:'AI models'}]).length,0,'Generic AI keywords cannot establish similarity');

const fb=sandbox.backoff('source-http-429','172800',429,now);
assert.ok(fb.seconds>=172800);
assert.ok(fb.detail.startsWith('rate-limited:429:attempt-'));
assert.ok(sandbox.backoff('rate-limited:429:attempt-3','',429,now).seconds>fb.seconds,'Exponential retries');
assert.ok(sandbox.backoff('rate-limited:429:attempt-3','',503,now).detail==='source-http-503');

const pub=sandbox.reg[0];
await sandbox.save({DB:db},pub,{id:'filtered-1',sourceId:'dev',kind:'community',
 title:'Congrats to the Open-Source AI Challenge Winners!',url:'https://dev.to/author/winners-story',
 summary:'Public announcement',signals:{reactions:100},recordedAt:now});
assert.equal(records.length,1);assert.equal(opportunityWrites,0,'Publicity must not enter automated opportunities');
await sandbox.save({DB:db},pub,{id:'candidate-2',sourceId:'dev',kind:'community',
 title:'How to automate support workflows for small teams',url:'https://dev.to/author/automate-workflows',
 summary:'Technical problem post',signals:{reactions:15},recordedAt:now});
assert.equal(opportunityWrites,1,'Useful lead may enter unverified opportunity workflow');

const r=await sandbox.scan({DB:db},sandbox.reg[2],now);
assert.equal(r,'unavailable:openalex:new:0');
assert.equal(scans[0].detail,'rate-limited:429:attempt-1');
assert.ok(Date.parse(scans[0].next_check_at)-Date.parse(now)>=172800*1000);
assert.equal(fetchCalls,1);
const again=await sandbox.scan({DB:db},sandbox.reg[2],now);
assert.equal(again,'cooldown:openalex');assert.equal(fetchCalls,1,'No retry before permitted time');
const view=sandbox.report(scans,[{lead_id:'filtered-1',source_id:'dev',kind:'community',
 title:'Congrats to the Open-Source AI Challenge Winners!',source_url:'https://dev.to/author/winners-story',summary:'Public announcement',observed_at:now}]);
assert.equal(view.sources.length,4);
assert.equal(view.sources.find(x=>x.id==='openalex').status,'rate-limited');
assert.equal(view.filtered,1);assert.equal(view.candidates,0);
assert.equal(view.entries[0].verifiedDemand,false);assert.equal(view.entries[0].quality.grade,'filtered');
console.log('PASS: low-signal publicity is stored for provenance but never promoted to opportunities');
console.log('PASS: model, research and community leads keep conservative, explainable quality status');
console.log('PASS: cross-source topic similarity requires two distinctive terms and distinct sources');
console.log('PASS: no topic signal is labeled demand, revenue or functionality verification');
console.log('PASS: rate-limit Retry-After cooldown, exponential delay and fail-closed follow-up');
console.log('PASS: no paid API, external agent, autonomous inference or production write');
