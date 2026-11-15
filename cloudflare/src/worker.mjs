/**
 * YorpHives Headquarters — zero-additional-subscription Cloudflare adapter.
 * Observation and research ONLY. Never POST to websites, mutate repositories,
 * execute browsers, buy resources, generate patches, or deploy.
 * Target: Workers Free + D1 Free + Static Assets + a single 5-minute Cron.
 * Private dashboard: fail-closed Cloudflare Access JWT verification (RS256).
 */
const SITE = "https://yorphives.com";
const ORIGIN_SET = new Set(["https://yorphives.com", "https://www.yorphives.com"]);
const PATH_ROOTS = ["/tools/", "/tool/", "/free-tools/", "/apps/", "/app/", "/explore/", "/products/"];
const HUBS = ["/", "/free-tools", "/tools", "/explore"];
const RESEARCH = "https://hnrss.org/show";
const MAX_ROUTES_PER_DISCOVERY = 45;
const MAX_CHECKS_PER_HOUR = 4;
const FETCH_BUDGET_DAY = 900; // intentionally far below platform ceilings
const MAX_TEXT_BYTES = 100000;
const JSON_HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};

function nowIso(date = new Date()) { return date.toISOString(); }
function clampText(value, max = 240) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function originOf(url) { try { return new URL(url).origin; } catch { return ""; } }
function safeToolUrl(value, base = SITE) {
  try {
    const url = new URL(String(value), base);
    if (!ORIGIN_SET.has(url.origin) || url.username || url.password || !["https:"].includes(url.protocol)) return null;
    url.search = ""; url.hash = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch { return null; }
}
function isTool(url) {
  const path = new URL(url).pathname.toLowerCase();
  return PATH_ROOTS.some(prefix => path.startsWith(prefix) && path.length > prefix.length);
}
function basicRecommendation(category) {
  if (category === "reliability") return "Investigate public availability and logs. Verify independently before proposing a fix; founder approval is required.";
  return "Validate customer demand, competition, feasibility, licensing and differentiation before pursuing a product.";
}
function fnv(text) { // non-cryptographic ID for deduplication, not an authentication signature
  let hash=2166136261;
  for (const char of String(text).slice(0, 700)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}
async function boundedText(response, max = MAX_TEXT_BYTES) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > max) return null;
  if (!response.body) return "";
  const reader=response.body.getReader(); const chunks=[]; let used=0;
  try {
    while (true) {
      const part=await reader.read();
      if (part.done) break;
      used += part.value.byteLength;
      if (used > max) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } finally { try { reader.releaseLock(); } catch {} }
  const bytes = new Uint8Array(used); let index=0;
  for (const part of chunks) { bytes.set(part,index); index+=part.byteLength; }
  return new TextDecoder().decode(bytes);
}
async function limitedFetch(url, {allowResearch = false, body = false} = {}) {
  const parsed = new URL(url);
  if (allowResearch ? url !== RESEARCH : !ORIGIN_SET.has(parsed.origin)) throw Error("target-not-allowlisted");
  const response = await fetch(url, {method:"GET", redirect:"manual", cache:"no-store",
    headers: {"user-agent":"YorpHivesHQ-ReadOnly/1.0 (+founder owned research)"}});
  const status=response.status;
  if (!body) { await response.body?.cancel(); return {status, text:null}; }
  if (status !== 200) { await response.body?.cancel(); return {status, text:null}; }
  const contentType = response.headers.get("content-type") || "";
  if (!/(xml|html|json|rss|atom|text)/i.test(contentType)) {
    await response.body?.cancel(); return {status, text:null};
  }
  return {status, text: await boundedText(response)};
}
async function reserveFetch(env) {
  const day = nowIso().slice(0,10);
  const result = await env.DB.prepare(
    "INSERT INTO quota(day,kind,used) VALUES(?,'public_fetches',1) " +
    "ON CONFLICT(day,kind) DO UPDATE SET used=used+1 WHERE used < ?"
  ).bind(day,FETCH_BUDGET_DAY).run();
  return Number(result.meta?.changes || 0) > 0;
}
async function getPublic(env,url,opts) {
  if (!(await reserveFetch(env))) throw Error("daily-free-budget-exhausted");
  return limitedFetch(url,opts);
}
function sitemapTools(xml, base=SITE) {
  const found=[];
  for (const match of String(xml||"").slice(0,MAX_TEXT_BYTES).matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    const link=safeToolUrl(match[1].replaceAll("&amp;","&"),base);
    if(link && isTool(link) && !found.includes(link)) found.push(link);
    if(found.length>=MAX_ROUTES_PER_DISCOVERY) break;
  }
  return found;
}
function hubTools(html, base=SITE) {
  const found=[];
  for (const match of String(html||"").slice(0,MAX_TEXT_BYTES).matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const link=safeToolUrl(match[1],base);
    if(link && isTool(link) && !found.includes(link)) found.push(link);
    if(found.length>=MAX_ROUTES_PER_DISCOVERY) break;
  }
  return found;
}
function manifestTools(text, base=SITE) {
  try {
    const data=JSON.parse(text);const entries=Array.isArray(data)?data:data.products;
    if(!Array.isArray(entries)) return [];
    const found=[];
    for(const item of entries.slice(0,MAX_ROUTES_PER_DISCOVERY)) {
      const url=safeToolUrl(item?.url,base);
      if(url && url!==SITE+"/" && !found.includes(url)) found.push(url);
    }
    return found;
  } catch { return []; }
}
function feedLeads(xml) {
  const found=[];
  for(const match of String(xml||"").slice(0,MAX_TEXT_BYTES).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item=match[1];
    const title=clampText((item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1],160)
      .replaceAll("&amp;","&").replace(/<[^>]*>/g,"");
    const link=clampText((item.match(/<link>([^<]+)<\/link>/i)||[])[1],450);
    if(!title || !/^https?:\/\/[^\s]+$/i.test(link) ||
       !/\b(tool|app|open source|website|image|pdf|browser|developer|automation|convert|product|workflow|agent)\b/i.test(title)) continue;
    found.push({title,link});
    if(found.length >= 8) break;
  }
  return found;
}
async function saveStatus(env,key,value) {
  await env.DB.prepare("INSERT INTO status(key,value,checked_at) VALUES(?,?,?) "+
  "ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=excluded.checked_at")
    .bind(key,clampText(value,500),nowIso()).run();
}
async function addFinding(env,{key,category,priority,asset,title,description,evidence}) {
  const id=fnv(key);
  await env.DB.prepare(
    "INSERT INTO findings(id,category,priority,asset,title,description,recommendation,evidence,observed_at) " +
    "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,observed_at=excluded.observed_at"
  ).bind(id,category,priority,asset,clampText(title,220),clampText(description,450),
    basicRecommendation(category),evidence,nowIso()).run();
}
async function checkSite(env) {
  let result, reason=""; try {
    result=await getPublic(env,SITE+"/",{body:false});
  } catch(error) { reason=clampText(error.message,80); result={status:0}; }
  const rows=await env.DB.prepare("SELECT failures FROM assets WHERE url=?").bind(SITE+"/").first();
  const ok=result.status>=200 && result.status<300;
  const fails=ok?0:Number(rows?.failures||0)+1;
  await env.DB.prepare(
    "INSERT INTO assets(url,name,kind,first_seen,last_seen,last_checked,http_status,failures,status) "+
    "VALUES(?,'YorpHives website','website',?,?,?,?,?,?) " +
    "ON CONFLICT(url) DO UPDATE SET last_seen=excluded.last_seen,last_checked=excluded.last_checked,"+
    "http_status=excluded.http_status,failures=excluded.failures,status=excluded.status"
  ).bind(SITE+"/",nowIso(),nowIso(),nowIso(),result.status,fails,
    ok?"reachable":fails>=2?"degraded":"pending").run();
  if(fails===2) await addFinding(env,{key:"website-down",category:"reliability",priority:"high",asset:SITE,
    title:"YorpHives website repeatedly unavailable",
    description:"Two consecutive GET checks failed; HTTP "+result.status+" "+reason,evidence:SITE+"/"});
  if(ok && Number(rows?.failures||0)>=2) await saveStatus(env,"site_recovery","Website returned a successful response after repeated failures");
  return {status:result.status,failures:fails};
}
async function discoverTools(env) {
  const candidates=new Set(); let sources=0; const limits=[
    [SITE+"/sitemap.xml","sitemap"],
    [SITE+"/.well-known/yorphives-products.json","manifest"],
    ...HUBS.map(path=>[SITE+path,"hub"])
  ];
  for(const [url,kind] of limits){
    try{
      const result=await getPublic(env,url,{body:true});
      if(result.status!==200 || result.text===null) continue;
      sources++;
      const urls=kind==="sitemap"?sitemapTools(result.text):kind==="manifest"?
        manifestTools(result.text):hubTools(result.text);
      for(const item of urls) candidates.add(item);
    }catch { /* one unavailable source never implies a removed product */ }
    if(candidates.size>=MAX_ROUTES_PER_DISCOVERY) break;
  }
  const hasPrevious=await env.DB.prepare("SELECT COUNT(*) AS total FROM assets WHERE kind='tool'").first();
  let inserted=0;
  for(const url of [...candidates].slice(0,MAX_ROUTES_PER_DISCOVERY)){
    const name=decodeURIComponent(new URL(url).pathname.split("/").pop()||"Tool").replace(/[-_]/g," ").slice(0,100);
    const answer=await env.DB.prepare("INSERT OR IGNORE INTO assets(url,name,kind,first_seen,last_seen,status) VALUES(?,?,'tool',?,?,'unverified')")
      .bind(url,name,nowIso(),nowIso()).run();
    if(Number(answer.meta?.changes||0)>0) {
      inserted++;
      if(Number(hasPrevious?.total||0)>0) await saveStatus(env,"new_tool_"+fnv(url),"New tool discovered: "+url);
    }
    await env.DB.prepare("UPDATE assets SET last_seen=? WHERE url=?").bind(nowIso(),url).run();
  }
  await saveStatus(env,"discovery",sources===0?"unverified:no-readable-sources":
    "observed:"+candidates.size+":sources:"+sources);
  // No automatic deletions. Missing sitemap entries are NOT proof a tool was removed.
  return {discovered:candidates.size,newlyEnrolled:inserted,validSources:sources};
}
async function checkProducts(env) {
  const list=await env.DB.prepare(
    "SELECT url,name,failures FROM assets WHERE kind='tool' ORDER BY (last_checked IS NOT NULL) ASC,last_checked ASC LIMIT ?"
  ).bind(MAX_CHECKS_PER_HOUR).all();
  for(const item of list.results||[]){
    let status=0;
    try{ status=(await getPublic(env,item.url,{body:false})).status; }catch{}
    const ok=status>=200 && status<300;
    const fails=ok?0:Number(item.failures||0)+1;
    await env.DB.prepare("UPDATE assets SET last_checked=?,http_status=?,failures=?,status=? WHERE url=?")
      .bind(nowIso(),status,fails,ok?"reachable":fails>=2?"degraded":"pending",item.url).run();
    if(fails===2) await addFinding(env,{key:"tool-down:"+item.url,category:"reliability",priority:"high",
      asset:item.name,title:"Tool appears repeatedly unavailable: "+item.name,
      description:"Two consecutive read-only requests failed. Last observed HTTP "+status,
      evidence:item.url});
  }
  return (list.results||[]).length;
}
async function research(env) {
  try{
    const response=await getPublic(env,RESEARCH,{body:true,allowResearch:true});
    if(response.status!==200 || response.text===null) {
      await saveStatus(env,"research","unavailable"); return 0;
    }
    const leads=feedLeads(response.text);
    let created=0;
    for(const item of leads){
      const result=await env.DB.prepare(
        "INSERT OR IGNORE INTO opportunities(id,title,description,recommendation,source_url,observed_at,score,kind) "+
        "VALUES(?,?,?,?,?,?,?,'unvalidated-lead')"
      ).bind(fnv(item.link),item.title,"Public product mention; user demand and traffic are unverified.",
        basicRecommendation("product"),item.link,nowIso(),15).run();
      created += Number(result.meta?.changes||0);
    }
    await saveStatus(env,"research","sources:1:leads:"+leads.length+":new:"+created);
    return created;
  }catch{await saveStatus(env,"research","unavailable");return 0;}
}
function schedulePlan(scheduledTime){
  const time=new Date(scheduledTime);
  const minute=time.getUTCMinutes(),hour=time.getUTCHours();
  return {uptime:true,products:minute===0,discovery:minute===0 && hour%6===0,
    research:minute===0 && hour===3, retention:minute===0 && hour===3};
}
async function scheduledCycle(env, scheduledTime) {
  if(!env.DB) throw Error("Missing D1 binding");
  const plan=schedulePlan(scheduledTime);
  // Cloudflare is free only while account remains on Free; this worker has
  // no paid API, AI binding, browser use, writable GitHub credential or deployment tool.
  await checkSite(env);
  if(plan.products) await checkProducts(env);
  if(plan.discovery) await discoverTools(env);
  if(plan.research) await research(env);
  if(plan.retention) {
    await env.DB.prepare("DELETE FROM quota WHERE day < ?").bind(nowIso().slice(0,10)).run();
    await env.DB.prepare("DELETE FROM opportunities WHERE observed_at < ?")
      .bind(new Date(Date.now()-90*86400000).toISOString()).run();
  }
  await saveStatus(env,"last_cron","cycle:"+nowIso());
}
function base64UrlBytes(value) {
  if(!/^[A-Za-z0-9_-]+$/.test(value||"")) throw Error("invalid-token-encoding");
  const binary=atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"="));
  return Uint8Array.from(binary,x=>x.charCodeAt(0));
}
function base64UrlJson(value) { return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))); }
let jwksCache={url:"",until:0,keys:[]};
async function verifyAccess(request,env) {
  const domain=String(env.ACCESS_TEAM_DOMAIN||"");
  const audience=String(env.ACCESS_AUD||"");
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain) || audience.length<10) return false;
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token || token.length>6000) return false;
  try{
    const parts=token.split(".");
    if(parts.length!==3) return false;
    const header=base64UrlJson(parts[0]), claims=base64UrlJson(parts[1]);
    const now=Math.floor(Date.now()/1000);
    if(header.alg!=="RS256" || !header.kid || claims.iss!==domain ||
       !(Array.isArray(claims.aud)?claims.aud.includes(audience):claims.aud===audience) ||
       !Number.isFinite(claims.exp) || claims.exp<=now || (claims.nbf && claims.nbf>now+30)) return false;
    if(jwksCache.url!==domain || jwksCache.until<Date.now() || !jwksCache.keys.some(k=>k.kid===header.kid)){
      const res=await fetch(domain+"/cdn-cgi/access/certs",{redirect:"error"});
      if(!res.ok) return false;
      const body=await res.json();
      if(!Array.isArray(body.keys)) return false;
      jwksCache={url:domain,until:Date.now()+3600000,keys:body.keys.filter(k=>k.kty==="RSA"&&k.alg==="RS256")};
    }
    const jwk=jwksCache.keys.find(k=>k.kid===header.kid);
    if(!jwk) return false;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64UrlBytes(parts[2]),
      new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch{return false;}
}
async function report(env) {
  const [assets,findings,leads,quota,status]=await Promise.all([
    env.DB.prepare("SELECT * FROM assets ORDER BY kind ASC,name ASC LIMIT 150").all(),
    env.DB.prepare("SELECT * FROM findings ORDER BY observed_at DESC LIMIT 80").all(),
    env.DB.prepare("SELECT * FROM opportunities ORDER BY observed_at DESC LIMIT 50").all(),
    env.DB.prepare("SELECT kind,used FROM quota WHERE day=?").bind(nowIso().slice(0,10)).all(),
    env.DB.prepare("SELECT key,value,checked_at FROM status ORDER BY checked_at DESC LIMIT 30").all()
  ]);
  const a=assets.results||[],f=findings.results||[],o=leads.results||[],metadata=status.results||[];
  const last=metadata.find(x=>x.key==="last_cron");
  const discovery=metadata.find(x=>x.key==="discovery");
  const fresh=Boolean(last && Date.now()-Date.parse(last.checked_at)<2*3600000);
  const tools=a.filter(x=>x.kind==="tool");
  const quotaUsed=Object.fromEntries((quota.results||[]).map(row=>[row.kind,row.used]));
  const now=nowIso();
  return {
    schemaVersion:"yorphives.hq-intelligence.v1", generatedAt:now,
    verification:{method:"cloudflare-worker-readonly-http",complete:Boolean(discovery?.value.startsWith("observed:")),
      limitations:"HTTP evidence only; catalog completeness and feature functionality are not verified.",
      generatedAt:last?.checked_at||"",notes:fresh?[]:["Collector heartbeat stale or absent"]},
    assets:a.map(x=>({id:fnv(x.url),name:x.name,kind:x.kind,status:x.status==="reachable"?"healthy":"unknown",summary:x.url})),
    products:tools.map(x=>({id:fnv(x.url),name:x.name,url:x.url,source:"public-sitemap-or-hub",
      status:x.status==="reachable"?"healthy":x.status==="degraded"?"degraded":"unknown",
      active:true,firstSeen:x.first_seen,lastChecked:x.last_checked||"",features:[]})),
    changes:metadata.filter(x=>x.key.startsWith("new_tool_")).map(x=>({
      id:x.key,url:x.value.replace("New tool discovered: ",""),kind:"new-product",severity:"info",
      summary:x.value,occurredAt:x.checked_at
    })),
    findings:f.map(x=>({id:x.id,title:x.title,category:x.category,priority:x.priority,asset:x.asset,
      description:x.description,recommendation:x.recommendation,observedAt:x.observed_at,evidence:[x.evidence]})),
    opportunities:o.map(x=>({id:x.id,title:x.title,category:"product",priority:"medium",
      description:x.description,recommendation:x.recommendation,observedAt:x.observed_at,evidence:[x.source_url],
      confidence:"Public mention only; not validated market demand",score:x.score})),
    comparisons:[],agents:[],
    activity:metadata.slice(0,25).map(x=>({id:x.key,title:x.key.replaceAll("_"," "),
      summary:x.value,kind:"observation",occurredAt:x.checked_at})),
    resourceBudget:{publicFetches:{used:quotaUsed.public_fetches||0,limit:FETCH_BUDGET_DAY},
      aiCalls:{used:0,limit:0,disabled:true},browserMinutes:{used:0,limit:0,disabled:true}},
    pipeline:{generatedAt:last?.checked_at||"",readOnly:true,approvalRequired:true,
      products:{complete:Boolean(discovery?.value.startsWith("observed:")),method:"cloudflare-scheduled-http",
        discovered:tools.length,notes:[]},
      research:{status:metadata.find(x=>x.key==="research")?.value||"not-yet-observed"},
      errors:fresh?[]:["Collector heartbeat stale or absent"]}
  };
}
function json(value,status=200) {return new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});}
export default {
  async fetch(request,env,ctx) {
    const route=new URL(request.url).pathname;
    if(!["GET","HEAD"].includes(request.method)) return new Response("Read-only",{status:405});
    if(!(await verifyAccess(request,env))) return new Response("Private Headquarters access not configured or unauthorized",{status:403,headers:{"cache-control":"no-store"}});
    if(route==="/api/report") {
      if(!env.DB) return json({error:"Evidence database is not configured"},503);
      const result=await report(env);
      return new Response(request.method==="HEAD"?null:JSON.stringify(result),{
        status:200,headers:{...JSON_HEADERS,"X-YorpHives-HQ-Evidence":"readonly-cloudflare"}});
    }
    if(route==="/api/status") {
      const health=await env.DB.prepare("SELECT value,checked_at FROM status WHERE key='last_cron'").first();
      return json({collector:health?"reported":"not-started",lastCheck:health?.checked_at||null,
        readOnly:true,aiDisabled:true,paidServices:false});
    }
    if(!env.ASSETS) return new Response("Private assets not configured",{status:503});
    return env.ASSETS.fetch(request);
  },
  async scheduled(event,env,ctx) {
    if(!env.DB) return;
    ctx.waitUntil(scheduledCycle(env,event.scheduledTime).catch(error=>{
      console.warn("HQ read-only scheduled scan failed:",clampText(error?.message,80));
    }));
  }
};
export {safeToolUrl,sitemapTools,hubTools,manifestTools,feedLeads,schedulePlan,verifyAccess,report};
