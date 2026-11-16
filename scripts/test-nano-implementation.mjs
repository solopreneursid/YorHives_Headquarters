#!/usr/bin/env node
// Phase 12 collector tests execute current Worker functions against fake D1/HTTP.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Phase 12 — safe, first-party paper');
const end=source.indexOf('/* Nano Phase 11 — scientific evidence reviews',start);
const linkStart=source.indexOf('function nano10Link(');
const linkEnd=source.indexOf('function nano10CleanXml(',linkStart);
assert.ok(start>0&&end>start&&linkStart>0&&linkEnd>linkStart);
const code=source.slice(linkStart,linkEnd)+'\n'+source.slice(start,end);
assert.ok(!code.includes('env.AI.run')&&!code.includes('deploy('));
assert.ok(source.includes('await nano12Scheduled(env,scheduledTime)'));
assert.ok(source.includes('implementationEvidence:{...nano12Report('));
let now='2026-11-16T17:20:00.000Z';
let requestCount=0,quota=0,publicBudget=0;
const checks=new Map(),requests=[];
const papers=[
 {paper_id:'robot-paper',source_id:'arxiv',title:'Robot reasoning model from simulation',
  source_url:'https://arxiv.org/abs/2611.18562',published_at:'2026-11-13',research_priority:52},
 {paper_id:'lab-paper',source_id:'arxiv',title:'Automation and laboratory fault recovery',
  source_url:'https://arxiv.org/abs/2611.18496',published_at:'2026-11-13',research_priority:47},
 {paper_id:'crossref-paper',source_id:'crossref',title:'Old publisher chapter',
  source_url:'https://doi.org/10.1007/978-3-030-79997-7_24',published_at:'2021-01-01',research_priority:25}
];
const db={prepare(sql){
 if(sql.startsWith('SELECT COUNT(*) n FROM nano_implementation_checks'))
  return {first:async()=>({n:checks.size})};
 if(sql.startsWith('SELECT p.paper_id,p.source_id,p.source_url,p.title'))
  return {all:async()=>({results:papers.map(p=>({...p,...(checks.get(p.paper_id)||{})}))})};
 if(sql.startsWith('INSERT INTO quota(day,kind,used)')){
  assert.ok(sql.includes('nano_implementation_fetches'));
  return {bind:()=>({first:async()=>quota++<2?{used:quota}:null})};
 }
 if(sql.startsWith('INSERT INTO nano_implementation_checks'))
  return {bind:(paper_id,state,repository_url,license_spdx,facts_json,attempts,checked_at,next_check_at)=>({
   run:async()=>{checks.set(paper_id,{paper_id,state,repository_url,license_spdx,
    facts_json,attempts,checked_at,next_check_at});return {meta:{changes:1}};}
  })};
 throw Error('Unexpected SQL '+sql);
}};
const page='<html><body><a href="https://github.com/research-team/robot-kit">Source code</a>'+
 '<a href="http://evil.example/redirect">Unsafe</a></body></html>';
const repo={full_name:'research-team/robot-kit',html_url:'https://github.com/research-team/robot-kit',
 private:false,archived:false,disabled:false,fork:false,default_branch:'main',
 description:'Unverified repository demo',license:{spdx_id:'Apache-2.0'},pushed_at:'2026-11-15T08:00:00Z'};
