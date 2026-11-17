#!/usr/bin/env node
// Phase 19: no secrets, network or production data; exercise real repair scheduler.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Phase 19 — derived operational readiness');
const phase14=source.indexOf('/* Nano Phase 14 — bounded',start);
const end=source.indexOf('/* Nano Phase 13 — deterministic',phase14);
assert.ok(start>0&&phase14>start&&end>phase14);
const part=source.slice(start,phase14);
for(const denied of ['.run(', 'fetch(', 'env.DB', 'env.AI', 'deploy(', 'INSERT INTO', 'UPDATE '])
 assert.ok(!part.includes(denied),'Readiness must be deterministic, no execution: '+denied);
const now='2026-11-18T00:45:00Z',sha='a'.repeat(40),licenseSha='b'.repeat(40);
const pyproject='[project]\nname="device"\ndependencies=["torch>=2.0","mujoco>=3.0"]\n[dependency-groups]\ndev=["pytest"]\n';
const repo='https://github.com/demo-org/robot-kit';
const catalog=[
 {path:'pyproject.toml',kind:'manifest',sha,size:Buffer.byteLength(pyproject)},
 {path:'LICENSE',kind:'license',sha:licenseSha,size:48}];
const old={path:'pyproject.toml',kind:'manifest',sha,bytes:Buffer.byteLength(pyproject),
 manifestParser:'manifest-observed-not-parsed',directNamesObserved:0,
 exampleNames:[],contentExecuted:false};
const license={path:'LICENSE',kind:'license',sha:licenseSha,bytes:48,
 licenseFileObserved:true,legalRightsVerified:false,contentExecuted:false};
const candidate={paper_id:'paper-19',repository_url:repo,state:'repository-metadata-checked',
 paper_title:'Synthetic robot research',source_id:'arxiv',source_url:'https://arxiv.org/abs/2611.18562',
 checked_at:'2026-11-16T18:00:00Z',
 facts_json:JSON.stringify({url:repo,discoveryMethod:'title-matched-github-search'})};
const stored={paper_id:'paper-19',repository_url:repo,state:'complete',
 catalog_json:JSON.stringify(catalog),evidence_json:JSON.stringify([old,license]),
 next_check_at:'2026-12-03T00:45:00Z',attempts:3,checked_at:'2026-11-17T06:45:00Z'};
const another={paper_id:'paper-new',repository_url:'https://github.com/demo-org/new-research',
 state:'repository-metadata-checked',source_id:'arxiv',source_url:'https://arxiv.org/abs/2611.18562',
 paper_title:'Newer metadata candidate',checked_at:'2026-11-17T23:59:00Z',
 facts_json:JSON.stringify({url:'https://github.com/demo-org/new-research'})};
let at=now, requests=[],spent=0,lastWrite=null;
const db={prepare(sql){
 if(sql.startsWith('SELECT COUNT(*) n FROM nano_manifest_evidence'))
  return {first:async()=>({n:2})};
 if(sql.startsWith('SELECT i.paper_id,i.repository_url,i.state,i.facts_json'))
  return {all:async()=>({results:[
   {...another,saved_repository_url:another.repository_url,
    saved_state:'partial',saved_next:'2026-11-17T18:00:00Z',catalog_json:'[]',evidence_json:'[]',
    saved_attempts:1},
   {...candidate,saved_repository_url:stored.repository_url,
    saved_state:stored.state,saved_next:stored.next_check_at,
    catalog_json:stored.catalog_json,evidence_json:stored.evidence_json,
    saved_attempts:stored.attempts}
  ]})};
 if(sql.startsWith('INSERT INTO quota(day,kind,used)'))
  return {bind:(day)=>({first:async()=>{assert.equal(day,'2026-11-18');return spent++<2?{used:spent}:null;}})};
 if(sql.startsWith('INSERT INTO nano_manifest_evidence'))
  return {bind:(...fields)=>({run:async()=>{
   lastWrite={paper_id:fields[0],repository_url:fields[1],
    state:fields[2],catalog_json:fields[3],evidence_json:fields[4],
    attempts:fields[5],checked_at:fields[6],next_check_at:fields[7],
    error_code:fields[8]};
   return {meta:{changes:1}};
  }})};
 throw Error('Unexpected D1 query '+sql);
}};
const ctx={URL,Date,JSON,Map,Set,Math,Number,Boolean,String,Array,RegExp,
 TextDecoder,Uint8Array,AbortSignal,Response,atob,console,
 nowIso:()=>at,
 nano12RepoLink:u=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(u||''))?u:null,
 nano12PageUrl:r=>r?.source_url||'',
 clampText:(value,max=240)=>String(value||'').slice(0,max),
 boundedText:async(res,max)=>{const txt=await res.text();return txt.length>max?null:txt;},
 reserveFetch:async()=>true,
 fetch:async(url,opts)=>{
  requests.push(url);
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');
  assert.equal(url,'https://api.github.com/repos/demo-org/robot-kit/git/blobs/'+sha);
  return new Response(JSON.stringify({sha,size:Buffer.byteLength(pyproject),
   encoding:'base64',content:Buffer.from(pyproject).toString('base64')}),
   {status:200,headers:{'content-type':'application/json'}});
 }
};
runInNewContext(source.slice(phase14,end)+'\n'+part+
 '\nthis.schedule=nano14Scheduled;this.readiness=hq19Readiness;',ctx);
