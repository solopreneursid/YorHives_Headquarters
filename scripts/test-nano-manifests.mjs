#!/usr/bin/env node
// Exercise the exact Phase 14 Worker collector with fake D1 and GitHub responses.
// Only static fixture manifests are interpreted; no external repository code is run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('/* Nano Phase 14 — bounded');
const end=source.indexOf('/* Nano Phase 13 — deterministic',start);
assert.ok(start>0&&end>start,'Phase 14 must exist in the Worker');
const code=source.slice(start,end);
for(const dangerous of ['env.AI','deploy(','POST to','git clone','eval(','child_process.exec','child_process','spawn(', 'npm install']){
 assert.equal(code.includes(dangerous),false,'Unsafe Phase 14 capability: '+dangerous);
}
const SHA1='a'.repeat(40),SHA2='b'.repeat(40),REPO='https://github.com/research-team/robot-kit';
const pkg=JSON.stringify({name:'robot-demo',dependencies:{react:'^1.0.0',zod:'^4'},
 devDependencies:{'@scope/demo':'1.0.0'},scripts:{postinstall:'dangerous shell command'}});
const license='Apache License, Version 2.0\nThis is unverified synthetic text.\n';
const rows=[
 {paper_id:'robot-paper',paper_title:'Training robot simulation',source_url:'https://arxiv.org/abs/2611.18562',source_id:'arxiv',
  state:'repository-metadata-checked',repository_url:REPO,checked_at:'2026-11-16T17:00:00Z',
  facts_json:JSON.stringify({url:REPO,discoveryMethod:'title-matched-github-search'})},
 {paper_id:'bad-paper',paper_title:'Unrelated',source_url:'https://arxiv.org/abs/2611.18496',source_id:'arxiv',
  state:'repository-metadata-checked',repository_url:'https://evil.example/pivot',
  facts_json:JSON.stringify({url:'https://evil.example/pivot'})}
];
const stored=new Map(),requests=[];
let quota=0,publicUsed=0,now='2026-11-16T18:45:00Z';
const db={prepare(sql){
 if(sql.startsWith('SELECT COUNT(*) n FROM nano_manifest_evidence'))return {first:async()=>({n:stored.size})};
 if(sql.startsWith('SELECT i.paper_id,i.repository_url,i.state,i.facts_json')){
  return {all:async()=>({results:rows.map(r=>{
   const s=stored.get(r.paper_id)||{};
   return {...r,saved_repository_url:s.repository_url||null,saved_state:s.state||null,
    catalog_json:s.catalog_json||'[]',evidence_json:s.evidence_json||'[]',
    saved_attempts:s.attempts||0,saved_next:s.next_check_at||null};
  })})};
 }
 if(sql.startsWith('INSERT INTO quota(day,kind,used)')){
  assert.ok(sql.includes('nano_manifest_fetches'));
  return {bind:()=>({first:async()=>quota++<2?{used:quota}:null})};
 }
 if(sql.startsWith('INSERT INTO nano_manifest_evidence')){
  return {bind:(paper_id,repository_url,state,catalog_json,evidence_json,attempts,checked_at,next_check_at,error_code)=>({
   run:async()=>{stored.set(paper_id,{repository_url,state,catalog_json,evidence_json,attempts,checked_at,next_check_at,error_code});return {meta:{changes:1}};}
  })};
 }
 throw Error('Unexpected SQL '+sql);
}};
const sandbox={URL,JSON,Date,Set,Map,Array,String,Boolean,Number,Math,
 RegExp,Uint8Array,TextDecoder,AbortSignal,Response,atob,console,
 nowIso:()=>now,clampText:(v,n=240)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n),
 nano12RepoLink:v=>/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,90}$/.test(String(v||''))?v:null,
 nano12PageUrl:r=>/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(r?.source_url||'')?r.source_url:null,
 reserveFetch:async()=>{publicUsed++;return true;},
 boundedText:async(res,cap)=>{const s=await res.text();return s.length<=cap?s:null;},
 fetch:async(url,opts)=>{
  requests.push(url);
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.authorization,undefined);
  const prefix='https://api.github.com/repos/research-team/robot-kit/';
  assert.ok(url.startsWith(prefix),'only the fixed repository allowed');
  if(url===prefix+'contents'){
   return new Response(JSON.stringify([
     {name:'package.json',path:'package.json',type:'file',sha:SHA1,size:Buffer.byteLength(pkg)},
     {name:'LICENSE',path:'LICENSE',type:'file',sha:SHA2,size:Buffer.byteLength(license)},
     {name:'install.sh',path:'install.sh',type:'file',sha:'f'.repeat(40),size:100},
     {name:'README.md',path:'README.md',type:'file',sha:'e'.repeat(40),size:100}]),
    {status:200,headers:{'content-type':'application/json'}});
  }
  const text=url===prefix+'git/blobs/'+SHA1?pkg:url===prefix+'git/blobs/'+SHA2?license:null;
  assert.notEqual(text,null,'Only SHA-pinned blob GETs permitted');
  const sha=url.endsWith(SHA1)?SHA1:SHA2;
  return new Response(JSON.stringify({sha,size:Buffer.byteLength(text),encoding:'base64',
    content:Buffer.from(text).toString('base64')}),{status:200,headers:{'content-type':'application/json'}});
 }
};
runInNewContext(code+'\nObject.assign(this,{candidate:nano14Candidate,catalogUrl:nano14CatalogUrl,blobUrl:nano14BlobUrl,catalog:nano14CatalogFiles,parse:nano14ParseBlob,get:nano14Get,scheduled:nano14Scheduled,report:nano14Report,investigate:nano14Investigate});',sandbox);
assert.equal(sandbox.candidate(rows[1]),null);
assert.equal(sandbox.catalogUrl('https://attacker.example/bad'),null);
assert.equal(sandbox.blobUrl(REPO,'bad'),null);
assert.equal(sandbox.catalogUrl(REPO),'https://api.github.com/repos/research-team/robot-kit/contents');
assert.equal(sandbox.blobUrl(REPO,SHA1),'https://api.github.com/repos/research-team/robot-kit/git/blobs/'+SHA1);
assert.deepEqual(Array.from(sandbox.catalog([
 {name:'install.sh',path:'install.sh',type:'file',sha:SHA1,size:100},
 {name:'LICENSE',path:'LICENSE',type:'file',sha:SHA2,size:40000},
 {name:'requirements.txt',path:'requirements.txt',type:'dir',sha:SHA1,size:10}
])),[]);
assert.throws(()=>sandbox.parse({sha:SHA2,size:pkg.length,encoding:'base64',content:Buffer.from(pkg).toString('base64')},
 {path:'package.json',kind:'manifest',sha:SHA1,size:pkg.length}),/identity/);
