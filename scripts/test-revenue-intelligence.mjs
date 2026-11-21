#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRevenueIntelligence} from '../src/revenue-intelligence.mjs';
import {verify,asset} from './verify-current-hq.mjs';

verify();
const now='2026-11-21T05:00:00.000Z';
const base=buildRevenueIntelligence({now});
assert.equal(base.schemaVersion,1);
assert.equal(base.readOnly,true);
assert.deepEqual(base.verifiedEarnings,{available:false,amount:null,currency:null,
 reason:'No authenticated YorpHives payout, sales or accounting data connected. Unknown is not zero.'});
assert.equal(base.activity.available,false);
assert.equal(base.opportunities.length,10,'Revenue has up to ten independently sourced programs and official procurement channels');
assert.deepEqual(new Set(base.opportunities.map(x=>x.channel)),new Set([
 'HQventures','Free Tools only','Paid services · possible clients','Affiliate · optional editorial','Partnership · research',
 'Government contracts · India','Government contracts · Jharkhand','Government contracts · GeM'
]));
assert.ok(base.opportunities.some(x=>x.sourceUrl==='https://www.namecheap.com/affiliates/'));
assert.ok(base.opportunities.some(x=>x.sourceUrl==='https://www.digitalocean.com/affiliates'));
assert.ok(base.opportunities.some(x=>x.sourceUrl==='https://www.cloudflare.com/partners/power-up-program/'));
assert.equal(base.sources.length,9);
assert.equal(base.constraints.advertisingScope,'Free Tools only');
assert.ok(base.constraints.adFreeAreas.includes('HQventures'));
assert.ok(base.constraints.adFreeAreas.includes('YorpHivesHQ'));
assert.equal(base.constraints.freeToolsRemainFree,true);
assert.equal(base.constraints.hqventuresOnlyFounderApprovedProducts,true);
assert.match(base.constraints.supportButton,/disabled/);
assert.ok(base.opportunities.every(x=>x.approvalRequired===true&&x.autoExecute===false));
assert.equal(base.marketSignals.length,0);

assert.ok(base.opportunities.some(x=>x.sourceUrl==='https://eprocure.gov.in/eprocure/app'));
assert.ok(base.opportunities.some(x=>x.sourceUrl==='https://jharkhandtenders.gov.in/nicgep/app'));
assert.ok(base.opportunities.some(x=>x.sourceUrl==='https://bidplus.gem.gov.in/all-bids'));
assert.ok(base.opportunities.every(x=>x.whoMightPay&&x.whyPay&&x.nextAction),'Three founder questions mandatory on all Revenue cards');
assert.ok(base.opportunities.filter(x=>x.channel.startsWith('Government')).every(x=>x.approvalRequired&&
 !x.revenueVerified&&x.autoExecute===false),'Official portal does not equal awarded government contract');
const tender={
 kind:'revenue-government',title:'Government tender · Website and digital records management software',
 source_url:'https://eprocure.gov.in/eprocure/app',observed_at:now,score:71,
 description:'Official Central government procurement public listing. Tender reference: IT/GOV/2026/004. Bid closing: 2026-11-29 15:30 IST. Scope: Website and digital records management software. Issuing body and eligibility must be checked.',
 recommendation:'VERIFY BEFORE BID: Check the official tender before applying.'
};
const gov=buildRevenueIntelligence({now,researchRows:[tender]});
const tenderCard=gov.opportunities.find(x=>x.channel==='Government project · verify eligibility');
assert.ok(tenderCard,'A first-party still-open tender with reference and closing date is prioritized');
assert.equal(tenderCard.bidDeadline,'2026-11-29 15:30 IST');
assert.equal(tenderCard.sourceUrl,'https://eprocure.gov.in/eprocure/app');
assert.ok(tenderCard.whoMightPay&&tenderCard.whyPay&&tenderCard.nextAction);
assert.equal(tenderCard.revenueVerified,false);
assert.equal(tenderCard.buyerDemandVerified,false);
assert.equal(gov.verifiedEarnings.amount,null);
assert.ok(!gov.marketSignals.some(x=>x.title===tender.title),'An individual tender is not duplicated in Market Intelligence');
const expired={...tender,description:tender.description.replace('2026-11-29 15:30','2026-11-20 15:30')};
const old=buildRevenueIntelligence({now,researchRows:[expired]});
assert.ok(!old.opportunities.some(x=>x.channel==='Government project · verify eligibility'),'Expired government tenders must not be recommended');
const unverified={...tender,description:tender.description.replace('Bid closing: 2026-11-29 15:30 IST.','')};
assert.ok(!buildRevenueIntelligence({now,researchRows:[unverified]}).opportunities.some(x=>x.channel==='Government project · verify eligibility'),
 'Missing deadline is not an active contract opportunity');

