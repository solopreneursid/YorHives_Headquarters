#!/usr/bin/env node
// Phase 18: actual Worker entry validation and report, no network or production writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const src=readFileSync('src/hq-worker.mjs','utf8');
const p14=src.indexOf('/* Nano Phase 14 — bounded');
const p13=src.indexOf('/* Nano Phase 13 — deterministic',p14);
const p18=src.indexOf('/* Nano Phase 18 — founder-submitted',p13);
const p17=src.indexOf('/* Nano Phase 17 — bounded',p18);
const p16=src.indexOf('/* Nano Phase 16 — founder-initiated',p17);
const p11=src.indexOf('/* Nano Phase 11 — scientific',p16);
assert.ok(p14>0&&p13>p14&&p18>p13&&p17>p18&&p16>p17&&p11>p16);
const code=src.slice(p18,p17);
for(const bad of ['fetch(', 'env.AI','child_process','deploy(','DELETE FROM','UPDATE nano_experiment_gate_evidence']){
 assert.ok(!code.includes(bad),'No external fetch/agent execution or overwritten evidence: '+bad);
}
const repo='https://github.com/demo-org/robot-kit',paper='phase18-paper';
const sha='a'.repeat(40);
const catalog=[{path:'pyproject.toml',kind:'manifest',sha,size:360}];
const facts={url:repo,discoveryMethod:'title-matched-github-search'};
const root={paper_id:paper,paper_title:'Robotics evidence experiment',
 state:'repository-metadata-checked',repository_url:repo,source_url:'https://arxiv.org/abs/2611.18562',
 source_id:'arxiv',license_spdx:'Apache-2.0',facts_json:JSON.stringify(facts),
 catalog_json:JSON.stringify(catalog),evidence_json:JSON.stringify([{
  path:'pyproject.toml',kind:'manifest',sha,bytes:360,
  manifestParser:'pyproject-declared-subset-v1',directNamesObserved:2,
  runtimeNamesObserved:1,optionalOrGroupNamesObserved:1,
  exampleNames:['torch','requests'],computeSignals:['possible-gpu-or-accelerator-stack']
 }]),saved_repository_url:repo,founder_version:1};
let selected={...root},writes=0,remoteCalls=0;
const reviews=[{paper_id:paper,repository_url:repo,manifest_sha:sha,version:1,
 disposition:'plan-isolated-test',license_concern:'unreviewed',technical_concern:'unknown',
 max_budget_inr:0,max_runtime_minutes:10,
 reason:'A manual review is still required.',next_step:'Review licenses before any test.',
 reviewed_at:'2026-11-17T00:00:00Z'}],records=[];
