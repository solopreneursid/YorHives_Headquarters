#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync('src/hq-worker.mjs','utf8');
const p14=source.indexOf('/* Nano Phase 14 — bounded'),p13=source.indexOf('/* Nano Phase 13 — deterministic');
const p16=source.indexOf('/* Nano Phase 16 — founder-initiated'),p11=source.indexOf('/* Nano Phase 11 — scientific',p16);
assert.ok(p14>0&&p13>p14&&p16>p13&&p11>p16);
const code=source.slice(p16,p11);
for(const forbidden of ['fetch(', 'env.AI', 'UPDATE nano_research_founder_reviews','DELETE FROM nano_research_founder_reviews','deploy(','child_process'])
 assert.ok(!code.includes(forbidden),'Founder review cannot execute: '+forbidden);
const repo='https://github.com/demo-org/review-kit',sha='a'.repeat(40),paperId='review-paper';
const file={path:'pyproject.toml',kind:'manifest',sha,size:236};
const evidence={path:'pyproject.toml',kind:'manifest',sha,bytes:236,
 manifestParser:'pyproject-declared-subset-v1',directNamesObserved:2,runtimeNamesObserved:1,
 optionalOrGroupNamesObserved:1,exampleNames:['torch','mujoco'],
 computeSignals:['possible-gpu-or-accelerator-stack'],contentExecuted:false};
const original={paper_id:paperId,source_id:'arxiv',source_url:'https://arxiv.org/abs/2611.18562',
 paper_title:'Synthetic robot paper',state:'repository-metadata-checked',repository_url:repo,
 checked_at:'2026-11-17T00:00:00Z',license_spdx:'Apache-2.0',
 facts_json:JSON.stringify({url:repo,description:'Test only',discoveryMethod:'title-matched-github-search'}),
 saved_repository_url:repo,catalog_json:JSON.stringify([file]),evidence_json:JSON.stringify([evidence])};
let record={...original},writes=0,network=0;const history=[];
const db={prepare(sql){
 if(sql.startsWith('SELECT i.*,p.title paper_title'))
  return {bind:id=>({first:async()=>id===record.paper_id?{...record}:null})};
 if(sql.startsWith('INSERT INTO nano_research_founder_reviews')){
  assert.ok(sql.includes('MAX(version)')&&sql.includes('i.facts_json=?')&&sql.includes('m.evidence_json'));
  return {bind:(...v)=>({run:async()=>{
   writes++;assert.equal(v.length,16);
   const [id,manifest,disposition,license,tech,budget,mins,reason,next,at,paper,url,facts,catalog,evid,version]=v;
   const latest=history.filter(x=>x.paper_id===paper).length;
   if(paper!==record.paper_id||url!==record.repository_url||record.state!=='repository-metadata-checked'||
     facts!==record.facts_json||catalog!==record.catalog_json||evid!==record.evidence_json||latest!==version)
     return {meta:{changes:0}};
   history.push({entry_id:id,paper_id:paper,repository_url:url,manifest_sha:manifest,
     version:latest+1,disposition,license_concern:license,technical_concern:tech,
     max_budget_inr:budget,max_runtime_minutes:mins,reason,next_step:next,reviewed_at:at});
   return {meta:{changes:1}};
  }})};
 }
 throw Error('Unexpected SQL: '+sql);
}};
const vm={URL,JSON,Map,Set,Date,Array,String,Number,Boolean,Math,RegExp,atob,Uint8Array,TextDecoder,
 crypto:webcrypto,Response,Request,
 clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 nowIso:()=>'2026-11-17T00:00:00Z',
 nano12RepoLink:x=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(x||''))?x:null,
 nano12PageUrl:x=>x?.source_url||'',
 json:(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}}),
 boundedText:async(req,max)=>{const t=await req.text();return t.length>max?null:t;},
 fetch:async()=>{network++;throw Error('Network forbidden');}
};
runInNewContext(source.slice(p14,p13)+'\n'+code+'\nthis.save=nano16Save;this.report=nano16Report;',vm);
const env={HQ_DECISIONS_ENABLED:'true',DB:db};
const payload={paperId,expectedManifestSha:sha,expectedVersion:0,
 disposition:'needs-evidence',licenseConcern:'unreviewed',technicalConcern:'unknown',
 maxBudgetInr:0,maxRuntimeMinutes:0,
 reason:'The scientific relationship of this GitHub candidate is not confirmed.',
 nextStep:'Check maintainer provenance and review dependency licenses manually.'};