const ext=[
 {kind:'revenue-trend',title:'Glowy public earnings report',source_url:'https://trustmrr.com/newsletter',
  observed_at:'2026-11-19T06:30:00Z',
  description:'Third-party newsletter reported $13,843 in 30 days (not audited independently).',
  recommendation:'Investigate costs; do not assume we earn it.'},
 {kind:'revenue-trend',title:'Glowy public earnings report',source_url:'https://trustmrr.com/newsletter',
  observed_at:'2026-11-19T06:30:00Z',description:'duplicate'},
 {kind:'revenue-trend',title:'untrusted',source_url:'http://example.com/insecure',
  observed_at:'2026-11-19T06:30:00Z',description:'bad link'},
 {kind:'trend-listed',title:'Unrelated GitHub SDK',source_url:'https://github.com/example/sdk',
  observed_at:'2026-11-19T06:30:00Z'}
];
const withSignals=buildRevenueIntelligence({externalRows:ext,now});
assert.equal(withSignals.marketSignals.length,1);
assert.equal(withSignals.marketSignals[0].sourceUrl,'https://trustmrr.com/newsletter');
assert.equal(withSignals.opportunities.length,10,'External revenue claims may not outrank real channels');
assert.ok(!withSignals.opportunities.some(x=>x.sourceUrl==='https://trustmrr.com/newsletter'));
const glowy=buildRevenueIntelligence({externalRows:[{kind:'revenue-trend',title:'AI photo creation — Glowy',
  source_url:'https://trustmrr.com/newsletter',observed_at:now,score:71,description:'Third-party revenue claim',
  recommendation:'Niche premium packs require independent validation'}],now});
assert.equal(glowy.marketSignals.length,1,'Third-party claim remains accessible with original evidence');
assert.equal(glowy.marketSignals[0].category,'hqventures','AI photo generation is not automatically a Free Tools ad opportunity');
assert.equal(glowy.marketSignals[0].effortHypothesis,'high');
assert.equal(glowy.opportunities.length,10,'An unverified reported amount alone is not a Top Revenue Opportunity');

assert.equal(withSignals.marketSignals[0].yorphivesRevenue,false);
assert.equal(withSignals.marketSignals[0].profitVerified,false);
assert.equal(withSignals.verifiedEarnings.amount,null);

