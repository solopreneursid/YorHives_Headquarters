#!/usr/bin/env node
// Manual-only, fail-closed HQ Worker publisher. Not callable by deployed HQ agents.
// No deploy on push/PR. Require founder-approved GitHub environment and narrow token.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {verify,gitBlob} from './verify-current-hq.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const info=JSON.parse(readFileSync(join(root,'hq-release.json'),'utf8'));
verify(); // Fail before network access if the reviewed source changed.
const env=process.env;
function fail(condition,message){if(!condition)throw Error(message)}
fail(env.GITHUB_EVENT_NAME==='workflow_dispatch','Only a manual GitHub Actions release is allowed');
fail(env.GITHUB_REF==='refs/heads/main','Only the approved main branch may release');
fail(env.HQ_FOUNDER_CONFIRMATION==='RELEASE_FOUR_BUTTON_HQ','Founder confirmation text required');
fail(/^[0-9a-f]{40}$/.test(env.HQ_APPROVED_SOURCE_SHA||''),'Source commit SHA input invalid');
fail(env.HQ_APPROVED_SOURCE_SHA===env.GITHUB_SHA,'Approved SHA must match workflow checked-out commit');
fail(env.EXPECTED_CURRENT_VERSION===info.sourceWorkerVersion,
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
  modules.set(name,part.slice(at+4).replace(new RegExp(sep+'
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
fail(version===env.EXPECTED_CURRENT_VERSION,'Live HQ version changed. Release denied.');
const [settings,schedules]=await Promise.all([data(prefix+'/settings'),data(prefix+'/schedules')]);
fail(equalJson(sortedBindings(settings.bindings),sortedBindings(info.expectedBindings)),
 'Live bindings differ from reviewed inventory. Release denied.');
fail(settings.compatibility_date===info.compatibilityDate,'Compatibility date differs; release denied');
const currentSchedule=(schedules?.schedules||[]).map(x=>x.cron);
fail(equalJson(currentSchedule,info.expectedSchedules),'Live scheduler differs; release denied');
const sourceResponse=await request(prefix+'/content/v2');
const current=parseModules(await sourceResponse.text());
const local=new Map(Object.keys(info.moduleGitBlobs).map(name=>[name,readFileSync(join(root,'src',name),'utf8')]));
fail(local.size===4&&[...local].every(([name,src])=>gitBlob(src)===info.moduleGitBlobs[name]),
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
// Never log settings, source or token. Re-fetch exact modules after write.
const after=parseModules(await (await request(prefix+'/content/v2')).text());
fail(sameSource(after),'Post-upload HQ modules do not match the reviewed Git source');
const newSettings=await data(prefix+'/settings');
const newSchedules=await data(prefix+'/schedules');
fail(equalJson(sortedBindings(newSettings.bindings),sortedBindings(info.expectedBindings)),
 'Post-upload binding inventory mismatch');
fail(equalJson((newSchedules?.schedules||[]).map(x=>x.cron),info.expectedSchedules),
 'Post-upload scheduler mismatch');
const finalDeployment=await data(prefix+'/deployments');
console.log('PASS: manually approved HQ source deployed and verified. Version: '+
 (finalDeployment?.deployments?.[0]?.versions?.[0]?.version_id||'check Cloudflare dashboard'));
console.log('Limitations: authenticated founder browser and Cloudflare Access policies require separate checks.');
),''));
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
fail(version===env.EXPECTED_CURRENT_VERSION,'Live HQ version changed. Release denied.');
const [settings,schedules]=await Promise.all([data(prefix+'/settings'),data(prefix+'/schedules')]);
fail(equalJson(sortedBindings(settings.bindings),sortedBindings(info.expectedBindings)),
 'Live bindings differ from reviewed inventory. Release denied.');
fail(settings.compatibility_date===info.compatibilityDate,'Compatibility date differs; release denied');
const currentSchedule=(schedules?.schedules||[]).map(x=>x.cron);
fail(equalJson(currentSchedule,info.expectedSchedules),'Live scheduler differs; release denied');
const sourceResponse=await request(prefix+'/content/v2');
const current=parseModules(await sourceResponse.text());
const local=new Map(Object.keys(info.moduleGitBlobs).map(name=>[name,readFileSync(join(root,'src',name),'utf8')]));
fail(local.size===4&&[...local].every(([name,src])=>gitBlob(src)===info.moduleGitBlobs[name]),
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
// Never log settings, source or token. Re-fetch exact modules after write.
const after=parseModules(await (await request(prefix+'/content/v2')).text());
fail(sameSource(after),'Post-upload HQ modules do not match the reviewed Git source');
const newSettings=await data(prefix+'/settings');
const newSchedules=await data(prefix+'/schedules');
fail(equalJson(sortedBindings(newSettings.bindings),sortedBindings(info.expectedBindings)),
 'Post-upload binding inventory mismatch');
fail(equalJson((newSchedules?.schedules||[]).map(x=>x.cron),info.expectedSchedules),
 'Post-upload scheduler mismatch');
const finalDeployment=await data(prefix+'/deployments');
console.log('PASS: manually approved HQ source deployed and verified. Version: '+
 (finalDeployment?.deployments?.[0]?.versions?.[0]?.version_id||'check Cloudflare dashboard'));
console.log('Limitations: authenticated founder browser and Cloudflare Access policies require separate checks.');
