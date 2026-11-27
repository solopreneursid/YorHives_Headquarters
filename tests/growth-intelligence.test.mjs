import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECTS,configureProjects,qualifyOpportunity,buildGrowthIntelligence,
 founderReview,prepareCommunicationDraft} from '../src/growth-intelligence.mjs';
import {existingGrowthMetrics,existingRevenueSignals,growthFromExistingEvidence}
 from '../src/growth-intelligence-adapter.mjs';

const NOW='2026-11-27T06:30:00.000Z';
const taxSignal={title:'Open source tax calculator discussion',
 summary:'Developers discuss income tax calculator precision requirements',
 sourceUrl:'https://news.ycombinator.com/item?id=123',
 sourceType:'public-discussion',observedAt:'2026-11-27T06:00:00.000Z'};
const jobSignal={title:'Government job vacancies for students',
 summary:'Community discussion about public sector job recruitment resources',
 sourceUrl:'https://github.com/example/public-jobs/issues/3',
 sourceType:'public-demand-signal',observedAt:'2026-11-26T06:00:00.000Z'};

test('project registration validates uniqueness and metadata',()=>{
 assert.equal(configureProjects().length,3);
 assert.deepEqual(PROJECTS.map(x=>x.id),['yorphives','globalgov','taxpulse']);
 assert.throws(()=>configureProjects([PROJECTS[0],PROJECTS[0]]),/Invalid or duplicate/);
 assert.throws(()=>configureProjects([{id:'x',name:'A',audience:[],keywords:[]}])); 
});

test('relevance is evidence-first and remains separated by project',()=>{
 const value=buildGrowthIntelligence({signals:[taxSignal,jobSignal],now:NOW});
 const byId=Object.fromEntries(value.dossiers.map(d=>[d.project.id,d]));
 assert.equal(value.readOnly,true);
 assert.equal(value.autoOutreach,false);
 assert.equal(value.autoPublishing,false);
 assert.equal(byId.taxpulse.opportunities.length,1);
 assert.equal(byId.globalgov.opportunities.length,1);
 assert.equal(byId.yorphives.opportunities.length,0);
 const card=byId.taxpulse.opportunities[0];
 assert.equal(card.demandVerified,false);
 assert.equal(card.contactPermissionVerified,false);
 assert.equal(card.verifiedRevenue,null);
 assert.equal(card.approvalStatus,'unreviewed');
 assert.ok(card.matchedKeywords.includes('tax'));
 assert.ok(card.relevanceScore>0&&card.relevanceScore<=90);
 assert.equal(card.sourceUrl,taxSignal.sourceUrl);
});

test('no public evidence produces zero opportunities, not fabricated prospects',()=>{
 const value=buildGrowthIntelligence({now:NOW});
 assert.equal(value.sourceRecordsConsidered,0);
 for(const d of value.dossiers){
  assert.deepEqual(d.opportunities,[]);
  assert.equal(d.analytics.available,false);
  assert.equal(d.analytics.uniqueUsers,null);
  assert.equal(d.analytics.verifiedRevenue,null);
 }
});

test('untrusted, misleading, stale or improperly dated evidence is rejected',()=>{
 const project=PROJECTS[2],options={now:NOW};
 for(const sourceUrl of [
  'http://news.ycombinator.com/item?id=123',
  'https://news.ycombinator.com.attacker.invalid/a',
  'https://username:password@news.ycombinator.com/item?id=123',
  'https://127.0.0.1/item?id=123'
 ])assert.equal(qualifyOpportunity(project,{...taxSignal,sourceUrl},options),null);
 assert.equal(qualifyOpportunity(project,{...taxSignal,sourceType:'reported-claim'},options),null);
 assert.equal(qualifyOpportunity(project,{...taxSignal,observedAt:'2026-01-01T00:00:00Z'},options),null);
 assert.equal(qualifyOpportunity(project,{...taxSignal,observedAt:'2026-11-28T06:00:00Z'},options),null);
 assert.equal(qualifyOpportunity(project,{...taxSignal,summary:'x'},options),null);
});

test('duplicates, UTMs and content injection are bounded and sanitized',()=>{
 const content={...taxSignal,summary:
  'Contact alice@example.org <script>alert(1)</script> about a tax calculator.',
  sourceUrl:'https://news.ycombinator.com/item?id=123&utm_campaign=untrusted'};
 const value=buildGrowthIntelligence({signals:[content,content],now:NOW});
 const card=value.dossiers.find(d=>d.project.id==='taxpulse').opportunities[0];
 assert.equal(value.dossiers.find(d=>d.project.id==='taxpulse').opportunities.length,1);
 assert.ok(card.summary.includes('[redacted-contact]'));
 assert.ok(!card.summary.includes('<script>'));
 assert.equal(card.sourceUrl,'https://news.ycombinator.com/item?id=123');
});

test('only founder-reviewed state transitions are modeled, no action occurs',()=>{
 const card=qualifyOpportunity(PROJECTS[2],taxSignal,{now:NOW});
 assert.throws(()=>founderReview(card,{decision:'approved-for-founder',actor:'agent',at:NOW}));
 assert.throws(()=>founderReview(card,{decision:'founder-executed',actor:'founder',at:NOW}));
 const approval=founderReview(card,{decision:'approved-for-founder',actor:'founder',at:NOW,
  note:'Review the source before any contact'});
 assert.equal(approval.communicationSent,false);
 assert.equal(approval.externalActionsPerformed,false);
 const executed=founderReview({...card,approvalStatus:'approved-for-founder'},
  {decision:'founder-executed',actor:'founder',at:NOW});
 assert.equal(executed.status,'founder-executed');
});