const sqls=[];
const db={prepare(sql){
 sqls.push(sql);
 if(sql.startsWith('SELECT i.*,p.title paper_title'))
  return {bind:id=>({first:async()=>id===selected.paper_id?{...selected}:null})};
 if(sql.startsWith('INSERT INTO nano_experiment_gate_evidence')){
  assert.ok(sql.includes('i.facts_json=?')&&sql.includes('MAX(revision)')&&sql.includes('MAX(version)'));
  assert.ok(sql.includes("m.evidence_json"));
  return {bind:(...params)=>({run:async()=>{
   writes++;
   assert.equal(params.length,18,'All SQL CAS placeholders must be bound');
   const [id,gate,innerGate,manifest,founderVersion,assessment,type,evidenceUrl,explanation,at,
    paperId,repop,factsJson,catalogJson,evidenceJson,expectedFounderVersion,lastGate,expectedVersion]=params;
   const latest=records.filter(r=>r.paper_id===paperId&&r.gate_key===gate).length;
   if(paperId!==selected.paper_id||repop!==selected.repository_url||
      innerGate!==gate||lastGate!==gate||selected.state!=='repository-metadata-checked'||
      factsJson!==selected.facts_json||catalogJson!==selected.catalog_json||
      evidenceJson!==selected.evidence_json||selected.founder_version!==founderVersion||
      expectedFounderVersion!==selected.founder_version||expectedVersion!==latest)
    return {meta:{changes:0}};
   records.push({entry_id:id,paper_id:paperId,gate_key:gate,revision:latest+1,
     repository_url:repop,manifest_sha:manifest,founder_review_version:founderVersion,
     assessment,evidence_type:type,evidence_url:evidenceUrl,explanation,recorded_at:at});
   return {meta:{changes:1}};
  }})};
 }
 throw Error('Unknown D1 query: '+sql);
}};
const vm={URL,JSON,Date,Map,Set,Array,Math,String,Number,Boolean,RegExp,
 crypto:webcrypto,Response,Request,atob,TextDecoder,Uint8Array,
 nowIso:()=>'2026-11-17T00:00:00Z',
 clampText:(v,n=240)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n),
 nano12RepoLink:v=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(v||''))?v:null,
 nano12PageUrl:v=>/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(v?.source_url||'')?v.source_url:null,
 json:(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}}),
 boundedText:async(req,max)=>{const x=await req.text();return x.length>max?null:x;},
 fetch:async()=>{remoteCalls++;throw Error('Phase 18 must never fetch links');}
};
runInNewContext(src.slice(p14,p13)+'\n'+src.slice(p18,p17)+'\n'+src.slice(p17,p16)+'\n'+src.slice(p16,p11)+
 '\nthis.validateUrl=nano18EvidenceUrl;this.save=nano18Save;this.report=nano18Report;',vm);
for(const input of [
 'http://github.com/demo-org/robot-kit','https://localhost/test',
 'https://127.0.0.1/whatever','https://example.local/foo',
 'https://private.internal/foo','https://user:secret@github.com/repo',
 'https://github.com/demo-org/repo?token=secret',
 'https://github.com/demo-org/repo#section',
 'javascript:alert(1)','file:///etc/hosts','https://github.com/a b',
 'https://[::1]/private','https://a.example/path'
])assert.equal(vm.validateUrl(input),null,'Reject untrusted or non-public link: '+input);
const link='https://github.com/demo-org/robot-kit/blob/main/LICENSE';
assert.equal(vm.validateUrl(link),link);
const env={DB:db,HQ_DECISIONS_ENABLED:'true'};
const payload={paperId:paper,gateKey:'licenses',expectedGateVersion:0,
 expectedFounderVersion:1,expectedManifestSha:sha,
 assessment:'evidence-submitted',evidenceType:'code-or-license',
 evidenceUrl:link,explanation:'The repository has a root license file, but dependency terms remain unreviewed.'};
