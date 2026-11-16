#!/usr/bin/env node
/**
 * Isolated HQpulse incident lifecycle test.
 * Uses the actual syncIncidentHistory function extracted from deployed-source snapshot.
 * Fake D1 is intentionally local: NEVER writes to Cloudflare production database.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync('src/hq-worker.mjs','utf8');
const start=source.indexOf('async function syncIncidentHistory(env) {');
const end=source.indexOf('async function scheduledCycle(',start);
assert.ok(start>=0 && end>start,'Cannot isolate real incident synchronizer');
let tick=0;
const nowIso=()=>new Date(Date.UTC(2026,10,16,12,0,tick++)).toISOString();
const sandbox={nowIso};
runInNewContext(source.slice(start,end)+'\nthis.syncIncidentHistory=syncIncidentHistory;',sandbox);
const syncIncidentHistory=sandbox.syncIncidentHistory;
assert.equal(typeof syncIncidentHistory,'function');

const state={findings:[],incidents:new Map(),events:[]};
const DB={
  prepare(sql){
    return {
      all:async()=>{
        if(sql.includes('FROM incident_history'))return {results:[...state.incidents.values()].map(x=>({id:x.id,status:x.status,last_seen:x.last_seen}))};
        if(sql.includes('FROM findings'))return {results:state.findings.slice().sort((a,b)=>b.observed_at.localeCompare(a.observed_at)).slice(0,300)};
        throw Error('Unexpected SELECT: '+sql);
      },
      bind(...args){
        return {run:async()=>{
          if(sql.startsWith('INSERT INTO incident_history')){
            const [id,title,category,severity,asset,status,first_seen,last_seen,resolved_at,description,recommendation,evidence]=args;
            assert.ok(!state.incidents.has(id),'duplicate insert');
            state.incidents.set(id,{id,title,category,severity,asset,status,first_seen,last_seen,resolved_at,description,recommendation,evidence,occurrences:1});
          }else if(sql.startsWith('UPDATE incident_history SET title=')){
            const [title,category,severity,asset,status,last_seen,resolved_at,description,recommendation,evidence,increment,id]=args;
            const row=state.incidents.get(id); assert.ok(row,'missing row');
            Object.assign(row,{title,category,severity,asset,status,last_seen,resolved_at,description,recommendation,evidence});
            row.occurrences+=increment;
          }else if(sql.startsWith('UPDATE incident_history SET last_seen=')){
            const [last_seen,description,evidence,id]=args;
            Object.assign(state.incidents.get(id),{last_seen,description,evidence});
          }else if(sql.startsWith('INSERT INTO incident_events')){
            const [incident_id,transition,observed_at,evidence]=args;
            state.events.push({incident_id,transition,observed_at,evidence});
          }else throw Error('Unexpected mutation SQL: '+sql);
          return {success:true};
        }};
      }
    };
  }
};
const env={DB};
const base={id:'website-test',title:'Website availability test',category:'reliability',priority:'high',asset:'https://yorphives.com',status:'open',observed_at:'2026-11-16T10:00:00.000Z',description:'Two failed checks',recommendation:'Verify source independently',evidence:'https://yorphives.com/'};
state.findings=[{...base}];
await syncIncidentHistory(env);
assert.equal(state.incidents.size,1);
assert.equal(state.events[0].transition,'detected');
assert.equal(state.incidents.get(base.id).occurrences,1);
await syncIncidentHistory(env);
assert.equal(state.events.length,1,'Duplicate event on unchanged heartbeat');
state.findings=[{...base,observed_at:'2026-11-16T10:05:00.000Z',description:'Still failing'}];
await syncIncidentHistory(env);
assert.equal(state.events.length,1,'Repeated observation is not a new incident');
assert.equal(state.incidents.get(base.id).last_seen,'2026-11-16T10:05:00.000Z');
state.findings=[{...base,status:'resolved',observed_at:'2026-11-16T10:10:00.000Z'}];
await syncIncidentHistory(env);
assert.equal(state.events.at(-1).transition,'resolved');
assert.ok(state.incidents.get(base.id).resolved_at);
assert.equal(state.incidents.get(base.id).occurrences,1);
state.findings=[{...base,status:'open',observed_at:'2026-11-16T10:15:00.000Z'}];
await syncIncidentHistory(env);
assert.equal(state.events.at(-1).transition,'reopened');
assert.equal(state.incidents.get(base.id).resolved_at,null);
assert.equal(state.incidents.get(base.id).occurrences,2);
await syncIncidentHistory(env);
assert.equal(state.events.length,3,'Repeated open status must not emit new event');
state.findings=[{...base,id:'historical-resolved',status:'resolved'}];
await syncIncidentHistory(env);
assert.equal(state.incidents.get('historical-resolved').status,'resolved');
assert.equal(state.events.at(-1).transition,'historical');
assert.equal(state.incidents.get('historical-resolved').resolved_at,null,'Do not invent historical recovery timestamp');
console.log('PASS: first detection persisted');
console.log('PASS: identical check idempotent');
console.log('PASS: repeated observation updates last seen without duplicate event');
console.log('PASS: resolved transition and timestamp');
console.log('PASS: reopening clears recovery timestamp, counts another occurrence');
console.log('PASS: historical resolved import does not fabricate recovery time');
console.log('PASS: all assertions ran in isolated fake D1; production untouched');
