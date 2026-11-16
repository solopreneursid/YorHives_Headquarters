#!/usr/bin/env node
// Phase 13: evaluate the actual read-only Worker triage functions with synthetic data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Nano Phase 13 — deterministic');
const end=source.indexOf('/* Nano Phase 16 — founder-initiated',start);
assert.ok(start>0&&end>start,'Phase 13 must be in current Worker source');
const code=source.slice(start,end);
for(const forbidden of ['fetch(','.run()', '.batch(','.exec(', 'env.AI', 'deploy(', 'POST', 'PUT ', 'DELETE ']){
 assert.equal(code.includes(forbidden),false,'Phase 13 must never mutate or fetch: '+forbidden);
}
const sandbox={URL,JSON,Array,String,Boolean,Object,Math,RegExp,
 clampText:(v,max=240)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,max),
 nano12RepoLink:(s)=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(s||''))?s:null,
 nano12PageUrl:(r)=>/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(String(r?.source_url||''))?r.source_url:null
};
runInNewContext(code+'\nthis.assess=nano13Assess;this.report=nano13Report;',sandbox);
const candidate={paper_id:'p1',paper_title:'Training reasoning models in simulation to use real robots',
 source_url:'https://arxiv.org/abs/2611.18562',repository_url:'https://github.com/mit-han-lab/pear',
 state:'repository-metadata-checked',license_spdx:'Apache-2.0',
 checked_at:'2026-11-16T17:00:00Z',facts_json:JSON.stringify({
  url:'https://github.com/mit-han-lab/pear',
  description:'training robotics with gpu simulation',
  discoveryMethod:'title-matched-github-search',archived:false,fork:false
 })};
const a=sandbox.assess(candidate);
assert.equal(a.licenseSpdx,'Apache-2.0');
assert.equal(a.licenseLegallyReviewed,false);
assert.equal(a.dependencyFilesInspected,false);
assert.equal(a.reproduced,false);
assert.equal(a.commerciallyApproved,false);
assert.equal(a.paperRelationshipVerified,false);
assert.equal(a.outcome,'defer-until-hardware-budget-established');
assert.equal(a.relationship,'title-search-candidate-unconfirmed');
assert.ok(a.blockers.some(x=>x.includes('matched a title search')));
assert.ok(a.steps.some(x=>x.includes('founder approval')));
assert.equal(a.hardwareBenchmarked,false);
assert.equal(a.dependencyDisposition,'not-inspected');
const unrelated={...candidate,paper_id:'p2',paper_title:'A small coding utility',
 source_url:'javascript:alert(1)',facts_json:JSON.stringify({url:candidate.repository_url,
 description:'small utility',archived:false})};
const b=sandbox.assess(unrelated);
assert.equal(b.paperUrl,'','unsafe paper URLs must never appear as clickable links');
assert.equal(b.hardwareDisposition,'hardware-requirements-unknown');
assert.equal(b.outcome,'manual-license-and-dependency-review-required');
const archived=sandbox.assess({...unrelated,facts_json:JSON.stringify({
 url:candidate.repository_url,archived:true,fork:true})});
assert.equal(archived.outcome,'defer-archived-repository');
assert.equal(archived.archived,true);
assert.ok(archived.blockers.some(x=>x.includes('fork')));
const noRepo=sandbox.assess({...candidate,repository_url:'https://attacker.example/bad'});
assert.equal(noRepo.repositoryUrl,null);
assert.equal(noRepo.outcome,'insufficient-source-evidence');
const wrongIdentity=sandbox.assess({...candidate,facts_json:JSON.stringify({
 url:'https://github.com/unrelated/other'})});
assert.equal(wrongIdentity.outcome,'insufficient-source-evidence');
assert.equal(wrongIdentity.repositoryUrl,null);
const invalidJson=sandbox.assess({...candidate,facts_json:'{{{bad'});
assert.equal(invalidJson.outcome,'insufficient-source-evidence');
const report=sandbox.report([candidate,unrelated,noRepo]);
assert.equal(report.reviewed,3);
assert.equal(report.sourceMetadataChecked,2);
assert.equal(report.highCostSignals,1);
assert.equal(report.fullyValidated,0);
assert.equal(report.automatedExecution,false);
assert.ok(report.scope.includes('NOT verified'));
const prefix='const PILOT_STATIC_BUNDLE = ',i=source.indexOf(prefix),j=source.indexOf(';\n',i);
assert.ok(i>0&&j>i);
const bundle=JSON.parse(source.slice(i+prefix.length,j));
const ui=bundle['/dashboard.js'];
assert.ok(ui.includes('function feasibilityPanel()'));
assert.equal((ui.match(/\$\{feasibilityPanel\(\)\}/g)||[]).length,1,
 'AI Employees must show Phase 13 review');
assert.ok(ui.includes('implementationEvidencePanel()+feasibilityPanel()+manifestEvidencePanel()+dependencySignalsPanel()+scienceEvidencePanel()'),
 'Research journals must show Phase 13 review');
assert.ok(ui.includes('Provisional research triage'));
assert.ok(ui.includes('esc(e.licenseDisposition'));
assert.ok(source.includes('feasibilityReviews:nano13Report(implementationRows.results||[])'));
console.log('PASS: Phase 13 metadata-only cautious classification and hardware signals');
console.log('PASS: no dependency/license/reproducibility false assurances or automatic execution');
console.log('PASS: title-match provenance warnings, archived/fork & untrusted URL guards');
console.log('PASS: research journals and AI Employees both show Phase 13 cards');