function request(body,headers={}){
 return new Request('https://hq.example/api/experiment/evidence',
  {method:'POST',headers:{origin:'https://hq.example','x-hq-founder-action':'gate-evidence-v1',
   'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
}
async function save(body,headers={},ctx=env){
 const resp=await vm.save(request(body,headers),ctx);return {status:resp.status,...await resp.json()};
}
assert.equal((await save(payload,{origin:'https://attacker.example'})).status,403);
assert.equal((await save(payload,{'x-hq-founder-action':'unknown'})).status,403);
assert.equal((await save(payload,{'content-type':'text/plain'})).status,403);
assert.equal((await save('{bad')).status,400);
assert.equal((await save('a'.repeat(2001))).status,413);
assert.equal((await save(payload,{}, {...env,HQ_DECISIONS_ENABLED:'false'})).status,503);
assert.equal((await save({...payload,gateKey:'deploy'})).status,400);
assert.equal((await save({...payload,assessment:'verified'})).status,400);
assert.equal((await save({...payload,evidenceType:'approved'})).status,400);
assert.equal((await save({...payload,evidenceUrl:'http://example.com/private'})).status,400);
assert.equal((await save({...payload,evidenceUrl:'https://github.com/path?access_token=secret'})).status,400);
assert.equal((await save({...payload,expectedManifestSha:'c'.repeat(40)})).status,409);
assert.equal((await save({...payload,expectedFounderVersion:0})).status,409);
assert.equal((await save({...payload,paperId:'missing'})).status,404);
assert.equal(records.length,0);
let result=await save(payload);
assert.equal(result.status,201);
assert.equal(result.saved,true);
assert.equal(result.revision,1);
assert.equal(result.independentlyVerified,false);
assert.equal(result.licenseCleared,false);
assert.equal(result.executionAuthorized,false);
assert.equal(result.sourceFetched,false);
assert.equal(records.length,1);
assert.equal(records[0].evidence_url,link);
assert.equal((await save(payload)).status,409,'CAS prevents duplicate submitted gate versions');
result=await save({...payload,expectedGateVersion:1,assessment:'blocker-reported',
 explanation:'The downstream dependency rights have not been independently assessed.'});
assert.equal(result.status,201);
assert.equal(records.length,2);
assert.equal(records[0].revision,1);
assert.equal(records[1].revision,2);
const report=vm.report([selected],[{paper_id:paper,repository_url:repo,
 catalog_json:selected.catalog_json,evidence_json:selected.evidence_json}],reviews,records.slice().reverse(),true);
assert.equal(report.eligible,1);
assert.equal(report.recordedEntries,2);
assert.equal(report.currentGateEvidence,1);
assert.equal(report.currentBlockers,1);
assert.equal(report.independentlyVerified,0);
assert.equal(report.preflightReady,0);
assert.equal(report.executionAuthorized,false);
assert.equal(report.commercialUseApproved,false);
assert.equal(report.entries[0].gateCount,10);
const licenseGate=report.entries[0].gates.find(g=>g.key==='licenses');
assert.equal(licenseGate.revision,2);
assert.equal(licenseGate.latest.assessment,'blocker-reported');
assert.equal(licenseGate.latest.sourceCurrent,true);
assert.equal(licenseGate.latest.verifiedIndependently,false);
assert.equal(licenseGate.history.length,2);
assert.equal(report.entries[0].independentClearances,0);
const stale=vm.report([selected],[{paper_id:paper,repository_url:repo,
 catalog_json:selected.catalog_json,evidence_json:selected.evidence_json}],
 [{...reviews[0],version:2}],records,true);
assert.equal(stale.currentGateEvidence,0);
assert.equal(stale.staleGateEvidence,1);
assert.equal(stale.entries[0].gates.find(g=>g.key==='licenses').latest.sourceCurrent,false);
selected={...root,founder_version:2};
assert.equal((await save({...payload,expectedGateVersion:2})).status,409);
assert.equal(remoteCalls,0);
const prefix='const PILOT_STATIC_BUNDLE = ',a=src.indexOf(prefix)+prefix.length,b=src.indexOf(';\n',a);
const js=JSON.parse(src.slice(a,b))['/dashboard.js'];
assert.ok(js.includes('function experimentEvidencePanel()'));
assert.ok(js.includes('function submitGateEvidence(form)'));
assert.ok(js.includes('experimentPlansPanel()+experimentEvidencePanel()+scienceEvidencePanel()'));
assert.ok(js.includes('$'+'{experimentEvidencePanel()}'));
assert.ok(js.includes("classList.contains('gate-evidence-form')"));
assert.ok(src.includes('const gateEvidenceWrite=route==="/api/experiment/evidence"'));
assert.ok(src.includes('!researchReviewWrite&&!gateEvidenceWrite&&'));
assert.ok(src.includes('experimentGateEvidence:nano18Report('));
const migration=readFileSync('migrations/0014_nano_experiment_gate_evidence.sql','utf8');
assert.ok(migration.includes('UNIQUE(paper_id,gate_key,revision)'));
console.log('PASS: only same-origin founder writes; URL links are never fetched');
console.log('PASS: source/review/gate CAS and append-only immutable evidence history');
console.log('PASS: blockers and submitted links remain unverified, never legal/spend/execution approval');
console.log('PASS: 10 source-bound evidence gates, malformed URL rejection and no remote requests');
console.log('PASS: source-stale founder history identified and responsive HQ forms wired');
