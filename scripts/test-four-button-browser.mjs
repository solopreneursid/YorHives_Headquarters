#!/usr/bin/env node
// Synthetic, local-only browser tests for CURRENT five-tab HQ.
// All APIs are mocked. This test never logs in to production or writes to D1.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {asset} from './verify-current-hq.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const source=readFileSync(join(root,'src/hq-worker.mjs'),'utf8');
const assets={'/':asset(source,'/index.html'),'/index.html':asset(source,'/index.html'),
 '/hq-simple.js':asset(source,'/hq-simple.js'),'/hq-simple.css':asset(source,'/hq-simple.css')};
const contentTypes={'/':'text/html','/index.html':'text/html','/hq-simple.js':'text/javascript','/hq-simple.css':'text/css'};
const now=new Date().toISOString();
const mock={
 '/api/hqconnect-inbox':{available:true,readOnly:true,records:[{id:'11111111-1111-4111-8111-111111111111',created_at:now,request_type:'Other',name:'Synthetic founder test',email:'synthetic@example.test',project:'Example',message:'<img src=x onerror=alert(1)>',timeline:'Flexible',budget:''}],next:null,notification:{health:{state:'current',checkedAt:now}}},
 '/api/report':{schemaVersion:'yorphives.hq-intelligence.v1',findings:[],securityWatch:[],changes:[],
   incidents:[],incidentEvents:[],opportunities:[{id:'trend-mock-home',title:'Private PDF Studio',kind:'trend-measured',recommendation:'Monetization: Paid exports.',description:'GitHub attention'}],comparisons:[]},
 '/api/health-self-check':{schemaVersion:1,authenticated:true,healthy:true,api:'responding',
   database:'responding',collector:'current',lastHeartbeat:now,readOnly:true},
 '/api/dependency-audit':{schemaVersion:3,available:true,complete:true,provider:'OSV.dev',
   lockfileVerified:true,resolvedPackagesChecked:69,directPackagesChecked:11,
   matchingAdvisoryCount:0,checkedAt:now,readOnly:true},
 '/api/dependency-inventory':{available:true,dependencies:[]},
 '/api/edge-watchdog':{state:'healthy',checks:[{id:'home',ok:true}],checkedAt:now},
 '/api/hq-perimeter':{available:true,ok:true,checkedAt:now,readOnly:true},
 '/api/hq-perimeter-history':{available:true,checks:[]},
 '/api/legacy-route-review':{available:true,reviewed:22,open:0},
 '/api/trending-products':{schemaVersion:2,readOnly:true,trafficVerified:false,revenueVerified:false,
   recommendations:[{id:'trend-demo',title:'Private PDF Studio',score:84,kind:'trend-measured',
    action:'Promising — investigate',signal:'Source reports 850 total stars. Not verified traffic.',
    opportunity:'Simpler private PDF workflow. Monetization: premium batch exports.',
    evidenceUrl:'https://github.com/example/private-pdf-studio',observedAt:now}],
   leads:[{title:'Permitted public launch discovery',productUrl:'https://example.org/public-product',status:'link-only-unverified',observedAt:now}],
   sources:[{name:'GitHub',site:'https://github.com/trending',status:'ok:1:recorded:1',checkedAt:now},
    {name:'BetaList',site:'https://betalist.com/startups',status:'not-yet-scanned',checkedAt:null}]},
 '/api/revenue-intelligence':{schemaVersion:1,readOnly:true,
  verifiedEarnings:{available:false,amount:null,currency:null,reason:'No actual payout data connected.'},
  activity:{available:false,status:'Not connected'},
  opportunities:[
   {id:'gov-it-tender',rank:1,channel:'Government project · verify eligibility',
    title:'Investigate: Government tender · Website and digital forms development',
    stage:'Official tender listing',evidenceStatus:'Official source with future deadline',
    whoMightPay:'Government issuing body — confirm buyer in original tender.',
    whyPay:'An authority published a procurement request for digital services.',
    nextAction:'Search tender reference NIC-IT/WEB/2026/7 and confirm eligibility.',
    bidDeadline:'2026-11-29 15:30 IST',
    evidence:'Tender reference NIC-IT/WEB/2026/7, deadline in IST. Eligibility unverified.',
    risk:'Experience requirements and DSC not verified.',sourceUrl:'https://eprocure.gov.in/eprocure/app'},
   {id:'hqventures-product-sales',rank:1,channel:'HQventures',title:'Validate a paid HQventures product',stage:'Research first',evidenceStatus:'No customers verified',evidence:'No verified orders.',nextAction:'Review one approved product.',risk:'Payment handling.',sourceUrl:'https://yorphives.com/hqventures/'},
   {id:'free-tools-advertising',rank:2,channel:'Free Tools only',title:'Evaluate advertising on Free Tools',stage:'Research first',evidenceStatus:'AdSense not verified',evidence:'Ads not enabled.',nextAction:'Review page evidence.',risk:'Publisher compliance.',sourceUrl:'https://yorphives.com/free-tools/'},
   {id:'free-tools-sponsorship',rank:3,channel:'Free Tools only',title:'Research relevant tool sponsorship',stage:'Research first',evidenceStatus:'No sponsor',evidence:'Hypothesis.',nextAction:'Test sponsor interest.',risk:'Disclosure.',sourceUrl:'https://yorphives.com/free-tools/'}
   ,{id:'maker-research',rank:4,channel:'HQventures · research',title:'Investigate: Maker reported paid SaaS',stage:'Founder research',
     evidenceStatus:'Public maker statement · earnings unverified',evidence:'Public statement is not audited.',nextAction:'Interview buyer.',risk:'Pricing unverified.',
     sourceUrl:'https://news.ycombinator.com/item?id=991',buildEffortHypothesis:'high'},
    {id:'free-tools-research',rank:5,channel:'Free Tools · research',title:'Investigate: Paid PDF workflow',
     stage:'Founder research',evidenceStatus:'Discussion only',evidence:'A related market signal.',nextAction:'Review tool usage.',risk:'No paywall.',
     sourceUrl:'https://indiemakerlist.com/makers/pdf-sample',buildEffortHypothesis:'low-to-medium'},
    {id:'public-client-request',rank:6,channel:'Potential client · unqualified',title:'Investigate: Public request for PDF automation',
     stage:'Founder research',evidenceStatus:'Public request; payment unverified',evidence:'A public requester may want a workflow.',
     nextAction:'Read original and validate scope, budget and date.',risk:'Unqualified inquiry.',
     sourceUrl:'https://news.ycombinator.com/item?id=501'},
    {id:'official-affiliate',rank:7,channel:'Affiliate · optional editorial',title:'Evaluate Namecheap domain affiliate program',
     stage:'Published program page',evidenceStatus:'Enrolment unknown',evidence:'Official page only.',
     nextAction:'Verify audience and permitted affiliate disclosures.',risk:'No confirmed commissions.',
     sourceUrl:'https://www.namecheap.com/affiliates/'},
    {id:'official-partner',rank:8,channel:'Partnership · research',title:'Evaluate Cloudflare PowerUP service-partner fit',
     stage:'Published program page',evidenceStatus:'Approval unknown',evidence:'Official program page.',
     nextAction:'Check entry requirements.',risk:'No partner agreement.',
     sourceUrl:'https://www.cloudflare.com/partners/power-up-program/'}
  ],sources:[
     {name:'India · official central eProcurement',status:'not-yet-checked',checkedAt:null},
     {name:'Hacker News · affiliate mentions',status:'not-yet-checked',checkedAt:null},
     {name:'Hacker News · sponsorship mentions',status:'not-yet-checked',checkedAt:null},
     {name:'Hacker News · maker revenue',status:'ok:2',checkedAt:now},
     {name:'Hacker News · potential public client requests',status:'not-yet-checked',checkedAt:null},
     {name:'IndieMakerList · maker feed',status:'ok:1',checkedAt:now},
     {name:'Hacker News · partnership mentions',status:'not-yet-checked',checkedAt:null},
     {name:'Hacker News · pricing',status:'not-yet-checked',checkedAt:null},
     {name:'Jharkhand · official state eProcurement',status:'not-yet-checked',checkedAt:null}],
   sourceScansCompleted:2,marketSignals:[{title:'External reported startup earnings',classification:'Third-party reported claim · not independently verified',summary:'Reported third-party earnings.',nextAction:'Investigate only',sourceUrl:'https://trustmrr.com/newsletter',yorphivesRevenue:false}]
 },
 '/api/tool-coverage':{available:true,declaredCanonicalPages:143,checkedCanonicalPages:143,
   pageResponding:143,brokenLegacyUrls:0}
};
const requests=[];
const server=createServer((req,res)=>{
 requests.push({method:req.method,path:req.url});
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(req.method==='DELETE'&&path==='/api/hqconnect-inbox/11111111-1111-4111-8111-111111111111'
    &&req.headers['x-hq-action']==='delete-enquiry'){
  mock['/api/hqconnect-inbox'].records=[];
  res.writeHead(200,{'content-type':'application/json'}).end('{"deleted":true}');return;
 }
 if(req.method!=='GET'){res.writeHead(405).end('Not permitted');return;}
 if(path==='/api/recommendations.csv'){
  res.writeHead(200,{'content-type':'text/csv','content-disposition':'attachment; filename="yorphives-hq-recommendations-products-test.csv"'})
    .end('section,title,recommendation\r\nProducts,Private PDF Studio,Research only\r\n');return;
 }
 if(Object.hasOwn(assets,path)){res.writeHead(200,{'content-type':contentTypes[path]+';charset=utf-8','cache-control':'no-store'}).end(assets[path]);return;}
 if(Object.hasOwn(mock,path)){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(mock[path]));return;}
 res.writeHead(404).end('Unknown route');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser=null;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,1366]){
  mock['/api/hqconnect-inbox'].records=[{id:'11111111-1111-4111-8111-111111111111',created_at:now,request_type:'Other',name:'Synthetic founder test',email:'synthetic@example.test',project:'Example',message:'<img src=x onerror=alert(1)>',timeline:'Flexible',budget:''}];
  const context=await browser.newContext({viewport:{width,height:820},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(origin+'/#home',{waitUntil:'networkidle',timeout:30000});
  const nav=await page.locator('nav button').evaluateAll(items=>items.map(x=>x.dataset.tab));
  assert.deepEqual(nav,['home','health','products','revenue','hqconnect']);
  assert.equal(await page.locator('main h1').textContent(),'Home');
  const homeCopy=await page.locator('main').innerText();
  assert.match(homeCopy,/Products[\s\S]*1 ideas/);
  assert.match(homeCopy,/Revenue[\s\S]*Research/,'Revenue shows research, not generic product keyword matches');
  await page.locator('nav button[data-tab="health"]').click();
  await page.waitForFunction(()=>document.querySelector('main h1')?.textContent==='Health');
  await page.waitForLoadState('networkidle');
  const verify=page.getByRole('button',{name:'Verify signed-in session'});
  await verify.click();
  await page.getByText('Passed: signed-in API, D1, collector, dependency audit').waitFor({timeout:10000});
  await page.locator('nav button[data-tab="products"]').click();
  assert.equal(await page.locator('main h1').textContent(),'Products');
  await page.getByText('Private PDF Studio').waitFor({timeout:10000});
  const productExport=page.getByRole('link',{name:'⬇ Download all product recommendations (CSV)'});
  assert.equal(await productExport.getAttribute('href'),'/api/recommendations.csv?scope=products');
  const [exportFile]=await Promise.all([page.waitForEvent('download'),productExport.click()]);
  assert.match(exportFile.suggestedFilename(),/yorphives-hq-recommendations-products/);
  await page.getByText('Not verified traffic.',{exact:false}).waitFor();
  await page.getByRole('link',{name:'View original source'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'View original source'}).getAttribute('rel'),'noopener noreferrer');
  await page.getByText('1 of 2 sources checked',{exact:false}).waitFor();
  await page.getByText('Additional public product links (1)',{exact:false}).click();
  const lead=page.getByRole('link',{name:'Product link'});
  await lead.waitFor();
  assert.equal(await lead.getAttribute('href'),'https://example.org/public-product');
  assert.equal(await lead.getAttribute('rel'),'noopener noreferrer');
  await page.locator('nav button[data-tab="revenue"]').click();
  assert.equal(await page.locator('main h1').textContent(),'Revenue');
  assert.equal(await page.locator('#hqconnect-inbox').count(),0,'HQconnect must be separate from Revenue');
  await page.getByText('Verified YorpHives earnings: Not connected.',{exact:false}).waitFor({timeout:10000});
  await page.getByText('Validate a paid HQventures product').waitFor({timeout:10000});
  await page.getByText('Government tender · Website and digital forms development',{exact:false}).waitFor({timeout:10000});
  await page.getByText('Who might pay:',{exact:false}).first().waitFor({timeout:10000});
  await page.getByText('Why they might pay:',{exact:false}).first().waitFor({timeout:10000});
  await page.getByText('Tender deadline (IST): 2026-11-29 15:30 IST',{exact:false}).waitFor({timeout:10000});
  const officialPortal=page.getByRole('link',{name:'Open official procurement portal'});
  assert.equal(await officialPortal.getAttribute('href'),'https://eprocure.gov.in/eprocure/app');
  assert.equal(await officialPortal.getAttribute('rel'),'noopener noreferrer');
  await page.getByText('Evaluate advertising on Free Tools').waitFor({timeout:10000});
  await page.getByText('Research relevant tool sponsorship').waitFor({timeout:10000});
  await page.getByText('Investigate: Maker reported paid SaaS').waitFor({timeout:10000});
  await page.getByText('Investigate: Paid PDF workflow').waitFor({timeout:10000});
  await page.getByText('Investigate: Public request for PDF automation').waitFor({timeout:10000});
  await page.getByText('Evaluate Namecheap domain affiliate program').waitFor({timeout:10000});
  await page.getByText('Evaluate Cloudflare PowerUP service-partner fit').waitFor({timeout:10000});
  await page.getByText('Recorded public checks: 2 of 9.',{exact:false}).waitFor({timeout:10000});
  await page.getByText('External reported startup earnings').waitFor({timeout:10000});
  const external=page.getByRole('link',{name:'Original report'});
  assert.equal(await external.getAttribute('href'),'https://trustmrr.com/newsletter');
  assert.equal(await external.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await page.locator('main .revenue-row').count(),10,'Government tender, eight revenue opportunities and one external report');
  await page.locator('nav button[data-tab="hqconnect"]').click();
  assert.equal(await page.locator('main h1').textContent(),'HQconnect');
  await page.getByText('Synthetic founder test').waitFor({timeout:10000});
  await page.getByText('Enquiry checks are current. Email delivery has not yet been verified.').waitFor({timeout:10000});
  assert.equal(await page.locator('#hqconnect-inbox img').count(),0,'Enquiry text must not become HTML');
  assert.equal(await page.getByRole('link',{name:'Reply to synthetic@example.test'}).getAttribute('href'),'mailto:synthetic%40example.test');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete message from Synthetic founder test'}).click();
  await page.getByText('No enquiries received yet.').waitFor({timeout:10000});
  assert.equal(await page.getByText('Synthetic founder test').count(),0,'Deleted enquiry no longer appears');
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(await page.locator('main h1').textContent(),'Revenue');
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(await page.locator('main h1').textContent(),'Products','Browser Back must restore Products');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=5,'Unexpected horizontal overflow '+overflow+' at width '+width);
  assert.deepEqual(errors,[],'Browser JS exceptions at '+width);
  console.log('PASS four-button HQ '+width+'px: navigation, signed-in simulated API, back, no overflow/errors');
  await context.close();
 }
 assert.ok(requests.length>=12,'No substantive HTTP requests captured');
 assert.ok(requests.every(x=>x.method==='GET'||(x.method==='DELETE'&&x.path==='/api/hqconnect-inbox/11111111-1111-4111-8111-111111111111')),'Only exact-enquiry DELETE is allowed');
 assert.equal(requests.filter(x=>x.method==='DELETE').length,2,'Exactly one confirmed deletion per browser size');
 console.log('PASS HQ SYNTHETIC BROWSER: GET-only research plus one simulated founder-confirmed deletion per device; no production credentials/data');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