function request(data,headers={}){
 return new Request('https://hq.example/api/research/review',{method:'POST',
  headers:{origin:'https://hq.example','x-hq-founder-action':'research-review-v1',
   'content-type':'application/json',...headers},
  body:typeof data==='string'?data:JSON.stringify(data)});
}
async function save(data,headers={},context=env){
 const res=await vm.save(request(data,headers),context);return {status:res.status,...await res.json()};
}
assert.equal((await save(payload,{origin:'https://evil.example'})).status,403);
assert.equal((await save(payload,{'x-hq-founder-action':'other'})).status,403);
assert.equal((await save(payload,{'content-type':'text/plain'})).status,403);
assert.equal((await save('{bad')).status,400);
assert.equal((await save(' '.repeat(1805))).status,413);
assert.equal((await save({...payload,paperId:'missing'})).status,404);
assert.equal((await save({...payload,disposition:'execute'})).status,400);
assert.equal((await save({...payload,licenseConcern:'approved'})).status,400);
assert.equal((await save({...payload,expectedManifestSha:'b'.repeat(40)})).status,409);
assert.equal((await save({...payload,maxBudgetInr:50})).status,400);
assert.equal((await save({...payload,disposition:'plan-isolated-test',maxRuntimeMinutes:2})).status,400);
assert.equal((await save(payload,{}, {...env,HQ_DECISIONS_ENABLED:'false'})).status,503);
assert.equal(history.length,0);
let result=await save(payload);
assert.equal(result.status,201);assert.equal(result.executionTriggered,false);
assert.equal(result.spendingAuthorized,false);assert.equal(result.licenseApproved,false);
assert.equal(result.revision,1);
assert.equal((await save(payload)).status,409,'Duplicate form revision cannot overwrite previous review');
const second={...payload,expectedVersion:1,disposition:'plan-isolated-test',
 licenseConcern:'manual-legal-review',technicalConcern:'needs-validation',
 maxBudgetInr:0,maxRuntimeMinutes:15,
 reason:'A future isolated resource-limited experiment may clarify hardware needs.',
 nextStep:'Obtain separate founder approval and manually confirm licenses before testing.'};
result=await save(second);assert.equal(result.status,201);assert.equal(result.revision,2);
assert.equal(history.length,2);assert.equal(history[0].disposition,'needs-evidence');
assert.equal(history[1].disposition,'plan-isolated-test');
let view=vm.report([record],[{paper_id:paperId,repository_url:repo,
 catalog_json:record.catalog_json,evidence_json:record.evidence_json}],history.slice().reverse(),true);
assert.equal(view.candidates,1);assert.equal(view.currentlyReviewed,1);
assert.equal(view.needingRefresh,0);assert.equal(view.available,true);
assert.equal(view.entries[0].latest.canExecute,false);
assert.equal(view.entries[0].latest.spendingAuthorized,false);
assert.equal(view.entries[0].latest.licenseCleared,false);
assert.equal(view.entries[0].history.length,2);
const newer={...record,evidence_json:JSON.stringify([{...evidence,sha:'b'.repeat(40)}])};
view=vm.report([newer],[{paper_id:paperId,repository_url:repo,
 catalog_json:newer.catalog_json,evidence_json:newer.evidence_json}],history,true);
assert.equal(view.currentlyReviewed,0);
assert.equal(view.needingRefresh,1,'Source evidence revisions must invalidate a previously current review');
record={...original,facts_json:JSON.stringify({url:'https://github.com/changed/repo'})};
assert.equal((await save({...second,expectedVersion:2})).status,409);
assert.equal(network,0);
const prefix='const PILOT_STATIC_BUNDLE = ',a=source.indexOf(prefix)+prefix.length,b=source.indexOf(';\n',a);
const ui=JSON.parse(source.slice(a,b))['/dashboard.js'];
assert.ok(ui.includes('function founderResearchPanel()'));
assert.ok(ui.includes('function submitFounderResearch(form)'));
assert.ok(ui.includes("classList.contains('research-review-form')"));
assert.ok(ui.includes('founderResearchPanel()+scienceEvidencePanel()'));
assert.ok(ui.includes('$'+'{founderResearchPanel()}'));
assert.ok(source.includes('const researchReviewWrite=route==="/api/research/review"&&request.method==="POST"'));
assert.ok(source.includes('!decisionWrite&&!privateAiWrite&&!learningWrite&&!researchReviewWrite'));
assert.ok(source.includes('founderResearchReviews:nano16Report('));
const migration=readFileSync('migrations/0013_nano_research_founder_reviews.sql','utf8');
assert.ok(migration.includes('UNIQUE(paper_id, version)'));
console.log('PASS: same-origin, founder-header, bounded body and disabled-write guards');
console.log('PASS: identity and SHA matching, immutable reviews, optimistic version control');
console.log('PASS: budget/runtime limits remain plans with no execution or spending');
console.log('PASS: stale evidence invalidates previous approvals; reviews are never legal clearance');
console.log('PASS: reviewed history and forms wired into AI Employees and Research journals');
