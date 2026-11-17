#!/usr/bin/env node
/**
 * Isolated browser tests for the actual embedded HQ UI.
 * No Cloudflare credentials, production DB, or external network.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import http from 'node:http';
import {chromium} from 'playwright';

function bundleFromSource() {
  const source=readFileSync('src/hq-worker.mjs','utf8');
  const marker='const PILOT_STATIC_BUNDLE = ';
  const start=source.indexOf(marker);
  assert.ok(start>=0);
  const first=source.indexOf('{',start+marker.length);
  let depth=0,quote=false,esc=false,last=-1;
  for(let i=first;i<source.length;i++){
    const c=source[i];
    if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')quote=false;}
    else if(c==='"')quote=true;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0){last=i+1;break;}
  }
  assert.ok(last>first);
  return JSON.parse(source.slice(first,last));
}
const bundle=bundleFromSource();
const report={
  schemaVersion:'yorphives.hq-intelligence.v1',
  operationalReadiness:{version:'operational-evidence-v1',
    research:{repositories:2,manifestsObserved:1,manifestsParsed:0,
      manifestsAwaitingParse:1,repositoriesWithoutManifest:1,
      dailyManifestFetchUsed:2,dailyManifestFetchLimit:2,dailyManifestFetchRemaining:0,
      nextEligibleBackfillWindow:'2026-11-18T00:45:00Z',
      latestManifestStatus:'budget-reached',
      backfillMeaning:'Eligible UTC window only; quota and availability apply.',
      sourceEvidenceOnly:true,licenseCleared:false,completeDependencyAudit:false},
    scheduler:{lastObserved:'2026-11-17T08:00:00Z',observedCurrent:true,
      observationAgeMinutes:5,independentlyTested:false},
    founder:{researchReviewEntries:0,evidenceEntries:0,signedInJourneyVerified:false},
    openWorkstreams:[
      {id:'authenticated-e2e',name:'Signed-in founder browser tests',status:'manual-required'},
      {id:'research-evidence',name:'Repository, license and dependency verification',status:'attention'},
      {id:'website-functional',name:'Real tool, security and incident E2E monitoring',status:'pending'},
      {id:'recovery-release',name:'Production restore and founder release verification',status:'pending'},
      {id:'private-ai',name:'Persistent founder-owned inference server',status:'pending'},
      {id:'experiment',name:'Isolated founder-authorized experiments and independent QA',status:'pending'},
      {id:'market-revenue',name:'Verified market outcomes and financial reporting',status:'pending'},
      {id:'portable-runtime',name:'Self-hosted runtime and source-independent deployment',status:'pending'}
    ],productionReady:false,fullySelfHosted:false,
    checksScope:'Read-only D1 report records, not an independent login, functionality or rights audit.'},

  generatedAt:'2026-11-16T10:00:00Z',
  assets:[{id:'site',name:'YorpHives.com',kind:'website',status:'healthy'}],
  products:[],
  findings:[{id:'finding-1',title:'Synthetic homepage outage',category:'reliability',priority:'high',asset:'https://yorphives.com',description:'Mock-only finding',recommendation:'Check uptime independently',observedAt:'2026-11-16T10:00:00Z',evidence:['https://yorphives.com/']}],
  incidents:[
    {id:'inc-1',title:'Synthetic incident — OPEN',category:'reliability',severity:'high',asset:'https://yorphives.com',status:'open',firstSeen:'2026-11-16T09:50:00Z',lastSeen:'2026-11-16T10:00:00Z',resolvedAt:null,description:'Test-only record',recommendation:'Review external evidence',evidence:'https://yorphives.com/',occurrences:1,recoveryVerified:false},
    {id:'inc-2',title:'Synthetic incident — RECOVERED',category:'reliability',severity:'medium',asset:'https://yorphives.com',status:'resolved',firstSeen:'2026-11-16T08:00:00Z',lastSeen:'2026-11-16T09:00:00Z',resolvedAt:'2026-11-16T09:00:00Z',description:'Test-only resolved record',recommendation:'Independently verify recovery',evidence:'https://yorphives.com/',occurrences:2,recoveryVerified:false}
  ],
  memory:{entries:[{memoryId:'memory-finding-abc',runId:'finding-abc',kind:'finding',department:'Security & Independent QA',title:'Synthetic shared memory evidence',evidenceState:'source-recorded-unverified',sourceUrl:'https://yorphives.com/',recommendation:'Founder check source',reviewState:'founder-review',observedAt:'2026-11-16T10:00:00Z',recordedAt:'2026-11-16T10:00:00Z'}]},
  nanoPipeline:{status:'created:2',checkedAt:'2026-11-16T10:00:00Z'},
  opportunityBriefs:{available:2,generated:2,pipelineStatus:'brief-recorded:agent-workforce',
    state:'research-hypotheses-only',top:[
      {memoryId:'memory-opportunity-aabbccdd',title:'Synthetic developer agent skill workflows',category:'agent-workforce',
       stage:'research-needed',rank:57,fitHypothesis:'Potential YorpHives HQ workforce component',
       buildHypothesis:'Investigate a self-hostable agent skills utility',
       adoptHypothesis:'Compare compatible permissive open-source libraries',
       revenueHypothesis:'Possible integration service, not proven revenue',
       proposedValidation:'Compare two portable tools and three independent user complaints',
       metadataCheck:'Platform metadata checked, not underlying assertions',
       evidence:[{kind:'first-party-metadata',label:'GitHub platform record',url:'https://github.com/itsmeyaw/skillset'}],
       risks:['Demand and revenue not independently verified'],evidenceGaps:['Obtain independent firsthand user problems'],
       departments:[{name:'Research & Innovation',task:'Check alternative tools'},{name:'Security & Independent QA',task:'Verify licenses'}],
       independentlyVerifiedDemand:false,independentlyVerifiedRevenue:false,automatedExecution:false,founderApproved:false},
      {memoryId:'memory-opportunity-ddccbb12',title:'Synthetic internal QA automation problem',category:'quality-automation',
       stage:'research-needed',rank:51,fitHypothesis:'Potential YorpHives QA tool',
       buildHypothesis:'Investigate an isolated test tool',
       adoptHypothesis:'Compare self-hosted QA options',
       revenueHypothesis:'Potential support service only',
       proposedValidation:'Collect source-backed QA problems',metadataCheck:'No confirmed platform metadata',
       evidence:[{kind:'recorded-link',url:'https://dev.to/author/testing-workflows'}],risks:[],
       evidenceGaps:['Independent user evidence required'],departments:[],
       independentlyVerifiedDemand:false,independentlyVerifiedRevenue:false,founderApproved:false,automatedExecution:false}
     ]},

  implementationEvidence:{pipelineStatus:'repository-metadata-checked:robot-paper',checked:2,linked:1,
    metadataChecked:1,scope:'Only first-party metadata; technical claims are not verified.',entries:[
    {paperId:'robot-paper',title:'Robot-use agents from simulation',paperUrl:'https://arxiv.org/abs/2611.18562',
      state:'repository-metadata-checked',repositoryUrl:'https://github.com/research-team/robot-kit',
      licenseSpdx:'Apache-2.0',evidence:'Public GitHub metadata, not independent replication',
      lastChecked:'2026-11-16T16:40:00Z',nextCheck:'2026-11-30T16:40:00Z',repositoryDescription:'Unverified demo',
      archived:false,sourceCodeInspected:false,reproducibilityVerified:false},
    {paperId:'other-paper',title:'Unverified physics paper',paperUrl:'https://arxiv.org/abs/2611.18546',
      state:'no-repository-link-observed',repositoryUrl:null,licenseSpdx:null,
      evidence:'No qualifying GitHub link was seen in the page.',
      lastChecked:'2026-11-16T16:50:00Z',nextCheck:'2026-11-23T16:50:00Z'}]},
  feasibilityReviews:{reviewed:1,sourceMetadataChecked:1,highCostSignals:1,fullyValidated:0,
    scope:'Provisional metadata-only assessment; licenses, dependencies and cost NOT verified.',
    entries:[{paperId:'robot-paper',title:'Robot-use agents from simulation',
      paperUrl:'https://arxiv.org/abs/2611.18562',repositoryUrl:'https://github.com/research-team/robot-kit',
      relationship:'title-search-candidate-unconfirmed',licenseSpdx:'Apache-2.0',
      licenseDisposition:'human-review-required; not cleared',dependencyDisposition:'not-inspected',
      hardwareDisposition:'possible-specialized-hardware-cost; unverified',
      outcome:'defer-until-hardware-budget-established',
      blockers:['Repository-paper connection not confirmed','Direct and transitive dependencies not inspected'],
      steps:['Verify upstream provenance','Obtain founder approval before any isolated execution']} ]},
  manifestEvidence:{pipelineStatus:'complete:robot-paper',eligible:1,filesObserved:2,licenseFilesObserved:1,
   verifiedLegalClearances:0,budget:'Max two public GitHub GETs per UTC day',
   scope:'SHA-pinned root files only; license and dependencies not approved',entries:[
   {paperId:'robot-paper',title:'Robot-use agents from simulation',paperUrl:'https://arxiv.org/abs/2611.18562',
    repositoryUrl:'https://github.com/research-team/robot-kit',state:'complete',selectedRootFiles:['package.json','LICENSE'],
    files:[{path:'package.json',kind:'manifest',sha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      bytes:120,manifestParser:'package-json-names-only',directNamesObserved:2,exampleNames:['react','zod']},
      {path:'LICENSE',kind:'license',sha:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
       bytes:800,licenseFileObserved:true}]}]},

  experimentGateEvidence:{available:true,eligible:1,recordedEntries:1,
   currentGateEvidence:0,staleGateEvidence:1,currentBlockers:0,independentlyVerified:0,
   preflightReady:0,executionAuthorized:false,commercialUseApproved:false,
   caution:'All gates remain UNVERIFIED. Submitted links are not independent audit evidence.',
   cost:'No external verification or paid services.',
   entries:[{paperId:'robot-paper',title:'Robot-use agents from simulation',
     repositoryUrl:'https://github.com/research-team/robot-kit',
     manifestSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
     founderReviewVersion:1,founderReviewCurrent:false,status:'review-stale',
     gateCount:10,currentEvidenceEntries:0,staleEvidenceEntries:1,
     independentClearances:0,legallyApproved:false,executionApproved:false,
     gates:Array.from({length:10},(_,i)=>({
       key:['authorship','source','dependencies','licenses','data',
        'isolation','hardware','cost','acceptance','permission'][i],
       name:i===0?'Research-to-code identity':i===3?'Full software and asset rights':'Verification gate '+(i+1),
       proofNeeded:'Collect independent source-linked proof before considering action.',
       existingObservation:'No legal, hardware or execution clearance.',
       revision:i===0?1:0,
       latest:i===0?{revision:1,assessment:'evidence-submitted',
         type:'research-source',
         evidenceUrl:'https://github.com/research-team/robot-kit/blob/main/LICENSE',
         explanation:'The linked file belongs to an older source snapshot, not independently checked.',
         recordedAt:'2026-11-16T19:30:00Z',sourceCurrent:false,verifiedIndependently:false}:null,
       history:i===0?[{revision:1,assessment:'evidence-submitted',sourceCurrent:false}]:[],
       independentlyVerified:false,approved:false}))}]},
  experimentPlans:{eligible:1,preflightReady:0,automaticallyRun:0,commerciallyApproved:0,
   plansWithCurrentFounderIntent:0,
   scope:'Evidence-linked MANUAL experiment design. All execution/legal/hardware gates remain unverified.',
   cost:'Zero additional HTTP calls, D1 writes, AI models, Cron schedules or subscriptions in Phase 17.',
   entries:[{paperId:'robot-paper',title:'Robot-use agents from simulation',
    paperUrl:'https://arxiv.org/abs/2611.18562',
    repositoryUrl:'https://github.com/research-team/robot-kit',
    manifestSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    sourceDescription:'Title-search candidate only; paper authorship unconfirmed',
    sourceStatus:'Some declared names extracted from one root manifest',
    planStatus:'review-stale',founderReviewRevision:1,
    founderReviewCurrent:false,founderReviewDisposition:null,
    declaredNameCount:8,licenseFileObserved:true,
    computeSignals:['possible-gpu-or-accelerator-stack','robotics-or-simulation'],
    proposedCaps:{inr:0,runtimeMinutes:0,spentInr:null,capRecorded:false,
      notSpendingAuthorization:true,estimate:'No measured cost or quote; caps are planning bounds only.'},
    preflightVerified:0,gatesTotal:10,
    preflightGates:Array.from({length:10},(_,i)=>({key:'g-'+i,
      name:i===0?'Research-to-code identity':i===3?'Full software and asset rights':'Gate '+(i+1),
      status:i===1?'root-manifest-observed':'unverified',
      evidence:i===1?'Root manifest SHA pinned, not deployment proof':'No independent evidence yet.',
      proof:'Obtain independent source-linked human verification evidence.'})),
    stages:Array.from({length:5},(_,i)=>({order:i+1,name:'Manual stage '+(i+1),
      owner:'Founder/manual reviewer',work:'Review evidence and verify it independently.',
      output:'Human-reviewed evidence record'})),
    stopConditions:['Stop if rights are unclear','Stop if credentials are requested',
      'Stop before spending ceilings','Stop if repeatability fails'],
    independentSuccess:'Reproducible independent baseline with measured resources.',
    outcome:'Not executed; no measured cost, license clearance or outcome.',
    readiness:'NOT approved to execute',automatedExecution:false,
    commercialReuseApproved:false,measuredCost:false,founderExecutionAuthorized:false,
    version:'source-grounded-manual-experiment-plan-v1'}]},
  founderResearchReviews:{available:true,candidates:1,reviewRecords:1,currentlyReviewed:0,
    needingRefresh:1,automatedExecution:false,commercialClearance:false,
    scope:'Founder planning records only. No code execution, deployments, license clearance or paid spend.',
    note:'Changing selected manifest SHA marks older reviews stale.',entries:[
      {paperId:'robot-paper',title:'Robot-use agents from simulation',
       paperUrl:'https://arxiv.org/abs/2611.18562',repositoryUrl:'https://github.com/research-team/robot-kit',
       manifestSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
       manifestStatus:'Some declared names extracted from one root manifest',
       provenance:'Title-search candidate; repository/paper link unconfirmed',
       hardware:'Possible specialized-compute signal, not a requirement',
       licenseStatus:'Legal rights and dependency terms unverified',
       revision:1,latest:{version:1,disposition:'needs-evidence',licenseConcern:'unreviewed',
        technicalConcern:'unknown',maxBudgetInr:0,maxRuntimeMinutes:0,
        reason:'The repository authors are not verified.',nextStep:'Confirm research provenance.',
        evidenceCurrent:false,canExecute:false,licenseCleared:false,spendingAuthorized:false},
       history:[{version:1,disposition:'needs-evidence',
        reason:'The repository authors are not verified.',evidenceCurrent:false}]}]},
  dependencySignals:{eligible:1,partiallyParsed:1,computeSignalsObserved:1,legallyApproved:0,
    hardwareBenchmarked:0,automatedExecution:false,
    scope:'Partial declared names; no legal or cost verification.',
    networkCost:'Zero extra API calls; Phase 14 shared budget.',
    entries:[{paperId:'robot-paper',title:'Robot-use agents from simulation',
      paperUrl:'https://arxiv.org/abs/2611.18562',repositoryUrl:'https://github.com/research-team/robot-kit',
      relationship:'Title-search candidate only; paper/repository authorship NOT confirmed',
      manifestStatus:'Some declared names extracted from one root manifest',
      manifestName:'pyproject.toml',manifestSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      manifestParser:'pyproject-declared-subset-v1',declaredNameCount:8,
      requiredNameCount:0,optionalNameCount:8,nameExamples:['torch','mujoco','vllm'],
      computeSignals:['possible-gpu-or-accelerator-stack','robotics-or-simulation'],
      hardwareAssessment:'Possible specialized-compute signal, not a requirement',
      cashCost:'unmeasured; no reliable cost estimate',repoSpdx:'Apache-2.0',
      repoSpdxStatus:'GitHub-reported license identifier, not clearance',
      licenseFileObserved:true,licenseAssessment:'Unreviewed: copyright, dependency licenses, models and datasets',
      codeExecuted:false,commercialUseCleared:false,
      steps:['Founder approval before running external code','Verify dependency copyright and licenses']}]},
  scienceReviews:{pipelineStatus:'review-recorded:workflow-resilience',reviewed:2,needsReview:2,watch:0,
   independentCodeChecks:0,experimentalRuns:0,commercialValidation:0,top:[
    {paperId:'paper-test-a',title:'Synthetic resilient autonomous laboratory workflows',
     sourceId:'arxiv',sourceUrl:'https://arxiv.org/abs/2611.18496',category:'workflow-resilience',
     stage:'review-needed',researchPriority:47,applicationHypothesis:'Potential lessons for HQ incident recovery',
     possibleExperiment:'Simulate an incident in an isolated local test environment',
     transferRisk:'Hardware recovery algorithms may not transfer to websites',
     evidenceScope:'Author-provided abstract excerpt and bibliographic metadata only',
     authorExcerpts:[{text:'We investigate synthetic failure recovery in controlled laboratories.',verified:false,kind:'author-abstract-excerpt'}],
     methodMentions:['Author abstract mentions simulation'],implementationStatus:{code:'not-checked'},
     missingEvidence:['Find a licensed code implementation','Check independent replication'],
     scientificClaimsReproduced:false,customerDemandVerified:false,revenueVerified:false,
     founderApproved:false,automatedExecution:false},
    {paperId:'paper-test-b',title:'Synthetic monitoring and predictive planning',sourceId:'arxiv',
     sourceUrl:'https://arxiv.org/abs/2611.18501',category:'monitoring-intelligence',
     stage:'review-needed',researchPriority:45,applicationHypothesis:'Possible HQ monitoring improvement',
     possibleExperiment:'Compare with a synthetic offline monitoring baseline',transferRisk:'Domain mismatch',
     evidenceScope:'Bibliographic metadata only',authorExcerpts:[],methodMentions:[],
     missingEvidence:['Obtain full paper'],scientificClaimsReproduced:false,founderApproved:false,automatedExecution:false}
    ]},
  researchJournals:{pipelineStatus:'ok:crossref:saved:1',recordCount:1,active:1,sources:[
    {id:'crossref',name:'Crossref',status:'ok',detail:'metadata:1',
      lastChecked:'2026-11-16T15:00:00Z',nextCheckAt:'2026-11-17T15:00:00Z'},
    {id:'arxiv',name:'arXiv',status:'unavailable',detail:'source-http-503',
      lastChecked:'2026-11-16T15:05:00Z',nextCheckAt:'2026-11-17T15:05:00Z'}],
   entries:[{id:'journal-test-1',title:'Modular AI agents for software verification',
     url:'https://doi.org/10.1234/verified-source',sourceId:'crossref',sourceType:'journal-article',
     topicId:'ai',publishedAt:'2026-11-10',publicationAge:'published-within-one-year',relevanceRank:47,
     abstract:'',possibleUse:'Could inform a replaceable AI model, agent, or automation component',
     nextStep:'Review original work and compare independent evidence',
     checks:['Read the original paper','Verify original results'],
     claimsReproduced:false,customerDemandVerified:false,licenseVerified:false,founderApproved:false}]},
  globalSources:{pipelineStatus:'rate-limited:openalex:new:0',active:2,screened:2,candidates:1,filtered:1,limited:1,
   sourceSignals:[{sourceIds:['dev','crossref'],sharedTerms:['customer','support'],verifiedDemand:false,evidence:'Two sources share a topic, not proof of demand'}],sources:[
    {id:'dev',name:'DEV Community',category:'Developer problems',status:'listing-recorded',newCount:1,note:'Contributor posts only'},
    {id:'hf',name:'Hugging Face',category:'AI models',status:'listing-recorded',newCount:1,note:'Licenses unverified'},
    {id:'openalex',name:'OpenAlex',category:'Research',status:'rate-limited',newCount:0,retryAt:'2026-11-18T10:00:00Z',note:'Bibliographic evidence only'},
    {id:'crossref',name:'Crossref',category:'Alternative research',status:'not-attempted',newCount:0,note:'Publisher metadata only'}
   ],entries:[{id:'global-synthetic',sourceId:'dev',kind:'community',title:'Synthetic open-source AI agent workflow',
     sourceUrl:'https://dev.to/author/agent-workflow',summary:'Unverified public discussion',
     quality:{grade:'candidate',reason:'Specific technical problem but needs validation'},
     observedAt:'2026-11-16T10:00:00Z',verifiedDemand:false,verifiedRevenue:false},
     {id:'global-publicity',sourceId:'dev',kind:'community',title:'Congrats to the AI Challenge Winners!',
      sourceUrl:'https://dev.to/author/ai-winners',summary:'Publicity only',
      quality:{grade:'filtered',reason:'Announcement and publicity without a specific problem'},
      observedAt:'2026-11-16T10:00:00Z',verifiedDemand:false,verifiedRevenue:false}]},


  investigations:{checked:2,crossPlatform:1,confirmed:2,pending:0,pipelineStatus:'cross-platform-metadata-confirmed',
    entries:[{memoryId:'memory-opportunity-mock',title:'Synthetic AI developer project',
      department:'Research & Innovation',state:'cross-platform-metadata-confirmed',
      primaryUrl:'https://news.ycombinator.com/item?id=123',
      secondaryUrl:'https://github.com/acme/freedom-tools',
      facts:[{provider:'Hacker News',url:'https://news.ycombinator.com/item?id=123',points:8,comments:2,notes:'Not verified customer demand'},
       {provider:'GitHub',url:'https://github.com/acme/freedom-tools',project:'acme/freedom-tools',description:'Mock open-source project',stars:10,forks:1,notes:'Not verified functionality'}],
      checklist:[{department:'Security & Independent QA',question:'Review licensing and security before reuse.'}],
      checkedAt:'2026-11-16T10:00:00Z',demandVerified:false,revenueVerified:false,productFunctionalityVerified:false
    },{memoryId:'memory-opportunity-unsupported',title:'Unsupported public lead',
      department:'Research & Innovation',state:'unsupported-source',
      primaryUrl:'',secondaryUrl:'',facts:[],checklist:[],checkedAt:'2026-11-16T10:00:00Z',
      demandVerified:false,revenueVerified:false,productFunctionalityVerified:false}]},

  triage:{reviewCount:1,researchFirst:1,screened:2,pipelineStatus:'updated:2',autoAiStatus:'disabled',
    ready:[{memoryId:'memory-finding-abc',sourceKind:'finding',sourceId:'finding-1',department:'Engineering & Operations',
      title:'Synthetic homepage outage',score:95,state:'review-now',action:'Founder: verify failure independently',
      evidenceState:'source-recorded-unverified',verified:false}]},

  workflows:[{runId:'finding-abc',kind:'finding',sourceId:'finding-1',department:'Security & Independent QA',revision:1,
    stage:'founder_review',reviewState:'founder-review',evidenceState:'source-recorded-unverified',
    title:'Synthetic orchestrated investigation',recommendation:'Founder to review source',
    stages:[{name:'observe',state:'recorded',note:'Already in HQ evidence'},
      {name:'route',state:'routed',note:'Security & Independent QA'},
      {name:'evaluate',state:'evaluated',note:'Description exists'},
      {name:'evidence_check',state:'source-recorded',note:'Not independently verified'},
      {name:'recommend',state:'draft-recorded',note:'Existing HQ recommendation'},
      {name:'founder_review',state:'pending',note:'Founder decision'}],
    observedAt:'2026-11-16T10:00:00Z',createdAt:'2026-11-16T10:00:00Z'}],
  incidentEvents:[
    {sequence:3,incidentId:'inc-1',transition:'detected',observedAt:'2026-11-16T10:00:00Z',evidence:'https://yorphives.com/'},
    {sequence:2,incidentId:'inc-2',transition:'resolved',observedAt:'2026-11-16T09:00:00Z',evidence:'https://yorphives.com/'},
    {sequence:1,incidentId:'inc-2',transition:'detected',observedAt:'2026-11-16T08:00:00Z',evidence:'https://yorphives.com/'}
  ],
  opportunities:[{id:'opp-1',title:'Synthetic research result',category:'product',description:'Test-only',observedAt:'2026-11-16T09:00:00Z'}],
  activity:[{id:'activity-1',title:'Scheduler checked',summary:'Test-only',occurredAt:'2026-11-16T09:30:00Z'}],
  changes:[],
  operating:{pending:1,queue:[],threads:[{id:'finding-1',thread:'finding:finding-1',type:'finding',title:'Synthetic homepage outage',status:'proposed',needsDecision:true,contract:{freshness:'recent'}}],aiStatus:'Not connected'},
  decisionJournal:{available:false,events:[]},
  hqHealth:{status:'responding',api:'responding',database:'responding',collector:'current',lastCollectorCheck:'2026-11-16T09:30:00Z'}
};
const mime=(pathname)=>pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.html')?'text/html':pathname.endsWith('.webp')?'image/webp':'text/plain';
const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  res.setHeader('cache-control','no-store');
  res.setHeader('x-test-data','synthetic-no-production');
  if(path==='/api/report') {res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(report));return;}
  if(path.startsWith('/api/')) {res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:'Test server: external lookups disabled'}));return;}
  const pageLink=/^\/(home|discover|team|decisions|growth|control)\/?$/.exec(path);
  if(pageLink){res.writeHead(302,{location:'/#'+pageLink[1]});res.end();return;}
  const file=path==='/'?'/index.html':path;
  if(!(file in bundle)){res.writeHead(404);res.end('Not found');return;}
  const raw=bundle[file];
  if(file.endsWith('.webp')) {res.writeHead(200,{'content-type':mime(file)});res.end(Buffer.from(raw,'base64'));return;}
  res.writeHead(200,{'content-type':mime(file)});res.end(raw);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser,failures=0;
async function test(name,callback){
  try{await callback();console.log('PASS: '+name);}
  catch(e){failures++;console.error('FAIL: '+name+' — '+String(e.stack||e));}
}
try{
  browser=await chromium.launch({headless:true});
  for(const profile of [{name:'desktop',viewport:{width:1366,height:850},isMobile:false},{name:'mobile',viewport:{width:390,height:844},isMobile:true}]){
    const page=await browser.newPage({viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.isMobile,acceptDownloads:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await test(profile.name+': direct AI Employees link survives source query',async()=>{
      await page.goto(origin+'/team?utm_source=chatgpt.com',{waitUntil:'domcontentloaded'});
      await page.getByText('Learning playbooks',{exact:true}).waitFor();
      assert.ok(page.url().endsWith('/#team'),'Deep link must load the actual team page');
      assert.ok((await page.locator('#page-root').innerText()).includes('Shared memory'));
    });
    await test(profile.name+': homepage and live mock report',async()=>{
      await page.goto(origin+'/#home',{waitUntil:'domcontentloaded'});
      await page.locator('#page-root').getByText('HQpulse').first().waitFor();
      await page.locator('.incident-item').first().waitFor();
      assert.equal(await page.locator('.incident-item').count(),2);
      assert.ok((await page.locator('#page-root').innerText()).includes('Synthetic incident'));
    });
    await test(profile.name+': Phase 19 Control readiness is evidence-limited',async()=>{
      await page.goto(origin+'/#control',{waitUntil:'domcontentloaded'});
      const readiness=page.locator('.panel').filter({hasText:'Phase 19 · Reliability & readiness'});
      await readiness.getByText('Phase 19 · Reliability & readiness',{exact:true}).waitFor();
      const report=await readiness.innerText();
      assert.ok(report.includes('PILOT · NOT PRODUCTION-READY'));
      assert.ok(report.includes('Unparsed SHA-pinned manifests'));
      assert.ok(report.includes('1 pending'));
      assert.ok(report.includes('2 / 2'));
      assert.ok(report.includes('Next eligible parser backfill slot'));
      assert.ok(report.includes('two-GET daily cap is unchanged'));
      assert.ok(report.includes('not independent monitoring'));
      await readiness.locator('details.science-evidence-more summary').click();
      const expanded=await readiness.innerText();
      assert.ok(expanded.includes('Remaining HQ workstreams (8)'));
      assert.ok(expanded.includes('Signed-in founder browser tests'));
      assert.ok(expanded.includes('Production restore and founder release verification'));
      assert.ok(expanded.includes('Persistent founder-owned inference server'));
      await page.goto(origin+'/#home',{waitUntil:'domcontentloaded'});
    });
    await test(profile.name+': incident details and recovery evidence',async()=>{
      const incident=page.locator('.incident-item').nth(1);
      await incident.locator('summary').click();
      assert.equal(await incident.getAttribute('open'),'');
      const txt=await incident.innerText();
      assert.ok(txt.includes('Independent recovery verification'));
      assert.ok(txt.includes('Not completed'));
      assert.ok(txt.includes('Investigation checklist'));
      assert.ok(txt.includes('Founder review required')||txt.includes('founder review required'));
      assert.ok(txt.includes('resolved'));
    });
    await test(profile.name+': HQpulse search and filters',async()=>{
      await page.locator('#pulse-query').fill('Synthetic homepage outage');
      await page.locator('.pulse-row').first().waitFor();
      assert.equal(await page.locator('.pulse-row').count(),1);
      await page.locator('#pulse-query').fill('Nothing matches this test');
      assert.equal(await page.locator('.pulse-row').count(),0);
      await page.locator('#pulse-query').fill('');
      const alerts=page.locator('[data-pulse-filter="alerts"]');
      await alerts.first().click();
      assert.equal(await page.locator('.pulse-row').count(),1);
    });
    await test(profile.name+': navigation, back and protected session continuity',async()=>{
      await page.locator('[data-page="discover"]:visible').first().click();
      assert.ok(page.url().endsWith('#discover'));
      if(profile.isMobile) await page.locator('#more-button').click();
      await page.locator('[data-page="control"]:visible').first().click();
      assert.ok(page.url().endsWith('#control'));
      const back=profile.isMobile?'#mobile-back-button':'#back-button';
      await page.locator(back).click();
      assert.ok(page.url().endsWith('#discover'),'Back should return to Discover');
      assert.equal(await page.evaluate(()=>document.cookie),'');
      await page.locator('[data-page="home"]:visible').first().click();
      assert.ok(page.url().endsWith('#home'));
    });
    await test(profile.name+': automatic triage shows only source-backed priority',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Priority shortlist',{exact:true}).waitFor();
      const panel=page.locator('.panel').filter({hasText:'Priority shortlist'});
      assert.equal(await panel.locator('.triage-card').count(),1);
      assert.ok((await panel.innerText()).includes('Synthetic homepage outage'));
      assert.ok((await panel.innerText()).includes('need independent evidence'));
      await page.locator('[data-page="decisions"]:visible').first().click();
      assert.equal(await page.locator('.triage-card').count(),1);
      const backlog=page.locator('.triage-backlog').first();
      assert.ok(await backlog.count()>=1);
      assert.equal(await backlog.getAttribute('open'),null,'Backlog is collapsed by default');
      const learningPage=page.locator('[data-page="team"]:visible').first();
      await learningPage.click();
      const optional=page.locator('.panel').filter({hasText:'Learning playbooks'}).locator('details.triage-backlog');
      assert.equal(await optional.getAttribute('open'),null,'Long feedback form starts collapsed');
    });
    await test(profile.name+': opportunity hypotheses and strict founder gates',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Opportunity briefs',{exact:true}).waitFor();
      const panel=page.locator('.panel').filter({hasText:'Opportunity briefs'});
      assert.equal(await panel.locator('.brief-card').count(),2);
      assert.ok((await panel.innerText()).includes('zero independently verified customer demand'));
      const card=panel.locator('details.brief-card').first();
      assert.equal(await card.getAttribute('open'),null);
      await card.locator('summary.brief-summary').click();
      const text=await card.innerText();
      assert.ok(text.includes('Possible integration service, not proven revenue'));
      assert.ok(text.includes('Platform metadata checked, not underlying assertions'));
      assert.ok(text.includes('Nothing was deployed, purchased, or approved.'));
      assert.ok(text.includes('not evidence confidence'));
      assert.equal(await card.locator('a[href="https://github.com/itsmeyaw/skillset"]').count(),1);
      assert.equal(await card.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),1);
      await card.locator('.brief-checks').last().locator('summary').click();
      assert.ok((await card.innerText()).includes('Security & Independent QA'));
    });
    await test(profile.name+': implementation evidence never claims code verification',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Implementation evidence',{exact:true}).waitFor();
      const panel=page.locator('.panel').filter({hasText:'Implementation evidence'});
      assert.equal(await panel.locator('details.implementation-entry').count(),2);
      assert.ok((await panel.innerText()).includes('Verified reproducibility: 0'));
      const first=panel.locator('details.implementation-entry').first();
      assert.equal(await first.getAttribute('open'),null);
      await first.locator('summary').click();
      const text=await first.innerText();
      assert.ok(text.includes('not verified'));
      assert.ok(text.includes('Apache-2.0'));
      assert.ok(text.includes('not legal approval'));
      assert.ok(text.includes('No code downloaded, run, modified or deployed.'));
      assert.equal(await first.locator('a[href="https://arxiv.org/abs/2611.18562"]').count(),1);
      assert.equal(await first.locator('a[href="https://github.com/research-team/robot-kit"]').count(),1);
      assert.equal(await first.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Implementation evidence'}).locator('details.implementation-entry').count(),2);
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 13 · Implementation feasibility'}).locator('details.implementation-entry').count(),1);
    });
    await test(profile.name+': Phase 13 feasibility stays provisional on mobile and desktop',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Phase 13 · Implementation feasibility'});
      await panel.getByText('Phase 13 · Implementation feasibility',{exact:true}).waitFor();
      assert.ok((await panel.innerText()).includes('0 independently validated'));
      const row=panel.locator('details.implementation-entry').first();
      assert.equal(await row.getAttribute('open'),null);
      await row.locator('summary').click();
      const txt=await row.innerText();
      assert.ok(txt.includes('not a license clearance'));
      assert.ok(txt.includes('not-inspected'));
      assert.ok(txt.includes('possible-specialized-hardware-cost; unverified'));
      assert.ok(txt.includes('human-review-required; not cleared'));
      assert.ok(txt.includes('founder approval'));
      assert.equal(await row.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 13 · Implementation feasibility'})
        .locator('details.implementation-entry').count(),1);
    });
    await test(profile.name+': Phase 14 SHA-pinned manifest evidence, no legal clearance',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Phase 14 · Manifest & license evidence'});
      await panel.getByText('Phase 14 · Manifest & license evidence',{exact:true}).waitFor();
      assert.ok((await panel.innerText()).includes('0 legal clearances'));
      const card=panel.locator('details.implementation-entry').first();
      assert.equal(await card.getAttribute('open'),null);
      await card.locator('summary').click();
      const txt=await card.innerText();
      assert.ok(txt.includes('not approval to copy or run code'));
      assert.ok(txt.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
      assert.ok(txt.includes('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'));
      assert.ok(txt.includes('License text observed, NOT legal approval.'));
      assert.ok(txt.includes('not a complete inventory'));
      assert.ok(txt.includes('No code was run'));
      assert.equal(await card.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 14 · Manifest & license evidence'})
        .locator('details.implementation-entry').count(),1);
    });
    await test(profile.name+': Phase 15 dependency evidence is cautious on mobile and desktop',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Phase 15 · Dependency & compute signals'});
      await panel.getByText('Phase 15 · Dependency & compute signals',{exact:true}).waitFor();
      assert.ok((await panel.innerText()).includes('0 license approvals or benchmarks'));
      const row=panel.locator('details.implementation-entry').first();
      assert.equal(await row.getAttribute('open'),null);
      await row.locator('summary').click();
      const content=await row.innerText();
      assert.ok(content.includes('repository authorship proved'));
      assert.ok(content.includes('pyproject.toml'));
      assert.ok(content.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
      assert.ok(content.includes('8 distinct observed names'));
      assert.ok(content.includes('extras/group names'));
      assert.ok(content.includes('possible-gpu-or-accelerator-stack'));
      assert.ok(content.includes('not verified hardware requirements'));
      assert.ok(content.includes('no reliable cost estimate'));
      assert.ok(content.includes('not clearance'));
      assert.ok(content.includes('founder')||content.includes('Founder'));
      assert.equal(await row.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 15 · Dependency & compute signals'})
       .locator('details.implementation-entry').count(),1);
    });
    await test(profile.name+': Phase 16 owner decisions are private planning only',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Phase 16 · Founder research decisions'});
      await panel.getByText('Phase 16 · Founder research decisions',{exact:true}).waitFor();
      assert.ok((await panel.innerText()).includes('1 evidence revisions need review'));
      const card=panel.locator('details.implementation-entry').first();
      assert.equal(await card.getAttribute('open'),null);
      await card.locator('summary').first().click();
      const text=await card.innerText();
      assert.ok(text.includes('not license approval'));
      assert.ok(text.includes('previous evidence'));
      assert.ok(text.includes('revision 1'));
      assert.ok(text.includes('max proposed ₹0'));
      const formMore=card.locator('details.triage-backlog').first();
      assert.equal(await formMore.getAttribute('open'),null);
      await formMore.locator('summary').click();
      const form=card.locator('form.research-review-form');
      await form.locator('select[name="disposition"]').selectOption('plan-isolated-test');
      await form.locator('select[name="licenseConcern"]').selectOption('manual-legal-review');
      await form.locator('select[name="technicalConcern"]').selectOption('needs-validation');
      await form.locator('input[name="maxBudgetInr"]').fill('0');
      await form.locator('input[name="maxRuntimeMinutes"]').fill('5');
      await form.locator('textarea[name="reason"]').fill('Only a future isolated test could validate the observed hardware signals.');
      await form.locator('textarea[name="nextStep"]').fill('Check license and independent evidence before any manual test request.');
      const [request]=await Promise.all([
       page.waitForRequest(r=>r.url().endsWith('/api/research/review')&&r.method()==='POST'),
       form.locator('button[type="submit"]').click()
      ]);
      assert.equal(request.headers()['x-hq-founder-action'],'research-review-v1');
      const body=request.postDataJSON();
      assert.equal(body.paperId,'robot-paper');
      assert.equal(body.expectedVersion,1);
      assert.equal(body.expectedManifestSha,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      assert.equal(body.disposition,'plan-isolated-test');
      assert.equal(body.maxBudgetInr,0);
      assert.equal(body.maxRuntimeMinutes,5);
      await form.locator('.research-review-error').getByText('Test server: external lookups disabled').waitFor();
      assert.equal(await card.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 16 · Founder research decisions'})
       .locator('details.implementation-entry').count(),1);
    });

    await test(profile.name+': Phase 17 source-backed manual experiment export',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Phase 17 · Manual experiment plans'});
      await panel.getByText('Phase 17 · Manual experiment plans',{exact:true}).waitFor();
      assert.ok((await panel.innerText()).includes('0 approved to run'));
      const item=panel.locator('details.implementation-entry').first();
      assert.equal(await item.getAttribute('open'),null);
      await item.locator('summary').first().click();
      const summary=await item.innerText();
      assert.ok(summary.includes('No code was run'));
      assert.ok(summary.includes('₹0'));
      assert.ok(summary.includes('No measured cost or quote'));
      assert.ok(summary.includes('possible-gpu-or-accelerator-stack'));
      assert.ok(summary.includes('MANUAL PLAN ONLY'));
      assert.ok(summary.includes('not spending permission')||summary.includes('planning bounds only'));
      assert.ok(summary.includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
      const gates=item.locator('details.science-evidence-more').nth(0);
      await gates.locator('summary').first().click();
      assert.equal(await gates.locator('ol > li').count(),10);
      assert.ok((await gates.innerText()).includes('Not independently verified'));
      const stages=item.locator('details.science-evidence-more').nth(1);
      await stages.locator('summary').first().click();
      assert.equal(await stages.locator('ol > li').count(),5);
      assert.equal(await item.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
      const [download]=await Promise.all([
        page.waitForEvent('download'),
        item.locator('[data-export-experiment="robot-paper"]').click()
      ]);
      assert.equal(download.suggestedFilename(),'hq-manual-experiment-robot-paper.json');
      const dataChunks=[];
      for await (const chunk of await download.createReadStream())dataChunks.push(chunk);
      const exported=JSON.parse(Buffer.concat(dataChunks).toString('utf8'));
      assert.equal(exported.format,'yorphives.hq.manual-experiment-plan.v1');
      assert.equal(exported.manualPlanOnly,true);
      assert.equal(exported.executed,false);
      assert.equal(exported.licenseCleared,false);
      assert.equal(exported.spendingAuthorized,false);
      assert.equal(exported.plan.preflightVerified,0);
      assert.equal(exported.plan.preflightGates.length,10);
      assert.equal(exported.plan.founderExecutionAuthorized,false);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 17 · Manual experiment plans'})
        .locator('details.implementation-entry').count(),1);
    });
    await test(profile.name+': Phase 18 founder evidence checklist and rejected synthetic write',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Phase 18 · Evidence checklist'});
      await panel.getByText('Phase 18 · Evidence checklist',{exact:true}).waitFor();
      assert.ok((await panel.innerText()).includes('0 independently verified'));
      const candidate=panel.locator('details.implementation-entry').first();
      assert.equal(await candidate.getAttribute('open'),null);
      await candidate.locator('summary').first().click();
      const gates=candidate.locator('details.gate-evidence-item');
      assert.equal(await gates.count(),10);
      const gate=gates.first();
      await gate.locator('summary').first().click();
      const t=await gate.innerText();
      assert.ok(t.includes('Outdated evidence'));
      assert.ok(t.includes('older research snapshot'));
      assert.ok(t.includes('not independent verification')||t.includes('not independently verified'));
      assert.equal(await gate.locator('a[href="https://github.com/research-team/robot-kit/blob/main/LICENSE"][rel="noopener noreferrer"]').count(),1);
      const section=gate.locator('details.science-evidence-more').last();
      await section.locator('summary').first().click();
      const form=section.locator('form.gate-evidence-form');
      await form.locator('select[name="assessment"]').selectOption('blocker-reported');
      await form.locator('select[name="evidenceType"]').selectOption('code-or-license');
      await form.locator('input[name="evidenceUrl"]').fill('https://github.com/research-team/robot-kit/blob/main/LICENSE');
      await form.locator('textarea[name="explanation"]').fill('The license and all transitive library terms remain legally unreviewed.');
      const [request]=await Promise.all([
        page.waitForRequest(r=>r.url().endsWith('/api/experiment/evidence')&&r.method()==='POST'),
        form.locator('button[type="submit"]').click()
      ]);
      assert.equal(request.headers()['x-hq-founder-action'],'gate-evidence-v1');
      const data=request.postDataJSON();
      assert.equal(data.paperId,'robot-paper');
      assert.equal(data.gateKey,'authorship');
      assert.equal(data.expectedGateVersion,1);
      assert.equal(data.expectedFounderVersion,1);
      assert.equal(data.expectedManifestSha,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      assert.equal(data.assessment,'blocker-reported');
      assert.equal(data.evidenceType,'code-or-license');
      await form.locator('.gate-evidence-error').getByText('Test server: external lookups disabled').waitFor();
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('.panel').filter({hasText:'Phase 18 · Evidence checklist'})
        .locator('details.implementation-entry').count(),1);
    });
    await test(profile.name+': scientific evidence reviews preserve unknowns',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Scientific evidence reviews',{exact:true}).waitFor();
      const panel=page.locator('.panel').filter({hasText:'Scientific evidence reviews'});
      assert.equal(await panel.locator('details.science-review-card').count(),2);
      assert.ok((await panel.innerText()).includes('independently reproduced: 0'));
      const first=panel.locator('details.science-review-card').first();
      assert.equal(await first.getAttribute('open'),null);
      await first.locator('summary').first().click();
      const content=await first.innerText();
      assert.ok(content.includes('not been checked'));
      assert.ok(content.includes('not credibility'));
      assert.ok(content.includes('Simulate an incident'));
      assert.ok(content.includes('Hardware recovery algorithms may not transfer'));
      assert.equal(await first.locator('a[href="https://arxiv.org/abs/2611.18496"]').count(),1);
      assert.equal(await first.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),1);
      await first.locator('details.science-evidence-more').first().locator('summary').click();
      assert.ok((await first.innerText()).includes('We investigate synthetic failure recovery'));
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('#page-root .science-review-card').count(),2);
      assert.ok((await page.locator('#page-root').innerText()).includes('Scientific evidence reviews'));
    });
    await test(profile.name+': dedicated Research journals shows real-source semantics',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      const panel=page.locator('.panel').filter({hasText:'Research journals'});
      await panel.getByText('Research journals',{exact:true}).waitFor();
      assert.equal(await panel.locator('.journal-source').count(),2);
      assert.equal(await panel.locator('.journal-paper').count(),1);
      assert.ok((await panel.innerText()).includes('Published within 1 year'));
      assert.ok((await panel.innerText()).includes('No AI model calls'));
      const paper=panel.locator('details.journal-paper').first();
      assert.equal(await paper.getAttribute('open'),null);
      await paper.locator('summary').click();
      assert.ok((await paper.innerText()).includes('not been independently verified'));
      assert.ok((await paper.innerText()).includes('verification'));
      assert.equal(await paper.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),1);
      await page.locator('[data-page="discover"]:visible').first().click();
      await page.locator('[data-discover-source="journals"]').click();
      assert.equal(await page.locator('#page-root .journal-paper').count(),1);
      assert.ok((await page.locator('#page-root').innerText()).includes('Research journals'));
      assert.ok((await page.locator('#page-root').innerText()).includes('Crossref'));
    });
    await test(profile.name+': modular global sources and unverified candidate list',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Global intelligence sources',{exact:true}).waitFor();
      const panel=page.locator('.panel').filter({hasText:'Global intelligence sources'});
      assert.equal(await panel.locator('.source-card').count(),4);
      const text=await panel.innerText();
      assert.ok(text.includes('DEV Community')&&text.includes('Hugging Face')&&text.includes('OpenAlex')&&text.includes('Crossref'));
      assert.ok(text.includes('Rate-limited')&&text.includes('Low-value announcements'));
      assert.equal(await panel.locator('.source-card .source-limited').count(),1);
      assert.equal(await panel.locator('.source-low-value:visible').count(),0,'Quality details must remain hidden until backlog expands');
      assert.ok(text.includes('cross-source topic overlap'));
      const backlog=panel.locator('details.source-backlog').last();
      assert.equal(await backlog.getAttribute('open'),null);
      await backlog.locator('summary').click();
      const a=backlog.locator('a[href="https://dev.to/author/agent-workflow"]');
      assert.equal(await a.count(),1);
      assert.equal(await a.getAttribute('rel'),'noopener noreferrer');
      assert.ok((await backlog.innerText()).includes('listing-unverified'));
      assert.equal(await backlog.locator('.source-low-value').count(),1);
      assert.ok((await backlog.innerText()).includes('Announcement and publicity'));
    });
    await test(profile.name+': investigation evidence and department questions',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Research investigations',{exact:true}).waitFor();
      const section=page.locator('.panel').filter({hasText:'Research investigations'});
      assert.equal(await section.locator('details.investigation-item').count(),2);
      const row=section.locator('details.investigation-item').first();
      await row.locator('summary').click();
      assert.equal(await row.getAttribute('open'),'');
      const body=await row.innerText();
      assert.ok(body.includes('Hacker News'));
      assert.ok(body.includes('GitHub'));
      assert.ok(body.includes('customer demand'));
      assert.ok(body.includes('Security & Independent QA'));
      assert.equal(await row.locator('a[href="https://github.com/acme/freedom-tools"]').count(),1);
      assert.equal(await row.locator('a[target="_blank"][rel="noopener noreferrer"]').count(),2);
    });
    await test(profile.name+': Nano workflow pipeline and evidence review',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Workflow pipeline').waitFor();
      await page.getByText('Scheduler: created:2', {exact:false}).waitFor();
      const workflow=page.locator('.nano-run').first();
      await workflow.locator('summary').click();
      assert.equal(await workflow.getAttribute('open'),'');
      const body=await workflow.innerText();
      assert.ok(body.includes('Synthetic orchestrated investigation'));
      assert.ok(body.includes('source-recorded-unverified'));
      assert.ok(body.includes('evidence_check'));
      assert.ok(body.includes('Founder review pending'));
      assert.equal(await page.locator('.nano-run').filter({hasText:'Synthetic orchestrated investigation'}).count(),1);
    });
    await test(profile.name+': read-only shared memory panel',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('Shared memory', {exact:true}).waitFor();
      const memory=page.locator('.nano-run').filter({hasText:'Synthetic shared memory evidence'});
      await memory.locator('summary').click();
      assert.equal(await memory.getAttribute('open'),'');
      const visible=await memory.innerText();
      assert.ok(visible.includes('source-recorded-unverified'));
      assert.ok(visible.includes('Founder check source'));
      assert.ok(visible.includes('no self-learning yet'));
    });
    await test(profile.name+': private AI controls fail safely without model server',async()=>{
      await page.locator('[data-page="team"]:visible').first().click();
      await page.getByText('AI assessment', {exact:true}).waitFor();
      await page.locator('#ai-department').selectOption('Security & Independent QA');
      await page.locator('#ai-finding').selectOption('finding-1');
      await page.locator('[data-action="ai-analyze"]').click();
      await page.getByText('Test server: external lookups disabled').waitFor();
      assert.ok((await page.locator('#page-root').innerText()).includes('No automatic remediation') || (await page.locator('#page-root').innerText()).includes('no tools.'));
    });
    await test(profile.name+': no horizontal overflow at viewport width',async()=>{
      const dims=await page.evaluate(()=>({screen:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
      assert.ok(dims.content<=dims.screen+2,JSON.stringify(dims));
    });
    await test(profile.name+': no frontend exceptions',async()=>{assert.deepEqual(errors,[]);});
    await page.close();
  }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failures)process.exitCode=1;
else console.log('PASS: isolated browser suite completed; real founder authentication NOT tested');
