import test from "node:test";
import assert from "node:assert/strict";
import worker,{makeFounderBriefing,robotsAllowsPath,competitorClaimEvidence,schedulePlan}
  from "../src/worker.mjs";

test("daily briefing shows verified coverage without declaring untested tools healthy",()=>{
  const now="2026-11-15T07:00:00.000Z";
  const tools=Array.from({length:22},(_,i)=>({
    url:"https://yorphives.com/free-tools/example-"+i,kind:"tool",
    last_checked:i<3?"2026-11-15T06:55:00Z":null,status:i<3?"reachable":"unverified"
  }));
  const assets=[{kind:"website",status:"reachable",last_checked:"2026-11-15T06:55:00Z",http_status:200},...tools];
  const meta=[{key:"last_cron",checked_at:"2026-11-15T06:59:00Z"},
    {key:"discovery",value:"partial:published:22:candidates:0",checked_at:"2026-11-15T06:40:00Z"}];
  const b=makeFounderBriefing(assets,[],[],[],meta,91,now);
  assert.deepEqual([b.coverage.discovered,b.coverage.checked,b.coverage.awaitingFirstCheck],[22,3,19]);
  assert.equal(b.coverage.checkedPercent,14);
  assert.equal(b.coverage.httpReachable,3);
  assert.equal(b.site.status,"reported-reachable");
  assert.equal(b.coverage.inventoryComplete,false);
  assert.equal(b.nextAction.section,"products");
  assert.match(b.nextAction.description,/19 tool routes/);
  assert.equal(b.usage.used,91);
  assert.equal(b.usage.limit,900);
  assert.equal(b.safety.liveBrowserTests,false);
});
test("briefing prioritizes source-backed incidents and treats stale heartbeat as uncertain",()=>{
  const old="2026-11-15T04:00:00Z",now="2026-11-15T07:00:00Z";
  const incident=[{priority:"high",title:"Website repeatedly unavailable"}];
  const b=makeFounderBriefing([{kind:"website",status:"reachable",last_checked:old}],incident,
    [{id:"one"}],[{id:"alternative"}],[{key:"last_cron",checked_at:old}],15,now);
  assert.equal(b.collector.current,false);
  assert.equal(b.site.status,"not-verified","Old HTTP evidence must never become a live healthy assertion");
  assert.equal(b.nextAction.section,"monitoring");
  assert.equal(b.alerts.highPriority,1);
  assert.equal(b.research.alternatives,1);
  assert.equal(b.research.verifiedRevenue,0);
});
test("robots rules honor public host restrictions and reject unreadable rules",()=>{
  assert.equal(robotsAllowsPath("User-agent: *\nDisallow: /", "/resize"),false);
  assert.equal(robotsAllowsPath("User-agent: *\nDisallow: /private\nAllow: /private/public", "/private/public"),true);
  assert.equal(robotsAllowsPath("User-agent: YorpHivesHQ-ReadOnly\nDisallow: /resize\nUser-agent: *\nAllow: /", "/resize"),false);
  assert.equal(robotsAllowsPath("User-agent: *\nDisallow: /archive", "/resize"),true);
  assert.equal(robotsAllowsPath(null, "/resize"),false);
  assert.equal(robotsAllowsPath("", ""),false);
});
test("research scout extracts only visibly advertised features, not unverified absences",()=>{
  const features=competitorClaimEvidence("<h1>Resize animated images</h1><p>Crop to your aspect ratio.</p>"+
    "<script>const secret='local processing';</script>",
    ["animated images","crop","aspect ratio","local processing","neural engine"]);
  assert.deepEqual(features,["animated images","crop","aspect ratio"]);
});
function fakeScoutDatabase(blocked=false){
  const statuses=new Map(),queries=[];
  const db={prepare(sql){
    const record={sql,args:[]};queries.push(record);
    return {
      bind(...args){record.args=args;return this;},
      async first(){
        if(sql.includes("discovery_engine_version"))return {value:"v4"};
        if(sql.includes("SELECT url,name,features_json")&&record.args[0]==="https://yorphives.com/free-tools/image-resizer")
          return {url:record.args[0],name:"Image Resizer",features_json:"[]"};
        return null;
      },
      async all(){return sql.includes("SELECT key FROM status")?{results:["discovery","research","security_watch"].map(key=>({key}))}:{results:[]}},
      async run(){
        assert.equal(record.args.length,(sql.match(/\?/g)||[]).length);
        if(sql.startsWith("INSERT INTO status"))statuses.set(record.args[0],record.args[1]);
        return {meta:{changes:1}};
      }
    };
  }};
  return {db,statuses,queries};
}
test("competitor scout reads only official allowlisted pages and stores unverified review",async()=>{
  const original=globalThis.fetch,fixture=fakeScoutDatabase(),urls=[];
  globalThis.fetch=async(url,options)=>{
    urls.push(url);
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"manual");
    if(url==="https://ezgif.com/robots.txt")return new Response(
      "User-agent: *\nAllow: /",{status:200,headers:{"content-type":"text/plain"}});
    if(url==="https://ezgif.com/resize")return new Response(
      "<h1>Resize animated images online</h1><p>Crop or keep aspect ratio with local processing.</p>",
      {status:200,headers:{"content-type":"text/html"}});
    throw Error("Unexpected external request "+url);
  };
  try{
    let pending;
    await worker.scheduled({scheduledTime:Date.parse("2026-11-15T07:05:00Z")},
      {DB:fixture.db},{waitUntil(p){pending=p}});
    await pending;
    assert.deepEqual(urls,["https://ezgif.com/robots.txt","https://ezgif.com/resize"]);
    const comparisons=fixture.queries.filter(x=>x.sql.startsWith("INSERT INTO product_hypotheses"));
    assert.equal(comparisons.length,1);
    assert.equal(comparisons[0].args[4],"https://ezgif.com/resize");
    assert.match(comparisons[0].args[5],/Official page mentions:/);
    assert.match(comparisons[0].args[6],/Do not assume missing functionality/);
    assert.match(fixture.statuses.get("competitor_watch_ezgif-image-resize"),/source-observed:reviews:1/);
    assert(!fixture.queries.some(x=>/DELETE FROM assets|DROP TABLE|UPDATE.*production/i.test(x.sql)));
  }finally{globalThis.fetch=original;}
});
test("robots refusal never fetches competitor product pages",async()=>{
  const original=globalThis.fetch,fixture=fakeScoutDatabase(),urls=[];
  globalThis.fetch=async(url,opts)=>{
    urls.push(url);
    assert.equal(opts.method,"GET");
    if(url==="https://ezgif.com/robots.txt")return new Response(
      "User-agent: *\nDisallow: /resize",{status:200,headers:{"content-type":"text/plain"}});
    throw Error("Forbidden competitor page fetch");
  };
  try{
    let pending;
    await worker.scheduled({scheduledTime:Date.parse("2026-11-15T07:05:00Z")},
      {DB:fixture.db},{waitUntil(p){pending=p}});
    await pending;
    assert.deepEqual(urls,["https://ezgif.com/robots.txt"]);
    assert(!fixture.queries.some(x=>x.sql.includes("INSERT INTO product_hypotheses")));
    assert.equal(fixture.statuses.get("competitor_watch_ezgif-image-resize"),"robots-unavailable-or-disallowed");
  }finally{globalThis.fetch=original;}
});
