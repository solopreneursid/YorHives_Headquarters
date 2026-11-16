#!/usr/bin/env node
// Exercise actual Phase 15 HQ Worker code on synthetic manifests, without downloading or executing source.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const a=source.indexOf('/* Nano Phase 14 — bounded'),b=source.indexOf('/* Nano Phase 13 — deterministic',a);
assert.ok(a>0&&b>a);
const code=source.slice(a,b);
const sha='a'.repeat(40),lsha='b'.repeat(40),repo='https://github.com/demo-org/robot-kit';
const vm={URL,JSON,Date,Set,Map,Array,String,Number,Boolean,Math,RegExp,atob,Uint8Array,TextDecoder,
 nano12RepoLink:x=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(x||''))?x:null,
 nano12PageUrl:x=>/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(String(x?.source_url||''))?x.source_url:null,
 clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n)};
runInNewContext(code+'\nObject.assign(this,{parse:nano15ParsePyproject,array:nano15StringArray,backfill:nano15BackfillFile,blob:nano14ParseBlob,assess:nano15Assess,report:nano15Report});',vm);
const text=[
 '[build-system]','requires = ["setuptools>=64"]',
 '[project]','name = "robot-kit"','dependencies = ["requests>=2", "torch>=2", "lerobot[feetech,kinematics]"]',
 '[project.optional-dependencies]','cuda = [','  "vllm", "cupy-cuda13x", # comment ]',
 '  "nvidia-cuda-nvcc", "flash-linear-attention", "torch",',']',
 'sim = ["mujoco", "gymnasium", "ray"]',
 '[dependency-groups]','dev = ["pytest", "ruff"]',
 '[tool.poetry.dependencies]','python = "^3.12"','pydantic = "^2"',
 '[tool.poetry.group.qa.dependencies]','pytest = "^8"',
 '[project.scripts]','install = "sudo npm install --unsafe"',
 '[unrelated]','dependencies = ["not-a-dependency"]'
].join('\n');
const parsed=vm.parse(text);
assert.equal(parsed.manifestParser,'pyproject-declared-subset-v1');
assert.equal(parsed.runtimeNamesObserved,4);
assert.ok(parsed.optionalOrGroupNamesObserved>=7);
assert.ok(parsed.directNamesObserved>=9);
assert.ok(parsed.computeSignals.includes('possible-gpu-or-accelerator-stack'));
assert.ok(parsed.computeSignals.includes('robotics-or-simulation'));
assert.ok(parsed.computeSignals.includes('training-or-distributed-tools'));
assert.ok(parsed.exampleNames.includes('requests'));
assert.ok(!parsed.exampleNames.includes('setuptools'));
assert.ok(!parsed.exampleNames.includes('not-a-dependency'));
assert.equal(JSON.stringify(parsed).includes('sudo npm install'),false);
assert.equal(vm.array('["torch[extra]", "# is a string", # outside ]\n "jax" ]').complete,true);
assert.equal(vm.array('["bad"').complete,false);
const file={path:'pyproject.toml',kind:'manifest',sha,size:Buffer.byteLength(text)};
const payload={sha,size:file.size,encoding:'base64',content:Buffer.from(text).toString('base64')};
const observed=vm.blob(payload,file);
assert.equal(observed.contentExecuted,false);
assert.equal(observed.manifestParser,'pyproject-declared-subset-v1');
assert.ok(JSON.stringify(observed).length<1800);
assert.equal(JSON.stringify(observed).includes('sudo npm install'),false);
const old={...observed,manifestParser:'manifest-observed-not-parsed'};
assert.equal(vm.backfill(JSON.stringify([file]),JSON.stringify([old])).sha,sha);
assert.equal(vm.backfill([file],[old]).sha,sha);
assert.equal(vm.backfill([file],[observed]),null);
const paper={paper_id:'p1',paper_title:'Robotics experiment',source_url:'https://arxiv.org/abs/2611.18562',
 repository_url:repo,state:'repository-metadata-checked',license_spdx:'Apache-2.0',
 facts_json:JSON.stringify({url:repo,discoveryMethod:'title-matched-github-search'})};
