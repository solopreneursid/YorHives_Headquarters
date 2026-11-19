#!/usr/bin/env node
// Synthetic, local-only browser tests for CURRENT four-button HQ.
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
 '/api/report':{schemaVersion:'yorphives.hq-intelligence.v1',findings:[],securityWatch:[],changes:[],
   incidents:[],incidentEvents:[],opportunities:[],comparisons:[]},
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
 '/api/trending-products':{schemaVersion:1,readOnly:true,trafficVerified:false,
   recommendations:[{id:'trend-demo',title:'Private PDF Studio',score:84,kind:'trend-measured',
    action:'Promising — investigate',signal:'Source reports 850 total stars. Not verified traffic.',
    opportunity:'Simpler private PDF workflow. Monetization: premium batch exports.',
    evidenceUrl:'https://github.com/example/private-pdf-studio',observedAt:now}],
   sources:[{name:'GitHub',site:'https://github.com/trending',status:'ok:1:recorded:1',checkedAt:now},
    {name:'BetaList',site:'https://betalist.com/startups',status:'not-yet-scanned',checkedAt:null}]},
 '/api/tool-coverage':{available:true,declaredCanonicalPages:143,checkedCanonicalPages:143,
   pageResponding:143,brokenLegacyUrls:0}
};
const requests=[];
const server=createServer((req,res)=>{
 requests.push({method:req.method,path:req.url});
 if(req.method!=='GET'){res.writeHead(405).end('Not permitted');return;}
 const path=new URL(req.url,'http://127.0.0.1').pathname;
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
  const context=await browser.newContext({viewport:{width,height:820},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(origin+'/#home',{waitUntil:'networkidle',timeout:30000});
  const nav=await page.locator('nav button').evaluateAll(items=>items.map(x=>x.dataset.tab));
  assert.deepEqual(nav,['home','health','products','revenue']);
  assert.equal(await page.locator('main h1').textContent(),'Home');
  await page.locator('nav button[data-tab="health"]').click();
  await page.waitForFunction(()=>document.querySelector('main h1')?.textContent==='Health');
  await page.waitForLoadState('networkidle');
  const verify=page.getByRole('button',{name:'Verify signed-in session'});
  await verify.click();
  await page.getByText('Passed: signed-in API, D1, collector, dependency audit').waitFor({timeout:10000});
  await page.locator('nav button[data-tab="products"]').click();
  assert.equal(await page.locator('main h1').textContent(),'Products');
  await page.getByText('Private PDF Studio').waitFor({timeout:10000});
  await page.getByText('Not verified traffic.',{exact:false}).waitFor();
  await page.getByRole('link',{name:'View original source'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'View original source'}).getAttribute('rel'),'noopener noreferrer');
  await page.getByText('of 2 source types scanned',{exact:false}).waitFor();
  await page.locator('nav button[data-tab="revenue"]').click();
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
 assert.ok(requests.every(x=>x.method==='GET'),'Synthetic HQ should make GET requests only');
 console.log('PASS HQ SYNTHETIC BROWSER: all routes read-only; no production credentials/data');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