const sandbox={URL,Date,Map,Set,String,Number,JSON,Response,AbortSignal,console,
 nowIso:()=>now,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 reserveFetch:async()=>{publicBudget++;return true;},
 boundedText:async(r,max)=>{const value=await r.text();return value.length<=max?value:null;},
 fetch:async(url,opts)=>{
  requestCount++;requests.push(url);
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.authorization,undefined);
  if(url==='https://arxiv.org/abs/2611.18562')
   return new Response(page,{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
  if(url.startsWith('https://api.github.com/search/repositories?')){
   assert.ok(url.includes('per_page=4'));
   return new Response(JSON.stringify({items:[{...repo,description:papers[1].title}]}),
      {status:200,headers:{'content-type':'application/json'}});
  }
  if(url==='https://api.github.com/repos/research-team/robot-kit')
   return new Response(JSON.stringify(repo),{status:200,headers:{'content-type':'application/json'}});
  throw Error('Unapproved fetch: '+url);
 }};
runInNewContext(code+'\nthis.repo=nano12RepoLink;this.links=nano12ExtractRepo;this.fact=nano12RepoFacts;this.page=nano12PageUrl;this.api=nano12ApiUrl;this.scheduled=nano12Scheduled;this.investigate=nano12Investigate;this.report=nano12Report;this.get=nano12Get;this.searchUrl=nano12SearchUrl;this.search=nano12SearchCandidate;',sandbox);
const bad=['http://github.com/team/tool','https://github.com.evil.com/team/tool',
 'https://github.com/team/tool/tree/main','https://github.com/team/tool?token=1',
 'https://user:pass@github.com/team/tool','https://github.com/team/repo#token',
 'https://github.com/team'];
for(const url of bad)assert.equal(sandbox.repo(url),null,url);
assert.equal(sandbox.repo('https://github.com/research-team/robot-kit'),
 'https://github.com/research-team/robot-kit');
assert.equal(sandbox.links('<div><a href="https://github.com/team/tool">Code</a></div>'),
 'https://github.com/team/tool');
assert.equal(sandbox.links('<a href="https://attacker.example/team/repo">Unsafe</a>'),null);
assert.equal(sandbox.page(papers[2]),null,'Publisher DOI links must not be crawled');
const query=sandbox.searchUrl(papers[1].title);
assert.ok(query.startsWith('https://api.github.com/search/repositories?q=%22Automation'));
assert.equal(sandbox.search({items:[{...repo,description:'Unrelated robotic task'}]},papers[1].title),null);
const exact=sandbox.search({items:[{...repo,description:papers[1].title}]},papers[1].title);
assert.equal(exact.url,'https://github.com/research-team/robot-kit');
assert.equal(exact.independentlyLicenseReviewed,false);

assert.throws(()=>sandbox.fact({...repo,html_url:'https://github.com/attacker/other'},
 'https://github.com/research-team/robot-kit'),/identity/);
assert.throws(()=>sandbox.fact({...repo,private:true},
 'https://github.com/research-team/robot-kit'),/identity/);
const facts=sandbox.fact(repo,'https://github.com/research-team/robot-kit');
assert.equal(facts.licenseReported,'Apache-2.0');
assert.equal(facts.independentlyLicenseReviewed,false);
assert.equal(facts.implementationTested,false);
assert.equal(facts.sourceCodeInspected,false);
const env={DB:db};
assert.equal(await sandbox.scheduled(env,'2026-11-16T17:20:00Z'),'repository-link-observed:robot-paper');
assert.equal(requestCount,1);assert.equal(checks.get('robot-paper').repository_url,
 'https://github.com/research-team/robot-kit');
now='2026-11-16T17:25:00.000Z';
assert.equal(await sandbox.scheduled(env,'2026-11-16T17:25:00Z'),'repository-metadata-checked:robot-paper');
assert.equal(requestCount,2);
const check=checks.get('robot-paper');
assert.equal(check.license_spdx,'Apache-2.0');
assert.equal(JSON.parse(check.facts_json).sourceCodeInspected,false);
assert.equal(publicBudget,2);
assert.equal(await sandbox.scheduled(env,'2026-11-16T17:30:00Z'),'outside-window');
await assert.rejects(()=>sandbox.get(env,'https://arxiv.org/abs/2611.18496','paper'),
 /implementation-daily-budget/);
assert.equal(requestCount,2);
assert.equal(await sandbox.scheduled(env,'2026-11-16T18:25:00Z'),'outside-window');
await assert.rejects(()=>sandbox.get(env,'https://evil.example/bad','paper'),/not-approved/);
assert.equal(requestCount,2);
assert.equal(checks.size,1,'No synthetic code artifacts should be inserted');
const report=sandbox.report([{...check,paper_title:'Robot reasoning',source_url:papers[0].source_url}]);
assert.equal(report.metadataChecked,1);
assert.equal(report.linked,1);
assert.equal(report.entries[0].licenseSpdx,'Apache-2.0');
assert.equal(report.entries[0].reproducibilityVerified,false);
assert.equal(report.entries[0].licenseLegallyReviewed,false);
assert.equal(report.entries[0].repositoryAuthorVerified,false);
assert.ok(report.scope.includes('not verified'));
const withheld=sandbox.fact({...repo,license:{spdx_id:'NOASSERTION'}},'https://github.com/research-team/robot-kit');
assert.equal(withheld.licenseReported,null);
// A previously checked paper page is eligible for a single title search,
// without pretending a matching repository is a paper-linked implementation.
quota=0;
now='2026-11-16T17:35:00.000Z';
const past={state:'no-repository-link-observed',attempts:1,repository_url:null,
 next_check_at:'2026-11-23T17:25:47.000Z'};
assert.equal(await sandbox.investigate(env,papers[1],past,now),
 'repository-metadata-checked:lab-paper');
const searched=checks.get('lab-paper');
assert.equal(searched.license_spdx,'Apache-2.0');
assert.equal(JSON.parse(searched.facts_json).discoveryMethod,'title-matched-github-search');
assert.ok(JSON.parse(searched.facts_json).metadataSource.includes('NOT linked'));
assert.equal(JSON.parse(searched.facts_json).independentReplication,false);
assert.equal(requestCount,3);
assert.equal(await sandbox.investigate(env,papers[1],searched,now),'not-due');

console.log('PASS: fixed paper and GitHub API targets, no SSRF, credentials or redirects');
console.log('PASS: observed public code link is not author identity or source-code verification');
console.log('PASS: GitHub license metadata does not imply legal/license compliance');
console.log('PASS: two-stage one-fetch-per-Cron checks with 2/day atomic D1 quota');
console.log('PASS: exact-title GitHub search fallback preserves author/link uncertainty');
console.log('PASS: no PDF, deployment, code execution, model inference or independent scientific claims');