test('communication remains a recipient-free unsent draft',()=>{
 const card=qualifyOpportunity(PROJECTS[2],taxSignal,{now:NOW});
 const draft=prepareCommunicationDraft(card,{channel:'partnership',projectName:'TaxPulse'});
 assert.match(draft.subject,/TaxPulse/);
 assert.equal(draft.recipient,null);
 assert.equal(draft.sent,false);
 assert.equal(draft.published,false);
 assert.equal(draft.autoExecute,false);
 assert.equal(draft.status,'requires-founder-review');
 assert.throws(()=>prepareCommunicationDraft(card,{channel:'email-blast'}));
});

test('first-party aggregate metrics do not imply verified people or earnings',()=>{
 const growth={available:true,readOnly:true,source:'https://yorphives.com/api/insights/growth',
  generatedAt:'2026-11-27T06:00:00Z',
  comparison:{recent7dPageViews:72,recent7dCompletedActions:10}};
 const value=buildGrowthIntelligence({now:NOW,metrics:existingGrowthMetrics(growth)});
 const m=value.dossiers.find(d=>d.project.id==='yorphives').analytics;
 assert.equal(m.available,true);
 assert.equal(m.pageViews7d,72);
 assert.equal(m.completedActions7d,10);
 assert.equal(m.uniqueUsers,null);
 assert.equal(m.payingCustomers,null);
 assert.equal(m.verifiedRevenue,null);
 assert.equal(value.dossiers.find(d=>d.project.id==='globalgov').analytics.available,false);
 assert.deepEqual(existingGrowthMetrics({...growth,readOnly:false}),{});
});

test('the existing Revenue interface is reused without guessed source types',()=>{
 const revenue={schemaVersion:1,readOnly:true,
  marketSignals:[{...taxSignal,description:taxSignal.summary},
   {...taxSignal,description:taxSignal.summary}],
  opportunities:[{title:'Program',sourceUrl:'https://www.namecheap.com/affiliates/',
   observedAt:NOW,sourceType:'third-party reported claim'}],
  sources:[{name:'Hacker News',status:'ok:1'}]};
 assert.equal(existingRevenueSignals(revenue).length,1);
 assert.equal(existingRevenueSignals({...revenue,readOnly:false}).length,0);
 const result=growthFromExistingEvidence({revenue,now:NOW});
 assert.equal(result.dossiers.find(d=>d.project.id==='taxpulse').opportunities.length,1);
 assert.equal(result.sourceStatuses.length,1);
 assert.equal(result.integration,'existing-hq-revenue-evidence');
});

test('bounds protect the API from oversized candidate data',()=>{
 assert.throws(()=>buildGrowthIntelligence({signals:new Array(2001).fill(taxSignal),now:NOW}));
 assert.throws(()=>buildGrowthIntelligence({maxPerProject:0,now:NOW}));
 assert.throws(()=>buildGrowthIntelligence({now:'not-a-date'}));
});

test('bounded D1 storage writes only research tables with parameterized SQL',async()=>{
 const {persistGrowthEvidence}=await import('../src/growth-intelligence-store.mjs');
 const snapshot=buildGrowthIntelligence({signals:[taxSignal],now:NOW});
 const calls=[],db={
  prepare(sql){return {bind(...args){return {sql,args}}}},
  async batch(stmts){calls.push(...stmts);return stmts.map(()=>({success:true}))}
 };
 const result=await persistGrowthEvidence(db,snapshot.dossiers,{observedAt:NOW});
 assert.equal(result.storedProjects,3);
 assert.ok(result.statements>=7);
 assert.ok(calls.every(x=>/^INSERT INTO growth_(?:projects|audiences|sources|opportunities)/.test(x.sql)));
 assert.ok(calls.every(x=>!x.sql.includes('approval_status')&&!x.sql.includes('DELETE ')));
 assert.ok(calls.every(x=>!x.sql.includes('mailto:')&&!x.sql.includes('http:')));
 await assert.rejects(()=>persistGrowthEvidence(db,[{project:{id:'invalid!'}}],{observedAt:NOW}));
});
test('read model stays project-scoped and never returns earnings guesses',async()=>{
 const {readGrowthProject}=await import('../src/growth-intelligence-store.mjs');
 const prepared=[];
 const db={prepare(sql){const record={sql,bind(...args){record.args=args;return record},
  async first(){return {id:'taxpulse',name:'TaxPulse',stage:'research'}},
  async all(){return {results:[{id:'growth-a',title:'Tax calculator research',
   summary:'Public discussion with a public source',relevance_score:62,
   audience_hypothesis:'Taxpayers',demand_verified:0,approval_status:'unreviewed',
   discovered_at:NOW,source_url:taxSignal.sourceUrl,source_type:'public-discussion',
   observed_at:taxSignal.observedAt}]}}};prepared.push(record);return record}};
 const value=await readGrowthProject(db,'taxpulse');
 assert.equal(value.available,true);
 assert.equal(value.revenueVerified,false);
 assert.equal(value.externalActionsAllowed,false);
 assert.equal(value.opportunities[0].verifiedRevenue,null);
 assert.equal(prepared.length,2);
 assert.deepEqual(prepared[1].args,['taxpulse',30]);
 assert.match(prepared[1].sql,/WHERE o.project_id=\?/);
 await assert.rejects(()=>readGrowthProject(db,'invalid!'));
});
