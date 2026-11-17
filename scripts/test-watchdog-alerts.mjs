import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessWatchdogAlert,loadWatchdogEvidence,WATCHDOG_CHECK_IDS} from '../src/watchdog-evidence.mjs';
const asDate=minutes=>new Date(Date.parse('2026-11-17T09:00:00Z')-minutes*60000).toISOString();
const latest=(state='healthy',failed=[],ageMin=0)=>({
 available:true,state,checkedAt:asDate(ageMin),healthy:state==='healthy',
 failedChecks:failed,checks:WATCHDOG_CHECK_IDS.map(id=>({id,ok:!failed.includes(id)}))
});
const sample=(minutes,failed=[])=>({
 checkedAt:asDate(minutes),healthy:failed.length===0,failedChecks:failed
});
const clear=assessWatchdogAlert(latest());
assert.equal(clear.severity,'none');assert.equal(clear.actionable,false);
const first=assessWatchdogAlert(latest('degraded',['model']),[sample(0,['model']),sample(15,[])]);
assert.equal(first.kind,'first-observation');assert.equal(first.actionable,false);
const repeated=assessWatchdogAlert(latest('degraded',['model']),[
 sample(0,['model']),sample(15,['model']),sample(30,['model']),sample(45,[])]);
assert.equal(repeated.kind,'sustained-failure');assert.equal(repeated.actionable,true);
assert.deepEqual(repeated.affectedIds,['model']);
assert.equal(repeated.firstObserved,asDate(30));
assert.equal(repeated.incidentKey,'repeat:model:'+asDate(30));
const shifted=assessWatchdogAlert(latest('degraded',['model'],15),[
 sample(15,['model']),sample(30,['model']),sample(45,[])]);
assert.equal(shifted.incidentKey,repeated.incidentKey);
const changed=assessWatchdogAlert(latest('degraded',['growth']),[
 sample(0,['growth']),sample(15,['model'])]);
assert.equal(changed.actionable,false,'Different failures must not count as sustained');
const delayedRepeat=assessWatchdogAlert(latest('degraded',['model']),[
 sample(0,['model']),sample(45,['model'])]);
assert.equal(delayedRepeat.actionable,false,'Large gaps break repeated evidence');
const missingHistory=assessWatchdogAlert(latest('degraded',['model']),[]);
assert.equal(missingHistory.kind,'first-observation');assert.equal(missingHistory.actionable,false);
const stale=assessWatchdogAlert(latest('stale',[]));
assert.equal(stale.kind,'monitor-stale');assert.equal(stale.actionable,true);
assert.ok(stale.incidentKey.startsWith('monitor-stale:'));
const offline=assessWatchdogAlert({available:false});
assert.equal(offline.kind,'monitor-unverified');assert.equal(offline.actionable,false);
const fake=(current,history)=>({EDGE_WATCHDOG:{
 fetch:async request=>Response.json(request.url.endsWith('/status')?current:history,{status:200})
}});
const status={available:true,checkedAt:asDate(0),healthy:false,stale:false,failureStreak:2,
 checks:WATCHDOG_CHECK_IDS.map(id=>({id,ok:id!=='model'})),failedChecks:['model']};
const history={schemaVersion:1,available:true,records:[
 {...sample(15,['model']),failureStreak:1},
 {...sample(0,['model']),failureStreak:2}
]};
const actual=await loadWatchdogEvidence(fake(status,history),{now:()=>Date.parse(asDate(0))});
assert.equal(actual.alert.kind,'sustained-failure');assert.equal(actual.alert.actionable,true);
assert.equal(actual.readOnly,true);assert.equal(actual.automaticRemediation,false);
const code=readFileSync('src/hq-worker.mjs','utf8');
const prefix='const PILOT_STATIC_BUNDLE = ';
const i=code.indexOf(prefix)+prefix.length;
const assets=JSON.parse(code.slice(i,code.indexOf(';\n',i)));
const js=assets['/dashboard.js'];
assert.ok(js.includes('function watchdogAlertPanel(){'),'missing founder alert');
assert.ok(js.includes("kind==='sustained-failure'"),'must label sustained incident explicitly');
assert.ok(js.includes("button('watchdog-view-checks'"),'must offer clear next step');
assert.ok(js.includes("watchdogAlertPanel()+"),'must surface banner in Home and Control');
assert.ok(js.includes("new Notification('YorpHives HQ: website alert'"),'must opt in to browser notifications');
assert.ok(js.includes("store.set('watchdog-alert-last'"),'must dedupe alert notification');
new Function(js);
console.log('PASS: two independent same-probe failures, stale monitor, no-alert single failure, incident dedupe and founder UI.');
