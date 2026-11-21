#!/usr/bin/env node
import assert from 'node:assert/strict';
import {eligibleFiles,withoutEmbeddedUi} from './check-hq-auto-scope.mjs';
const old='const ACL=true;\nPILOT_STATIC_BUNDLE["/hq-simple.js"] = "old UI";\nPILOT_STATIC_BUNDLE["/hq-simple.css"] = "body{}";\n';
const ui='const ACL=true;\nPILOT_STATIC_BUNDLE["/hq-simple.js"] = "new UI";\nPILOT_STATIC_BUNDLE["/hq-simple.css"] = "body{padding:3px}";\n';
const compromised='const ACL=false;\nPILOT_STATIC_BUNDLE["/hq-simple.js"] = "new UI";\nPILOT_STATIC_BUNDLE["/hq-simple.css"] = "body{padding:3px}";\n';
const base={parent:'another_commit',oldWorker:old,newWorker:ui};
assert.equal(withoutEmbeddedUi(old),withoutEmbeddedUi(ui),'Static assets may change without backend mutation');
assert.notEqual(withoutEmbeddedUi(old),withoutEmbeddedUi(compromised),'Runtime backend must not auto-release');
assert.equal(eligibleFiles({...base,changed:['src/revenue-intelligence.mjs','hq-release.json','scripts/test-revenue-intelligence.mjs']}).eligible,true);
assert.equal(eligibleFiles({...base,changed:['src/hq-worker.mjs','hq-release.json']}).eligible,true);
assert.equal(eligibleFiles({...base,newWorker:compromised,changed:['src/hq-worker.mjs','hq-release.json']}).eligible,false);
for(const file of ['src/revenue-research.mjs','src/product-intelligence.mjs','scripts/release-hq-manual.mjs','.github/workflows/hq-production-release.yml','src/watchdog-evidence.mjs']){
 assert.equal(eligibleFiles({...base,changed:[file,'hq-release.json']}).eligible,false,'Sensitive change blocked: '+file);
}
assert.equal(eligibleFiles({...base,changed:['docs/safe.md']}).eligible,false,'Docs alone do not redeploy');
assert.equal(eligibleFiles({...base,changed:['hq-release.json']}).eligible,false,'Manifest alone does not redeploy');
const bootstrap=eligibleFiles({parent:'fcad1341f06100d23f7ff6e50db0ff505de859e6',changed:[
 '.github/workflows/hq-production-release.yml','scripts/release-hq-manual.mjs',
 'scripts/check-hq-auto-scope.mjs','scripts/test-hq-auto-scope.mjs','docs/HQ_AUTOMATIC_RELEASES.md']});
assert.equal(bootstrap.eligible,true,'Explicitly pinned one-time pipeline bootstrap permitted');
assert.equal(eligibleFiles({parent:'not-bootstrap',changed:['.github/workflows/hq-production-release.yml']}).eligible,false);
console.log('PASS safe auto-release scope: UI-only and model changes accepted; backend, secrets, workflows and scanner changes denied');