const stored={paper_id:'p1',repository_url:repo,checked_at:'2026-11-16T18:25:00Z',
 catalog_json:JSON.stringify([file,{path:'LICENSE',kind:'license',sha:lsha,size:480}]),
 evidence_json:JSON.stringify([observed,{path:'LICENSE',kind:'license',sha:lsha,bytes:480,licenseFileObserved:true}])};
const report=vm.report([paper],[stored]);const row=report.entries[0];
assert.equal(report.eligible,1);assert.equal(report.partiallyParsed,1);
assert.equal(report.computeSignalsObserved,1);
assert.equal(report.legallyApproved,0);
assert.equal(report.hardwareBenchmarked,0);
assert.equal(report.automatedExecution,false);
assert.equal(row.manifestSha,sha);
assert.equal(row.repoSpdx,'Apache-2.0');
assert.equal(row.licenseFileObserved,true);
assert.equal(row.paperRelationshipVerified,false);
assert.equal(row.commercialUseCleared,false);
assert.equal(row.codeExecuted,false);
assert.equal(row.measuredHardware,false);
assert.equal(row.completeDependencyInventory,false);
assert.ok(row.relationship.includes('NOT confirmed'));
assert.ok(row.cashCost.includes('unmeasured'));
assert.ok(row.steps.some(x=>x.includes('founder authorization')));
const stale=vm.assess(paper,{...stored,repository_url:'https://github.com/mismatched/repo'});
assert.equal(stale.manifestSha,null);
assert.equal(stale.licenseFileObserved,false);
const mismatch=vm.assess(paper,{...stored,catalog_json:JSON.stringify([{...file,sha:'c'.repeat(40)}])});
assert.equal(mismatch.manifestSha,null);
assert.equal(vm.report([paper],[]).partiallyParsed,0);
assert.equal(vm.report([{...paper,repository_url:'https://evil.example/ssrf'}],[stored]).eligible,0);
assert.equal(vm.parse('[project]\ndependencies = []').directNamesObserved,0);
const unparsed=vm.assess(paper,{...stored,evidence_json:JSON.stringify([old])});
assert.equal(unparsed.manifestParser,null);
assert.ok(unparsed.manifestStatus.includes('not yet parsed'));
const prefix='const PILOT_STATIC_BUNDLE = ',i=source.indexOf(prefix)+prefix.length,j=source.indexOf(';\n',i);
const ui=JSON.parse(source.slice(i,j))['/dashboard.js'];
assert.ok(ui.includes('function dependencySignalsPanel()'));
assert.ok(ui.includes('implementationEvidencePanel()+feasibilityPanel()+manifestEvidencePanel()+dependencySignalsPanel()+founderResearchPanel()+scienceEvidencePanel()'));
assert.ok(ui.includes('$'+'{dependencySignalsPanel()}'));
assert.ok(ui.includes('esc(e.manifestSha'));
assert.ok(ui.includes('No safely parsed names yet'));
assert.ok(source.includes('dependencySignals:nano15Report(implementationRows.results||[],manifestRows.results||[])'));
assert.ok(source.includes('nano15BackfillFile(x.catalog_json,x.evidence_json)'));
for(const forbidden of ['env.AI','child_process','eval(','spawn(','new Worker('])
 assert.equal(code.includes(forbidden),false,'No execution privileges: '+forbidden);
console.log('PASS: partial pyproject PEP621/Poetry/PEP735 declared dependency extraction');
console.log('PASS: optional groups vs runtime, comments, scripts and source-size bounds');
console.log('PASS: one-time SHA-pinned recheck of previously unparsed Python files');
console.log('PASS: no legal clearance, numeric hardware costs, execution, or author claims');
console.log('PASS: mobile-friendly evidence UI wired in both journals and AI team');
