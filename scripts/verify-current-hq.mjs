#!/usr/bin/env node
// Source-of-truth checks for the CURRENT four-button HQ, not historic HQpulse.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import assert from 'node:assert/strict';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const load=(p)=>readFileSync(join(root,p),'utf8');
export function gitBlob(content){
 const bytes=Buffer.from(content,'utf8');
 return createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length),Buffer.from([0]),bytes])).digest('hex');
}
export function asset(src,path){
 const tag='PILOT_STATIC_BUNDLE['+JSON.stringify(path)+'] = ';
 const i=src.lastIndexOf(tag);
 assert.ok(i>=0,'Missing embedded asset: '+path);
 const a=i+tag.length,b=src.indexOf(';'+String.fromCharCode(10),a);
 assert.ok(b>a,'Malformed embedded asset: '+path);
 return JSON.parse(src.slice(a,b));
}
export function verify(){
 const info=JSON.parse(load('hq-release.json'));
 assert.equal(info.schemaVersion,1);
 assert.equal(info.productionWorker,'yorphives-hq-free-pilot');
 assert.equal(info.releaseMethod.includes('workflow_dispatch'),true);
 const expected=Object.entries(info.moduleGitBlobs);
 assert.equal(expected.length,7,'Seven reviewed Worker modules required, including Products and Revenue intelligence');
 const imported=[];
 for(const [name,sha] of expected){
  const src=load('src/'+name);
  assert.equal(gitBlob(src),sha,'Source diverged from authorized snapshot: '+name);
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}/.test(src),
   'High-signal credential pattern in '+name);
  imported.push(name);
 }
 const hq=load('src/hq-worker.mjs');
 assert.match(hq,/from '\.\/products-ranker\.mjs'/,'Ranker must be imported');
 assert.match(hq,/from '\.\/revenue-intelligence\.mjs'/,'Revenue intelligence must be imported');
 assert.match(hq,/rankProducts\(products\.results/,'Evidence-ranked Products route missing');
 assert.match(hq,/product_intel_leads/,'Safe public source fallback links missing');
 const html=asset(hq,'/index.html');
 const js=asset(hq,'/hq-simple.js');
 const css=asset(hq,'/hq-simple.css');
 assert.match(html,/<meta name="robots" content="noindex">/);
 const nav=[...html.matchAll(/data-tab="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(nav,info.navigation,'UI must have exactly Home, Health, Products, Revenue');
 assert.ok(!html.includes('data-tab="discover"')&&!html.includes('data-tab="control"'));
 new Function(js); // syntax only; does not execute the browser application
 assert.match(js,/Verify signed-in session/);
 assert.match(js,/browserCheck/);
 assert.match(js,/credentials:'same-origin'/);
 assert.match(css,/max-width:600px|@media/,'Mobile CSS breakpoint must exist');
 for(const endpoint of ['/api/report','/api/health-self-check','/api/dependency-audit',
  '/api/tool-coverage','/api/hq-perimeter','/api/agent-demand','/api/revenue-intelligence']){
   assert.ok(hq.includes(endpoint),'Missing currently deployed endpoint '+endpoint);
 }
 assert.match(hq,/verifyAccess\(request,env,ctx\)/,'Auth guard must be enforced in the live source');
 assert.match(hq,/async scheduled\(/,'Cloudflare scheduled collector entrypoint required');
 assert.ok(hq.includes('sourceManifest')||hq.includes('sourceManifest:'),'Lockfile-aware OSV audit missing');
 assert.deepEqual(info.expectedSchedules,['*/5 * * * *']);
 const bindings=info.expectedBindings.map(x=>x.name).sort();
 assert.equal(bindings.length,9);
 assert.equal(new Set(bindings).size,9);
 assert.deepEqual(bindings,[
  'ACCESS_AUD','ACCESS_OWNER_EMAIL','ACCESS_TEAM_DOMAIN','AI','ANALYTICS_SQL',
  'DB','EDGE_WATCHDOG','HQ_DECISIONS_ENABLED','HQ_PERIMETER_MONITOR'].sort());
 return {worker:info.productionWorker,version:info.sourceWorkerVersion,modules:imported,
  nav,bindings:bindings.length,embeddedAssets:[html.length,js.length,css.length]};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const result=verify();
 console.log('PASS CURRENT HQ SOURCE '+JSON.stringify(result));
}
