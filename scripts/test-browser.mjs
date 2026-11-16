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
    const page=await browser.newPage({viewport:profile.viewport,isMobile:profile.isMobile,hasTouch:profile.isMobile});
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
