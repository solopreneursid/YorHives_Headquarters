import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.mjs";

function evidenceDatabase(){
  const status=new Map(),products=new Map(),calls=[],quota={used:0};
  const db={
    prepare(sql){
      const record={sql,args:[]};calls.push(record);
      return {
        bind(...args){record.args=args;return this;},
        async run(){
          assert.equal(record.args.length,(sql.match(/\?/g)||[]).length,
            "Incorrect parameter count: "+sql.slice(0,110));
          if(sql.startsWith("INSERT INTO quota"))quota.used++;
          if(sql.startsWith("INSERT INTO status")){
            status.set(record.args[0],{value:record.args[1],checked_at:record.args[2]});
          }
          if(sql.startsWith("INSERT OR IGNORE INTO assets(")){
            const [url,name,first,last,source,evidence,confidence,features]=record.args;
            if(products.has(url))return {meta:{changes:0}};
            products.set(url,{url,name,kind:"tool",first_seen:first,last_seen:last,discovery_source:source,
              evidence_url:evidence,inventory_confidence:confidence,features_json:features,
              page_fingerprint:"",failures:0,last_checked:null,status:"unverified"});
          }
          if(sql.startsWith("UPDATE assets SET last_seen=") && record.args.length===10){
            const p=products.get(record.args[9]);
            if(p){
              p.last_seen=record.args[0];
              if(record.args[1])p.name=record.args[2];
              p.discovery_source=record.args[4];
              p.evidence_url=record.args[6];
              p.inventory_confidence=record.args[7];
              p.features_json=record.args[8]==="[]" ? p.features_json:record.args[8];
            }
          }
          if(sql.startsWith("UPDATE assets SET last_checked=")){
            const [checked,http,failures,state,fingerprint,url]=record.args;
            const p=products.get(url);
            if(p)Object.assign(p,{last_checked:checked,http_status:http,failures,status:state,page_fingerprint:fingerprint});
          }
          return {meta:{changes:1}};
        },
        async first(){
          if(sql.includes("SELECT failures FROM assets WHERE url"))return {failures:0};
          if(sql.includes("discovery_engine_version"))return status.get("discovery_engine_version")||null;
          if(sql.includes("SELECT value FROM status WHERE key"))return status.get(record.args[0]||"discovery")||null;
          return null;
        },
        async all(){
          if(sql.includes("SELECT key FROM status"))return {results:["discovery","research","security_watch"].map(key=>({key}))};
          if(sql.includes("SELECT url,name,failures,page_fingerprint")){
            return {results:[...products.values()].sort((a,b)=>
              Number(Boolean(a.last_checked))-Number(Boolean(b.last_checked))).slice(0,4)};
          }
          if(sql.includes("SELECT url,name,features_json FROM assets")){
            return {results:[...products.values()].filter(x=>x.inventory_confidence==="published")};
          }
          return {results:[]};
        }
      };
    }
  };
  return {db,status,products,calls,quota};
}

test("new manifest entry joins passive HTTP monitoring on the next scheduled hourly check",async()=>{
  const state=evidenceDatabase(), requests=[],before=globalThis.fetch;
  let stage=1;
  globalThis.fetch=async(url,opts)=>{
    requests.push({url,method:opts.method,redirect:opts.redirect});
    assert.equal(opts.method,"GET","Never write to website or research sources");
    assert.equal(opts.redirect,"manual","Never chase redirects onto other hosts");
    const page = (text,type="text/html")=>new Response(text,{status:200,headers:{"content-type":type}});
    if(url==="https://yorphives.com/")return page("<title>YorpHives</title><h1>Useful tools</h1>");
    if(url==="https://yorphives.com/.well-known/yorphives-products.json")return page(JSON.stringify({
      complete:true,products:[
        {name:"Image Resizer",url:"/tools/image-resizer",features:["Batch resize"]},
        ...(stage>=2?[{name:"PDF Converter",url:"/tools/pdf-converter",features:["Convert PDFs"]}]:[])
      ]
    }),"application/json");
    if(url==="https://yorphives.com/tools/image-resizer")return page(
      "<title>Image Resizer | YorpHives</title><h1>Image Resizer</h1>");
    if(url==="https://yorphives.com/tools/pdf-converter")return page(
      "<title>PDF Converter | YorpHives</title><h1>PDF Converter</h1>");
    return new Response("not found",{status:404});
  };
  try{
    for(const hour of [6,12,13]){
      stage=hour===6?1:2;
      let promise;
      await worker.scheduled({scheduledTime:Date.parse("2026-11-15T"+
        String(hour).padStart(2,"0")+":00:00Z")},{DB:state.db},
        {waitUntil(p){promise=p}});
      assert(promise);await promise;
    }
    const urls=[...state.products.keys()];
    assert.deepEqual(urls,["https://yorphives.com/tools/image-resizer",
      "https://yorphives.com/tools/pdf-converter"]);
    const second=state.products.get(urls[1]);
    assert.equal(second.inventory_confidence,"published");
    assert.equal(second.discovery_source,"manifest");
    assert.equal(JSON.parse(second.features_json)[0],"Convert PDFs");
    assert(second.last_checked,"New product should join the next hourly monitoring run");
    assert.equal(second.status,"reachable");
    assert.match(state.status.get("discovery").value,/observed:manifest-complete:/);
    assert([...state.status.keys()].some(k=>k.startsWith("new_tool_")),
      "New entry after baseline should be surfaced for founder review");
    assert(requests.some(r=>r.url===urls[1]),"Tool route never checked");
    assert(requests.every(r=>r.url.startsWith("https://yorphives.com/")),"Unexpected third-party endpoint");
    assert(state.quota.used<60,"Exceeded expected low-cost request count");
    assert(!state.calls.some(x=>/DELETE FROM assets|DROP TABLE|ALTER TABLE|UPDATE.*repository/i.test(x.sql)));
  }finally{globalThis.fetch=before;}
});

