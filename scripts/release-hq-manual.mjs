#!/usr/bin/env node
// Fail-closed HQ publisher: normal automatic GitHub CI or sensitive manual founder dispatch.
// Deployed HQ agents cannot call this, access GH deployment secrets, or change infrastructure.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {verify,gitBlob} from './verify-current-hq.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const info=JSON.parse(readFileSync(join(root,'hq-release.json'),'utf8'));
verify(); // Fail before network access if the reviewed source changed.
const env=process.env;
function fail(condition,message){if(!condition)throw Error(message)}
const manual=env.GITHUB_EVENT_NAME==='workflow_dispatch';
const auto=env.GITHUB_EVENT_NAME==='push'&&env.HQ_AUTO_RELEASE==='true';
fail(manual||auto,'Only founder-manual or scoped GitHub main-branch auto-release is allowed');
fail(env.GITHUB_REF==='refs/heads/main','Only the approved main branch may release');
if(manual)fail(env.HQ_FOUNDER_CONFIRMATION==='RELEASE_FOUR_BUTTON_HQ','Founder confirmation text required');
if(auto){
 fail(env.HQ_AUTO_SCOPE_OK==='true','Safe automatic release scope check is mandatory');
 // This script must NEVER be invoked directly in production without the upstream path gate.
 fail(Boolean(env.GITHUB_WORKFLOW_REF?.includes('/.github/workflows/hq-production-release.yml@refs/heads/main')),
  'Automated release must originate from the reviewed main-branch workflow');
}
fail(/^[0-9a-f]{40}$/.test(env.HQ_APPROVED_SOURCE_SHA||''),'Source commit SHA input invalid');
fail(env.HQ_APPROVED_SOURCE_SHA===env.GITHUB_SHA,'Approved SHA must match workflow checked-out commit');
if(manual)fail(env.EXPECTED_CURRENT_VERSION===info.sourceWorkerVersion,
  'Current Worker version must match the review manifest (prevents stale releases)');
fail(Boolean(env.HQ_RELEASE_TOKEN)&&Boolean(env.HQ_CLOUDFLARE_ACCOUNT_ID),
  'Missing founder-configured, scoped release token or Cloudflare account ID');

