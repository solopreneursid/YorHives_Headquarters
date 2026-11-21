#!/usr/bin/env node
// READ-ONLY token and source-of-truth preflight. Deliberately contains no deployment requests.
// All Cloudflare requests below use GET. Secret values and Worker source are NEVER logged.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {verify,gitBlob} from './verify-current-hq.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const release=JSON.parse(readFileSync(join(root,'hq-release.json'),'utf8'));
assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch','Must be run manually');
assert.equal(process.env.GITHUB_REF,'refs/heads/main','Only main may run preflight');
verify(); // Validates exact source snapshot before any network requests.

const token=process.env.HQ_RELEASE_TOKEN;
const account=process.env.HQ_CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Missing hq-production environment secret(s)');
if(!/^[a-f0-9]{32}$/i.test(account))throw Error('HQ_CLOUDFLARE_ACCOUNT_ID is not a valid account identifier');

const worker=release.productionWorker;
const api='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
async function get(path){
 const res=await fetch(api+path,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw Error('Cloudflare read-only endpoint returned HTTP '+res.status+' for an authorized HQ endpoint');
 return res;
}
async function json(path){
 const data=await (await get(path)).json();
 if(data?.success===false||!data?.result)throw Error('Cloudflare read-only response invalid for '+path.split('/').at(-1));
 return data.result;
}
const [deployment,settings,schedules,content]=await Promise.all([
 json(encodeURIComponent(worker)+'/deployments'),
 json(encodeURIComponent(worker)+'/settings'),
 json(encodeURIComponent(worker)+'/schedules'),
 get(encodeURIComponent(worker)+'/content/v2').then(r=>r.text()),
]);
const live=deployment.deployments?.[0]?.versions?.[0]?.version_id;
assert.equal(live,release.sourceWorkerVersion,'Live HQ Worker version changed; review before any release');
assert.equal(settings.compatibility_date,release.compatibilityDate,'HQ compatibility date changed');
const sorted=(xs)=>xs.map(x=>({name:x.name,type:x.type})).sort((a,b)=>a.name.localeCompare(b.name));
assert.deepEqual(sorted(settings.bindings||[]),sorted(release.expectedBindings),'Live HQ binding names/types changed');
assert.deepEqual((schedules.schedules||[]).map(x=>x.cron),release.expectedSchedules,'Live HQ cron changed');

// Verify actual remote source modules, without printing Worker code or bindings.
const crlf='\r\n';
const boundary=content.slice(0,content.indexOf(crlf));
assert.ok(boundary.startsWith('--')&&boundary.length<150,'Unexpected Cloudflare multipart format');
const modules=new Map();
for(const part of content.split(boundary).slice(1)){
 if(!part.includes('filename='))continue;
 const name=part.match(/filename="([^"]+)"/)?.[1],split=part.indexOf(crlf+crlf);
 assert.ok(name&&split>=0,'Malformed remote Worker module');
 modules.set(name,part.slice(split+4).replace(new RegExp(crlf+'$'),''));
}
assert.equal(modules.size,6,'Unexpected current live module count');
for(const [name,sha] of Object.entries(release.liveModuleGitBlobs)){
 assert.ok(modules.has(name),'Missing deployed module '+name);
 assert.equal(gitBlob(modules.get(name)),sha,'Deployed source differs from approved snapshot for '+name);
}

// A separate, already-known Worker must be inaccessible to this HQ-only token.
// Do not request its code. Check only its deployment metadata. No mutation.
const other='yorphives-edge-watchdog';
assert.notEqual(other,worker);
const denied=await fetch(api+encodeURIComponent(other)+'/deployments',{
 method:'GET',headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(15000),
});
if(denied.status===200)throw Error('SCOPE FAILURE: HQ release token can also read another Worker');
if(![403,404].includes(denied.status))throw Error('Unable to verify Worker isolation; cross-Worker request returned HTTP '+denied.status);
await denied.body?.cancel();

console.log('PASS HQ TOKEN PREFLIGHT (read-only): approved Worker readable, source/bindings/version/schedule matched, other Worker access denied.');
console.log('This workflow sends GET requests only and makes no deployment, access-policy, database, or secret changes.');
