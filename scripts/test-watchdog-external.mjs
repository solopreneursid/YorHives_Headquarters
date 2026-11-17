// External, unauthenticated contract check; GET-only and no personal data.
// Does NOT attempt to bypass HQ Access or write any production records.
import assert from 'node:assert/strict';
const WATCHDOG='https://yorphives-edge-watchdog.solopreneursid-proy.workers.dev';
const HQ='https://yorphives-hq-free-pilot.solopreneursid-proy.workers.dev';
async function get(url){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{return await fetch(url,{redirect:'manual',signal:ctrl.signal,
  headers:{'user-agent':'YorpHives-HQ-External-Evidence-Check/1.0',accept:'application/json'}});}
 finally{clearTimeout(timer)}
}
const current=await get(WATCHDOG+'/status');
assert.ok([200,503].includes(current.status),'Unexpected watchdog status '+current.status);
assert.match(current.headers.get('content-type')||'',/application\/json/i);
const latest=await current.json();
assert.equal(latest.available,true,'Watchdog has no unattended run yet');
assert.ok(Number.isFinite(Date.parse(latest.checkedAt)));
assert.equal(latest.checks.length,7);
assert.equal(latest.healthy===true,current.status===200,'Status code disagrees with reported health');
assert.ok(latest.checks.every(x=>typeof x.id==='string'&&typeof x.ok==='boolean'));
const history=await get(WATCHDOG+'/history');
assert.equal(history.status,200,'Watchdog history not available');
const body=await history.json();
assert.equal(body.schemaVersion,1);
assert.equal(body.available,true);
assert.ok(body.records.length>=1&&body.records.length<=24);
assert.ok(body.records.every(r=>typeof r.checkedAt==='string'&&Array.isArray(r.failedChecks)));
assert.equal(JSON.stringify(body).includes('sessionId'),false);
const denied=await get(HQ+'/api/edge-watchdog');
assert.ok([302,401,403].includes(denied.status),'Unauthenticated HQ endpoint exposed HTTP '+denied.status);
const demand=await get(HQ+'/api/agent-demand');
assert.ok([302,401,403].includes(demand.status),
 'Private aggregate agent demand exposed to unauthenticated request: '+demand.status);
assert.equal(demand.headers.get('access-control-allow-origin'),null,
 'Private HQ agent demand must not be CORS-enabled');
const unknown=await get(WATCHDOG+'/not-an-api');
assert.equal(unknown.status,404);
console.log('PASS: independent watchdog real Cron evidence, last '+body.records.length+' records, HQ watchdog guarded '+denied.status+', agent usage guarded '+demand.status+', no unauthenticated mutations.');
