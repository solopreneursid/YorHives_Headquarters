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
const HUBS = ["/", "/free-tools/", "/free-tools/index.html", "/tools/", "/explore/"];
const RESEARCH = "https://hnrss.org/show";
const RESEARCH_SOURCES = [RESEARCH, "https://hnrss.org/ask"];
// Strictly allowlisted, public, anonymous, GET-only; not an applicability assessment.
const ADVISORY_SOURCE = "https://api.github.com/advisories?type=reviewed&ecosystem=npm&per_page=3";
// Tiny, replaceable Research Scout registry. Explicit public URLs only.
// No credentials, arbitrary search input, user browsing history or remote LLM.
const COMPETITOR_SOURCES = Object.freeze([
  {id:"ezgif-image-resize",name:"Ezgif image resizer",url:"https://ezgif.com/resize",
    robots:"https://ezgif.com/robots.txt",paths:["/free-tools/image-resizer"],
    claims:["animated images","crop","aspect ratio","local processing"]},
  {id:"ilovepdf-pdf-organize",name:"iLovePDF PDF documentation",
    url:"https://www.ilovepdf.com/help/documentation",
    robots:"https://www.ilovepdf.com/robots.txt",
    paths:["/free-tools/merge-pdf","/free-tools/split-pdf"],
    claims:["password-protected","cloud storage","page ranges","reorder"]}
]);
const MAX_ROUTES_PER_DISCOVERY = 45;
const MAX_CHECKS_PER_TICK = 2; // bounded two-product rounds every five minutes; Free-tier safe
const FETCH_BUDGET_DAY = 900; // intentionally far below platform ceilings
const MAX_TEXT_BYTES = 100000;
// Build-time replacement for the isolated API pilot; Wrangler Static Assets take priority.
const PILOT_STATIC_BUNDLE = null;
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
async function limitedFetch(url, {allowResearch = false, allowSecurity = false, allowCompetitor = false, body = false} = {}) {
  const parsed = new URL(url);
  const allowed = allowCompetitor ? COMPETITOR_SOURCES.some(x=>x.url===url||x.robots===url) :
    allowSecurity ? url === ADVISORY_SOURCE :
    allowResearch ? RESEARCH_SOURCES.includes(url) : ORIGIN_SET.has(parsed.origin);
  if (!allowed) throw Error("target-not-allowlisted");
  const response = await fetch(url, {method:"GET", redirect:"manual", cache:"no-store",
    headers: {"user-agent":"YorpHivesHQ-ReadOnly/1.0 (+founder owned research)",
      "accept":allowSecurity?"application/vnd.github+json":"text/html, application/xml, application/rss+xml, application/json;q=0.9"}});
  const status=response.status;
  if (!body) { await response.body?.cancel(); return {status, text:null}; }
  if (status !== 200) { await response.body?.cancel(); return {status, text:null}; }
  const contentType = response.headers.get("content-type") || "";
  if (!/(xml|html|json|rss|atom|text|javascript)/i.test(contentType)) {
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
// Passive release signal, NOT a browser test or proof that a tool changed.
// Modern SPA builds often change hashed JS/CSS asset URLs after a new release.
function siteBundleRefs(html,base=SITE) {
  const found=new Set();
  for(const m of String(html||"").slice(0,MAX_TEXT_BYTES).matchAll(
    /\b(?:src|href)\s*=\s*["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)){
    try{
      const parsed=new URL(m[1],base);
      if(parsed.protocol!=="https:" || !ORIGIN_SET.has(parsed.origin) ||
        parsed.username || parsed.password || !/\.(js|css)$/i.test(parsed.pathname)) continue;
      parsed.search=""; parsed.hash="";
      found.add(parsed.toString());
    }catch{}
    if(found.size>=24) break;
  }
  return [...found].sort();
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
    // Ask HN often contains personal conversations. Keep concrete requests
    // for tools/solutions rather than classifying generic sentiment as demand.
    if(/^Ask HN:/i.test(title) && !/\b(need|looking for|recommend|which|what|how|where|any tool|is there|alternatives|automate|solution)\b/i.test(title)) continue;
    // An unrelated entertainment launch is not a validated technology problem.
    if(/\b(multiplayer|rts|gaming)\b/i.test(title) && !/\b(editor|sdk|engine|framework|developer tool|automation)\b/i.test(title)) continue;
    found.push({title,link});
    if(found.length >= 8) break;
  }
  return found;
}
// Only compares words in titles to the observed catalog; does NOT establish feature parity.
function classifyLead(title, catalog, complete=false) {
  if(!Array.isArray(catalog) || !catalog.length) {
    return {kind:"catalog-unverified",related:null,
      recommendation:"First verify the YorpHives product catalog. The current site inventory is incomplete, so this is only an external research mention."};
  }
  const tokenize = value => new Set(String(value||"").toLowerCase()
    .replace(/^(show|ask) hn\s*:\s*/,"")
    .split(/[^a-z0-9]+/).filter(word => word.length >= 3 &&
    !["the","for","and","with","from","that","this","using","best","new","free","open","source","app","tool","build","built"].includes(word)));
  const requested=tokenize(title);
  let best=null,score=0;
  for(const product of catalog){
    const known=tokenize(product.name);
    if(!known.size || !requested.size) continue;
    const matched=[...known].filter(x=>requested.has(x)).length;
    const similarity=matched/known.size;
    if(matched>=2 && similarity>score){best=product;score=similarity;}
  }
  if(best && score >= .6) return {kind:"possible-existing-product",related:best.name,relatedUrl:best.url,
    recommendation:"Potential alternative for "+best.name+
      ". Compare published source claims and verified tool capabilities; no inferior feature is established."};
  if(!complete)return {kind:"catalog-unverified",related:null,
    recommendation:"The published YorpHives catalog is incomplete. Review this lead; do not assume the product is missing."};
  return {kind:"potential-missing-product",related:null,
    recommendation:"Catalog suggests a possible missing product. Verify demand, competition, feasibility and differentiation before proposing it."};
}
function parseAdvisories(text) {
  let parsed; try { parsed=JSON.parse(text); }catch{return [];}
  if(!Array.isArray(parsed)) return [];
  const output=[];
  for(const row of parsed.slice(0,6)){
    const ghsa=String(row?.ghsa_id||"");
    if(!/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(ghsa) || row?.withdrawn_at) continue;
    const severity=String(row?.severity||"").toLowerCase();
    if(!["critical","high"].includes(severity)) continue;
    const affected=(Array.isArray(row?.vulnerabilities)?row.vulnerabilities:[])
      .map(x=>({ecosystem:clampText(x?.package?.ecosystem,25),name:clampText(x?.package?.name,120)}))
      .filter(x=>x.ecosystem==="npm" && x.name).slice(0,4);
    if(!affected.length) continue;
    output.push({id:ghsa, title:clampText(row?.summary,170),severity,
      publishedAt:clampText(row?.published_at,35),packages:affected,
      url:"https://github.com/advisories/"+ghsa});
  }
  return output;
}

const DISALLOWED_PRODUCT_PATH = /^\/(?:api|admin|internal|cdn-cgi|_next|assets|auth|account|login|logout|settings|billing|dashboard|private)(?:\/|$)/i;
function safeProductUrl(raw, base=SITE, allowVanity=false) {
  const url=safeToolUrl(raw,base);
  if(!url || url.length>400) return null;
  const path=new URL(url).pathname;
  if(path==="/" || /\/(?:free-tools|tools|explore|apps)\/index\.html$/i.test(path) || DISALLOWED_PRODUCT_PATH.test(path) || /[{}:*]/.test(path) ||
     /%(?:2f|5c|00)/i.test(path)) return null;
  if(!allowVanity && !isTool(url)) return null;
  return url;
}
function productManifest(text) {
  try {
    const data=JSON.parse(String(text||""));
    const list=Array.isArray(data)?data:data?.products;
    if(!Array.isArray(list)) return {items:[],complete:false};
    const seen=new Set(),items=[];
    for(const entry of list.slice(0,MAX_ROUTES_PER_DISCOVERY)) {
      if(!entry || typeof entry!=="object") continue;
      const url=safeProductUrl(entry.url,SITE,true);
      if(!url || seen.has(url)) continue;
      seen.add(url);
      items.push({url,name:clampText(entry.name,90),features:Array.isArray(entry.features)?
        entry.features.slice(0,12).map(x=>clampText(x,80)).filter(Boolean):[]});
    }
    // An explicitly completed, nonempty owner manifest is the only basis for
    // treating the inventory as comprehensive. All other sources are partial.
    return {items,complete:!Array.isArray(data)&&data.complete===true&&items.length>0&&list.length===items.length};
  }catch{return {items:[],complete:false};}
}
function sitemapEntries(xml) {
  const routes=[],children=[];
  for(const m of String(xml||"").slice(0,MAX_TEXT_BYTES).matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)){
    const raw=m[1].replaceAll("&amp;","&");
    const next=safeToolUrl(raw);
    if(!next) continue;
    if(/\.xml$/i.test(new URL(next).pathname)){
      if(children.length<3&&!children.includes(next))children.push(next);
    }else{
      const route=safeProductUrl(next);
      if(route && !routes.includes(route) && routes.length<MAX_ROUTES_PER_DISCOVERY)routes.push(route);
    }
  }
  return {routes,children};
}
function publicStructuredProducts(html) {
  const items=[],seen=new Set();
  const collect=(node,depth=0)=>{
    if(!node||depth>4||items.length>=MAX_ROUTES_PER_DISCOVERY)return;
    if(Array.isArray(node)){for(const child of node.slice(0,MAX_ROUTES_PER_DISCOVERY))collect(child,depth+1);return;}
    if(typeof node!=="object")return;
    const kinds=Array.isArray(node["@type"])?node["@type"]:[node["@type"]];
    const application=kinds.some(x=>["SoftwareApplication","WebApplication","MobileApplication"].includes(x));
    if(application){
      const url=safeProductUrl(node.url||node["@id"],SITE,true);
      if(url&&!seen.has(url)){seen.add(url);items.push({url,name:clampText(node.name,90)});}
    }
    if(node.item)collect(node.item,depth+1);
    if(node.itemListElement)collect(node.itemListElement,depth+1);
    if(node["@graph"])collect(node["@graph"],depth+1);
  };
  const scripts=String(html||"").slice(0,MAX_TEXT_BYTES).matchAll(
    /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for(const m of scripts) {
    try{collect(JSON.parse(m[1]));}catch{}
    if(items.length>=MAX_ROUTES_PER_DISCOVERY)break;
  }
  return items;
}
function publicBundleToolHints(javascript) {
  const found=[];
  const code=String(javascript||"").slice(0,MAX_TEXT_BYTES).replaceAll("\\/","/");
  // A literal product URL in public source is only a *route candidate*:
  // bundles can contain obsolete routes, examples and dead code.
  for(const match of code.matchAll(/["'\x60](\/(?:tools|tool|free-tools|apps|app|explore|products)\/[a-z0-9][a-z0-9/_-]{1,110})["'\x60]/gi)) {
    const url=safeProductUrl(match[1]);
    if(url&&!found.includes(url))found.push(url);
    if(found.length>=12)break;
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
    "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,observed_at=excluded.observed_at,status=\'open\'"
  ).bind(id,category,priority,asset,clampText(title,220),clampText(description,450),
    basicRecommendation(category),evidence,nowIso()).run();
}
async function checkSite(env) {
  let result, reason=""; try {
    result=await getPublic(env,SITE+"/",{body:false});
  } catch(error) {
    reason=clampText(error.message,80);
    if(reason==="daily-free-budget-exhausted"){
      await saveStatus(env,"monitoring_paused","Daily request budget exhausted; no failed health check inferred.");
      return {status:null,skipped:true};
    }
    result={status:0};
  }
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
  if(ok && Number(rows?.failures||0)>=2) {
    await env.DB.prepare("UPDATE findings SET status='resolved' WHERE id=?").bind(fnv("website-down")).run();
    await saveStatus(env,"site_recovery","Website responded after previous repeated failures; verify independently");
  }
  return {status:result.status,failures:fails};
}
function publicPageFingerprint(html){
  const page=String(html||"").slice(0,MAX_TEXT_BYTES);
  const title=(page.match(/<title[^>]*>([^<]{1,220})<\/title>/i)||[])[1]||"";
  const heading=(page.match(/<h1[^>]*>([^<]{1,220})<\/h1>/i)||[])[1]||"";
  const description=(page.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,350})/i)||[])[1]||"";
  const stable=[title,heading,description].map(x=>clampText(x,250)).filter(Boolean).join("|");
  return stable?fnv(stable):"";
}
async function discoverTools(env) {
  const choices=new Map(),manifestDeclared=new Set(),sourceHealth=[]; let validSources=0,manifestComplete=false,scriptCandidateCount=0;
  const rank={manifest:5,structured:4,link:3,sitemap:2,script:1};
  const insert=(url,source,evidence,name="",features=[])=>{
    const safe=safeProductUrl(url,SITE,source==="manifest"||source==="structured");
    if(!safe || choices.size>=MAX_ROUTES_PER_DISCOVERY&&!choices.has(safe))return;
    const current=choices.get(safe);
    if(current && rank[current.source]>=rank[source])return;
    choices.set(safe,{url:safe,source,evidence,name:clampText(name,90),
      features:features.slice(0,12),confidence:source==="script"?"candidate":"published"});
  };
  // Catalog sources are public GET resources on the website's own domain.
  // The website's GitHub source may not correspond to the current Pages deploy.
  try{
    const result=await getPublic(env,SITE+"/.well-known/yorphives-products.json",{body:true});
    sourceHealth.push("manifest:"+result.status);
    if(result.status===200 && result.text){
      const parsed=productManifest(result.text);
      if(parsed.items.length){validSources++;manifestComplete=parsed.complete;}
      for(const item of parsed.items){
        manifestDeclared.add(item.url);
        insert(item.url,"manifest",SITE+"/.well-known/yorphives-products.json",item.name,item.features);
      }
    }
  }catch{}
  const sitemaps=[SITE+"/sitemap.xml",SITE+"/free-tools-tool-sitemap.xml",SITE+"/sitemap_index.xml"];
  try{
    const robots=await getPublic(env,SITE+"/robots.txt",{body:true});
    sourceHealth.push("robots:"+robots.status);
    if(robots.status===200 && robots.text){
      for(const m of robots.text.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)){
        const url=safeToolUrl(m[1]);
        if(url && /\.xml$/i.test(new URL(url).pathname) && sitemaps.length<5 && !sitemaps.includes(url))sitemaps.push(url);
      }
    }
  }catch{}
  for(let k=0;k<sitemaps.length && k<5;k++){
    const source=sitemaps[k];
    try{
      const response=await getPublic(env,source,{body:true});
      sourceHealth.push("sitemap:"+new URL(source).pathname+":"+response.status);
      if(response.status!==200||!response.text)continue;
      const parsed=sitemapEntries(response.text);
      if(parsed.routes.length||parsed.children.length)validSources++;
      for(const item of parsed.routes)insert(item,"sitemap",source);
      for(const nested of parsed.children){
        if(sitemaps.length<4&&!sitemaps.includes(nested))sitemaps.push(nested);
      }
    }catch{}
  }
  const hubs=[SITE+"/",...HUBS.filter(x=>x!=="/").map(x=>SITE+x)];
  for(const url of hubs){
    try{
      const page=await getPublic(env,url,{body:true});
      sourceHealth.push("hub:"+new URL(url).pathname+":"+page.status);
      if(page.status!==200||page.text===null)continue;
      const links=hubTools(page.text,url);
      const structured=publicStructuredProducts(page.text);
      if(links.length||structured.length)validSources++;
      for(const item of links)insert(item,"link",url);
      for(const item of structured)insert(item.url,"structured",url,item.name);
      if(url===SITE+"/"){
        const meaningful=publicPageFingerprint(page.text);
        if(meaningful)await saveStatus(env,"home_content_fingerprint",meaningful);
        const refs=siteBundleRefs(page.text);
        if(refs.length){
          const version=fnv(refs.join("|"));
          const previous=await env.DB.prepare("SELECT value FROM status WHERE key='site_bundle_fingerprint'").first();
          if(previous?.value && previous.value!==version)await saveStatus(env,"site_bundle_change",
            "Public site JS/CSS assets changed. Review for newly published or modified tools; identity unverified.");
          await saveStatus(env,"site_bundle_fingerprint",version);
          // Fetch at most ONE small, same-origin public JS file for SPA routes.
          const main=refs.filter(x=>new URL(x).pathname.endsWith(".js"))
            .sort((a,b)=>Number(/(?:index|main|app)[.-]/i.test(b))-Number(/(?:index|main|app)[.-]/i.test(a)))[0];
          if(main){
            try{
              const bundle=await getPublic(env,main,{body:true});
              sourceHealth.push("script:"+bundle.status+(bundle.text===null?":oversize":""));
              if(bundle.status===200&&bundle.text){
                const hinted=publicBundleToolHints(bundle.text);
                scriptCandidateCount+=hinted.length;
                for(const item of hinted)insert(item,"script",main);
              }
            }catch{}
          }
        }
      }
    }catch{}
  }
  const wasInitialized=await env.DB.prepare("SELECT value FROM status WHERE key='discovery'").first();
  let enrolled=0;
  for(const item of [...choices.values()].slice(0,MAX_ROUTES_PER_DISCOVERY)){
    const pieces=new URL(item.url).pathname.split("/").filter(Boolean);
    const path=pieces.at(-1)==="index.html"?pieces.at(-2)||"Product":pieces.at(-1)||"Product";
    let readable=path;
    try{readable=decodeURIComponent(path);}catch{}
    const name=item.name||clampText(readable.replace(/[-_]/g," "),90);
    const data=await env.DB.prepare(
      "INSERT OR IGNORE INTO assets(url,name,kind,first_seen,last_seen,status,discovery_source,evidence_url,inventory_confidence,features_json)"+
      " VALUES(?,?,'tool',?,?,'unverified',?,?,?,?)"
    ).bind(item.url,name,nowIso(),nowIso(),item.source,item.evidence,item.confidence,
      JSON.stringify(item.features)).run();
    if(Number(data.meta?.changes||0)>0){
      enrolled++;
      if(wasInitialized)await saveStatus(env,"new_tool_"+fnv(item.url),
        (item.confidence==="candidate"?"Possible tool route (unverified): ":"New tool discovered: ")+item.url);
    }
    await env.DB.prepare(
      "UPDATE assets SET last_seen=?, "+
      "name=CASE WHEN ?<>'' THEN ? ELSE name END, "+
      "discovery_source=CASE WHEN inventory_confidence='published' AND ?='candidate' THEN discovery_source ELSE ? END, "+
      "evidence_url=CASE WHEN inventory_confidence='published' AND ?='candidate' THEN evidence_url ELSE ? END, "+
      "inventory_confidence=CASE WHEN inventory_confidence='published' THEN inventory_confidence ELSE ? END, "+
      "features_json=CASE WHEN ?<>'[]' THEN ? ELSE features_json END WHERE url=?"
    ).bind(nowIso(),item.name,item.name,item.confidence,item.source,item.confidence,item.evidence,
      item.confidence,JSON.stringify(item.features),JSON.stringify(item.features),item.url).run();
  }
  const confirmed=[...choices.values()].filter(x=>x.confidence==="published").length;
  // A manifest cannot certify a comprehensive inventory if the website
  // also publicly links tools omitted from it. Preserve those discoveries,
  // but warn the founder that the catalog is inconsistent.
  const mismatch=manifestComplete&&[...choices.values()].some(x=>
    x.confidence==="published"&&!manifestDeclared.has(x.url));
  if(mismatch)manifestComplete=false;
  const label=manifestComplete?"observed:manifest-complete:":"partial:";
  await saveStatus(env,"discovery",label+"published:"+confirmed+":candidates:"+scriptCandidateCount+
    ":sources:"+validSources+(mismatch?":manifest-mismatch":""));
  await saveStatus(env,"discovery_sources",sourceHealth.slice(0,14).join(","));

  // Discoveries are never removed on missing scans; a missing source is NOT
  // evidence of deletion, and literal JS routes never prove functionality.
  return {discovered:choices.size,newlyEnrolled:enrolled,confirmed,manifestComplete,scriptCandidateCount};
}
async function checkProducts(env) {
  const list=await env.DB.prepare(
    "SELECT url,name,failures,page_fingerprint,inventory_confidence FROM assets WHERE kind='tool' "+
    "ORDER BY (last_checked IS NOT NULL) ASC,last_checked ASC LIMIT ?"
  ).bind(MAX_CHECKS_PER_TICK).all();
  const homepage=await env.DB.prepare("SELECT value FROM status WHERE key='home_content_fingerprint'").first();
  let checked=0;
  for(const item of list.results||[]){
    let result={status:0,text:null};
    try{ result=await getPublic(env,item.url,{body:true}); }
    catch(error){
      if(error?.message==="daily-free-budget-exhausted"){
        await saveStatus(env,"monitoring_paused",
          "Daily request allowance exhausted. Remaining tool checks skipped, not failed.");
        break;
      }
    }
    checked++;
    const redirect=result.status>=300&&result.status<400;
    // Same-site directory routes can canonically redirect to a trailing
    // slash. A redirect is NOT a failed tool nor proof the destination works.
    const ok=result.status>=200&&result.status<400;
    const hash=ok&&result.text?publicPageFingerprint(result.text):"";
    const shell=Boolean(hash&&homepage?.value&&hash===homepage.value);
    const previous=item.page_fingerprint||"";
    const fails=ok?0:Number(item.failures||0)+1;
    await env.DB.prepare(
      "UPDATE assets SET last_checked=?,http_status=?,failures=?,status=?,page_fingerprint=? WHERE url=?"
    ).bind(nowIso(),result.status,fails,ok?(shell||redirect?"unverified":"reachable"):
      fails>=2?"degraded":"pending",hash||previous,item.url).run();
    if(ok && Number(item.failures||0)>=2){
      await env.DB.prepare("UPDATE findings SET status='resolved' WHERE id=?")
        .bind(fnv("tool-down:"+item.url)).run();
    }
    if(fails===2)await addFinding(env,{key:"tool-down:"+item.url,category:"reliability",priority:"high",
      asset:item.name,title:"Tool route repeatedly unavailable: "+item.name,
      description:"Two HTTP GET checks failed (last status "+result.status+
        "). This is a route observation, not functional browser testing.",
      evidence:item.url});
    if(ok && hash && previous && hash!==previous && !shell){
      await saveStatus(env,"tool_change_"+fnv(item.url),
        "Public title, heading or description changed for "+item.url+
        ". Review new features; page metadata is not proof of functionality.");
      await env.DB.prepare("UPDATE assets SET changed_at=? WHERE url=?")
        .bind(nowIso(),item.url).run();
    }
    // A generic SPA shell is not a verified product response, even at HTTP 200.
    if(shell)await saveStatus(env,"spa_shell_"+fnv(item.url),
      "Generic site shell returned for "+item.url+"; tool functionality remains unverified.");
  }
  return checked;
}
// Conservative, standard robots.txt rules for the exact public page path.
// If unknown or unparseable, the competitor scout skips inspection.
function robotsAllowsPath(robotsText,pagePath){
  if(typeof robotsText!=="string"||robotsText.length>100000||!pagePath.startsWith("/"))return false;
  const groups=[];let agents=[],rules=[],sawRules=false;
  function flush(){if(agents.length)groups.push({agents,rules});agents=[];rules=[];sawRules=false;}
  for(const raw of robotsText.split(/\r?\n/).slice(0,1200)){
    const line=raw.split("#")[0].trim();
    if(!line)continue;
    const m=line.match(/^([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if(!m)continue;
    const directive=m[1].toLowerCase(),value=m[2];
    if(directive==="user-agent"){
      if(sawRules)flush();
      agents.push(value.toLowerCase());
    }else if((directive==="allow"||directive==="disallow") && agents.length){
      sawRules=true;
      if(value)rules.push({kind:directive,prefix:value.split("*")[0].split("$")[0]});
    }
  }
  flush();
  const target=["yorphiveshq-readonly","*"];
  for(const agent of target){
    const matching=groups.filter(g=>g.agents.some(a=>a===agent));
    if(!matching.length)continue;
    let verdict=true,max=-1;
    for(const rule of matching.flatMap(g=>g.rules)){
      if(!pagePath.startsWith(rule.prefix))continue;
      if(rule.prefix.length>max || rule.prefix.length===max && rule.kind==="allow"){
        max=rule.prefix.length;verdict=rule.kind==="allow";
      }
    }
    return verdict;
  }
  return true; // a valid robots file with no applicable group
}
function cleanPublicPage(html){
  return String(html||"").slice(0,MAX_TEXT_BYTES)
    .replace(/<script\b[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&(?:amp|quot|nbsp|#39|lt|gt);/gi," ")
    .replace(/\s+/g," ").trim().toLowerCase();
}
function competitorClaimEvidence(html,phrases){
  const visible=cleanPublicPage(html);
  return phrases.filter(phrase=>visible.includes(phrase.toLowerCase())).slice(0,4);
}
async function competitorScout(env,index){
  const source=COMPETITOR_SOURCES[index];
  if(!source)return 0;
  const key="competitor_watch_"+source.id;
  let reason="not-verified",created=0;
  try{
    const robots=await getPublic(env,source.robots,{body:true,allowCompetitor:true});
    const allowed=robots.status===404 ||
      robots.status===200 && robots.text!==null &&
      robotsAllowsPath(robots.text,new URL(source.url).pathname);
    if(!allowed){reason="robots-unavailable-or-disallowed";return 0;}
    const page=await getPublic(env,source.url,{body:true,allowCompetitor:true});
    if(page.status!==200||!page.text){reason="public-page-not-readable:"+page.status;return 0;}
    const claims=competitorClaimEvidence(page.text,source.claims);
    if(!claims.length){reason="no-verifiable-advertised-claims";return 0;}
    // Only map to exact product URLs already confirmed by public catalog.
    for(const path of source.paths){
      const own=await env.DB.prepare(
        "SELECT url,name,features_json FROM assets WHERE url=? AND kind='tool' AND inventory_confidence='published'"
      ).bind(SITE+path).first();
      if(!own)continue;
      const id=fnv("official-public-page:"+own.url+"|"+source.url);
      const summary="Official page mentions: "+claims.join(", ")+
        ". No feature-parity or YorpHives implementation test was performed.";
      const recommendation="Review "+own.name+" alongside the public "+
        source.name+" documentation. Check these advertised features manually: "+
        claims.join(", ")+". Do not assume missing functionality.";
      await env.DB.prepare(
        "INSERT INTO product_hypotheses(id,product_url,product_name,competing_title,competing_url,evidence_summary,recommendation,status,observed_at)"+
        " VALUES(?,?,?,?,?,?,?,'unverified',?)"+
        " ON CONFLICT(id) DO UPDATE SET evidence_summary=excluded.evidence_summary,recommendation=excluded.recommendation,observed_at=excluded.observed_at"
      ).bind(id,own.url,own.name,source.name,source.url,summary,recommendation,nowIso()).run();
      created++;
    }
    reason="source-observed:reviews:"+created;
  }catch(error){
    reason=error?.message==="daily-free-budget-exhausted"?"budget-paused":"source-unavailable";
  }finally{await saveStatus(env,key,reason);}
  return created;
}

async function research(env) {
  const catalog=await env.DB.prepare(
    "SELECT url,name,features_json FROM assets WHERE kind='tool' AND inventory_confidence='published' LIMIT 150"
  ).all();
  const products=catalog.results||[];
  const completeness=await env.DB.prepare("SELECT value FROM status WHERE key='discovery'").first();
  const complete=Boolean(completeness?.value?.startsWith("observed:manifest-complete:"));
  let created=0,successful=0,linked=0;
  for(const feed of RESEARCH_SOURCES){
    try{
      const response=await getPublic(env,feed,{body:true,allowResearch:true});
      if(response.status!==200||response.text===null)continue;
      successful++;
      for(const item of feedLeads(response.text)){
        const result=classifyLead(item.title,products,complete);
        const stored=await env.DB.prepare(
          "INSERT OR IGNORE INTO opportunities(id,title,description,recommendation,source_url,observed_at,score,kind) "+
          "VALUES(?,?,?,?,?,?,?,?)"
        ).bind(fnv(item.link),item.title,
          "Public "+(feed.endsWith("/ask")?"problem discussion":"product mention")+
          "; demand, traffic, feature equivalence and revenue are unverified.",
          result.recommendation,item.link,nowIso(),15,result.kind).run();
        created+=Number(stored.meta?.changes||0);
        // Public mentions can suggest alternatives, but never prove that any
        // current YorpHives feature is missing, inferior, or profitable.
        if(result.kind==="possible-existing-product" && result.relatedUrl){
          const hypothesisId=fnv(result.relatedUrl+"|"+item.link);
          await env.DB.prepare(
            "INSERT INTO product_hypotheses(id,product_url,product_name,competing_title,competing_url,evidence_summary,recommendation,status,observed_at)"+
            " VALUES(?,?,?,?,?,?,?,'unverified',?)"+
            " ON CONFLICT(id) DO UPDATE SET observed_at=excluded.observed_at"
          ).bind(hypothesisId,result.relatedUrl,result.related,item.title,item.link,
            "A public RSS title resembles an enrolled tool; no competitor feature audit performed.",
            result.recommendation,nowIso()).run();
          linked++;
        }
      }
    }catch{}
  }
  await saveStatus(env,"research",successful?"sources:"+successful+"/"+RESEARCH_SOURCES.length+
    ":new:"+created+":alternatives:"+linked:"unavailable:no-public-feeds");
  return created;
}
async function securityWatch(env) {
  let response;
  try { response=await getPublic(env,ADVISORY_SOURCE,{body:true,allowSecurity:true}); }
  catch { await saveStatus(env,"security_watch","unavailable"); return 0; }
  if(response.status!==200 || response.text===null) {
    await saveStatus(env,"security_watch","unavailable:http-"+response.status);
    return 0;
  }
  const items=parseAdvisories(response.text);
  for(const item of items) {
    await env.DB.prepare(
      "INSERT INTO security_watch(id,title,severity,packages,source_url,published_at,observed_at,applicability)"+
      " VALUES(?,?,?,?,?,?,?,'unverified')"+
      " ON CONFLICT(id) DO UPDATE SET title=excluded.title,severity=excluded.severity,"+
      "packages=excluded.packages,observed_at=excluded.observed_at"
    ).bind(item.id,item.title,item.severity,JSON.stringify(item.packages),
      item.url,item.publishedAt,nowIso()).run();
  }
  await saveStatus(env,"security_watch","observed:"+items.length+
    ":applicability-unverified");
  return items.length;
}
function schedulePlan(scheduledTime){
  const time=new Date(scheduledTime);
  const minute=time.getUTCMinutes(),hour=time.getUTCHours();
  const discovery=minute===0 && hour%6===0;
  const research=minute===0 && hour===3;
  const security=minute===0 && hour===4;
  const competitorIndex=hour===7&&minute===5?0:hour===7&&minute===10?1:-1;
  // Keep heavy scanners separate from tool HTTP checks on 10ms CPU Free Cron.
  // 2 tools per ordinary five-minute event and site check every 15 min:
  // 564 tool checks/day + 96 website checks/day, leaving ~240 public fetches
  // for discovery, research, advisory and bounded competitor source reviews.
  return {uptime:minute%15===0,products:!(discovery||research||security||competitorIndex>=0),
    discovery,research,security,retention:research,competitorIndex};
}
async function scheduledCycle(env, scheduledTime) {
  if(!env.DB) throw Error("Missing D1 binding");
  const plan=schedulePlan(scheduledTime);
  // Cloudflare is free only while account remains on Free; this worker has
  // no paid API, AI binding, browser use, writable GitHub credential or deployment tool.
  if(plan.uptime) await checkSite(env);
  if(plan.products) await checkProducts(env);
  // On a newly initialized HQ database, discover/research immediately rather
  // than waiting up to six hours or one day for the first scheduled window.
  const first = await env.DB.prepare(
    "SELECT key FROM status WHERE key IN ('discovery','research','security_watch')"
  ).all();
  const observed=new Set((first.results||[]).map(x=>x.key));
  // Stagger expensive first-run discovery/research/watch across separate Cron
  // invocations. Never try to run all public collectors in one Free-tier event.
  // A newly deployed discovery engine gets one immediate scheduled scan,
  // preserving earlier records instead of waiting six hours or rewriting
  // website files. Versioned scan state is D1 observation metadata only.
  const version=await env.DB.prepare(
    "SELECT value FROM status WHERE key='discovery_engine_version'"
  ).first();
  if(plan.discovery || !observed.has("discovery") || version?.value!=="v4") {
    await discoverTools(env);
    await saveStatus(env,"discovery_engine_version","v4");
  }else if(plan.research || !observed.has("research")) await research(env);
  else if(plan.security || !observed.has("security_watch")) await securityWatch(env);
  else if(plan.competitorIndex>=0) await competitorScout(env,plan.competitorIndex);
  if(plan.retention) {
    await env.DB.prepare("DELETE FROM quota WHERE day < ?").bind(nowIso().slice(0,10)).run();
    await env.DB.prepare("DELETE FROM opportunities WHERE observed_at < ?")
      .bind(new Date(Date.now()-90*86400000).toISOString()).run();
    await env.DB.prepare("DELETE FROM security_watch WHERE observed_at < ?")
      .bind(new Date(Date.now()-120*86400000).toISOString()).run();
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
async function verifyAccess(request,env,ctx) {
  const expectedOwner=String(env.ACCESS_OWNER_EMAIL||"").trim().toLowerCase();
  const expectedAudience=String(env.ACCESS_AUD||"");
  if(!expectedOwner || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedOwner) ||
     expectedAudience.length<10) return false;
  // With Worker-level Cloudflare Access, ctx.access is the platform-validated
  // identity. Browser sessions can be authenticated without forwarding the
  // legacy Cf-Access-Jwt-Assertion request header to this Worker.
  if(ctx?.access) {
    try {
      if(ctx.access.aud!==expectedAudience ||
         typeof ctx.access.getIdentity!=="function") return false;
      const identity=await ctx.access.getIdentity();
      const email=String(identity?.email||"").trim().toLowerCase();
      return email===expectedOwner;
    }catch{return false;}
  }
  // Legacy HTTP app fallback: only an explicitly signed JWT with the exact
  // audience AND owner email may authenticate. No caller-supplied email header.

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
       String(claims.email||"").trim().toLowerCase()!==expectedOwner ||
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
// Structured, evidence-bound daily briefing. No model calls, cloud billing
// assumptions or automated remediation. Always distinguish HTTP from features.
function makeFounderBriefing(assets,findings,opportunities,hypotheses,metadata,used,at=nowIso()){
  const tools=assets.filter(x=>x.kind==="tool");
  const checked=tools.filter(x=>Boolean(x.last_checked));
  const pending=tools.length-checked.length;
  const reachable=checked.filter(x=>x.status==="reachable").length;
  const degraded=checked.filter(x=>x.status==="degraded").length;
  const uncertain=checked.length-reachable-degraded;
  const website=assets.find(x=>x.kind==="website");
  const lastCron=metadata.find(x=>x.key==="last_cron")?.checked_at||"";
  const cronAge=Date.parse(at)-Date.parse(lastCron);
  const collectorCurrent=Number.isFinite(cronAge)&&cronAge>=0&&cronAge<30*60000;
  const siteAge=Date.parse(at)-Date.parse(website?.last_checked||"");
  const siteCurrent=Number.isFinite(siteAge)&&siteAge>=0&&siteAge<60*60000;
  const site=siteCurrent&&website?.status==="reachable"?"reported-reachable":
    siteCurrent&&website?.status==="degraded"?"issue-reported":"not-verified";
  const discovery=metadata.find(x=>x.key==="discovery");
  const discoveryAge=Date.parse(at)-Date.parse(discovery?.checked_at||" ");
  const discoveryCurrent=Number.isFinite(discoveryAge)&&discoveryAge>=0&&discoveryAge<12*3600000;
  const inventoryComplete=Boolean(discoveryCurrent&&discovery.value.startsWith("observed:manifest-complete:"));
  const urgent=[...findings].filter(x=>x.priority==="high"||x.priority==="critical");
  const alternatives=hypotheses.length;
  const suggested=urgent.length?
    {label:"Review a reported problem",description:urgent[0].title,section:"monitoring",kind:"alert"}:
    !collectorCurrent?{label:"Check monitoring freshness",description:"The scheduled collector's latest heartbeat is missing or stale.",
      section:"monitoring",kind:"coverage"}:
    pending?{label:"Finish the first tool checks",description:pending+" tool routes await their first HTTP observation.",
      section:"products",kind:"coverage"}:
    !inventoryComplete?{label:"Review catalog completeness",
      description:"The public site does not yet certify a complete inventory; unlinked tools may be missing.",
      section:"products",kind:"coverage"}:
    alternatives?{label:"Review a possible alternative",
      description:"External public pages suggest features to investigate; no YorpHives feature gap is established.",
      section:"products",kind:"research"}:
    {label:"Review new ideas",description:"No urgent findings are recorded. Public ideas remain unvalidated.",
      section:"opportunities",kind:"research"};
  return {
    generatedAt:at,
    collector:{current:collectorCurrent,lastSeen:lastCron},
    site:{status:site,lastCheck:website?.last_checked||"",httpStatus:website?.http_status||null},
    coverage:{discovered:tools.length,checked:checked.length,awaitingFirstCheck:pending,
      checkedPercent:tools.length?Math.round(checked.length/tools.length*100):0,
      httpReachable:reachable,httpIssue:degraded,httpUnverified:uncertain,
      inventoryComplete,method:"Read-only HTTP; no interactive feature testing"},
    alerts:{open:findings.length,highPriority:urgent.length},
    research:{leads:opportunities.length,alternatives,verifiedRevenue:null,
      limitation:"Research mentions and public feature claims are not proof of traffic, demand or feature gaps"},
    usage:{used:Math.max(0,Number(used)||0),limit:FETCH_BUDGET_DAY,
      note:"Internal public-GET safeguard, not an invoice or a price guarantee"},
    nextAction:suggested,
    safety:{readOnly:true,changeRequiresFounder:true,liveBrowserTests:false,paidAi:false}
  };
}

// Founder decisions are internal records only. Collectors cannot invoke this
// route and no decision is interpreted as an instruction to execute code.
const DECISION_TRANSITIONS = Object.freeze({
  proposed:['accepted','rejected','snoozed'], accepted:['implemented','rejected','snoozed'],
  implemented:['verified','accepted'], verified:['proposed'], rejected:['proposed'], snoozed:['proposed']
});
function decisionTransition(previous, next) {
  return (DECISION_TRANSITIONS[previous]||[]).includes(next);
}
function evidenceContract(item,type,at=nowIso()) {
  const age=Date.parse(at)-Date.parse(item.observed_at||item.observedAt||'');
  const maxAge=type==='finding'?3600000:7*86400000;
  const source=item.evidence||item.source_url||'';
  const hasSource=Array.isArray(source)?source.some(x=>/^https?:\/\//.test(x)):/^https?:\/\//.test(source);
  const freshness=!Number.isFinite(age)||age<0?'unknown':age>maxAge?'stale':'recent';
  return {classification:type==='finding'?'observation':'hypothesis',freshness,
    confidence:hasSource&&freshness==='recent'?'Source available; independent validation needed':'Insufficient current evidence',
    impact:type==='finding'?'Visitors may be unable to use the affected service; impact is not quantified.':'Potential user value; demand and revenue are not established.',
    owner:type==='finding'?(item.category==='security'?'Security & Independent QA':'Engineering & Operations'):
      item.category==='revenue'?'Revenue & Business':'Product & Growth',
    reviewer:type==='finding'?'Security & Independent QA':'Global Market Intelligence',
    successCondition:type==='finding'?'An independent check confirms the reported problem is resolved.':'A defined customer experiment meets its success threshold.',
    effort:'Not estimated',risk:'Assess before founder execution'};
}
async function decisionJournal(env) {
  if(env.HQ_DECISIONS_ENABLED!=='true')return {available:false,events:[]};
  try {
    const rows=await env.DB.prepare('SELECT * FROM founder_decisions ORDER BY sequence DESC LIMIT 2000').all();
    return {available:true,events:rows.results||[]};
  } catch {return {available:false,events:[]};}
}
function operatingBrief(findings,opportunities,journal,at=nowIso()) {
  const latest=new Map();
  for(const event of journal.events)if(!latest.has(event.thread))latest.set(event.thread,event);
  const records=[...findings.map(item=>({item,type:'finding'})),...opportunities.map(item=>({item,type:'opportunity'}))];
  const queue=records.map(({item,type})=>{
    const thread=type+':'+item.id,decision=latest.get(thread);
    const contract=evidenceContract(item,type,at);
    // A repeated polling timestamp alone must not resurface a rejected idea.
    const changed=Boolean(decision&&decision.snapshot!==JSON.stringify([item.title,item.description,item.recommendation,item.evidence||item.source_url]));
    return {id:item.id,thread,type,title:item.title,priority:item.priority||'low',
      status:decision?.state||'proposed',revision:decision?.revision||0,changed,contract,
      needsDecision:!decision||(changed&&['rejected','snoozed','verified'].includes(decision.state))||decision.state==='proposed'};
  });
  const ranked=queue.filter(x=>x.needsDecision).sort((a,b)=>
    (a.type==='finding'?0:1)-(b.type==='finding'?0:1)||
    ({high:0,medium:1,low:2}[a.priority]??2)-({high:0,medium:1,low:2}[b.priority]??2)||a.thread.localeCompare(b.thread));
  return {version:1,queue:ranked.slice(0,3),pending:ranked.length,threads:queue,
    activeOpportunities:[...latest.values()].filter(x=>x.kind==='opportunity'&&['accepted','implemented'].includes(x.state)).length,
    opportunityLimit:3,aiStatus:'Not connected',
    learning:'Founder feedback retained; no automatic changes to rules, permissions or budgets',
    stages:['Observe','Investigate','Challenge','Recommend','Follow through']};
}
function validateExperiment(value,at=Date.now()) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const keys=['audience','problem','hypothesis','metric','stopCondition'];
  if(keys.some(key=>typeof value[key]!=='string'||!value[key].trim()||value[key].length>400))return null;
  const deadline=Date.parse(value.reviewBy);
  if(!Number.isFinite(value.target)||value.target<=0||value.target>1e9||
     !Number.isFinite(value.effortHours)||value.effortHours<=0||value.effortHours>40||
     !Number.isFinite(deadline)||deadline<=at||deadline>at+90*86400000)return null;
  return {...Object.fromEntries(keys.map(k=>[k,value[k].trim()])),target:value.target,
    effortHours:value.effortHours,reviewBy:new Date(deadline).toISOString()};
}
async function saveDecision(request,env) {
  if(env.HQ_DECISIONS_ENABLED!=='true'||!env.DB)return json({error:'Decision journal is not enabled'},503);
  const url=new URL(request.url);
  if(request.headers.get('origin')!==url.origin||request.headers.get('x-hq-founder-action')!=='decision-v1'||
     request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Same-origin founder action required'},403);
  let input;
  try {const body=await boundedText(request,8192);if(body===null)return json({error:'Decision too large'},413);input=JSON.parse(body);}
  catch{return json({error:'Invalid JSON'},400);}
  if(!input||!['finding','opportunity'].includes(input.kind)||!/^[-a-zA-Z0-9_]{1,80}$/.test(input.id)||
     !Number.isSafeInteger(input.revision)||input.revision<0)return json({error:'Invalid record or revision'},400);
  const note=clampText(input.note,800),outcome=clampText(input.outcome,800),success=clampText(input.successCondition,500);
  const feedback=['useful','incorrect','too-noisy','not-priority',''].includes(input.feedback||'')?input.feedback||'':null;
  let evidence='';try{const parsed=new URL(input.evidenceUrl);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)evidence=parsed.href.slice(0,1000);}catch{}
  if(!note||feedback===null)return json({error:'Add a reason and valid feedback'},400);
  if(input.state==='verified'&&(!outcome||!success||!evidence))return json({error:'Verification needs a measured outcome, success condition and HTTPS evidence link'},400);
  const thread=input.kind+':'+input.id;
  const current=await env.DB.prepare('SELECT * FROM founder_decisions WHERE thread=? ORDER BY revision DESC LIMIT 1').bind(thread).first();
  if((current?.revision||0)!==input.revision||!decisionTransition(current?.state||'proposed',input.state))return json({error:'Decision changed or transition is invalid; refresh and review'},409);
  const table=input.kind==='finding'?'findings':'opportunities'; // fixed allowlist, never user SQL
  const item=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(input.id).first();
  if(!item&&!current)return json({error:'Record not found'},404);
  const snapshot=item?JSON.stringify([item.title,item.description,item.recommendation,item.evidence||item.source_url]):current.snapshot;
  let experiment=current?.experiment_json||'{}';
  if(input.kind==='opportunity'&&input.state==='accepted'){
    const validated=validateExperiment(input.experiment);
    if(!validated)return json({error:'Acceptance requires an audience, problem, hypothesis, metric, positive target, effort limit (up to 40 hours), stop condition and review date within 90 days'},400);
    experiment=JSON.stringify(validated);
  }
  const timestamp=nowIso();
  // Single atomic INSERT enforces optimistic concurrency, the three-opportunity
  // limit and the finite journal budget even for simultaneous browser tabs.
  const sql=`INSERT INTO founder_decisions(thread,revision,kind,record_id,title,state,note,feedback,outcome,success_condition,evidence_url,snapshot,created_at,experiment_json)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?
    WHERE COALESCE((SELECT MAX(revision) FROM founder_decisions WHERE thread=?),0)=?
    AND (SELECT COUNT(*) FROM founder_decisions)<2000
    AND (?!='opportunity' OR ? NOT IN ('accepted','implemented') OR
      (SELECT COUNT(*) FROM founder_decisions d WHERE d.kind='opportunity' AND d.state IN ('accepted','implemented')
       AND d.thread!=? AND d.revision=(SELECT MAX(revision) FROM founder_decisions e WHERE e.thread=d.thread))<3)`;
  const result=await env.DB.prepare(sql).bind(thread,input.revision+1,input.kind,input.id,
    item?.title||current.title,input.state,note,feedback,outcome,success,evidence,snapshot,timestamp,experiment,
    thread,input.revision,input.kind,input.state,thread).run();
  if(result.meta?.changes!==1)return json({error:'Refresh before retrying. The journal permits three active opportunities and 2,000 history entries; export for archival if full.'},409);
  return json({saved:true,revision:input.revision+1,state:input.state,executionTriggered:false},201);
}

// Report proves authenticated API+D1 response, not external network uptime.
function headquartersHealth(metadata,at=nowIso()) {
  const cron=metadata.find(x=>x.key==="last_cron");
  const age=Date.parse(at)-Date.parse(cron?.checked_at||"");
  const valid=Number.isFinite(age)&&age>=0;
  const fresh=valid&&age<20*60*1000;
  return {
    status:!valid?"unknown":fresh?"responding":"delayed",
    api:"responding",database:"responding",collector:!valid?"unknown":fresh?"current":"stale",
    lastCollectorCheck:cron?.checked_at||null,checkedAt:at,staleAfterMinutes:20,
    independentCheck:"external-access-gate-only",
    note:"Authenticated report verifies API and database; scheduled heartbeat is not independent uptime."
  };
}
async function report(env) {
  const [assets,findings,leads,quota,status,security,hypotheses]=await Promise.all([
    env.DB.prepare("SELECT * FROM assets ORDER BY kind ASC,name ASC LIMIT 150").all(),
    env.DB.prepare("SELECT * FROM findings WHERE status='open' ORDER BY observed_at DESC LIMIT 80").all(),
    env.DB.prepare("SELECT * FROM opportunities ORDER BY observed_at DESC LIMIT 50").all(),
    env.DB.prepare("SELECT kind,used FROM quota WHERE day=?").bind(nowIso().slice(0,10)).all(),
    env.DB.prepare("SELECT key,value,checked_at FROM status ORDER BY checked_at DESC LIMIT 30").all(),
    env.DB.prepare("SELECT * FROM security_watch ORDER BY observed_at DESC LIMIT 15").all(),
    env.DB.prepare("SELECT * FROM product_hypotheses ORDER BY observed_at DESC LIMIT 30").all()
  ]);
  const a=assets.results||[],f=findings.results||[],o=leads.results||[],metadata=status.results||[];
  const last=metadata.find(x=>x.key==="last_cron");
  const discovery=metadata.find(x=>x.key==="discovery");
  const heartbeatAge=Date.now()-Date.parse(last?.checked_at||" ");
  const fresh=Number.isFinite(heartbeatAge)&&heartbeatAge>=0&&heartbeatAge<30*60000;
  const discoveryFresh=Boolean(discovery && Number.isFinite(Date.parse(discovery.checked_at)) &&
    Date.now()-Date.parse(discovery.checked_at)>=0 &&
    Date.now()-Date.parse(discovery.checked_at)<12*3600000);
  const discoveryComplete=Boolean(discoveryFresh && discovery?.value.startsWith("observed:manifest-complete:"));
  const tools=a.filter(x=>x.kind==="tool");
  const quotaUsed=Object.fromEntries((quota.results||[]).map(row=>[row.kind,row.used]));
  const now=nowIso();
  const journal=await decisionJournal(env);
  return {
    decisionJournal:journal, operating:operatingBrief(f,o,journal,now),
    schemaVersion:"yorphives.hq-intelligence.v1", generatedAt:now,
    hqHealth:headquartersHealth(metadata,now),
    briefing:makeFounderBriefing(a,f,o,hypotheses.results||[],metadata,quotaUsed.public_fetches||0,now),
    verification:{method:"cloudflare-worker-readonly-http",complete:discoveryComplete,
      limitations:"Public GET evidence only. A complete catalog requires an explicit owner manifest; page changes and functionality need independent verification.",
      generatedAt:last?.checked_at||"",notes:fresh?[]:["Collector heartbeat stale or absent"]},
    assets:a.map(x=>({id:fnv(x.url),name:x.name,kind:x.kind,status:fresh&&Number.isFinite(Date.parse(x.last_checked))&&Date.now()-Date.parse(x.last_checked)>=0&&Date.now()-Date.parse(x.last_checked)<3600000?(x.status==="reachable"?"healthy":x.status==="degraded"?"degraded":"unknown"):"unknown",summary:x.url})),
    products:tools.map(x=>({id:fnv(x.url),name:x.name,url:x.url,
      source:x.discovery_source||"unverified",discoveryConfidence:x.inventory_confidence||"unverified",
      evidenceUrl:x.evidence_url||"",status:x.inventory_confidence==="candidate"?"unknown":
        x.status==="reachable"?"healthy":x.status==="degraded"?"degraded":"unknown",
      active:true,firstSeen:x.first_seen,lastChecked:x.last_checked||"",
      features:(()=>{try{const arr=JSON.parse(x.features_json||"[]");return Array.isArray(arr)?arr.slice(0,12):[];}catch{return [];}})(),
      qaStatus:"unverified",qaReason:x.status==="unverified"?"Generic SPA response; route not verified":
        "HTTP route observation only; not a functional test"})),
    changes:metadata.filter(x=>x.key.startsWith("new_tool_")||x.key.startsWith("tool_change_")||
      x.key==="site_bundle_change").map(x=>({
      id:x.key,
      url:x.key.startsWith("new_tool_")?x.value.replace(/^(?:New tool discovered: |Possible tool route \(unverified\): )/,""):"",
      kind:x.key.startsWith("tool_change_")?"content-change":
        x.key==="site_bundle_change"?"site-release":
        x.value.startsWith("Possible tool route")?"candidate-route":"new-product",
      severity:"info",summary:x.value,occurredAt:x.checked_at
    })),
    findings:f.map(x=>({id:x.id,title:x.title,category:x.category,priority:x.priority,asset:x.asset,
      description:x.description,recommendation:x.recommendation,observedAt:x.observed_at,evidence:[x.evidence]})),
    opportunities:o.map(x=>({id:x.id,title:x.title,category:"product",priority:"medium",
      description:x.description,recommendation:x.recommendation,observedAt:x.observed_at,evidence:[x.source_url],
      confidence:x.kind==="catalog-unverified"?
        "Research mention · YorpHives catalog incomplete" :
        "Research mention · user demand not validated",score:x.score,kind:x.kind})),
    securityWatch:(security.results||[]).map(x=>({id:x.id,title:x.title,severity:x.severity,
      packages:JSON.parse(x.packages||"[]"),source:x.source_url,observedAt:x.observed_at,
      applicability:"Not evaluated against YorpHives dependencies"})),
    comparisons:(hypotheses.results||[]).map(x=>({
      id:x.id,product:x.product_name,competitor:x.competing_title,
      missingFeatures:[],evidenceSummary:x.evidence_summary,
      confidence:String(x.evidence_summary||"").startsWith("Official page mentions:")?
        "Official public description · feature parity unverified":
        "Public title similarity only · feature parity unverified",
      recommendation:x.recommendation,evidence:[x.product_url,x.competing_url],
      observedAt:x.observed_at
    })),agents:[],
    activity:metadata.filter(x=>x.key!=="site_bundle_fingerprint" && x.key!=="discovery_engine_version" && x.key!=="discovery_sources").slice(0,25).map(x=>({id:x.key,title:x.key.replaceAll("_"," "),
      summary:x.value,kind:"observation",occurredAt:x.checked_at})),
    resourceBudget:{publicFetches:{used:quotaUsed.public_fetches||0,limit:FETCH_BUDGET_DAY},
      aiCalls:{used:0,limit:0,disabled:true},browserMinutes:{used:0,limit:0,disabled:true}},
    pipeline:{generatedAt:last?.checked_at||"",readOnly:true,approvalRequired:true,
      products:{complete:discoveryComplete,method:"bounded-public-http-discovery",
        discovered:tools.length,confirmed:tools.filter(x=>x.inventory_confidence==="published").length,
        candidates:tools.filter(x=>x.inventory_confidence==="candidate").length,
        notes:discoveryComplete?["Owner manifest declares complete inventory, but tool functionality is not verified."]:
          ["Public inventory incomplete; JS bundle paths are only candidates. No product absence or inferiority is established."]},
      research:{status:metadata.find(x=>x.key==="research")?.value||"not-yet-observed"},
      security:{status:metadata.find(x=>x.key==="security_watch")?.value||"not-yet-observed",
        limitation:"Public npm advisories; applicability to YorpHives is not established"},
      errors:fresh?[]:["Collector heartbeat stale or absent"]}
  };
}

// Strictly bounded read-only public repository lookup. The founder must initiate every search.
const publicGithubCache=new Map();
let lastPublicGithubRequest=0;
function githubRepoMetadata(repo){
  const fullName=String(repo?.full_name||"");
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(fullName)||repo?.private===true||repo?.archived===true)return null;
  const topics=Array.isArray(repo.topics)?repo.topics.filter(x=>typeof x==="string").slice(0,12):[];
  const technology=/(^|[-_ ])(ai|llm|ml|agents?|machine-learning|models?|framework|sdk|mcp|inference|transformers)($|[-_ ])/i;
  const license=String(repo.license?.spdx_id||"");
  return {id:fullName,title:fullName,description:String(repo.description||"").slice(0,280),
    url:"https://github.com/"+fullName,
    license:/^[A-Za-z0-9.-]{1,40}$/.test(license)&&license!=="NOASSERTION"?license:null,
    stars:Number.isSafeInteger(repo.stargazers_count)&&repo.stargazers_count>=0?repo.stargazers_count:0,
    language:typeof repo.language==="string"?repo.language.slice(0,40):"",
    topics,category:topics.some(t=>technology.test(t))||technology.test(fullName)?"technology":"apps",
    updatedAt:typeof repo.updated_at==="string"?repo.updated_at:"",
    source:"github-public",verified:false};
}
async function discoverPublicGithub(request){
  const u=new URL(request.url),q=String(u.searchParams.get("q")||"").normalize("NFKC").trim().replace(/\s+/g," ");
  if(!/^[\p{L}\p{N} ._-]{2,64}$/u.test(q)||q.split(/\s+/).length>8)return json({error:"Enter 2–64 letters or numbers, up to 8 words."},400);
  const key=q.toLowerCase(),now=Date.now();
  for(const [k,v] of publicGithubCache)if(now-v.at>300000)publicGithubCache.delete(k);
  const hit=publicGithubCache.get(key);
  if(hit)return json({...hit.data,cached:true});
  // Isolate-local cooldown; upstream rate limits still apply across edge instances.
  if(now-lastPublicGithubRequest<15000)return json({error:"Search cooldown. Retry shortly."},429);
  lastPublicGithubRequest=now;
  const api=new URL("https://api.github.com/search/repositories");
  api.searchParams.set("q",q+" in:name,description fork:false archived:false");
  api.searchParams.set("per_page","12");
  try{
    const response=await fetch(api.href,{method:"GET",redirect:"error",cache:"no-store",
      headers:{accept:"application/vnd.github+json","user-agent":"YorpHives-HQ-ReadOnly-Discovery"},
      signal:AbortSignal.timeout(7000)});
    if(response.status===403||response.status===429)return json({error:"GitHub search is rate-limited. Retry later."},429);
    if(!response.ok)return json({error:"Public GitHub search is temporarily unavailable."},503);
    if(Number(response.headers.get("content-length")||0)>1000000)return json({error:"Search response too large."},502);
    const raw=await response.text();
    if(raw.length>1000000)return json({error:"Search response too large."},502);
    const data=JSON.parse(raw);
    if(!Array.isArray(data.items))return json({error:"Unexpected GitHub response."},502);
    const items=data.items.slice(0,12).map(githubRepoMetadata).filter(Boolean);
    const payload={query:q,source:"github-public",searchedAt:new Date(now).toISOString(),
      total:Math.max(0,Number(data.total_count)||0),incomplete:data.incomplete_results===true,items,
      licenseNotice:"Verify each repository license and obligations before copying or adapting code."};
    if(publicGithubCache.size>=40)publicGithubCache.delete(publicGithubCache.keys().next().value);
    publicGithubCache.set(key,{at:now,data:payload});
    return json(payload);
  }catch{return json({error:"Public GitHub search did not respond."},503);}
}

function json(value,status=200) {return new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});}
export default {
  async fetch(request,env,ctx) {
    const route=new URL(request.url).pathname;
    const decisionWrite=route==="/api/decisions"&&request.method==="POST";
    if(!decisionWrite&&!["GET","HEAD"].includes(request.method)) return new Response("Read-only",{status:405});
    if(!(await verifyAccess(request,env,ctx))) return new Response("Private Headquarters access not configured or unauthorized",{status:403,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
    if(decisionWrite) {
      try{return await saveDecision(request,env);}catch{return json({error:"Decision could not be saved; refresh before retrying"},503);}
    }
    if(route==="/api/decisions"&&request.method==="GET")return json(await decisionJournal(env));
    if(route==="/api/discover"&&request.method==="GET")return discoverPublicGithub(request);
    if(route==="/api/discover"&&request.method==="HEAD")return new Response(null,{status:200,headers:JSON_HEADERS});
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
    if(env.ASSETS) return env.ASSETS.fetch(request);
    // Isolated pilot fallback; replaced only by build-standalone.mjs.
    // Never serve unrecognized paths or project/source/evidence files.
    const path=route==="/" ? "/index.html" : route;
    const item=PILOT_STATIC_BUNDLE && PILOT_STATIC_BUNDLE[path];
    if(!item) return new Response("Private UI assets not configured",{status:503});
    // Only these exact official logo images may be returned as binary assets.
    if(path==="/assets/yorphives-logo.webp"||path==="/assets/yorphives-mark.webp"){
      if(typeof item!=="string"||!/^[A-Za-z0-9+/]+={0,2}$/.test(item))
        return new Response("Brand asset unavailable",{status:503});
      const bytes=Uint8Array.from(atob(item),ch=>ch.charCodeAt(0));
      return new Response(request.method==="HEAD"?null:bytes,{status:200,
        headers:{"content-type":"image/webp","cache-control":"private,no-store",
          "x-content-type-options":"nosniff","x-frame-options":"DENY",
          "referrer-policy":"no-referrer"}});
    }
    const type=path.endsWith(".css")?"text/css; charset=utf-8":
      path.endsWith(".js")?"text/javascript; charset=utf-8":"text/html; charset=utf-8";
    return new Response(request.method==="HEAD"?null:item,{status:200,
      headers:{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff",
        "x-frame-options":"DENY","referrer-policy":"no-referrer",
        "content-security-policy":"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}
    });
  },
  async scheduled(event,env,ctx) {
    if(!env.DB) return;
    ctx.waitUntil(scheduledCycle(env,event.scheduledTime).catch(error=>{
      console.warn("HQ read-only scheduled scan failed:",clampText(error?.message,80));
    }));
  }
};
export {githubRepoMetadata,discoverPublicGithub,headquartersHealth,safeToolUrl,sitemapTools,hubTools,manifestTools,feedLeads,classifyLead,parseAdvisories,siteBundleRefs,safeProductUrl,productManifest,sitemapEntries,publicStructuredProducts,publicBundleToolHints,publicPageFingerprint,robotsAllowsPath,competitorClaimEvidence,makeFounderBriefing,schedulePlan,verifyAccess,report,decisionTransition,evidenceContract,operatingBrief,saveDecision,validateExperiment};
