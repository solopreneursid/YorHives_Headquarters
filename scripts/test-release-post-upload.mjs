#!/usr/bin/env node
// The release publisher is not run here. Exercise its real post-upload verifier
// against simulated temporary Cloudflare errors; no network, tokens or writes.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('./release-hq-manual.mjs',import.meta.url),'utf8');
assert.equal((src.match(/await data\(prefix,\{method:'PUT',body:upload\}\);/g)||[]).length,1,
 'Exactly one upload operation; retries must never repeat a write');
assert.match(src,/GITHUB_EVENT_NAME==='workflow_dispatch'/);
assert.match(src,/HQ_FOUNDER_CONFIRMATION==='RELEASE_FOUR_BUTTON_HQ'/);
assert.match(src,/HQ_APPROVED_SOURCE_SHA===env\.GITHUB_SHA/);
assert.match(src,/fail\(version===env\.EXPECTED_CURRENT_VERSION/);
const a=src.indexOf('async function verifyPublishedModules(){');
const b=src.indexOf('\nawait verifyPublishedModules();',a);
assert.ok(a>0&&b>a,'Missing post-upload GET verification');
const impl=src.slice(a,b);
function runner(response){
 const requests=[];
 const get=async (path)=>{
  requests.push(path);
  return response(requests.length);
 };
 const build=new Function('request','prefix','sameSource','parseModules','setTimeout',
  impl+'\nreturn verifyPublishedModules;');
 const verify=build(get,'/accounts/account-id/workers/scripts/hq',
  x=>x==='right-source',x=>x,
  fn=>{fn();return 1});
 return {verify,requests};
}
const transient=runner(n=>{
 if(n<3)throw new Error('Cloudflare GET request failed HTTP 404');
 return {text:async()=> 'right-source'};
});
await transient.verify();
assert.equal(transient.requests.length,3,'Temporary post-upload 404 should be retried');
assert.ok(transient.requests.every(x=>x.endsWith('/content/v2')));
const forbidden=runner(async ()=>{throw new Error('Cloudflare GET request failed HTTP 403')});
await assert.rejects(forbidden.verify(),/403/,'Access denials must not be retried');
assert.equal(forbidden.requests.length,1);
const permanent=runner(async ()=>{throw new Error('Cloudflare GET request failed HTTP 404')});
await assert.rejects(permanent.verify(),/Do NOT rerun publication/);
assert.equal(permanent.requests.length,7,'Post-upload verification attempts must be bounded');
console.log('PASS HQ manual release: retries read-only GET after temporary 404; never retries PUT or 403');
