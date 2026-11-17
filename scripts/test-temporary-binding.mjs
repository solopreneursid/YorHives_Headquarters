import assert from 'node:assert/strict';
const endpoint='https://yorphives-watchdog-binding-check.solopreneursid-proy.workers.dev/check';
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
try{
 const r=await fetch(endpoint,{signal:ctrl.signal,redirect:'manual',headers:{accept:'application/json'}});
 const body=await r.json();
 assert.equal(r.status,200,'Direct Cloudflare service binding failed: '+JSON.stringify(body));
 assert.equal(body.ok,true);
 assert.equal(body.checks,7);
 assert.ok(body.historyCount>=1&&body.historyCount<=24);
 console.log('PASS: direct service binding returned '+body.checks+' checks, '+body.historyCount+' historical snapshots; temporary probe can be deleted.');
}finally{clearTimeout(timer);}
