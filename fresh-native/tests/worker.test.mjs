import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker,{internals as x} from '../worker.mjs';

const fakeDb=()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf-8'));
 const prepare=(sql)=>({
  bind(...args){return{
   first:async()=>db.prepare(sql).get(...args),
   all:async()=>({results:db.prepare(sql).all(...args)}),
   run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})
  };},
  first:async()=>db.prepare(sql).get(),
  all:async()=>({results:db.prepare(sql).all()}),
  run:async()=>({meta:{changes:db.prepare(sql).run().changes}})
 });
 return {prepare,batch:async(statements)=>Promise.all(statements.map(s=>s.run())),raw:db};
};
const env=()=>({DB:fakeDb(),AI:{run:async()=>({response:JSON.stringify({reason:'Possible fit. Validate demand.',risk:'Demand unproven.',nextStep:'Interview customers.',fitScore:4})})}});
const sampleHN={objectID:'88223',title:'Show HN: Tiny photo editor',url:'https://example.org/tiny',created_at:'2026-11-15T12:00:00Z'};
const devArticle={title:'Open-source agent framework',url:'https://dev.to/example/framework',description:'Tool update',published_at:'2026-11-15T12:00:00Z'};

test('reject unsafe URLs and keep sources unverified',()=>{
 assert.equal(x.safeHttps('javascript:alert(1)'),null);
 assert.equal(x.safeHttps('https://user:pass@example.org/'),null);
 assert.equal(x.safeHttps('http://example.org/'),null);
 assert.equal(x.safeHttps('https://example.org/'),'https://example.org/');
 assert.equal(x.normalizeDev({title:'Bad',url:'http://bad.example'}),null);
 const article=x.normalizeDev(devArticle);assert.equal(article.verified,false);assert.equal(article.category,'Technology');
 assert.equal(x.normalizeHN(sampleHN).verified,false);
});
test('categorise signals without pretending verified market demand',()=>{
 assert.equal(x.classify('Open source LLM framework in Rust'),'Technology');
 assert.equal(x.classify('Subscription pricing for SaaS'),'Revenue');
 assert.equal(x.classify('Unmet market demand'),'Markets');
 assert.equal(x.classify('Alternative to popular apps'),'Competitors');
 const market=x.normalizeHN({...sampleHN,title:'Ask HN: What tool do you need?'},{category:'Markets',name:'Hacker News · Needs'});
 assert.equal(market.category,'Markets');
 assert.equal(x.normalizeHN({...sampleHN,title:'Hello world'},{category:'Revenue',name:'Hacker News · Revenue'}),null);
});
test('auth fails closed for anonymous and malformed token on all routes',async()=>{
 for(const path of ['/','/api/bootstrap','/api/export','/api/ai/evaluate']){
  const r=await worker.fetch(new Request(`https://test.example${path}`),{});assert.equal(r.status,403,path);
 }
 const r=await worker.fetch(new Request('https://test.example/',{headers:{'Cf-Access-Jwt-Assertion':'x.y.z'}}),{ACCESS_AUD:'aud',ACCESS_TEAM_DOMAIN:'team.cloudflareaccess.com',ACCESS_OWNER_EMAIL:'test@example.com'});
 assert.equal(r.status,403);
});
test('Granite model chat.completion response is extracted from choices',()=>{
 const output={choices:[{message:{role:'assistant',content:'{\"reason\":\"Useful\",\"risk\":\"Unknown\",\"nextStep\":\"Verify\",\"fitScore\":4}'}}]};
 assert.equal(x.parseAi(x.aiReplyText(output)).fitScore,4);
 assert.equal(x.aiReplyText({response:'Plain response'}),'Plain response');
 assert.equal(x.aiReplyText({choices:[]}), '');
});
test('AI output is bounded, learning needs feedback, and memory weights stay bounded',()=>{
 const r=x.parseAi('{"reason":"A reason","risk":"A risk","nextStep":"Verify","fitScore":7}');
 assert.equal(r.fitScore,5);
 assert.equal(x.updateWeight(0,0),1);
 assert.equal(x.updateWeight(1,0),1);
 assert.equal(x.updateWeight(8,0),1.5);
 assert.equal(x.updateWeight(0,8),.5);
});
test('scheduled research persists records and quota prevents repeated scans',async()=>{
 const e=env(),original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  if(String(url).includes('dev.to'))return new Response(JSON.stringify([devArticle]),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({hits:[sampleHN]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const found=await x.scanSources(e);assert.ok(found.count>=2);
  assert.equal((await x.scanSources(e)).skipped,true);
  const state=await x.bootstrap(e);
  assert.ok(state.opportunities.length>=2);
  assert.equal(state.budget.scansUsed,1);
  assert.equal(state.budget.sourceFetchesPerScan,4);
  assert.ok(state.sources.length>=3);
 }finally{globalThis.fetch=original;}
});
test('AI review is saved, repeated requests do not spend quota, and decisions evolve weights',async()=>{
 const e=env();let invocations=0;
 e.AI.run=async()=>{invocations++;return{choices:[{message:{content:JSON.stringify({reason:'Explore customer need',risk:'No verified demand',nextStep:'Interview users',fitScore:4})}}]};};
 const stamp=new Date().toISOString();
 await e.DB.prepare('INSERT INTO opportunities(id,title,summary,category,source,url,first_seen,last_seen) VALUES(?,?,?,?,?,?,?,?)').bind('lead_ab1234','Open-source tool','Public link','Apps & Tools','Hacker News','https://example.org',stamp,stamp).run();
 const result=await x.evaluate(e,'lead_ab1234');assert.equal(result.ok,true);
 assert.equal(invocations,1);
 assert.equal((await x.evaluate(e,'lead_ab1234')).skipped,'already-evaluated');assert.equal(invocations,1);
 const api=await x.api(new Request('https://test.example/api/decision',{method:'POST',body:JSON.stringify({id:'lead_ab1234',action:'approve'})}),e,new URL('https://test.example/api/decision'));
 assert.equal(api.status,200);
 const learning=(await x.bootstrap(e)).learning;
 assert.equal(learning[0].positive,1);
 assert.equal(learning[0].weight,1);
 const exportResponse=await x.exportData(e);assert.equal(exportResponse.status,200);
 assert.equal((await exportResponse.json()).evaluations.length,1);
});
test('AI hard limit is atomic and no external API is required',async()=>{
 const e=env();assert.equal(await x.reserve(e,'ai_calls',3),true);assert.equal(await x.reserve(e,'ai_calls',3),true);assert.equal(await x.reserve(e,'ai_calls',3),true);assert.equal(await x.reserve(e,'ai_calls',3),false);
});
test('Watchtower records HTTP check but does not mutate production',async()=>{
 const e=env(),original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('ok',{status:200});
 try{const r=await x.checkSite(e);assert.equal(r.state,'online');assert.equal(r.code,200);assert.equal((await x.bootstrap(e)).site.state,'online');}finally{globalThis.fetch=original;}
});
test('fresh-install cron seeds research before six-hour schedule without spending extra calls',async()=>{
 const e=env(),before=globalThis.fetch;
 globalThis.fetch=async(url)=>String(url).includes('dev.to')
   ?new Response(JSON.stringify([devArticle]),{status:200})
   :String(url).startsWith('https://yorphives.com')
   ?new Response('site ok',{status:200})
   :new Response(JSON.stringify({hits:[sampleHN]}),{status:200});
 try{
  await worker.scheduled({scheduledTime:Date.parse('2026-11-16T01:30:00Z')},e);
  let data=await x.bootstrap(e);
  assert.ok(data.opportunities.length>0);
  assert.equal(data.scan.status,'ok');
  assert.equal(data.budget.scansUsed,1);
  assert.equal(data.hq.state,'online');
  await worker.scheduled({scheduledTime:Date.parse('2026-11-16T01:45:00Z')},e);
  data=await x.bootstrap(e);
  assert.equal(data.budget.scansUsed,1);
 }finally{globalThis.fetch=before;}
});

test('Cloudflare-compatible manual redirect blocks redirects and allows HTTP 200 JSON',async()=>{
 const url='https://dev.to/api/articles?per_page=8&top=7',original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(request,opts)=>{calls.push({request,opts});if(opts.redirect!=='manual')throw Error('redirect mode unsupported');return new Response('redirect',{status:302,headers:{location:'https://bad.example/'}});};
 try{
  await assert.rejects(x.publicJson(url),/source-http-302/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].opts.redirect,'manual');
  globalThis.fetch=async(_req,opts)=>{assert.equal(opts.redirect,'manual');return new Response('[]',{status:200});};
  assert.deepEqual(await x.publicJson(url),[]);
 }finally{globalThis.fetch=original;}
});

test('YorpHives site URLs are allowlisted and monetization suggestions stay unverified',()=>{
 assert.equal(x.appPath('https://yorphives.com/free-tools/image-resizer'),'/free-tools/image-resizer');
 assert.equal(x.appPath('https://evil.example/free-tools/image-resizer'),null);
 assert.equal(x.appPath('https://yorphives.com/free-tools/'),null);
 assert.equal(x.appPath('javascript:alert(1)'),null);
 const paths=x.findAppPaths('<urlset><url><loc>https://yorphives.com/free-tools/merge-pdf</loc></url><url><loc>https://evil.example/free-tools/nope</loc></url></urlset>');
 assert.deepEqual(paths,['/free-tools/merge-pdf']);
 assert.deepEqual(x.findAppPaths('<a href="/free-tools/image-resizer">Image</a><a href="/free-tools/merge-pdf">PDF</a>'), ['/free-tools/image-resizer','/free-tools/merge-pdf']);
 const ideas=x.monetizationIdeas([{path:'/free-tools/merge-pdf',title:'Merge Pdf',status:'online'}]);
 assert.ok(ideas.some(v=>v.channel==='Sponsorships'));
 assert.ok(ideas.some(v=>v.title.includes('pdf presets')));
 assert.ok(ideas.every(v=>v.basis&&!('revenue' in v)));
 assert.equal(new Set(ideas.map(v=>v.id)).size, ideas.length);
});

test('site inventory, app HTTP monitoring and revenue founder decisions persist without AI or site changes',async()=>{
 const e=env();delete e.AI;
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,opts={})=>{const u=String(url);calls.push({u,method:opts.method||'GET'});
  if(u.endsWith('sitemap.xml'))return new Response('<urlset><url><loc>https://yorphives.com/free-tools/merge-pdf</loc></url><url><loc>https://yorphives.com/free-tools/image-resizer</loc></url></urlset>',{status:200});
  if(u.endsWith('/free-tools/'))return new Response('<a href="/free-tools/merge-pdf">Merge PDF</a>',{status:200});
  if(u.endsWith('/image-resizer'))return new Response('up',{status:200});
  if(u.endsWith('/merge-pdf'))return new Response('up',{status:200});
  throw Error('Unexpected URL '+u);
 };
 try{
  const a=await x.auditApps(e);assert.equal(a.found,2);assert.equal(a.tracked,2);
  const checks=await x.monitorApps(e);assert.equal(checks.length,2);assert.ok(checks.every(v=>v.status==='online'));
  const again=await x.auditApps(e);assert.equal(again.found,2);
  let snap=await x.bootstrap(e);assert.equal(snap.appInventory.length,2);
  assert.ok(snap.revenueIdeas.length>=10);
  const pdfIdea=snap.revenueIdeas.find(v=>v.title.includes('pdf presets'));assert.ok(pdfIdea);
  assert.equal(pdfIdea.action,'new');assert.equal(pdfIdea.target_path,'/free-tools/merge-pdf');
  assert.ok(snap.revenueIdeas.some(v=>v.channel==='Affiliates'));
  const call=(action)=>x.api(new Request('https://hq.test/api/revenue/decision',{method:'POST',body:JSON.stringify({id:pdfIdea.id,action})}),e,new URL('https://hq.test/api/revenue/decision'));
  assert.equal((await call('shortlist')).status,200);
  assert.equal((await call('plan')).status,200);
  snap=await x.bootstrap(e);assert.equal(snap.revenueIdeas.find(v=>v.id===pdfIdea.id).action,'plan');
  assert.ok((await x.exportData(e)).headers.get('content-disposition').includes('backup'));
  assert.ok(calls.every(v=>v.method==='GET'));
  assert.equal(snap.budget.siteAuditsUsed,2);
  assert.equal((await call('new')).status,200);
  snap=await x.bootstrap(e);assert.equal(snap.revenueIdeas.find(v=>v.id===pdfIdea.id).action,'new');
 }finally{globalThis.fetch=original;}
});

test('revenue audit quotas are enforced and no arbitrary URL is fetched',async()=>{
 const e=env();const existing=await x.buildRevenueIdeas(e);assert.ok(existing.count>=8);
 for(let i=0;i<4;i++)assert.equal(await x.reserve(e,'site_audits',4),true);
 assert.equal(await x.reserve(e,'site_audits',4),false);
 assert.equal((await x.auditApps(e)).skipped,'daily-budget');
 const bad=await x.api(new Request('https://test.example/api/revenue/decision',{method:'POST',body:JSON.stringify({id:'../../thing',action:'plan'})}),e,new URL('https://test.example/api/revenue/decision'));
 assert.equal(bad.status,400);
});