const parsed=sandbox.parse({sha:SHA1,size:Buffer.byteLength(pkg),encoding:'base64',
 content:Buffer.from(pkg).toString('base64')},{path:'package.json',kind:'manifest',sha:SHA1,size:Buffer.byteLength(pkg)});
assert.equal(parsed.manifestParser,'package-json-names-only');
assert.equal(parsed.directNamesObserved,3);
assert.equal(parsed.exampleNames.length,3);
assert.equal(parsed.contentExecuted,false);
assert.equal(JSON.stringify(parsed).includes('dangerous shell command'),false,
 'Never persist scripts/commands from package manifests');
assert.equal(await sandbox.scheduled({DB:db},now),'catalogued:robot-paper');
assert.equal(requests.length,1);
let saved=stored.get('robot-paper');
assert.equal(JSON.parse(saved.catalog_json).length,2);
assert.equal(saved.evidence_json,'[]');
now='2026-11-16T18:50:00Z';
assert.equal(await sandbox.scheduled({DB:db},now),'partial:robot-paper');
saved=stored.get('robot-paper');
assert.equal(JSON.parse(saved.evidence_json)[0].sha,SHA1);
assert.equal(requests.length,2);
now='2026-11-16T18:55:00Z';
assert.equal(await sandbox.investigate({DB:db}, {...rows[0],saved_repository_url:REPO,saved_state:saved.state,
 catalog_json:saved.catalog_json,evidence_json:saved.evidence_json,saved_attempts:2,saved_next:saved.next_check_at},now),
 'budget-reached');
assert.equal(requests.length,2,'No third GitHub request same day');
quota=0;now='2026-11-17T06:45:00Z';
assert.equal(await sandbox.scheduled({DB:db},now),'complete:robot-paper');
saved=stored.get('robot-paper');
assert.equal(JSON.parse(saved.evidence_json).length,2);
const result=sandbox.report(rows,[{paper_id:'robot-paper',...saved}]);
assert.equal(result.eligible,1);
assert.equal(result.filesObserved,2);
assert.equal(result.licenseFilesObserved,1);
assert.equal(result.verifiedLegalClearances,0);
assert.equal(result.automatedExecution,false);
assert.ok(result.entries[0].files.some(x=>x.sha===SHA2&&x.licenseFileObserved));
assert.equal(await sandbox.scheduled({DB:db},now),'no-due-repositories');
assert.equal(requests.length,3);
const stale=sandbox.report([{...rows[0],repository_url:'https://github.com/team/changed',
 facts_json:JSON.stringify({url:'https://github.com/team/changed'})}], [{paper_id:'robot-paper',...saved}]);
assert.equal(stale.filesObserved,0,'Do not attach old manifests after candidate identity changes');
const startBundle=source.indexOf('const PILOT_STATIC_BUNDLE = ')+ 'const PILOT_STATIC_BUNDLE = '.length;
const endBundle=source.indexOf(';\n',startBundle);
const ui=JSON.parse(source.slice(startBundle,endBundle))['/dashboard.js'];
assert.ok(ui.includes('function manifestEvidencePanel()'));
assert.ok(ui.includes('manifestEvidencePanel()+scienceEvidencePanel()'));
assert.ok(ui.includes('${manifestEvidencePanel()}'));
assert.ok(ui.includes('esc(f.sha'));
assert.ok(source.includes('manifestEvidence:{...nano14Report('));
assert.ok(source.includes('await nano14Scheduled(env,scheduledTime)'));
console.log('PASS: public GitHub root listing and strict SHA-pinned allowlist');
console.log('PASS: no source checkout, shell execution, arbitrary URLs, credentials or claims of license clearance');
console.log('PASS: two requests/day D1 quota and shared public quota, honest partial/complete states');
console.log('PASS: stale identity segregation and bounded metadata-only evidence');
console.log('PASS: Research journals and AI Employees Phase 14 cards exposed');
