#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankProducts} from '../src/products-ranker.mjs';
import {verify} from './verify-current-hq.mjs';
verify();
const at='2026-11-20T09:00:00Z',now=Date.parse('2026-11-21T09:00:00Z');
const item=(id,url,title,score=95)=>({id,title,score,source_url:url,description:'Public attention. Not sales.',kind:'trend-signal',observed_at:at});
const g=item('g','https://github.com/test/growing','Open-source agent workflow');
const p=item('p','https://github.com/test/popular','Popular large project',99);
const h=item('h','https://news.ycombinator.com/item?id=777777','Show HN: New product');
const f=item('f','https://addons.mozilla.org/en-US/firefox/addon/productivity-helper/','Privacy productivity extension');
const signal=(id,day,value,metric='github_stars')=>({product_id:id,metric,observed_day:day,value});
const data=[
 signal('gh:test/growing','2026-11-17',100),
 signal('gh:test/growing','2026-11-18',120),
 signal('gh:test/growing','2026-11-20',180),
 signal('gh:test/popular','2026-11-20',25000),
 signal('hn:777777','2026-11-20',60,'hn_points'),
 signal('firefox:productivity-helper','2026-11-18',100,'firefox_daily_users'),
 signal('firefox:productivity-helper','2026-11-20',80,'firefox_daily_users')
];
const ranked=rankProducts([p,f,h,g],data,now);
assert.equal(ranked.length,4);
assert.equal(ranked[0].id,'g','multi-day growth should beat unverified raw count');
assert.equal(ranked[0].evidenceGrade,'multi-day-growth');
assert.equal(ranked.find(x=>x.id==='p').evidenceGrade,'one-snapshot');
assert.equal(ranked.find(x=>x.id==='f').evidenceGrade,'flat-or-down');
assert.equal(ranked.find(x=>x.id==='h').evidenceGrade,'one-snapshot');
assert.ok(ranked.every(x=>x.revenueVerified===false&&x.trafficVerified===false));
assert.match(ranked[0].opportunity,/model-neutral|local-first/i);
assert.ok(!ranked[0].signal.includes('verified visitors'));
const short=rankProducts([g],[signal('gh:test/growing','2026-11-17',100),signal('gh:test/growing','2026-11-20',500)],now);
assert.equal(short[0].evidenceGrade,'early-growth','two samples never establish sustained trend');
const uneven=rankProducts([g],[signal('gh:test/growing','2026-11-17',100),signal('gh:test/growing','2026-11-18',100),signal('gh:test/growing','2026-11-20',160)],now);
assert.equal(uneven[0].evidenceGrade,'early-growth','one positive interval is insufficient for multi-day growth');
const tiny=rankProducts([g],[signal('gh:test/growing','2026-11-17',100),signal('gh:test/growing','2026-11-18',101),signal('gh:test/growing','2026-11-20',102)],now);
assert.equal(tiny[0].evidenceGrade,'early-growth','small raw changes must not imply viral traction');
const same=rankProducts([p,p],data,now);assert.equal(same.length,1,'duplicate links deduplicated');
const src=readFileSync(new URL('../src/hq-worker.mjs',import.meta.url),'utf8');
assert.match(src,/rankProducts\(products\.results/);
assert.match(src,/product_intel_leads/);
assert.match(src,/link-only-unverified/);
assert.match(src,/verifyAccess\(request,env,ctx\)/);
assert.match(src,/if\(!decisionWrite/);
const ranker=readFileSync(new URL('../src/products-ranker.mjs',import.meta.url),'utf8');
assert.doesNotMatch(ranker,/\bfetch\s*\(|\bPOST\b|\bPUT\b|\bDELETE\b/);
const hnDuplicate={...h,id:'h-other',title:'Show HN: Incorrect unrelated launch'};
assert.equal(rankProducts([h,hnDuplicate],data,now).length,0,'conflicting HN labels for one discussion must be quarantined');
assert.equal(rankProducts([h],data,now).length,1,'a single verified-source HN title remains eligible');
console.log('PASS Products: repeat observations, one-shot downgrade, decline, diverse links, no false revenue/traffic, HN conflict quarantine, private read-only contract');
