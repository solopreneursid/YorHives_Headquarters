#!/usr/bin/env node
// Phase 17 tests run the real, purely advisory Worker planning functions offline.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const a=source.indexOf('/* Nano Phase 14 — bounded');
const b=source.indexOf('/* Nano Phase 13 — deterministic',a);
const c=source.indexOf('/* Nano Phase 17 — bounded',b);
const d=source.indexOf('/* Nano Phase 16 — founder-initiated',c);
const e=source.indexOf('/* Nano Phase 11 — scientific',d);
assert.ok(a>0&&b>a&&c>b&&d>c&&e>d,'All source modules must be in stable order');
const phase17=source.slice(c,d);
for(const denied of [
 'env.DB','env.AI','fetch(','.run(','.bind(','eval(','spawn(','process.','worker_threads',
 'exec(','deploy(', 'INSERT INTO','UPDATE ', 'DELETE FROM','crypto.randomUUID()'
])assert.ok(!phase17.includes(denied),'Phase 17 must be deterministic only: '+denied);
const sha='a'.repeat(40),repo='https://github.com/example-team/manual-research';
const r={paper_id:'paper-phase17',paper_title:'Agentic robotics research',source_id:'arxiv',
 source_url:'https://arxiv.org/abs/2611.18562',state:'repository-metadata-checked',
 repository_url:repo,license_spdx:'Apache-2.0',
 facts_json:JSON.stringify({url:repo,discoveryMethod:'title-matched-github-search'})};
const catalog=[{path:'pyproject.toml',kind:'manifest',sha,size:345},
 {path:'LICENSE',kind:'license',sha:'b'.repeat(40),size:500}];
const evidence=[{path:'pyproject.toml',kind:'manifest',sha,bytes:345,
 manifestParser:'pyproject-declared-subset-v1',directNamesObserved:9,
 runtimeNamesObserved:1,optionalOrGroupNamesObserved:8,
 exampleNames:['torch','vllm','gymnasium'],computeSignals:['possible-gpu-or-accelerator-stack'],
 contentExecuted:false},
 {path:'LICENSE',kind:'license',sha:'b'.repeat(40),bytes:500,licenseFileObserved:true}];
const manifest={paper_id:r.paper_id,repository_url:repo,
 catalog_json:JSON.stringify(catalog),evidence_json:JSON.stringify(evidence),
 checked_at:'2026-11-16T19:00:00Z'};
const review={entry_id:'rev-test',paper_id:r.paper_id,repository_url:repo,
 manifest_sha:sha,version:1,disposition:'plan-isolated-test',
 license_concern:'manual-legal-review',technical_concern:'needs-validation',
 max_budget_inr:0,max_runtime_minutes:20,reviewed_at:'2026-11-16T20:00:00Z',
 reason:'Only a future sandbox can measure the system safely.',
 next_step:'Review the model and dependency licenses before any external testing.'};
const sandbox={
 URL,JSON,Date,Set,Map,Array,String,Boolean,Number,Math,RegExp,
 nano12RepoLink:v=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(v||''))?v:null,
 nano12PageUrl:row=>/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(String(row?.source_url||''))?row.source_url:null,
 clampText:(v,n=240)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n)
};
runInNewContext(source.slice(a,b)+'\n'+source.slice(c,d)+'\n'+source.slice(d,e)+
 '\nthis.phase17Report=nano17Report;',sandbox);
const get=(records=[r],roots=[manifest],reviews=[review])=>
 sandbox.phase17Report(records,roots,reviews);
