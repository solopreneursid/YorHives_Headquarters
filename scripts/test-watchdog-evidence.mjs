import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadWatchdogEvidence,WATCHDOG_CHECK_IDS} from '../src/watchdog-evidence.mjs';
const now=Date.now();
const when=new Date(now-3*60000).toISOString();
const valid=()=>({available:true,checkedAt:when,healthy:true,stale:false,failureStreak:0,
 checks:WATCHDOG_CHECK_IDS.map(id=>({id,ok:true,latencyMs:135,rawIp:'never-expose'})),failedChecks:[]});
const recent=()=>({schemaVersion:1,available:true,records:[
 {checkedAt:new Date(now-18*60000).toISOString(),healthy:false,failedChecks:['model','unknown'],failureStreak:1,secret:'private'},
 {checkedAt:when,healthy:true,failedChecks:[],failureStreak:0,secret:'private'}]});
function adapter(status=valid(),history=recent(),statusHttp=200){
 const reads=[];
 const env={EDGE_WATCHDOG:{fetch:async request=>{
  assert.equal(request.method,'GET');assert.equal(request.headers.get('accept'),'application/json');
  assert.equal(new URL(request.url).host,'watchdog.internal');
  reads.push(new URL(request.url).pathname);
  const payload=request.url.endsWith('/history')?history:status;
  return new Response(JSON.stringify(payload),{status:request.url.endsWith('/history')?200:statusHttp,
    headers:{'content-type':'application/json'}});
 }}};
 return {env,reads};
}
const {env,reads}=adapter();
const healthy=await loadWatchdogEvidence(env,{now:()=>now});
assert.equal(healthy.available,true);assert.equal(healthy.state,'healthy');
assert.equal(healthy.checks.length,7);assert.deepEqual(reads.sort(),['/history','/status']);
assert.equal(healthy.history.length,2);
assert.deepEqual(healthy.history[1].failedChecks,['model']);
assert.equal(JSON.stringify(healthy).includes('private'),false);
assert.equal(JSON.stringify(healthy).includes('rawIp'),false);
const failed=valid();failed.healthy=false;failed.failureStreak=2;failed.checks[5]={id:'model',ok:false,reason:'http-500'};
const degraded=await loadWatchdogEvidence(adapter(failed,recent(),503).env,{now:()=>now});
assert.equal(degraded.state,'degraded');assert.equal(degraded.failureStreak,2);
assert.deepEqual(degraded.failedChecks,['model']);assert.equal(degraded.healthy,false);
const stale=valid();stale.checkedAt=new Date(now-60*60000).toISOString();
assert.equal((await loadWatchdogEvidence(adapter(stale).env,{now:()=>now})).state,'stale');
const corrupt=valid();corrupt.checks[0].id='unexpected';
assert.equal((await loadWatchdogEvidence(adapter(corrupt).env,{now:()=>now})).state,'unavailable');
const inconsistent=valid();inconsistent.checks[0].ok=false;
assert.equal((await loadWatchdogEvidence(adapter(inconsistent).env,{now:()=>now})).state,'unavailable');
const absent=await loadWatchdogEvidence({},{now:()=>now});
assert.equal(absent.state,'unavailable');
assert.equal(absent.reason,'watchdog-service-not-connected');
const statusOnly=await loadWatchdogEvidence(adapter(valid(),null).env,{now:()=>now});
assert.equal(statusOnly.state,'healthy');assert.equal(statusOnly.historyAvailable,false);
const worker=readFileSync('src/hq-worker.mjs','utf8');
assert.ok(worker.indexOf('await verifyAccess(request,env,ctx)')<worker.indexOf('if(route==="/api/edge-watchdog"'));
assert.ok(worker.includes('loadWatchdogEvidence(env)'));
assert.ok(readFileSync('src/watchdog-evidence.mjs','utf8').includes('EDGE_WATCHDOG'));
assert.equal(/\b(?:put|delete|post|patch)\s*\(/i.test(readFileSync('src/watchdog-evidence.mjs','utf8')),false);
const source=worker.slice(worker.indexOf('const PILOT_STATIC_BUNDLE = ')+ 'const PILOT_STATIC_BUNDLE = '.length);
const bundled=JSON.parse(source.slice(0,source.indexOf(';\n')));
const script=bundled['/dashboard.js'];
assert.ok(script.includes('function watchdogPanel(){'));
assert.ok(script.includes("fetch('/api/edge-watchdog'"));
assert.ok(script.includes("if(to==='control')void refreshWatchdog()"));
assert.ok(script.includes('data-action="edge-watchdog-refresh"')||script.includes("button('edge-watchdog-refresh'"));
assert.ok(script.includes('watchdogPanel()'));
new Function(script);
console.log('Watchdog HQ adapter tests passed: freshness, unhealthy 503, history safety, guarded route, mobile UI hooks.');
