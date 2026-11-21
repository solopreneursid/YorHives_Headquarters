#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHnRevenue,normalizeMakerFeed,normalizeRevenueOpportunities,normalizeGovernmentTenders,robotsPermit,revenueResearchWindow,runRevenueResearch} from '../src/revenue-research.mjs';
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
assert.equal(revenueResearchWindow('2026-11-21T01:25:00Z').id,'gov-cppp');
assert.equal(revenueResearchWindow('2026-11-21T23:25:00Z').id,'gov-jharkhand');
assert.equal(revenueResearchWindow('2026-11-21T03:25:00Z').id,'hn-affiliates');
assert.equal(revenueResearchWindow('2026-11-21T06:25:00Z').id,'hn-sponsors');
assert.equal(revenueResearchWindow('2026-11-21T09:25:00Z').id,'hn-mrr');
assert.equal(revenueResearchWindow('2026-11-21T12:25:00Z').id,'hn-clients');
assert.equal(revenueResearchWindow('2026-11-21T18:25:00Z').id,'hn-partners');
assert.equal(revenueResearchWindow('2026-11-21T15:25:00Z').id,'makers');
assert.equal(revenueResearchWindow('2026-11-21T21:25:00Z').id,'hn-pricing');
assert.equal(revenueResearchWindow('2026-11-21T10:25:00Z'),null);

const request=(id,body,date='2026-11-20T12:00:00Z')=>({
 objectID:String(id),story_title:'Ask HN: Help building products',comment_text:body,created_at:date,
 points:0,num_comments:0
});
const clientHits=[request(501,'We need a developer for our PDF automation project with a budget.'),
 request(502,'I need to find a job.'),request(503,'Contact owner@private.example.com: we need a freelancer for our API project.')];
const clientLeads=normalizeRevenueOpportunities(clientHits,'2026-11-21T12:25:00Z','client');
assert.equal(clientLeads.length,2,'Strict buyer/request and project terms required');
assert.ok(clientLeads.every(x=>x.kind==='revenue-client'));
assert.ok(clientLeads.every(x=>x.source_url.startsWith('https://news.ycombinator.com/item?id=')));
assert.ok(clientLeads.every(x=>!x.description.includes('owner@private.example.com')),'Emails are masked in stored evidence');
assert.ok(clientLeads.every(x=>x.recommendation.includes('do not auto-contact')));
assert.equal(normalizeRevenueOpportunities([request(509,'I need a developer for my project.','2026-10-01T00:00:00Z')],
 '2026-11-21T12:25:00Z','client').length,0,'Expired public requests are not active leads');
const hna=(id,title,pts=8,c=3)=>hn(id,title,pts,c);
const affiliateHits=[hna(601,'New affiliate program with commission for SaaS tool referrals')];
const partnerHits=[hna(602,'Seeking partners for our developer automation product')];
const sponsorHits=[hna(603,'Sponsoring developer newsletters and open source tools')];
assert.equal(normalizeRevenueOpportunities(affiliateHits,'2026-11-21T03:25:00Z','affiliate').length,1);
assert.equal(normalizeRevenueOpportunities(partnerHits,'2026-11-21T18:25:00Z','partnership').length,1);
assert.equal(normalizeRevenueOpportunities(sponsorHits,'2026-11-21T06:25:00Z','sponsorship').length,1);
assert.deepEqual(normalizeRevenueOpportunities(clientHits,at,'unapproved-kind'),[]);