const first=get();
assert.equal(first.eligible,1);
assert.equal(first.preflightReady,0);
assert.equal(first.automaticallyRun,0);
assert.equal(first.commerciallyApproved,0);
assert.equal(first.plansWithCurrentFounderIntent,1);
const plan=first.entries[0];
assert.equal(plan.planStatus,'manual-preflight-pending');
assert.equal(plan.founderReviewCurrent,true);
assert.equal(plan.founderReviewDisposition,'plan-isolated-test');
assert.equal(plan.founderReviewRevision,1);
assert.equal(plan.proposedCaps.inr,0);
assert.equal(plan.proposedCaps.runtimeMinutes,20);
assert.equal(plan.proposedCaps.notSpendingAuthorization,true);
assert.equal(plan.manifestSha,sha);
assert.equal(plan.gatesTotal,10);
assert.equal(plan.preflightGates.length,10);
assert.equal(plan.preflightVerified,0);
assert.equal(plan.preflightGates.find(x=>x.key==='source').status,'root-manifest-observed');
for(const key of ['authorship','dependencies','licenses','data','isolation','hardware',
 'cost','acceptance','permission']){
 const gate=plan.preflightGates.find(x=>x.key===key);
 assert.equal(gate.status,'unverified','Must never infer completed preflight: '+key);
 assert.ok(gate.proof.length>25,'Proof requirements must be concrete');
}
assert.ok(plan.preflightGates.find(x=>x.key==='licenses').evidence.includes('NOT cleared'));
assert.ok(plan.preflightGates.find(x=>x.key==='hardware').evidence.includes('possible-gpu'));
assert.equal(plan.stages.length,5);
assert.ok(plan.stages.every(x=>x.owner.includes('Founder')||x.owner.includes('manual')||x.owner.includes('QA')));
assert.equal(plan.stopConditions.length,4);
assert.ok(plan.stopConditions.some(x=>x.includes('credentials')));
assert.equal(plan.readiness,'NOT approved to execute');
assert.equal(plan.founderExecutionAuthorized,false);
assert.equal(plan.automatedExecution,false);
assert.equal(plan.measuredCost,false);
assert.equal(plan.commercialReuseApproved,false);
assert.ok(plan.outcome.includes('Not executed'));
const noReview=get([r],[manifest],[]);
assert.equal(noReview.plansWithCurrentFounderIntent,0);
assert.equal(noReview.entries[0].planStatus,'research-first');
assert.equal(noReview.entries[0].proposedCaps.runtimeMinutes,0);
assert.equal(noReview.entries[0].proposedCaps.inr,0);
const staleReview=get([r],[{...manifest,catalog_json:JSON.stringify([
 {...catalog[0],sha:'c'.repeat(40)},catalog[1]
 ])}],[review]);
assert.equal(staleReview.entries[0].planStatus,'review-stale');
assert.equal(staleReview.entries[0].founderReviewCurrent,false);
assert.equal(staleReview.entries[0].proposedCaps.runtimeMinutes,0);
const differentRepo=get([r],[{...manifest,repository_url:'https://github.com/another/repo'}],[review]);
assert.equal(differentRepo.entries[0].manifestSha,'');
assert.equal(differentRepo.entries[0].founderReviewCurrent,false);
assert.equal(differentRepo.entries[0].proposedCaps.inr,0);
const deferred=get([r],[manifest],[{...review,disposition:'defer',max_budget_inr:0,max_runtime_minutes:0}]);
assert.equal(deferred.entries[0].planStatus,'deferred-by-founder');
assert.equal(deferred.entries[0].proposedCaps.runtimeMinutes,0);
const evidenceOnly=get([r],[manifest],[{...review,disposition:'needs-evidence',
 max_budget_inr:0,max_runtime_minutes:0}]);
assert.equal(evidenceOnly.entries[0].planStatus,'awaiting-founder-test-plan');
assert.equal(evidenceOnly.entries[0].preflightVerified,0);
assert.equal(get([{...r,repository_url:'https://attacker.example/fake'}]).eligible,0);
assert.equal(get([{...r,reason:'script to run'}]).entries[0].founderExecutionAuthorized,false);
assert.ok(phase17.includes('No observed infrastructure pricing or runtime usage'));
assert.ok(!JSON.stringify(plan).includes('sudo npm install'));
const prefix='const PILOT_STATIC_BUNDLE = ',start=source.indexOf(prefix)+prefix.length;
const end=source.indexOf(';\n',start);
const js=JSON.parse(source.slice(start,end))['/dashboard.js'];
assert.ok(js.includes('function experimentPlansPanel()'));
assert.ok(js.includes('function exportExperimentPlan(paperId)'));
assert.ok(js.includes("data-export-experiment="));
assert.ok(js.includes('experimentPlansPanel()+experimentEvidencePanel()+scienceEvidencePanel()'));
assert.ok(js.includes('$'+'{experimentPlansPanel()}'));
assert.ok(js.includes("format:'yorphives.hq.manual-experiment-plan.v1'"));
assert.ok(source.includes('experimentPlans:nano17Report('));
console.log('PASS: Phase 17 is pure read-only deterministic planning without API calls or D1 writes');
console.log('PASS: ten required evidence gates, actual proof requirements, no false approvals');
console.log('PASS: current vs stale founder plan, repository SHA changes, deferred candidates');
console.log('PASS: resource caps are planning only; no measured pricing or execution');
console.log('PASS: responsive research UI and local JSON export without server writes');
