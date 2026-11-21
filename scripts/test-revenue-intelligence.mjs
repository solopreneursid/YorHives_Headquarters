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
assert.deepEqual(base.opportunities.map(x=>x.channel),['HQventures','Free Tools only','Free Tools only']);
assert.equal(base.constraints.advertisingScope,'Free Tools only');
assert.ok(base.constraints.adFreeAreas.includes('HQventures'));
assert.ok(base.constraints.adFreeAreas.includes('YorpHivesHQ'));
assert.equal(base.constraints.freeToolsRemainFree,true);
assert.equal(base.constraints.hqventuresOnlyFounderApprovedProducts,true);
assert.match(base.constraints.supportButton,/disabled/);
assert.ok(base.opportunities.every(x=>x.approvalRequired===true&&x.autoExecute===false));
assert.equal(base.marketSignals.length,0);
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
assert.equal(withSignals.opportunities.length,3,'Unverified external earnings may not outrank actionable company channels');
assert.ok(!withSignals.opportunities.some(x=>x.sourceUrl==='https://trustmrr.com/newsletter'));
const glowy=buildRevenueIntelligence({externalRows:[{kind:'revenue-trend',title:'AI photo creation — Glowy',
  source_url:'https://trustmrr.com/newsletter',observed_at:now,score:71,description:'Third-party revenue claim',
  recommendation:'Niche premium packs require independent validation'}],now});
assert.equal(glowy.marketSignals.length,1,'Third-party claim remains accessible with original evidence');
assert.equal(glowy.marketSignals[0].category,'hqventures','AI photo generation is not automatically a Free Tools ad opportunity');
assert.equal(glowy.marketSignals[0].effortHypothesis,'high');
assert.equal(glowy.opportunities.length,3,'An unverified reported amount alone is not a Top Revenue Opportunity');

assert.equal(withSignals.marketSignals[0].yorphivesRevenue,false);
assert.equal(withSignals.marketSignals[0].profitVerified,false);
assert.equal(withSignals.verifiedEarnings.amount,null);
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
console.log('PASS HQ Revenue: distinct earnings/research, two business areas, source links, privacy and founder-only launch gates');
