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
const MAX_ROUTES_PER_DISCOVERY = 45;
const MAX_CHECKS_PER_HOUR = 4;
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
async function limitedFetch(url, {allowResearch = false, allowSecurity = false, body = false} = {}) {
  const parsed = new URL(url);
  const allowed = allowSecurity ? url === ADVISORY_SOURCE :
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
  const choices=new Map(),manifestDeclared=new Set(); let validSources=0,manifestComplete=false,scriptCandidateCount=0;
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
  // Discoveries are never removed on missing scans; a missing source is NOT
  // evidence of deletion, and literal JS routes never prove functionality.
  return {discovered:choices.size,newlyEnrolled:enrolled,confirmed,manifestComplete,scriptCandidateCount};
}
async function checkProducts(env) {
  const list=await env.DB.prepare(
    "SELECT url,name,failures,page_fingerprint,inventory_confidence FROM assets WHERE kind='tool' "+
    "ORDER BY (last_checked IS NOT NULL) ASC,last_checked ASC LIMIT ?"
  ).bind(MAX_CHECKS_PER_HOUR).all();
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
  return {uptime:true,products:minute===0,discovery:minute===0 && hour%6===0,
    research:minute===0 && hour===3, security:minute===0 && hour===4, retention:minute===0 && hour===3};
}
async function scheduledCycle(env, scheduledTime) {
  if(!env.DB) throw Error("Missing D1 binding");
  const plan=schedulePlan(scheduledTime);
  // Cloudflare is free only while account remains on Free; this worker has
  // no paid API, AI binding, browser use, writable GitHub credential or deployment tool.
  await checkSite(env);
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
  const fresh=Boolean(last && Date.now()-Date.parse(last.checked_at)<2*3600000);
  const discoveryFresh=Boolean(discovery && Number.isFinite(Date.parse(discovery.checked_at)) &&
    Date.now()-Date.parse(discovery.checked_at)>=0 &&
    Date.now()-Date.parse(discovery.checked_at)<12*3600000);
  const discoveryComplete=Boolean(discoveryFresh && discovery?.value.startsWith("observed:"));
  const tools=a.filter(x=>x.kind==="tool");
  const quotaUsed=Object.fromEntries((quota.results||[]).map(row=>[row.kind,row.used]));
  const now=nowIso();
  return {
    schemaVersion:"yorphives.hq-intelligence.v1", generatedAt:now,
    verification:{method:"cloudflare-worker-readonly-http",complete:discoveryComplete,
      limitations:"Public GET evidence only. A complete catalog requires an explicit owner manifest; page changes and functionality need independent verification.",
      generatedAt:last?.checked_at||"",notes:fresh?[]:["Collector heartbeat stale or absent"]},
    assets:a.map(x=>({id:fnv(x.url),name:x.name,kind:x.kind,status:x.status==="reachable"?"healthy":"unknown",summary:x.url})),
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
      missingFeatures:[],confidence:"Public title similarity only · no feature gap verified",
      recommendation:x.recommendation,evidence:[x.product_url,x.competing_url],
      observedAt:x.observed_at
    })),agents:[],
    activity:metadata.filter(x=>x.key!=="site_bundle_fingerprint" && x.key!=="discovery_engine_version").slice(0,25).map(x=>({id:x.key,title:x.key.replaceAll("_"," "),
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
function json(value,status=200) {return new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});}
export default {
  async fetch(request,env,ctx) {
    const route=new URL(request.url).pathname;
    if(!["GET","HEAD"].includes(request.method)) return new Response("Read-only",{status:405});
    if(!(await verifyAccess(request,env,ctx))) return new Response("Private Headquarters access not configured or unauthorized",{status:403,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
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
export {safeToolUrl,sitemapTools,hubTools,manifestTools,feedLeads,classifyLead,parseAdvisories,siteBundleRefs,safeProductUrl,productManifest,sitemapEntries,publicStructuredProducts,publicBundleToolHints,publicPageFingerprint,schedulePlan,verifyAccess,report};