// Public requests are unqualified until the founder reviews the original and budget.
const client=buildRevenueIntelligence({now,sourceStatuses:[
 {key:'revenue_research_hn_clients',value:'ok:1',checked_at:now}
],researchRows:[
 {kind:'revenue-client',title:'Potential client request: PDF automation help',source_url:'https://news.ycombinator.com/item?id=500111',
  description:'Unqualified public request. A team may need help; scope and payment unknown.',
  recommendation:'INVESTIGATE: Check the original public request before deciding if it is a fit.',
  score:58,observed_at:now},
 {kind:'revenue-affiliate',title:'Affiliate program mention: Startup referral',
  source_url:'https://news.ycombinator.com/item?id=500112',observed_at:now,
  description:'Public community mention only.',recommendation:'Verify official terms',score:39}
]});
assert.ok(client.opportunities.some(x=>x.channel==='Potential client · unqualified'));
const lead=client.opportunities.find(x=>x.channel==='Potential client · unqualified');
assert.equal(lead.buyerDemandVerified,false);
assert.equal(lead.revenueVerified,false);
assert.ok(lead.priorityScore>70,'New public client intent is prioritized for founder investigation');
assert.ok(!client.marketSignals.some(x=>x.sourceUrl===lead.sourceUrl),'No duplicated client lead in lower list');
assert.ok(client.marketSignals.some(x=>x.category==='affiliate'),'Community program chatter is not proof of a real offer');
assert.equal(client.verifiedEarnings.amount,null);
assert.equal(client.sourceScansCompleted,1);
assert.equal(client.sources.length,9);
const partnerAndSponsor=buildRevenueIntelligence({now,researchRows:[
 {kind:'revenue-partnership',title:'Potential partner collaboration for a software tool',
  source_url:'https://news.ycombinator.com/item?id=500113',observed_at:now,
  description:'Public collaboration request; active agreement not verified.',recommendation:'Check original and validate scope.',score:45},
 {kind:'revenue-sponsorship',title:'Sponsoring developer newsletters and tools',
  source_url:'https://news.ycombinator.com/item?id=500114',observed_at:now,
  description:'Potential sponsor public discussion, not a contract.',recommendation:'Check audience and sponsor fit.',score:44}
]});
assert.ok(partnerAndSponsor.opportunities.some(x=>x.channel==='Partnership · investigation'));
assert.ok(partnerAndSponsor.opportunities.some(x=>x.channel==='Sponsorship · investigation'));
assert.ok(partnerAndSponsor.opportunities.every(x=>x.approvalRequired&&x.autoExecute===false));
assert.equal(partnerAndSponsor.verifiedEarnings.amount,null);

const growth={available:true,source:'https://yorphives.com/api/insights/growth',
 generatedAt:now,ranked:[{url:'tools/image-resize/',name:'Image Resize',completedActions7d:40},
 {url:'apps/internal/',name:'HQventures',completedActions7d:100},
 {url:'tools/pdf/',name:'PDF Tool',completedActions7d:25}]};
const withGrowth=buildRevenueIntelligence({growth,now});
assert.equal(withGrowth.activity.available,true);
assert.equal(withGrowth.activity.topFreeTool.name,'Image Resize');
assert.equal(withGrowth.activity.topFreeTool.completedActions7d,40);
assert.match(withGrowth.activity.note,/not establish unique visitors/);
assert.equal(withGrowth.verifiedEarnings.available,false);
const tampered=buildRevenueIntelligence({growth:{...growth,source:'https://evil.example.com/data'},now});
assert.equal(tampered.activity.available,false,'Only fixed, validated public aggregate evidence is allowed');
const main=readFileSync(new URL('../src/hq-worker.mjs',import.meta.url),'utf8');
assert.match(main,/import \{buildRevenueIntelligence\} from '\.\/revenue-intelligence\.mjs'/);
assert.match(main,/\/api\/revenue-intelligence/);
assert.match(main,/WHERE kind='revenue-trend'/);
assert.match(main,/verifyAccess\(request,env,ctx\)/);
const ui=asset(main,'/hq-simple.js');
assert.match(ui,/Verified YorpHives earnings: Not connected/);
assert.match(ui,/Market Revenue Intelligence/);
assert.match(ui,/Research sources & freshness/);
assert.match(ui,/slice\(0,10\)/);
assert.match(ui,/\/api\/revenue-intelligence/);
assert.doesNotMatch(ui,/document\.write\(/);
const pure=readFileSync(new URL('../src/revenue-intelligence.mjs',import.meta.url),'utf8');
assert.doesNotMatch(pure,/\bfetch\s*\(|\bPOST\b|\bPUT\b|\bDELETE\b/);
console.log('PASS HQ Revenue: verified vs unqualified income; affiliate/partner programs and client leads; read-only founder gates');