const officialTenderHtml='<html><body><table><tbody>'+
'<tr><td>1.</td><td><a href="/eprocure/app">Development of website and digital forms platform</a></td><td>NIC-IT/WEB/2026/7</td><td>29-Nov-2026 03:30 PM</td><td>01-Dec-2026 11:00 AM</td></tr>'+
'<tr><td>2.</td><td><a href="/eprocure/app">Civil works and bridge construction at Jamshedpur</a></td><td>CIVIL/1101/2026</td><td>29-Nov-2026 03:30 PM</td><td>01-Dec-2026 11:00 AM</td></tr>'+
'<tr><td>3.</td><td><a href="/eprocure/app">Website maintenance of official records portal</a></td><td>IT/OLD/2026</td><td>20-Nov-2026 03:30 PM</td><td>25-Nov-2026 11:00 AM</td></tr>'+
'<tr><td>4.</td><td><a href="/eprocure/app">Build an online dashboard</a></td><td>IT/NO/2026</td><td>Not listed</td><td>01-Dec-2026 11:00 AM</td></tr>'+
'</tbody></table></body></html>';
const govTenders=normalizeGovernmentTenders(officialTenderHtml,'2026-11-21T01:25:00Z','https://eprocure.gov.in/eprocure/app');
assert.equal(govTenders.length,1,'Tender must be a relevant public IT project with reference and future deadline');
assert.equal(govTenders[0].kind,'revenue-government');
assert.match(govTenders[0].description,/NIC-IT\/WEB\/2026\/7/);
assert.match(govTenders[0].description,/2026-11-29 15:30 IST/);
assert.equal(govTenders[0].source_url,'https://eprocure.gov.in/eprocure/app');
assert.equal(normalizeGovernmentTenders(officialTenderHtml,'2026-11-21T01:25:00Z','https://unofficial.example.org/tenders').length,0,
 'No third-party claim becomes an official government bid');
assert.equal(robotsPermit('User-agent: *\nDisallow: /eprocure/app',
 'YorpHivesHQ-RevenueResearch','/eprocure/app'),false,'Respect official robots disallow');
assert.equal(robotsPermit('User-agent: *\nDisallow: /other',
 'YorpHivesHQ-RevenueResearch','/eprocure/app'),true);
assert.equal(robotsPermit('User-agent: *\nDisallow: /\nAllow: /eprocure/app',
 'YorpHivesHQ-RevenueResearch','/eprocure/app'),true,'Longer explicit allow wins');
