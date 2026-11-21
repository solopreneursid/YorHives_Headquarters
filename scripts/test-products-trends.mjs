#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {asset,verify} from './verify-current-hq.mjs';
verify();
const src=readFileSync(new URL('../src/hq-worker.mjs',import.meta.url),'utf8');
const start=src.indexOf('const TREND_REGISTRY=Object.freeze(['),end=src.indexOf('async function securityWatch(env) {',start);
assert.ok(start>0&&end>start);
const raw=src.slice(start,end);
const f=new Function('fnv','clampText',raw+'\nreturn {TREND_REGISTRY,trendGithub,trendHackerNews,trendListings};')(
 s=>[...s].reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261).toString(16),
 (s,n=240)=>String(s||'').replace(/\s+/g,' ').slice(0,n)
);
assert.deepEqual(f.TREND_REGISTRY.map(x=>x.id),['github','hackernews','betalist','trustmrr','microlaunch','uneed','arrfounder']);
const gh=f.trendGithub({items:[{full_name:'example/good',stargazers_count:810,created_at:'2026-11-15T00:00:00Z',
 html_url:'https://github.com/example/good',description:'Local document helper'},
 {full_name:'example/bad',stargazers_count:900,html_url:'https://github.com.evil.test/example/bad'}]});
assert.equal(gh.length,1);
assert.equal(gh[0].score,85);
assert.equal(gh[0].kind,'trend-signal'); // Live raw GitHub stars are not measured daily growth.
assert.match(gh[0].description,/not daily growth/i);
assert.match(gh[0].recommendation,/Monetization:/);
const hn=f.trendHackerNews({hits:[{title:'Show HN: PDF tool',points:130,num_comments:31,objectID:'123456'},
 {title:'Unpopular',points:3,objectID:'123457'}]});
assert.equal(hn.length,1);
assert.equal(hn[0].score,78);
assert.match(hn[0].description,/not product traffic/);
const un=f.TREND_REGISTRY.find(x=>x.id==='uneed');
assert.equal(f.trendListings(un,'<a href="/tool/example-tool">Example Tool</a><a href="https://evil.test/tool/attack">Attack</a>').length,1);
const js=asset(src,'/hq-simple.js');
assert.match(js,/\/api\/trending-products/);
assert.match(js,/View original source/);
assert.match(js,/safeSourceLink/);
assert.match(js,/Find what is getting attention/);
assert.match(asset(src,'/hq-simple.css'),/\.trend-row/);
assert.match(src,/verifyAccess\(request,env,ctx\)/);
assert.match(src,/await scheduledTrendDiscovery\(env,scheduledTime\)/);
console.log('PASS Products: seven sources, signal quality, ranking, links, monetization, read-only UX');
