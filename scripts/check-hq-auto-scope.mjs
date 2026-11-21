#!/usr/bin/env node
// GitHub CI-only gate. HQ runtime cannot call this or deploy itself.
// Routine changes auto-release; auth, Worker backend, collectors, workflows and secrets never do.
import {readFileSync,appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const BOOTSTRAP_PARENT='fcad1341f06100d23f7ff6e50db0ff505de859e6';
const BOOTSTRAP_FILES=new Set([
 '.github/workflows/hq-production-release.yml',
 'scripts/release-hq-manual.mjs',
 'scripts/check-hq-auto-scope.mjs',
 'scripts/test-hq-auto-scope.mjs',
 'scripts/test-release-post-upload.mjs',
 'docs/HQ_AUTOMATIC_RELEASES.md'
]);
const ROUTINE_FILES=new Set([
 'src/products-ranker.mjs',
 'src/revenue-intelligence.mjs',
 'src/hq-worker.mjs',
 'hq-release.json'
]);
const UI_PATHS=['/hq-simple.js','/hq-simple.css','/hq-simple.html'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:3e6}).trim();
export function withoutEmbeddedUi(src){
 let text=String(src);
 for(const path of UI_PATHS){
  const prefix='PILOT_STATIC_BUNDLE['+JSON.stringify(path)+'] = ';
  const a=text.indexOf(prefix);if(a<0)continue;
  const start=a+prefix.length,end=text.indexOf(';\n',start);
  if(end<0)throw Error('Malformed embedded HQ asset: '+path);
  // Remove content but not the assignment itself; any Worker backend changes still show.
  JSON.parse(text.slice(start,end));
  text=text.slice(0,start)+'"__HQ_STATIC_ONLY__"'+text.slice(end);
 }
 return text;
}
export function eligibleFiles({changed=[],parent='',oldWorker='',newWorker=''}={}){
 if(!Array.isArray(changed)||!changed.length)return {eligible:false,reason:'No changes'};
 if(parent===BOOTSTRAP_PARENT&&changed.every(x=>BOOTSTRAP_FILES.has(x)))
  return {eligible:true,reason:'One-time verified auto-release bootstrap'};
 const allowed=x=>ROUTINE_FILES.has(x)||/^scripts\/test-[a-z0-9-]+\.mjs$/.test(x)||x.startsWith('docs/');
 if(changed.some(x=>!allowed(x)))return {eligible:false,reason:'Sensitive code or release configuration changed; use manual release'};
 if(!changed.some(x=>x.startsWith('src/')))return {eligible:false,reason:'Documentation, tests or manifest only; no Worker changes'};
 if(changed.includes('src/hq-worker.mjs')){
  try{if(withoutEmbeddedUi(oldWorker)!==withoutEmbeddedUi(newWorker))
   return {eligible:false,reason:'Worker backend changed; manual release required'};}
  catch{return {eligible:false,reason:'Unable to prove UI-only Worker change'};}
 }
 return {eligible:true,reason:'Reviewed source and UI-only scope'};
}
function main(){
 const parent=git('rev-parse','HEAD^');
 const changed=git('diff','--name-only','HEAD^','HEAD').split('\n').filter(Boolean);
 const workerChanged=changed.includes('src/hq-worker.mjs');
 const result=eligibleFiles({changed,parent,
  oldWorker:workerChanged?git('show','HEAD^:src/hq-worker.mjs'):'',
  newWorker:workerChanged?readFileSync('src/hq-worker.mjs','utf8').trim():''});
 const out=process.env.GITHUB_OUTPUT;if(out)appendFileSync(out,'eligible='+(result.eligible?'true':'false')+'\n');
 console.log((result.eligible?'AUTO RELEASE ELIGIBLE: ':'MANUAL RELEASE REQUIRED: ')+result.reason);
 console.log('Changed paths: '+changed.join(', '));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
