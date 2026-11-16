#!/usr/bin/env node
// Exercise actual Phase 4 functions with a synthetic D1 ledger. No real credentials, remote APIs or inference.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Phase 4: founder-reviewed, append-only guidance.');
const end=source.indexOf('function base64UrlBytes(value)',start);
assert.ok(start>0&&end>start,'Phase 4 module missing');
const part=source.slice(start,end);
assert.ok(!part.includes('env.AI.run')&&!part.includes('fetch('),'Learning must perform no external work or inference');
assert.ok(!part.includes('deploy')&&!part.includes('DELETE FROM'),'Learning must preserve revisions and avoid production actions');
assert.ok(source.includes('const learningWrite=route==="/api/learning/review"'));
assert.ok(source.includes('!decisionWrite&&!privateAiWrite&&!learningWrite'));

const memoryId='memory-opportunity-ab12cd';
const reviews=[];
const env={HQ_DECISIONS_ENABLED:'true',DB:{prepare(sql){
  if(sql.startsWith('SELECT memory_id FROM nano_memories')){
    return {bind:id=>({first:async()=>id===memoryId?{memory_id:id}:null})};
  }
  if(sql.startsWith('INSERT INTO nano_playbooks')){
    return {bind:(id,outcome,guidance,reason,url,time,memory)=>({run:async()=>{
      if(memory!==memoryId||reviews.length>=1000)return {meta:{changes:0}};
      const version=reviews.filter(r=>r.memory_id===memory).length+1;
      reviews.push({entry_id:id,memory_id:memory,department:'Product & Growth',title:'Product idea',
        version,outcome,guidance,reason,evidence_url:url,source_evidence_state:'source-recorded-unverified',reviewed_at:time});
      return {meta:{changes:1}};
    }})};
  }
  throw Error('Unexpected SQL: '+sql);
}}};
const sandbox={URL,JSON,String,Number,Date,Map,crypto:webcrypto,
  boundedText:async(req,limit)=>{const txt=await req.text();return txt.length<=limit?txt:null;},
  nowIso:()=>new Date().toISOString(),
  json:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}})};
runInNewContext(part+'\nthis.saveNanoLearning=saveNanoLearning;this.nanoLearningView=nanoLearningView;',sandbox);
const makeRequest=(payload,extra={})=>new Request('https://hq.example/api/learning/review',{
  method:'POST',headers:{'origin':'https://hq.example','content-type':'application/json',
   'x-hq-founder-action':'learning-v1',...extra},body:JSON.stringify(payload)});
const base={memoryId,outcome:'useful',guidance:'Consider testing the idea with a small audience first.',
  reason:'This idea has a specific audience and an actionable validation plan.',evidenceUrl:'https://example.org/research'};
let r=await sandbox.saveNanoLearning(makeRequest(base,{'origin':'https://evil.example'}),env);
assert.equal(r.status,403);
r=await sandbox.saveNanoLearning(makeRequest({...base,memoryId:'memory-finding-deadbeef'}),env);
assert.equal(r.status,404);
r=await sandbox.saveNanoLearning(makeRequest({...base,guidance:'too short'}),env);
assert.equal(r.status,400);
r=await sandbox.saveNanoLearning(makeRequest({...base,evidenceUrl:'http://insecure.example'}),env);
assert.equal(r.status,400);
r=await sandbox.saveNanoLearning(makeRequest({...base,outcome:'auto-deploy'}),env);
assert.equal(r.status,400);
assert.equal(reviews.length,0);
r=await sandbox.saveNanoLearning(makeRequest(base),env);
assert.equal(r.status,201);
assert.equal((await r.json()).executionTriggered,false);
assert.equal(reviews.length,1);
assert.equal(reviews[0].version,1);
r=await sandbox.saveNanoLearning(makeRequest({...base,outcome:'needs-evidence',reason:'More research needed before relying on this conclusion.'}),env);
assert.equal(r.status,201);
assert.equal(reviews.length,2);
assert.equal(reviews[0].outcome,'useful','Earlier revision must not be overwritten');
assert.equal(reviews[1].version,2);
const ranked=sandbox.nanoLearningView([...reviews].reverse());
assert.equal(ranked.reviewedSources,1);
assert.equal(ranked.entries.length,1);
assert.equal(ranked.entries[0].version,2);
assert.equal(ranked.entries[0].rank,0);
assert.equal(ranked.entries[0].verified,false);
assert.equal(ranked.autonomousActions,false);
assert.equal(ranked.history.length,2);
r=await sandbox.saveNanoLearning(makeRequest(base),{...env,HQ_DECISIONS_ENABLED:'false'});
assert.equal(r.status,503);

const bundleStart=source.indexOf('const PILOT_STATIC_BUNDLE = ')+'const PILOT_STATIC_BUNDLE = '.length;
const bundleEnd=source.indexOf(';\nconst JSON_HEADERS',bundleStart);
const assets=JSON.parse(source.slice(bundleStart,bundleEnd));
assert.ok(assets['/dashboard.js'].includes('function learningPanel()'));
assert.ok(assets['/dashboard.js'].includes('function submitLearning(form)'));
assert.ok(assets['/dashboard.js'].includes("id==='learning-form'"));
console.log('PASS: founder-only authenticated review contract and strict bounded input');
console.log('PASS: immutable revisions and linked source memory');
console.log('PASS: latest founder feedback determines usefulness rank, not confidence');
console.log('PASS: no inferred verification, autonomous actions, AI calls or external requests');
console.log('PASS: learning form and submit handler bundled into UI');