test("the real Pages-style tool sitemap and directory hub enroll File Studio without a manifest",async()=>{
  const state=evidenceDatabase(),oldFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push(url);
    assert.equal(options.method,"GET");
    if(url==="https://yorphives.com/")return new Response(
      "<title>YorpHives</title><h1>Tools</h1>",{status:200,headers:{"content-type":"text/html"}});
    if(url==="https://yorphives.com/free-tools-tool-sitemap.xml")return new Response(
      '<urlset><url><loc>https://yorphives.com/free-tools/file-studio/</loc></url></urlset>',
      {status:200,headers:{"content-type":"application/xml"}});
    if(url==="https://yorphives.com/free-tools/index.html" || url==="https://yorphives.com/free-tools/"){
      return new Response('<a href="/free-tools/file-studio/">File Studio</a>',
        {status:200,headers:{"content-type":"text/html"}});
    }
    return new Response("not found",{status:404});
  };
  try{
    let pending;
    await worker.scheduled({scheduledTime:Date.parse("2026-11-15T06:00:00Z")},
      {DB:state.db},{waitUntil(p){pending=p}});
    await pending;
    const route=[...state.products.keys()].find(x=>x.includes("/free-tools/file-studio"));
    assert(route,"Public product route missing from registered inventory");
    const record=state.products.get(route);
    assert.equal(record.inventory_confidence,"published");
    assert.equal(record.discovery_source,"link");
    assert.match(state.status.get("discovery").value,/^partial:/);
    assert(requests.includes("https://yorphives.com/free-tools-tool-sitemap.xml"));
    assert(!requests.some(x=>x.includes("api.github.com")));
  }finally{globalThis.fetch=oldFetch;}
});

test("HTTP 308 directory redirects are not interpreted as broken tool functionality",async()=>{
  const state=evidenceDatabase(),originalFetch=globalThis.fetch;
  const route="https://yorphives.com/free-tools/file-studio";
  state.products.set(route,{url:route,name:"File Studio",kind:"tool",failures:1,
    page_fingerprint:"",inventory_confidence:"published",last_checked:null,
    features_json:"[]",status:"pending"});
  state.status.set("discovery_engine_version",{value:"v4",checked_at:new Date().toISOString()});
  globalThis.fetch=async(url,options)=>{
    assert.equal(options.method,"GET");
    assert.equal(options.redirect,"manual");
    return url===route?new Response(null,{status:308,headers:{"location":"/free-tools/file-studio/"}}):
      new Response("OK",{status:200,headers:{"content-type":"text/html"}});
  };
  try{
    let pending;
    await worker.scheduled({scheduledTime:Date.parse("2026-11-15T01:00:00Z")},
      {DB:state.db},{waitUntil(p){pending=p}});
    await pending;
    assert.equal(state.products.get(route).failures,0);
    assert.equal(state.products.get(route).status,"unverified");
    assert(!state.calls.some(x=>x.sql.startsWith("INSERT INTO findings")),
      "Canonical redirect must not create an outage alert");
  }finally{globalThis.fetch=originalFetch;}
});

test("conflicting sitemap evidence prevents a false complete owner catalog",async()=>{
  const state=evidenceDatabase(),oldFetch=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{
    assert.equal(opts.method,"GET");
    if(url==="https://yorphives.com/")return new Response("<title>HQ tools</title>",
      {status:200,headers:{"content-type":"text/html"}});
    if(url==="https://yorphives.com/.well-known/yorphives-products.json")return new Response(
      JSON.stringify({complete:true,products:[{url:"/tools/declared",name:"Declared"}]}),
      {status:200,headers:{"content-type":"application/json"}});
    if(url==="https://yorphives.com/sitemap.xml")return new Response(
      '<urlset><url><loc>https://yorphives.com/tools/not-listed-in-manifest</loc></url></urlset>',
      {status:200,headers:{"content-type":"application/xml"}});
    return new Response(null,{status:404});
  };
  try{
    let run;
    await worker.scheduled({scheduledTime:Date.parse("2026-11-15T06:00:00Z")},
      {DB:state.db},{waitUntil(p){run=p}});
    await run;
    assert.equal(state.products.size,2,"Public extra route must still be enrolled for observation");
    const status=state.status.get("discovery").value;
    assert(status.startsWith("partial:"),"Manifest discrepancy must not certify completeness");
    assert(status.includes("manifest-mismatch"));
  }finally{globalThis.fetch=oldFetch;}
});