const govModel=buildRevenueIntelligence({now:'2026-11-21T01:25:00Z',researchRows:govTenders});
assert.ok(govModel.opportunities.some(x=>x.channel==='Government project · verify eligibility'));
assert.ok(govModel.opportunities.every(x=>x.whoMightPay&&x.whyPay&&x.nextAction));
const expiredGov=buildRevenueIntelligence({now:'2026-12-10T01:25:00Z',researchRows:govTenders});
assert.ok(!expiredGov.opportunities.some(x=>x.channel==='Government project · verify eligibility'));

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
assert.equal(activity.marketSignals.length,0,'Research leads already recommended should not be repeated in Market Intelligence');
assert.equal(activity.researchedOpportunities,3);
assert.equal(activity.opportunities.length,10,'Seven channel/program hypotheses plus three qualified outside leads');
assert.equal(activity.sourceScansCompleted,2);
assert.equal(activity.verifiedEarnings.available,false);
assert.equal(activity.verifiedEarnings.amount,null);
assert.ok(activity.opportunities.every(x=>x.approvalRequired===true&&x.autoExecute===false&&x.revenueVerified===false));
assert.ok(activity.opportunities.filter(x=>x.stage==='Founder research').every(x=>x.revenueVerified===false&&x.buyerDemandVerified===false));
const withReported=buildRevenueIntelligence({now:at,researchRows:normal.concat(feed),externalRows:[{
 kind:'revenue-trend',title:'AI photo creation — Glowy',score:71,
 source_url:'https://trustmrr.com/newsletter',observed_at:'2026-11-20T12:00:00Z',
 description:'Outside report only, not YorpHives sales.',
 recommendation:'Investigate independent evidence before proposing a product.'
}]});
assert.equal(withReported.marketSignals.length,1,'Unverified reported earnings remain in Market Intelligence');
assert.equal(withReported.marketSignals[0].title,'AI photo creation — Glowy');
assert.equal(withReported.marketSignals[0].category,'hqventures','Commercial AI generation needs verified compute economics');
assert.equal(withReported.researchedOpportunities,3,'Reported figures must not gain a recommendation slot');
assert.ok(withReported.opportunities.every(x=>x.sourceUrl!=='https://trustmrr.com/newsletter'));
assert.equal(withReported.verifiedEarnings.amount,null);
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
 if(url.endsWith('/robots.txt'))return new Response('',{status:404});
 if(url.startsWith('https://eprocure.gov.in/')||url.startsWith('https://jharkhandtenders.gov.in/'))
  return new Response(officialTenderHtml,{status:200,headers:{'content-type':'text/html'}});
 if(url.startsWith('https://indiemakerlist.com'))return new Response(xml,{status:200,headers:{'content-type':'application/xml'}});
 const qs=new URL(url).searchParams,term=qs.get('query');
 const selected=term==='looking for'?clientHits:term==='affiliate'?affiliateHits:
  term==='partner'?partnerHits:term==='sponsor'?sponsorHits:hits;
 return new Response(JSON.stringify({hits:selected}),{status:200,headers:{'content-type':'application/json'}});
};
const env={DB:db};
const args={reserveFetch:async()=>true,fetchFn};
const results=await Promise.all([
 runRevenueResearch(env,'2026-11-21T01:25:00Z',args),
 runRevenueResearch(env,'2026-11-21T03:25:00Z',args),
 runRevenueResearch(env,'2026-11-21T06:25:00Z',args),
 runRevenueResearch(env,at,args),
 runRevenueResearch(env,'2026-11-21T12:25:00Z',args),
 runRevenueResearch(env,'2026-11-21T15:25:00Z',args),
 runRevenueResearch(env,'2026-11-21T18:25:00Z',args),
 runRevenueResearch(env,'2026-11-21T21:25:00Z',args),
 runRevenueResearch(env,'2026-11-21T23:25:00Z',args)
]);
for(const [i,name,count] of [[0,'gov-cppp',1],[1,'hn-affiliates',1],[2,'hn-sponsors',1],[3,'hn-mrr',2],
 [4,'hn-clients',2],[5,'makers',1],[6,'hn-partners',1],[7,'hn-pricing',2],[8,'gov-jharkhand',1]])
 assert.match(results[i],new RegExp(name+':ok:'+count));
assert.equal(requests.length,11,'Nine daily windows, with at most two additional robots checks for government sources');
assert.ok(requests.every(x=>x.method==='GET'&&x.redirect==='manual'));
assert.equal(ops.filter(s=>s.includes('INSERT INTO opportunities')).length,12);
assert.ok(ops.filter(s=>s.includes('DELETE')).every(s=>s.includes("kind IN ('revenue-research'")),'Retention affects only own evidence');
assert.equal(await runRevenueResearch(env,'2026-11-21T10:30:00Z',args),'outside-window');
const noBudget=await runRevenueResearch(env,'2026-11-22T09:25:00Z',{reserveFetch:async()=>false,fetchFn:()=>{throw Error('Must not fetch after budget exhaustion')}});
assert.match(noBudget,/unavailable:public-fetch-budget-exhausted/);
assert.equal(requests.length,11);
const worker=readFileSync(new URL('../src/hq-worker.mjs',import.meta.url),'utf8');
assert.match(worker,/runRevenueResearch\(env,scheduledTime,\{reserveFetch\}\)/);
assert.match(worker,/IN \('revenue-research','revenue-client','revenue-affiliate'/);
assert.match(worker,/revenue_research_%/);
assert.match(worker,/\/api\/revenue-intelligence/);
const collector=readFileSync(new URL('../src/revenue-research.mjs',import.meta.url),'utf8');
assert.doesNotMatch(collector,/method:'POST'|method:'PUT'|method:'DELETE'|cloudflare\.request/);
console.log('PASS Revenue research: nine bounded source windows, official tender deadlines/robots, unqualified leads and no automatic bids');
