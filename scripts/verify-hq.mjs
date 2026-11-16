#!/usr/bin/env node
// Dependency-free, offline HQ source and frontend integrity checks.
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const sourcePath = 'src/hq-worker.mjs';
const worker = readFileSync(sourcePath, 'utf8');
const syntax = spawnSync(process.execPath, ['--check', sourcePath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || 'Worker syntax check failed');

const marker = 'const PILOT_STATIC_BUNDLE = ';
const start = worker.indexOf(marker);
assert.ok(start >= 0, 'Static dashboard bundle missing');
const first = worker.indexOf('{', start + marker.length);
assert.ok(first >= 0, 'Static bundle object missing');
let depth = 0;
let quoted = false;
let escaped = false;
let last = -1;
for (let i = first; i < worker.length; i++) {
  const char = worker[i];
  if (quoted) {
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') quoted = false;
  } else if (char === '"') quoted = true;
  else if (char === '{') depth++;
  else if (char === '}' && --depth === 0) { last = i + 1; break; }
}
assert.ok(last > first, 'Static bundle is incomplete');
const bundle = JSON.parse(worker.slice(first, last));
for (const path of ['/index.html', '/styles.css', '/dashboard.js']) {
  assert.equal(typeof bundle[path], 'string', path + ' not embedded');
  assert.ok(bundle[path].length > 100, path + ' unexpectedly empty');
}
new Script(bundle['/dashboard.js'], { filename: '/dashboard.js' });

const js = bundle['/dashboard.js'];
const css = bundle['/styles.css'];
assert.ok(js.includes("card('HQpulse'"), 'HQpulse label missing');
assert.ok(!js.includes('YH Pulse'), 'Old YH Pulse label still present');
assert.ok(js.includes('records().slice(0,100)'), 'Recent activity limit regressed');
assert.ok(js.includes("card('Incidents'"), 'Incident history card missing');
assert.ok(js.includes('<details class="incident-item">'), 'Accessible disclosure missing');
assert.ok(js.includes('recoveryVerified') || js.includes('Independent recovery verification'), 'Recovery disclaimer missing');
assert.ok(css.includes('.incident-item'), 'Incident layout styles missing');
assert.ok(js.includes('incidentEvents:[]'), 'Missing fallback for incident event data');
assert.ok(worker.includes('async function syncIncidentHistory(env)'), 'Incident ledger sync missing');
assert.ok(worker.includes('await syncIncidentHistory(env)'), 'Incident scheduler hook missing');
assert.ok(worker.includes('SELECT * FROM incident_history'), 'Persisted incidents not reported');
assert.ok(worker.includes('SELECT * FROM incident_events'), 'Transition history not reported');
assert.ok(worker.includes('verifyAccess(request,env,ctx)'), 'Founder access guard missing');
assert.ok(worker.includes('if(!decisionWrite&&'), 'Read-only method guard missing');
assert.ok(worker.includes('if(!env.DB) throw Error'), 'Database binding guard missing');

console.log('PASS: Worker module syntax');
console.log('PASS: Embedded frontend JS syntax and assets');
console.log('PASS: HQpulse navigation, incident history, recovery warning');
console.log('PASS: Read-only policy, access checks and D1 ledger hooks');
console.log('NOTE: This is static verification, not live authenticated UI or incident testing.');
