#!/usr/bin/env node
// No external inference. Test real extracted Cloudflare AI adapter with fake bound AI and D1.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync('src/hq-worker.mjs','utf8');
const start=src.indexOf('const HQ_AI_ROLES='),end=src.indexOf('function json(value,status=200)',start);
assert.ok(start>=0&&end>start);
let now='2026-11-16T10:00:00.000Z',calls=[],count=0;
const env={AI:{run:async(model,options)=>{
  calls.push({model,options});return {response:'Investigate HTTP evidence. Founder review needed.'};
}},DB:{prepare(sql){
  if(sql.includes('FROM findings'))return {bind:id=>({first:async()=>id==='finding-1'?
    {id,title:'HTTP unavailable',category:'reliability',priority:'high',asset:'https://yorphives.com',
     description:'Two failed checks',recommendation:'Verify upstream',evidence:'https://yorphives.com',observed_at:now}:null})};
  if(sql.includes('FROM nano_memories'))return {bind:()=>({all:async()=>({results:[
    {department:'Engineering & Operations',title:'Related uptime incident',evidence_state:'source-recorded-unverified',
      recommendation:'Review independent uptime check',source_url:'https://yorphives.com/'},
    {department:'Revenue & Business',title:'Unrelated revenue case',evidence_state:'source-recorded-unverified',
      recommendation:'Assess customer demand',source_url:'https://yorphives.com/'},
    {department:'Security & Independent QA',title:'Old security observation',evidence_state:'source-recorded-unverified',
      recommendation:'Check findings',source_url:'https://yorphives.com/'}
  ]})})};
  if(sql.includes('INSERT INTO quota'))return {bind:day=>({first:async()=>count<2?{used:++count}:null})};
  throw Error('Unexpected query: '+sql);
}}};
const sandbox={URL,AbortController,Response,JSON,String,Number,Date,setTimeout,clearTimeout,
  nowIso:()=>now,clampText:(x,n=240)=>String(x||'').replace(/\\s+/g,' ').trim().slice(0,n),json:(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}}),
  fetch:async()=>{throw Error('Private model called unexpectedly')}};
runInNewContext(src.slice(start,end)+'\nthis.status=privateAiStatus;this.analyze=privateAiAnalyze;',sandbox);
const status=sandbox.status(env);
assert.equal(status.configured,true);assert.equal(status.provider,'cloudflare-workers-ai');
assert.equal(status.model,'@cf/ibm-granite/granite-4.0-h-micro');
assert.equal(status.dailyRequestLimit,2);
const request=(role='Engineering & Operations',findingId='finding-1')=>({
  headers:{get:()=>null},text:async()=>JSON.stringify({department:role,findingId})
});
let resp=await sandbox.analyze(request('Unlisted role'),env);assert.equal(resp.status,400);
resp=await sandbox.analyze(request('Engineering & Operations','missing'),env);assert.equal(resp.status,404);
assert.equal(calls.length,0);assert.equal(count,0);
resp=await sandbox.analyze(request(),env);assert.equal(resp.status,200);
let result=await resp.json();assert.equal(result.status,'unverified-advisory');assert.equal(result.budget.requestsUsed,1);
assert.equal(result.provider,'cloudflare-workers-ai');
assert.equal(calls.length,1);
assert.equal(calls[0].options.max_tokens,260);assert.equal(calls[0].options.stream,false);
assert.equal(calls[0].options.messages[0].role,'system');
assert.ok(!('tools' in calls[0].options));
const context=JSON.parse(calls[0].options.messages[1].content);
assert.equal(context.relatedHQMemory.length,2,'Only two bounded prior memories supplied');
assert.equal(context.relatedHQMemory[0].department,'Engineering & Operations');
assert.equal(context.relatedHQMemory[0].verified,false);
assert.ok(!calls[0].options.messages[1].content.includes('local-owned-token'),'Secrets not in memory context');assert.ok(!('tool_choice' in calls[0].options));
resp=await sandbox.analyze(request('Security & Independent QA'),env);assert.equal(resp.status,200);
resp=await sandbox.analyze(request(),env);assert.equal(resp.status,429);
assert.equal(calls.length,2,'Budget must prevent third inference');
assert.equal(count,2);
const denied={...env,DB:{prepare:sql=>sql.includes('FROM findings')?env.DB.prepare(sql):({bind:()=>({first:async()=>{throw Error('D1 quota unavailable')}})})}};
resp=await sandbox.analyze(request(),denied);assert.equal(resp.status,429);
assert.equal(calls.length,2,'DB quota failures must fail closed');
assert.equal(sandbox.status({}).configured,false);
assert.equal(sandbox.status({HQ_PRIVATE_AI_URL:'http://bad'}).configured,false);
console.log('PASS: binding detection and Granite default model');
console.log('PASS: invalid roles and unknown findings rejected before inference');
console.log('PASS: bounded non-streaming prompts, no tools');
console.log('PASS: only two relevant unverified memory entries included when founder invokes AI');
console.log('PASS: exactly two daily requests, third rejected without inference');
console.log('PASS: fail-closed quota errors, self-hosted adapter remains swappable');
console.log('NOTE: synthetic Workers AI binding; real Neuron use and model response untested.');
