#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROWTH_SOURCE,validateGrowth,loadGrowthEvidence} from '../src/growth-evidence.mjs';
const days=Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,9,19+i)).toISOString().slice(0,10));
const valid={schemaVersion:1,available:true,periodDays:30,generatedAt:'2026-11-17T12:00:00.000Z',
 daily:days.map(day=>({day,pageViews:1,completedActions:0})),
 comparison:{recent7dCompletedActions:3,previous7dCompletedActions:1,recent7dPageViews:7,previous7dPageViews:7},
 ranked:[{url:'tools/word-counter/',name:'Word Counter',completedActions30d:4,completedActions7d:3,previous7d:1}],
 opportunities:[{url:'tools/word-counter/',name:'Word Counter',signal:'increasing-completions',recent7d:3,previous7d:1,requiresFounderReview:true}],
 revenue:{available:false,amount:null}};
const report=validateGrowth(valid);
assert.equal(report.readOnly,true);
assert.equal(report.ranked[0].url,'tools/word-counter/');
assert.equal(report.opportunities[0].requiresFounderReview,true);
assert.equal(report.revenue.amount,null);
for(const broken of [
 {...valid,revenue:{available:true,amount:9999}},
 {...valid,ranked:[{...valid.ranked[0],url:'https://evil.test/'}]},
 {...valid,daily:valid.daily.slice(1)},
 {...valid,daily:valid.daily.map(x=>({...x,day:days[0]}))},
 {...valid,opportunities:[{...valid.opportunities[0],requiresFounderReview:false}]}
])assert.throws(()=>validateGrowth(broken));
let observed;
const mock=async(url,opts)=>{
 observed={url,opts};
 return {ok:true,headers:new Headers({'content-type':'application/json'}),text:async()=>JSON.stringify(valid)};
};
const fetched=await loadGrowthEvidence(mock);
assert.equal(fetched.source,GROWTH_SOURCE);
assert.equal(observed.url,GROWTH_SOURCE);
assert.equal(observed.opts.method,'GET');
assert.equal(observed.opts.redirect,'error');
assert.equal(observed.opts.cache,'no-store');
const src=readFileSync('src/hq-worker.mjs','utf8');
assert.ok(src.includes('if(route==="/api/growth-evidence"&&request.method==="GET")'));
assert.ok(src.includes('await verifyAccess(request,env,ctx)'));
assert.ok(src.indexOf('await verifyAccess(request,env,ctx)')<src.indexOf('if(route==="/api/growth-evidence"'));
const begin=src.indexOf('const PILOT_STATIC_BUNDLE = ')+'const PILOT_STATIC_BUNDLE = '.length;
const end=src.indexOf(';\n',begin);
const ui=JSON.parse(src.slice(begin,end))['/dashboard.js'];
for(const marker of ['function refreshPublicGrowth(force=false)','function publicGrowthPanel()','if(to===\'growth\')void refreshPublicGrowth()','No verified source','Research signals'])
 assert.ok(ui.includes(marker),'Missing UI: '+marker);
assert.equal(/\b(?:POST|PUT|PATCH|DELETE)\b/.test(readFileSync('src/growth-evidence.mjs','utf8')),false);
console.log('PASS: authenticated read-only HQ growth proxy, fixed upstream, bound response, zero fabricated revenue');
console.log('PASS: UTC series and catalog-safe product signals, no write capabilities');
console.log('PASS: HQ Growth page shows current evidence and founder-review cautions');