const worker=info.productionWorker;
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(env.HQ_CLOUDFLARE_ACCOUNT_ID);
const prefix=base+'/workers/scripts/'+encodeURIComponent(worker);
async function request(path,options={}){
 const headers=new Headers(options.headers||{});
 headers.set('Authorization','Bearer '+env.HQ_RELEASE_TOKEN);
 const response=await fetch(path,{...options,headers,redirect:'manual',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('Cloudflare '+(options.method||'GET')+' request failed HTTP '+response.status);
 return response;
}
async function data(path,opts){
 const response=await request(path,opts);
 const json=await response.json();
 if(json.success===false)throw Error('Cloudflare API rejected request (details intentionally redacted)');
 return json.result;
}
function parseModules(raw){
 const sep=String.fromCharCode(13,10);
 const boundary=raw.slice(0,raw.indexOf(sep));
 fail(boundary.startsWith('--')&&boundary.length<150,'Unexpected Worker multipart boundary');
 const modules=new Map();
 for(const part of raw.split(boundary).slice(1)){
  if(!part.includes('filename='))continue;
  const name=part.match(/filename="([^"]+)"/)?.[1],at=part.indexOf(sep+sep);
  fail(Boolean(name)&&at>=0,'Malformed Worker module');
  modules.set(name,part.slice(at+4).replace(new RegExp(sep+'$'),''));
 }
 return modules;
}
function sortedBindings(rows){return (rows||[]).map(x=>({name:x.name,type:x.type})).sort((a,b)=>a.name.localeCompare(b.name))}
function equalJson(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function sameSource(remote){
 const expected=new Map(Object.entries(info.moduleGitBlobs));
 if(remote.size!==expected.size)return false;
 return [...expected].every(([name,sha])=>remote.has(name)&&gitBlob(remote.get(name))===sha);
}
const deployments=await data(prefix+'/deployments');
const version=deployments?.deployments?.[0]?.versions?.[0]?.version_id;
if(manual)fail(version===env.EXPECTED_CURRENT_VERSION,'Live HQ version changed. Release denied.');
const parent=auto?execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim():null;
const bootstrap=auto&&parent==='fcad1341f06100d23f7ff6e50db0ff505de859e6';
if(bootstrap)fail(version===info.sourceWorkerVersion,'Bootstrap Worker version changed; release denied.');
const [settings,schedules]=await Promise.all([data(prefix+'/settings'),data(prefix+'/schedules')]);
fail(equalJson(sortedBindings(settings.bindings),sortedBindings(info.expectedBindings)),
 'Live bindings differ from reviewed inventory. Release denied.');
fail(settings.compatibility_date===info.compatibilityDate,'Compatibility date differs; release denied');
const currentSchedule=(schedules?.schedules||[]).map(x=>x.cron);
fail(equalJson(currentSchedule,info.expectedSchedules),'Live scheduler differs; release denied');
const sourceResponse=await request(prefix+'/content/v2');
const current=parseModules(await sourceResponse.text());
// For routine updates the previously merged main commit is the expected deployed
// source, so auto-release does not require hand-updating a Worker version after every deploy.
const priorManifest=auto&&!bootstrap?JSON.parse(execFileSync('git',['show','HEAD^:hq-release.json'],
 {encoding:'utf8',maxBuffer:300000})):null;
const pinnedLive=new Map(Object.entries(auto&&!bootstrap?
 (priorManifest?.moduleGitBlobs||{}):(info.liveModuleGitBlobs||{})));
fail(current.size===pinnedLive.size&&[...pinnedLive].every(([name,sha])=>current.has(name)&&gitBlob(current.get(name))===sha),
 'Currently deployed Worker module source drifted from founder-reviewed live baseline. Release denied.');

const local=new Map(Object.keys(info.moduleGitBlobs).map(name=>[name,readFileSync(join(root,'src',name),'utf8')]));
fail(local.size===8&&[...local].every(([name,src])=>gitBlob(src)===info.moduleGitBlobs[name]),
 'Local Worker module checksum changed. Release denied.');
if(sameSource(current)){
 console.log('PASS: live HQ modules already match approved private repo source; no deployment necessary.');
 process.exit(0);
}
const upload=new FormData();
const metadata={main_module:'hq-worker.mjs',compatibility_date:settings.compatibility_date,
 bindings:settings.bindings};
if(Array.isArray(settings.compatibility_flags))metadata.compatibility_flags=settings.compatibility_flags;
for(const [name,content] of local)upload.append(name,new Blob([content],{type:'application/javascript+module'}),name);
upload.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
await data(prefix,{method:'PUT',body:upload});
console.log('Cloudflare upload accepted. Checking deployed content after propagation.');
// Some Cloudflare regions briefly return 404 for /content/v2 immediately
// after a successful Worker PUT. Only retry the verification GET, NEVER the PUT.
// Do not retry an authorization failure or unexpected API response.
async function verifyPublishedModules(){
 const delays=[0,1500,2500,4000,6500,10000,15000];
 for(let i=0;i<delays.length;i++){
  if(delays[i])await new Promise(resolve=>setTimeout(resolve,delays[i]));
  try{
   const response=await request(prefix+'/content/v2');
   if(sameSource(parseModules(await response.text())))return;
   // Expected deployment may not have propagated yet; retry boundedly.
  }catch(error){
   if(!/^Error: Cloudflare GET request failed HTTP (404|408|429|500|502|503|504)$/.test(String(error)))
    throw error;
  }
  console.log('Deployed Worker verification pending; checking read-only endpoint again.');
 }
 throw Error('Upload was accepted, but source verification remained unavailable or differed after retries. Do NOT rerun publication before checking the live Worker version and source.');
}
await verifyPublishedModules();
const newSettings=await data(prefix+'/settings');
const newSchedules=await data(prefix+'/schedules');
fail(equalJson(sortedBindings(newSettings.bindings),sortedBindings(info.expectedBindings)),
 'Post-upload binding inventory mismatch');
fail(equalJson((newSchedules?.schedules||[]).map(x=>x.cron),info.expectedSchedules),
 'Post-upload scheduler mismatch');
const finalDeployment=await data(prefix+'/deployments');
console.log('PASS: '+(auto?'scoped automatic':'founder manual')+' HQ source deployed and verified. Version: '+
 (finalDeployment?.deployments?.[0]?.versions?.[0]?.version_id||'check Cloudflare dashboard'));
console.log('Limitations: authenticated founder browser and Cloudflare Access policies require separate checks.');
