import test from "node:test";
import assert from "node:assert/strict";
import handler,{githubRepoMetadata} from "../src/worker.mjs";

const audience="owner-audience-matches-test";
const env={ACCESS_OWNER_EMAIL:"founder@example.com",ACCESS_AUD:audience};
const ctx={access:{aud:audience,async getIdentity(){return {email:"founder@example.com"};}}};
const root="https://hq.example.workers.dev";

test("repository metadata excludes private/archived repositories and never invents licenses",()=>{
  const repo={full_name:"open-org/pdf-helper",description:"Free tools",license:{spdx_id:"MIT"},
    stargazers_count:123,topics:["productivity"],updated_at:"2026-11-15T00:00:00Z",private:false};
  const x=githubRepoMetadata(repo);
  assert.equal(x.url,"https://github.com/open-org/pdf-helper");
  assert.equal(x.license,"MIT");
  assert.equal(x.stars,123);
  assert.equal(x.source,"github-public");
  assert.equal(x.verified,false);
  assert.equal(githubRepoMetadata({...repo,license:null}).license,null);
  assert.equal(githubRepoMetadata({...repo,private:true}),null);
  assert.equal(githubRepoMetadata({...repo,archived:true}),null);
  assert.equal(githubRepoMetadata({...repo,full_name:"evil/../../path"}),null);
  assert.equal(githubRepoMetadata({...repo,topics:["llm-agents"]}).category,"technology");
});
test("live discovery is owner-only, GET-only, and strict-query on the API",async()=>{
  const original=globalThis.fetch;
  try{
    let calls=0;
    globalThis.fetch=async()=>{calls++;throw Error("Must not reach external API")};
    const route=root+"/api/discover?q=pdf";
    assert.equal((await handler.fetch(new Request(route),env,{})).status,403);
    assert.equal((await handler.fetch(new Request(route,{method:"POST"}),env,ctx)).status,405);
    assert.equal((await handler.fetch(new Request(root+"/api/discover?q=https%3A%2F%2Fevil.example"),env,ctx)).status,400);
    assert.equal((await handler.fetch(new Request(root+"/api/discover?q=a"),env,ctx)).status,400);
    assert.equal((await handler.fetch(new Request(root+"/api/discover?q=one%20two%20three%20four%20five%20six%20seven%20eight%20nine"),env,ctx)).status,400);
    assert.equal((await handler.fetch(new Request(root+"/api/discover",{method:"HEAD"}),env,ctx)).status,200);
    assert.equal(calls,0);
  }finally{globalThis.fetch=original}
});
test("GitHub search requests fixed allowlisted endpoint and returns capped read-only results",async()=>{
  const prior=globalThis.fetch;
  let upstream=0, requested="";
  try{
    globalThis.fetch=async(input,options)=>{
      upstream++;requested=String(input);
      assert.equal(new URL(input).origin,"https://api.github.com");
      assert.equal(new URL(input).pathname,"/search/repositories");
      assert.equal(new URL(input).searchParams.get("per_page"),"12");
      assert.equal(options.method,"GET");
      assert.equal(options.redirect,"error");
      assert.equal(options.headers.accept,"application/vnd.github+json");
      assert.equal(options.headers.authorization,undefined);
      return new Response(JSON.stringify({total_count:53,incomplete_results:false,items:[
        {full_name:"owner/pdf-helper",description:"PDF helper",stargazers_count:75,
          license:{spdx_id:"Apache-2.0"},topics:["utilities"],language:"TypeScript",updated_at:"2026-11-10T00:00:00Z"},
        {full_name:"owner/llm-agents",description:"Agent framework",stargazers_count:150,
          topics:["llm"],updated_at:"2026-11-11T00:00:00Z"},
        {full_name:"owner/private-demo",private:true,description:"Excluded"}
      ]}),{status:200,headers:{"content-type":"application/json"}});
    };
    const path=root+"/api/discover?q=pdf%20tools";
    const reply=await handler.fetch(new Request(path),env,ctx);
    assert.equal(reply.status,200);
    const payload=await reply.json();
    assert.equal(payload.source,"github-public");
    assert.equal(payload.items.length,2);
    assert.equal(payload.items[0].license,"Apache-2.0");
    assert.equal(payload.items[1].license,null);
    assert.equal(payload.items[1].category,"technology");
    assert.equal(payload.items[0].verified,false);
    assert.match(payload.licenseNotice,/Verify/);
    assert.equal(payload.total,53);
    assert.equal(new URL(requested).searchParams.get("q"),"pdf tools in:name,description fork:false archived:false");
    const cached=await handler.fetch(new Request(path),env,ctx);
    assert.equal((await cached.json()).cached,true);
    assert.equal(upstream,1,"Repeated searches should be served from free in-memory cache");
    const next=await handler.fetch(new Request(root+"/api/discover?q=another"),env,ctx);
    assert.equal(next.status,429,"New requests should honor outbound cooldown");
    assert.equal(upstream,1);
  }finally{globalThis.fetch=prior}
});
