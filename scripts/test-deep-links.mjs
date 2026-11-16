#!/usr/bin/env node
// Verify real Worker handler logic using synthetic authentication and no Cloudflare calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync('src/hq-worker.mjs','utf8');
const start=src.indexOf('export default {');
const end=src.lastIndexOf('export {DISCOVERY_ROLES');
assert.ok(start>0&&end>start,'Worker handler missing');
const handler=src.slice(start,end).replace('export default {','const worker={')+'\nthis.worker=worker;';
const build=authorized=>{
  const sandbox={Request,Response,URL,JSON_HEADERS:{'content-type':'application/json'},
    PILOT_STATIC_BUNDLE:{'/index.html':'<!doctype html><title>HQ</title>','/styles.css':'body{}'},
    verifyAccess:async()=>authorized};
  runInNewContext(handler,sandbox);
  return sandbox.worker;
};
const worker=build(true),guest=build(false);
const host='https://hq.example';
for(const path of ['/home','/discover','/team','/decisions','/growth','/control']){
  const response=await worker.fetch(new Request(host+path+'?utm_source=chatgpt.com'),{},null);
  assert.equal(response.status,302,path);
  assert.equal(response.headers.get('location'),host+'/#'+path.slice(1));
  assert.equal(response.headers.get('location').startsWith(host),true);
}
assert.equal((await worker.fetch(new Request(host+'/team/'),{},null)).headers.get('location'),host+'/#team');
const head=await worker.fetch(new Request(host+'/team',{method:'HEAD'}),{},null);
assert.equal(head.status,302);
const root=await worker.fetch(new Request(host+'/'),{},null);
assert.equal(root.status,200);
assert.equal(await root.text(),'<!doctype html><title>HQ</title>');
const asset=await worker.fetch(new Request(host+'/styles.css'),{},null);
assert.equal(asset.status,200);
const unknown=await worker.fetch(new Request(host+'/internal-secrets.txt'),{},null);
assert.equal(unknown.status,503,'Do not serve unrecognized paths');
const blocked=await guest.fetch(new Request(host+'/team'),{},null);
assert.equal(blocked.status,403,'Access gate must precede SPA redirects');
assert.equal(blocked.headers.get('location'),null,'Unauthorized request must never redirect to content');
const rejected=await worker.fetch(new Request(host+'/team',{method:'POST'}),{},null);
assert.equal(rejected.status,405,'Unapproved methods must stay rejected');
console.log('PASS: all six known deep links redirect to correct SPA pages');
console.log('PASS: query tags cannot change redirect origin');
console.log('PASS: Access gate precedes redirect, unknown paths remain unavailable');
console.log('PASS: root, static asset, HEAD and method safeguards retained');