const ready=ctx.readiness([candidate,another],[stored],[{kind:'nano_manifest_fetches',used:2}],
 [{key:'last_cron',checked_at:now},{key:'nano_manifest_evidence',value:'complete:paper-19'}],
 [],[],now);
assert.equal(ready.productionReady,false);
assert.equal(ready.fullySelfHosted,false);
assert.equal(ready.openWorkstreams.length,8);
assert.equal(ready.research.repositories,2);
assert.equal(ready.research.manifestsObserved,1);
assert.equal(ready.research.manifestsAwaitingParse,1);
assert.equal(ready.research.manifestsParsed,0);
assert.equal(ready.research.repositoriesWithoutManifest,1);
assert.equal(ready.research.dailyManifestFetchUsed,2);
assert.equal(ready.research.dailyManifestFetchRemaining,0);
assert.equal(ready.scheduler.observedCurrent,true);
assert.equal(ready.scheduler.independentlyTested,false);
assert.equal(ready.founder.signedInJourneyVerified,false);
const atOld=ctx.readiness([candidate],[stored],[{kind:'nano_manifest_fetches',used:0}],
 [{key:'last_cron',checked_at:'2026-11-17T23:55:00Z'}],[],[],now);
assert.equal(atOld.scheduler.observedCurrent,true);
const stale=ctx.readiness([candidate],[stored],[],
 [{key:'last_cron',checked_at:'2026-11-17T20:00:00Z'}],[],[],now);
assert.equal(stale.scheduler.observedCurrent,false);
assert.ok(ready.research.nextEligibleBackfillWindow);
assert.equal(await ctx.schedule({DB:db},'2026-11-18T00:40:00Z'),'outside-window',
 'Backfill may only occur within bounded UTC hour slots');
assert.equal(spent,0);
assert.equal(await ctx.schedule({DB:db},now),'complete:paper-19',
 'At 00:45 UTC old parsed evidence must take priority over newer partial candidates');
assert.equal(requests.length,1);
assert.equal(spent,1);
assert.equal(lastWrite.paper_id,'paper-19');
assert.equal(lastWrite.state,'complete');
assert.equal(lastWrite.error_code,null);
const updated=JSON.parse(lastWrite.evidence_json);
assert.equal(updated.length,2);
assert.equal(updated.find(x=>x.path==='LICENSE').sha,licenseSha,
 'Existing root license SHA evidence must not be lost');
const parsed=updated.find(x=>x.path==='pyproject.toml');
assert.equal(parsed.sha,sha);
assert.equal(parsed.manifestParser,'pyproject-declared-subset-v1');
assert.equal(parsed.runtimeNamesObserved,2);
assert.ok(parsed.exampleNames.includes('torch'));
assert.ok(parsed.computeSignals.includes('possible-gpu-or-accelerator-stack'));
assert.ok(parsed.computeSignals.includes('robotics-or-simulation'));
assert.equal(parsed.contentExecuted,false);
assert.equal(parsed.legalRightsVerified,false);
const after=ctx.readiness([candidate],[{...lastWrite}],
 [{kind:'nano_manifest_fetches',used:1}],
 [{key:'last_cron',checked_at:now}],[],[],now);
assert.equal(after.research.manifestsParsed,1);
assert.equal(after.research.manifestsAwaitingParse,0);
assert.equal(after.productionReady,false);
const prefix='const PILOT_STATIC_BUNDLE = ',i=source.indexOf(prefix)+prefix.length,j=source.indexOf(';\n',i);
const ui=JSON.parse(source.slice(i,j))['/dashboard.js'];
assert.ok(ui.includes('function operationalReadinessPanel()'));
assert.ok(ui.includes("card('Phase 19 · Reliability & readiness'"));
assert.ok(ui.includes('operationalReadinessPanel()+'));
assert.ok(source.includes('operationalReadiness:hq19Readiness('));
assert.ok(source.includes('const repairQueued=needsBackfill(due[0])'));
console.log('PASS: urgent unparsed SHA-pinned manifest gets next free-tier slot without increasing quota');
console.log('PASS: exact GitHub blob SHA, parsed package names, license preservation, no code execution');
console.log('PASS: honest daily quota, stale scheduler, unparsed and eight open-workstream evidence');
console.log('PASS: Control dashboard displays operational gaps rather than false production readiness');
