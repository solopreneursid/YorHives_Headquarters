import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import handler,{safeToolUrl,sitemapTools,hubTools,manifestTools,feedLeads,classifyLead,parseAdvisories,schedulePlan,verifyAccess,report}
  from "../src/worker.mjs";

test("same-origin discovery rejects arbitrary external URLs and strips tracking parameters",()=>{
  assert.equal(safeToolUrl("/tools/pdf?utm_source=x"),"https://yorphives.com/tools/pdf");
  assert.equal(safeToolUrl("https://www.yorphives.com/explore/app#x"),"https://www.yorphives.com/explore/app");
  assert.equal(safeToolUrl("https://evil.example/tools/pdf"),null);
  assert.equal(safeToolUrl("javascript:alert(1)"),null);
  assert.equal(safeToolUrl("https://yorphives.com.evil.example/tools/pdf"),null);
});
test("discovers real product routes from sitemap but ignores section index",()=>{
  const xml='<urlset><url><loc>https://yorphives.com/tools/crop-image</loc></url><url><loc>https://yorphives.com/free-tools</loc></url></urlset>';
  assert.deepEqual(sitemapTools(xml),["https://yorphives.com/tools/crop-image"]);
});
test("discovers tool links from server-rendered home and hub HTML",()=>{
  const html='<a href="/tools/free-resizer">Resizer</a><a href="https://malicious.example/tools/steal">Bad</a>';
  assert.deepEqual(hubTools(html),["https://yorphives.com/tools/free-resizer"]);
});
test("manifest discovers products on custom vanity routes",()=>{
  const json=JSON.stringify({products:[{url:"/make-resume",name:"Resume"},{url:"https://bad.example/fake"}]});
  assert.deepEqual(manifestTools(json),["https://yorphives.com/make-resume"]);
});
test("malformed manifest never invents products",()=>{
  assert.deepEqual(manifestTools('{"products":'),[]);
});
test("public RSS lead classifier does not invent popularity or revenue",()=>{
  const xml='<rss><channel><item><title>New open source image tool</title><link>https://example.org/post/123</link></item>'+
     '<item><title>Unrelated story</title><link>https://example.org/post/456</link></item></channel></rss>';
  assert.deepEqual(feedLeads(xml),[{title:"New open source image tool",link:"https://example.org/post/123"}]);
});
test("one 5-minute Cron handles all schedules without paid always-on services",()=>{
  const at=(x)=>schedulePlan(new Date(x).getTime());
  assert.deepEqual(at("2026-11-15T00:05:00Z"),{uptime:true,products:false,discovery:false,research:false,security:false,retention:false});
  assert.deepEqual(at("2026-11-15T06:00:00Z"),{uptime:true,products:true,discovery:true,research:false,security:false,retention:false});
  assert.deepEqual(at("2026-11-15T03:00:00Z"),{uptime:true,products:true,discovery:false,research:true,security:false,retention:true});
});
test("private report fails closed if Access is not configured", async()=>{
  const request=new Request("https://example.workers.dev/api/report");
  assert.equal(await verifyAccess(request,{}),false);
  const res=await handler.fetch(request,{DB:{}},{});
  assert.equal(res.status,403);
});
test("HTTP write methods are rejected even without Access setup",async()=>{
  const res=await handler.fetch(new Request("https://example.workers.dev/api/report",{method:"POST"}),{},{});
  assert.equal(res.status,405);
});
test("no D1 binding means scheduled worker does not start scans",async()=>{
  let called=false;
  await handler.scheduled({scheduledTime:Date.now()},{},{waitUntil:()=>{called=true;}});
  assert.equal(called,false);
});
test("report returns well-labelled unverified evidence with no paid AI inference",async()=>{
  const fixtures=[
    {results:[{url:"https://yorphives.com/",name:"YorpHives website",kind:"website",status:"reachable",first_seen:"2026-11-15T00:00:00Z",last_checked:"2026-11-15T00:05:00Z"}]},
    {results:[]},{results:[]},{results:[{kind:"public_fetches",used:2}]},
    {results:[{key:"last_cron",value:"cycle",checked_at:new Date().toISOString()},{key:"discovery",value:"unverified:no-readable-sources",checked_at:new Date().toISOString()}]},
    {results:[]}
  ];
  let i=0;
  const db={prepare(){return{bind(){return this},all:async()=>fixtures[i++]}}};
  const data=await report({DB:db});
  assert.equal(data.schemaVersion,"yorphives.hq-intelligence.v1");
  assert.equal(data.pipeline.readOnly,true);
  assert.equal(data.verification.complete,false);
  assert.equal(data.resourceBudget.aiCalls.disabled,true);
  assert.equal(data.resourceBudget.browserMinutes.disabled,true);
  assert.equal(data.assets.length,1);
});
test("configuration uses isolated HQ worker, single Cron and no paid service bindings",()=>{
  const here=dirname(fileURLToPath(import.meta.url));
  const conf=JSON.parse(readFileSync(resolve(here,"../wrangler.jsonc"),"utf8"));
  assert.equal(conf.name,"yorphives-hq-free-pilot");
  assert.deepEqual(conf.triggers.crons,["*/5 * * * *"]);
  assert.equal(conf.d1_databases.length,1);
  assert.equal(conf.d1_databases[0].binding,"DB");
  assert.equal(conf.assets.run_worker_first,true);
  assert(!conf.ai);
  assert(!conf.containers);
  assert(!conf.queues);
});

