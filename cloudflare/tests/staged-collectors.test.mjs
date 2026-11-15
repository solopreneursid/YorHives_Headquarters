import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.mjs";

function fakeDb() {
  const status=new Map(), calls=[];
  const db={
    prepare(sql) {
      const entry={sql,args:[]}; calls.push(entry);
      return {
        bind(...args){entry.args=args;return this;},
        async run(){
          const params=(sql.match(/\?/g)||[]).length;
          assert.equal(entry.args.length,params,"D1 placeholder mismatch");
          if(sql.startsWith("INSERT INTO status")) status.set(entry.args[0],entry.args[1]);
          return {meta:{changes:1}};
        },
        async all(){
          if(sql.includes("SELECT key FROM status")) return {
            results:[...status.keys()].filter(x=>["discovery","research","security_watch"].includes(x))
              .map(key=>({key}))
          };
          if(sql.includes("SELECT url,name FROM assets")) return {results:[]};
          return {results:[]};
        },
        async first(){return sql.includes("discovery_engine_version") && status.has("discovery_engine_version") ? {value:status.get("discovery_engine_version")} : null;}
      };
    }
  };
  return {db,status,calls};
}

test("new Free-tier collector staggers discovery, research and security over successive events",async()=>{
  const {db,status,calls}=fakeDb();
  const requests=[],oldFetch=globalThis.fetch;
  const sitemap='<urlset><url><loc>https://yorphives.com/tools/resize-image</loc></url></urlset>';
  const feeds={
    "https://hnrss.org/show": '<rss><item><title>Show HN: Open source image tool</title><link>https://news.ycombinator.com/item?id=123</link></item></rss>',
    "https://hnrss.org/ask": '<rss><item><title>Ask HN: browser workflow tool</title><link>https://news.ycombinator.com/item?id=456</link></item></rss>'
  };
  const advisories=[{
    ghsa_id:"GHSA-abcd-1234-efgh",type:"reviewed",summary:"Synthetic test case",
    severity:"critical",published_at:"2026-11-15T00:00:00Z",
    vulnerabilities:[{package:{ecosystem:"npm",name:"illustrative-npm-package"}}]
  }];
  globalThis.fetch=async(url,opts)=>{
    requests.push({url,method:opts.method});
    assert.equal(opts.method,"GET","Workers must never mutate observed public URLs");
    if(url==="https://yorphives.com/") return new Response("ok",{status:200,headers:{"content-type":"text/html"}});
    if(url==="https://yorphives.com/sitemap.xml") return new Response(sitemap,{status:200,headers:{"content-type":"application/xml"}});
    if(feeds[url]) return new Response(feeds[url],{status:200,headers:{"content-type":"application/rss+xml"}});
    if(String(url).startsWith("https://api.github.com/advisories?")) return new Response(JSON.stringify(advisories),
      {status:200,headers:{"content-type":"application/json"}});
    return new Response("not found",{status:404});
  };
  try {
    for(const minute of [5,10,15]){
      let background;
      await worker.scheduled({scheduledTime:Date.parse("2026-11-15T01:"+String(minute).padStart(2,"0")+":00Z")},
        {DB:db},{waitUntil(p){background=p}});
      assert(background,"Cron must register asynchronous task");
      await background;
    }
    assert(status.has("discovery"),"Discovery must run in the first cycle");
    assert(status.has("research"),"Market feeds must run after discovery");
    assert(status.has("security_watch"),"Advisory watch must run after research");
    assert(status.has("last_cron"),"Every successful cycle must record a heartbeat");
    assert(calls.some(x=>x.sql.startsWith("INSERT OR IGNORE INTO opportunities")),"Research did not store leads");
    assert(calls.some(x=>x.sql.startsWith("INSERT INTO security_watch")),"Security watch did not store advisory references");
    assert(requests.some(x=>x.url==="https://yorphives.com/sitemap.xml"));
    assert(requests.some(x=>x.url==="https://hnrss.org/show"));
    assert(requests.some(x=>x.url.startsWith("https://api.github.com/advisories?")));
    assert(requests.every(x=>x.method==="GET"),"Unexpected mutating request");
    assert(requests.filter(x=>x.url.startsWith("https://api.github.com")).length===1);
  }finally{
    globalThis.fetch=oldFetch;
  }
});
