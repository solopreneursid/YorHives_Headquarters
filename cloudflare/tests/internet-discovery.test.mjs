import test from "node:test";
import assert from "node:assert/strict";
import handler,{classifyInternetOpportunity,normalizeHackerNewsItem,discoverInternetFeed,persistDiscovery,loadStoredDiscovery,normalizeDevArticle,scoutReview,DISCOVERY_ROLES} from "../src/worker.mjs";
const ctx={access:{aud:"tests-access-audience",async getIdentity(){return {email:"founder@example.com"};}}};
const env={ACCESS_AUD:"tests-access-audience",ACCESS_OWNER_EMAIL:"founder@example.com"};
const origin="https://hq.example.workers.dev";
test("Title categories remain heuristic; every item remains unverified",()=>{
  assert.equal(classifyInternetOpportunity("Show HN: Open-source LLM SDK"),"technology");
  assert.equal(classifyInternetOpportunity("Show HN: New invoice payment app"),"revenue");
  assert.equal(classifyInternetOpportunity("Show HN: Jobs for teachers"),"markets");
  assert.equal(classifyInternetOpportunity("Show HN: Alternative to Slack"),"competitors");
  assert.equal(classifyInternetOpportunity("Show HN: Video trimmer"),"apps");
  const x=normalizeHackerNewsItem({id:123,title:"Show HN: Build a video trimmer",time:1780000000,
    url:"https://example.org/tool",score:8,descendants:3});
  assert.equal(x.url,"https://example.org/tool");
  assert.equal(x.sourceUrl,"https://news.ycombinator.com/item?id=123");
  assert.equal(x.price,"Unknown");
  assert.equal(x.verified,false);
  assert.equal(x.review.rulesOnly,true);
  assert.equal(x.review.aiInference,false);
  assert.equal(x.category,"apps");
  assert.equal(normalizeHackerNewsItem({id:234,title:"Show HN: test",deleted:true}),null);
  assert.equal(normalizeHackerNewsItem({id:1,title:"Bad URL",url:"javascript:alert(1)"}).url,
    "https://news.ycombinator.com/item?id=1");
});
test("Authenticated research accepts only two fixed channels",async()=>{
  let upstreamCalls=0;const prior=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{upstreamCalls++;throw Error("Blocked during validation")};
    assert.equal((await handler.fetch(new Request(origin+"/api/discover/feed?channel=unknown"),env,ctx)).status,400);
    assert.equal((await handler.fetch(new Request(origin+"/api/discover/feed?channel=launches"),env,{})).status,403);
    assert.equal((await handler.fetch(new Request(origin+"/api/discover/feed",{method:"POST"}),env,ctx)).status,405);
    assert.equal(upstreamCalls,0);
  }finally{globalThis.fetch=prior}
});
test("Public HN feed is bounded, source-linked, cached, and never writes data",async()=>{
  const original=globalThis.fetch;
  let requests=[];
  try{
    globalThis.fetch=async(url,options={})=>{
      const u=new URL(url);requests.push(u.pathname);
      assert.equal(u.origin,"https://hacker-news.firebaseio.com");
      assert.equal(options.method,"GET");
      assert.equal(options.headers.authorization,undefined);
      if(u.pathname.endsWith("showstories.json"))return new Response(JSON.stringify([101,102,103]),{status:200});
      if(u.pathname==="/v0/item/101.json")return new Response(JSON.stringify({id:101,title:"Show HN: Invoice payment app",time:1780000000,score:12,url:"https://example.com/payments"}),{status:200});
      if(u.pathname==="/v0/item/102.json")return new Response(JSON.stringify({id:102,title:"Show HN: Open-source LLM SDK",time:1780000000,score:5}),{status:200});
      if(u.pathname==="/v0/item/103.json")return new Response(JSON.stringify({id:103,deleted:true}),{status:200});
      throw Error("Unrecognized URL "+u);
    };
    const request=new Request(origin+"/api/discover/feed?channel=launches");
    const reply=await handler.fetch(request,env,ctx);
    assert.equal(reply.status,200);
    const body=await reply.json();
    assert.equal(body.source,"public-research");
    assert.equal(body.items.length,2);
    assert.equal(body.items[0].category,"revenue");
    assert.equal(body.items[1].category,"technology");
    assert.equal(body.items[1].sourceUrl,"https://news.ycombinator.com/item?id=102");
    assert.match(body.note,/no verified demand/i);
    assert.equal((await (await discoverInternetFeed(request)).json()).cached,true);
    assert.deepEqual(requests,["/v0/showstories.json","/v0/item/101.json","/v0/item/102.json","/v0/item/103.json"]);
  }finally{globalThis.fetch=original}
});
test("Unreachable external sources fail closed without synthetic products",async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response("down",{status:503});
    const result=await handler.fetch(new Request(origin+"/api/discover/feed?channel=signals"),env,ctx);
    assert.equal(result.status,503);
    const body=await result.json();
    assert.match(body.error,/unavailable/i);
    assert.equal(body.items,undefined);
  }finally{globalThis.fetch=original}
});

test("Six read-only scouts and evaluator never claim model inference",()=>{
 assert.equal(DISCOVERY_ROLES.length,6);
 assert.equal(new Set(DISCOVERY_ROLES.map(x=>x.id)).size,6);
 const review=scoutReview("Invoice helper","revenue","DEV Community",10);
 assert.equal(review.scout,"Revenue Scout");
 assert.equal(review.reviewer,"Opportunity Evaluator");
 assert.equal(review.aiInference,false);
 assert.equal(review.stage,"unverified-lead");
});
test("DEV source normalization excludes unsafe and private pseudo-links",()=>{
 const good=normalizeDevArticle({id:442,title:"Open-source test library",
   path:"/devauthor/test-library-123",published_at:"2026-11-16T00:00:00Z",
   public_reactions_count:13});
 assert.equal(good.url,"https://dev.to/devauthor/test-library-123");
 assert.equal(good.verified,false);
 assert.equal(good.source,"DEV Community");
 assert.equal(normalizeDevArticle({id:443,title:"unsafe",path:"//evil.example/attack"}),null);
 assert.equal(normalizeDevArticle({id:444,title:"unsafe",path:"/bad?url=https://evil.example"}),null);
});
test("D1 status snapshots store full evidence; no 500-character truncation",async()=>{
 let statement="",params=[],stored=null;
 const env={DB:{prepare(sql){
    statement=sql;
    return {bind(...args){params=args;
      return {async run(){stored={key:args[0],value:args[1],checked_at:new Date().toISOString()};},
        async first(){return stored;}};}};} }};
 const payload={source:"public-research",channel:"launches",items:Array.from({length:12},(_,i)=>({
   id:"hn-"+(i+100),title:"Public project "+i,description:"Description containing "+("x".repeat(130)),source:"Hacker News",
   sourceUrl:"https://news.ycombinator.com/item?id="+(i+100)
 }))};
 await persistDiscovery(env,"launches",payload);
 assert.match(statement,/INSERT INTO status/);
 assert.equal(params[0],"public_scouts_launches");
 assert(params[1].length>1500,"D1 must not clip the evidence JSON");
 const loaded=await loadStoredDiscovery(env,"launches");
 assert.equal(loaded.data.items.length,12);
 assert.equal(loaded.data.items[11].id,"hn-111");
});
