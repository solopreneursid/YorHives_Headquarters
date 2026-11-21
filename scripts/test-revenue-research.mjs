#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHnRevenue,normalizeMakerFeed,revenueResearchWindow,runRevenueResearch} from '../src/revenue-research.mjs';
import {buildRevenueIntelligence} from '../src/revenue-intelligence.mjs';

const at='2026-11-21T09:25:00Z';
const hn=(id,title,points=12,comments=4,date='2026-11-20T12:00:00Z')=>({objectID:String(id),title,points,num_comments:comments,created_at:date});
const hits=[
 hn(101,'Show HN: I got 20 paying users for a simple PDF tool'),
 hn(102,'How I think about startup pricing for my SaaS',21,7),
 hn(103,'Unrelated tech news yesterday'),
 hn(104,'Gambling subscriptions I recommend',20,12),
 hn(105,'I have monthly recurring revenue',0,0),
 hn(106,'Subscription startup',12,4,'2026-09-01T12:00:00Z')
];
const normal=normalizeHnRevenue(hits,at,'mrr');
assert.equal(normal.length,2,'Only relevant, fresh and engaged public discussions qualify');
assert.ok(normal.every(x=>x.kind==='revenue-research'&&x.source_url.startsWith('https://news.ycombinator.com/item?id=')));
assert.ok(normal.every(x=>x.description.includes('unverified')&&x.recommendation.includes('No verified YorpHives revenue')));
assert.deepEqual(normalizeHnRevenue(hits,at,'invalid'),[]);
assert.equal(revenueResearchWindow('2026-11-21T09:25:00Z').id,'hn-mrr');
assert.equal(revenueResearchWindow('2026-11-21T15:25:00Z').id,'makers');
assert.equal(revenueResearchWindow('2026-11-21T21:25:00Z').id,'hn-pricing');
assert.equal(revenueResearchWindow('2026-11-21T10:25:00Z'),null);
const xml='<rss><channel>'+
'<item><title>Bootstrapping a paid PDF product</title><link>https://indiemakerlist.com/makers/sample</link><pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate><description>Monthly revenue</description></item>'+
'<item><title>My unrelated story</title><link>https://indiemakerlist.com/makers/unrelated</link><pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate></item>'+
'<item><title>Subscription product</title><link>https://example.org/unauthorized</link><pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate></item>'+
'</channel></rss>';
const feed=normalizeMakerFeed(xml,'2026-11-21T15:25:00Z');
assert.equal(feed.length,1,'Only dated, publisher-linked and monetization-related maker entries qualify');
assert.equal(feed[0].source_url,'https://indiemakerlist.com/makers/sample');
assert.match(feed[0].description,/NOT been independently verified/);
const activity=buildRevenueIntelligence({now:at,researchRows:normal.concat(feed),sourceStatuses:[
 {key:'revenue_research_hn_mrr',value:'ok:2',checked_at:at},
 {key:'revenue_research_makers',value:'ok:1',checked_at:at}
]});
assert.equal(activity.marketSignals.length,3);
assert.equal(activity.researchedOpportunities,3);
assert.equal(activity.opportunities.length,6,'Three baseline channels plus three qualified outside hypotheses');
assert.equal(activity.sourceScansCompleted,2);
assert.equal(activity.verifiedEarnings.available,false);
assert.equal(activity.verifiedEarnings.amount,null);
assert.ok(activity.opportunities.every(x=>x.approvalRequired===true&&x.autoExecute===false&&x.revenueVerified===false));
assert.ok(activity.marketSignals.every(x=>x.yorphivesRevenue===false&&x.buyerDemandVerified===false));
const many=[...normal,...Array.from({length:20},(_,i)=>({
 kind:'revenue-research',title:'A PDF tool earns paying customers '+i,
 description:'Public discussion, not verified revenue.',
 recommendation:'Investigate market fit, competitors and operating costs.',
 source_url:'https://news.ycombinator.com/item?id='+(2000+i),
 observed_at:'2026-11-20T12:00:00Z',score:45+i
}))];
const capped=buildRevenueIntelligence({now:at,researchRows:many});
assert.ok(capped.opportunities.length>=5&&capped.opportunities.length<=10);
assert.ok(capped.marketSignals.length<=10);
assert.equal(capped.verifiedEarnings.amount,null);
const ops=[],state=[];
const db={prepare(sql){const obj={bind(...vals){state.push({sql,vals});return obj},async run(){ops.push(sql);return {meta:{changes:1}}}};return obj}};
const requests=[];
const fetchFn=async (url,options)=>{requests.push({url,method:options.method,redirect:options.redirect});
 if(url.startsWith('https://indiemakerlist.com'))return new Response(xml,{status:200,headers:{'content-type':'application/xml'}});
 return new Response(JSON.stringify({hits}),{status:200,headers:{'content-type':'application/json'}})
};
const env={DB:db};
const args={reserveFetch:async()=>true,fetchFn};
const r1=await runRevenueResearch(env,at,args);
const r2=await runRevenueResearch(env,'2026-11-21T15:25:00Z',args);
const r3=await runRevenueResearch(env,'2026-11-21T21:25:00Z',args);
assert.match(r1,/hn-mrr:ok:2/);
assert.match(r2,/makers:ok:1/);
assert.match(r3,/hn-pricing:ok:2/);
assert.equal(requests.length,3,'Only three research source GETs per day');
assert.ok(requests.every(x=>x.method==='GET'&&x.redirect==='manual'));
assert.equal(ops.filter(s=>s.includes('INSERT INTO opportunities')).length,5);
assert.ok(ops.filter(s=>s.includes('DELETE')).every(s=>s.includes("kind='revenue-research'")),'Retention affects own evidence only');
assert.equal(await runRevenueResearch(env,'2026-11-21T10:30:00Z',args),'outside-window');
const noBudget=await runRevenueResearch(env,'2026-11-22T09:25:00Z',{reserveFetch:async()=>false,fetchFn:()=>{throw Error('Must not fetch after budget exhaustion')}});
assert.match(noBudget,/unavailable:public-fetch-budget-exhausted/);
assert.equal(requests.length,3);
const worker=readFileSync(new URL('../src/hq-worker.mjs',import.meta.url),'utf8');
assert.match(worker,/runRevenueResearch\(env,scheduledTime,\{reserveFetch\}\)/);
assert.match(worker,/WHERE kind='revenue-research'/);
assert.match(worker,/revenue_research_%/);
assert.match(worker,/\/api\/revenue-intelligence/);
const collector=readFileSync(new URL('../src/revenue-research.mjs',import.meta.url),'utf8');
assert.doesNotMatch(collector,/method:'POST'|method:'PUT'|method:'DELETE'|cloudflare\.request/);
console.log('PASS Revenue research: three bounded sources; source links; strict business evidence; zero false earnings; no external writes');