test("scheduled passive check uses GET only and writes evidence without any project mutation",async()=>{
  const calls=[], originalFetch=globalThis.fetch;
  const db={
    prepare(sql){
      const entry={sql,args:[]};calls.push(entry);
      return {
        bind(...args){entry.args=args;return this},
        async run(){
          // Check SQL placeholder/arities for this simple unit fixture.
          const count=(sql.match(/\?/g)||[]).length;
          assert.equal(entry.args.length,count,"SQL binding mismatch: "+sql);
          return {meta:{changes:1}};
        },
        async first(){return null},
        async all(){return sql.includes("SELECT key FROM status")?{results:[{key:"discovery"},{key:"research"},{key:"security_watch"}]}:{results:[]}}
      };
    }
  };
  globalThis.fetch=async(input,init)=>{
    assert.equal(init?.method,"GET");
    assert.equal(input,"https://yorphives.com/");
    return new Response("ok",{status:200,headers:{"content-type":"text/html"}});
  };
  try{
    let pending;
    await handler.scheduled({scheduledTime:Date.parse("2026-11-15T00:05:00Z")},{DB:db},
      {waitUntil(p){pending=p;}});
    assert(pending,"Scheduled handler must register an awaited task");
    await pending;
    assert(calls.some(x=>x.sql.includes("INSERT INTO assets")),"Website record was not stored");
    assert(calls.some(x=>x.sql.includes("INSERT INTO quota")),"Cost guard was not evaluated");
    assert(calls.some(x=>x.sql.includes("INSERT INTO status") && x.args.includes("last_cron")),"Heartbeat was not saved");
    assert(!calls.some(x=>/DELETE FROM assets|UPDATE.*repository|DROP TABLE/i.test(x.sql)));
  }finally{globalThis.fetch=originalFetch;}
});

test("classifies similar product mentions cautiously and does not claim feature inferiority",()=>{
  const current=[{name:"PDF Compressor"},{name:"Image Resizer"}];
  const near=classifyLead("Show HN: New PDF compressor app",current);
  assert.equal(near.kind,"possible-existing-product");
  assert.match(near.recommendation,/no feature gap is verified/);
  const missing=classifyLead("Show HN: diagram storyboard generator",current);
  assert.equal(missing.kind,"potential-missing-product");
  assert(!missing.recommendation.toLowerCase().includes("guarantee"));
});
test("public GHSA parser accepts only high-severity reviewed npm references as unverified",()=>{
  const entries=[
    {ghsa_id:"GHSA-abcd-1234-wxyz",severity:"high",summary:"Test package risk",
      published_at:"2026-11-15T00:00:00Z",
      vulnerabilities:[{package:{ecosystem:"npm",name:"example-lib"}}]},
    {ghsa_id:"GHSA-xyz0-5678-jklm",severity:"low",vulnerabilities:[{package:{ecosystem:"npm",name:"x"}}]},
    {ghsa_id:"GHSA-aaaa-bbbb-cccc",severity:"critical",withdrawn_at:"2026-11-15T00:00:00Z",
      vulnerabilities:[{package:{ecosystem:"npm",name:"x"}}]}
  ];
  const results=parseAdvisories(JSON.stringify(entries));
  assert.equal(results.length,1);
  assert.equal(results[0].id,"GHSA-abcd-1234-wxyz");
  assert.equal(results[0].packages[0].name,"example-lib");
  assert.equal(results[0].url,"https://github.com/advisories/GHSA-abcd-1234-wxyz");
  assert.deepEqual(parseAdvisories("not json"),[]);
});
test("security schedule is daily and independent from daily product research",()=>{
  const at=x=>schedulePlan(Date.parse(x));
  assert.equal(at("2026-11-15T04:00:00Z").security,true);
  assert.equal(at("2026-11-15T04:00:00Z").research,false);
  assert.equal(at("2026-11-15T04:05:00Z").security,false);
});
