/** YorpHivesHQ Native v1 — Cloudflare-only founder command center.
 *  This module owns no repository/deploy credentials. Bot actions are GET-only.
 *  HTML is inserted at build time; never embed secrets in the asset.
 */
const PAGE_HTML = '__PAGE_HTML_BUILD_REPLACEMENT__';
const SITE = 'https://yorphives.com/';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY'
};
const SAFE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
};
const CATEGORIES = ['Apps & Tools','Technology','Markets','Competitors','Revenue'];
const MIN_SCAN_MS = 15*60*1000;
let jwksCache={at:0,keys:[]};
const now = () => new Date().toISOString();
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const clean = (s,max=240) => String(s??'').replace(/\s+/g,' ').trim().slice(0,max);
const safeHttps = (raw) => {try {const u=new URL(raw);return u.protocol==='https:' && !u.username && !u.password?u.href:null;}catch{return null;}};
const b64urlDecode=(x)=>{const t=String(x).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(t+'='.repeat((4-t.length%4)%4)),c=>c.charCodeAt(0));};
const decodeJwtPart=(x)=>JSON.parse(new TextDecoder().decode(b64urlDecode(x)));

// Second gate in addition to the independent Cloudflare Access application.
async function authorized(request,env){
  const aud=env.ACCESS_AUD,team=env.ACCESS_TEAM_DOMAIN,owner=env.ACCESS_OWNER_EMAIL;
  if(!aud||!team||!owner)return false; // fail closed
  const raw=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  const parts=raw.split('.');if(parts.length!==3)return false;
  let header,claims;try{header=decodeJwtPart(parts[0]);claims=decodeJwtPart(parts[1]);}catch{return false;}
  if(header.alg!=='RS256'||!header.kid||typeof claims.exp!=='number'||claims.exp*1000<=Date.now())return false;
  if(typeof claims.nbf==='number'&&claims.nbf*1000>Date.now()+60000)return false;
  if(!Array.isArray(claims.aud)||!claims.aud.includes(aud))return false;
  if(String(claims.email||'').toLowerCase()!==owner.toLowerCase())return false;
  const root=String(team).replace(/^https?:\/\//,'').replace(/\/$/,'');
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(root))return false;
  if(claims.iss!==`https://${root}`)return false;
  const cacheKey=`https://${root}/cdn-cgi/access/certs`;
  let keys=jwksCache.keys;
  if(Date.now()-jwksCache.at>10*60*1000){
    try{const resp=await fetch(cacheKey,{signal:AbortSignal.timeout(4500)});if(!resp.ok)return false;keys=(await resp.json()).keys||[];jwksCache={at:Date.now(),keys};}
    catch{return false;}
  }
  const key=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!key)return false;
  try{
    const imported=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const payload=new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,b64urlDecode(parts[2]),payload);
  }catch{return false;}
}
async function stateGet(env,key){
  const row=await env.DB.prepare('SELECT value,updated_at FROM state WHERE key=?').bind(key).first();
  if(!row)return null;try{return {value:JSON.parse(row.value),updatedAt:row.updated_at};}catch{return null;}
}
async function statePut(env,key,value){
  await env.DB.prepare('INSERT INTO state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),now()).run();
}
function classify(title,source){
  const s=title.toLowerCase();
  if(/money|price|saas|monetiz|subscription|revenue|profit|paywall|pricing|business model/.test(s))return 'Revenue';
  if(/competitor|alternatives|vs\.|compare|competing|benchmark.*app/.test(s))return 'Competitors';
  if(/market|customers|pain points|demand|users need|underserved|industry/.test(s))return 'Markets';
  if(/model|llm|agent|framework|protocol|open.source|library|rust|typescript|ai |developer|database/.test(s))return 'Technology';
  return 'Apps & Tools';
}
function idFor(source,url){let h=2166136261;for(const c of `${source}:${url}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return `lead_${(h>>>0).toString(16)}`;}
function normalizeHN(hit){
  const title=clean(hit.title,180);const link=safeHttps(hit.url)||safeHttps(`https://news.ycombinator.com/item?id=${hit.objectID}`);
  if(!title||!link)return null;
  return {id:idFor('Hacker News',link),title,summary:'Public launch or discussion. Verify demand and licensing.',category:classify(title,'HN'),source:'Hacker News',url:link,sourceDate:hit.created_at||null,verified:false};
}
function normalizeDev(hit){
  const title=clean(hit.title,180);const link=safeHttps(hit.url);
  if(!title||!link)return null;
  return {id:idFor('DEV',link),title,summary:clean(hit.description,220)||'Technical article. Verify relevance.',category:classify(title,'DEV'),source:'DEV Community',url:link,sourceDate:hit.published_at||null,verified:false};
}
async function smallPublicJson(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(5000),headers:{accept:'application/json'}});
  if(!response.ok)throw Error(`source-http-${response.status}`);
  const length=Number(response.headers.get('content-length')||0);if(length>120000)throw Error('source-too-large');
  const content=await response.text();if(content.length>120000)throw Error('source-too-large');
  return JSON.parse(content);
}
async function scanSources(env,{force=false}={}){
  const last=await stateGet(env,'last_scan');
  if(!force&&last&&Date.now()-Date.parse(last.updatedAt)<MIN_SCAN_MS)return {skipped:true,reason:'cooldown',last:last.updatedAt};
  // Avoid exhausting the Workers Free account: two bounded GETs, <=16 new leads.
  const all=await Promise.allSettled([
    smallPublicJson('https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=8'),
    smallPublicJson('https://dev.to/api/articles?per_page=8&top=7')
  ]);
  const records=[];const errors=[];
  if(all[0].status==='fulfilled')for(const hit of (all[0].value.hits||[]).slice(0,8)){const x=normalizeHN(hit);if(x)records.push(x);}else errors.push('Hacker News');
  if(all[1].status==='fulfilled')for(const hit of (Array.isArray(all[1].value)?all[1].value:[]).slice(0,8)){const x=normalizeDev(hit);if(x)records.push(x);}else errors.push('DEV Community');
  const fetchedAt=now();
  for(const x of records){
    await env.DB.prepare('INSERT INTO opportunities (id,title,summary,category,source,url,source_date,first_seen,last_seen) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,title=excluded.title,summary=excluded.summary').bind(x.id,x.title,x.summary,x.category,x.source,x.url,x.sourceDate,fetchedAt,fetchedAt).run();
  }
  await statePut(env,'last_scan',{count:records.length,failedSources:errors,completed:fetchedAt});
  return {count:records.length,failedSources:errors,completed:fetchedAt};
}
async function checkSite(env){
  const start=Date.now();let result={state:'unknown',checkedAt:now(),code:null,latencyMs:null};
  try{const r=await fetch(SITE,{method:'GET',signal:AbortSignal.timeout(6500),redirect:'manual',headers:{accept:'text/html'}});await r.body?.cancel();result={state:r.status>=200&&r.status<400?'online':'error',code:r.status,checkedAt:now(),latencyMs:Date.now()-start};}
  catch{result={...result,state:'error',checkedAt:now(),latencyMs:Date.now()-start};}
  await statePut(env,'site_health',result);return result;
}
async function bootstrap(env){
  const [site,scan,rows,saved,decisions]=await Promise.all([
    stateGet(env,'site_health'),stateGet(env,'last_scan'),
    env.DB.prepare('SELECT id,title,summary,category,source,url,source_date,first_seen,last_seen FROM opportunities ORDER BY last_seen DESC LIMIT 100').all(),
    env.DB.prepare('SELECT opportunity_id FROM saved').all(),
    env.DB.prepare('SELECT opportunity_id,action,updated_at FROM decisions ORDER BY updated_at DESC LIMIT 100').all()
  ]);
  return {serverTime:now(),site:site?.value||{state:'unknown'},siteUpdatedAt:site?.updatedAt||null,
    hq:{state:'online',checkedAt:now(),detail:'Authenticated API'},mind:{state:'not-connected',detail:'AI inference not enabled'},
    scan:scan?.value||null,scanUpdatedAt:scan?.updatedAt||null,
    opportunities:(rows.results||[]).map(x=>({...x,verified:false})),saved:(saved.results||[]).map(x=>x.opportunity_id),decisions:decisions.results||[],
    budget:{target:'₹0 additional',aiEnabled:false,sourceFetchesPerScan:2},mode:'live-foundation'};
}
async function api(request,env,url){
  const path=url.pathname;const method=request.method;
  if(method==='GET'&&path==='/api/bootstrap')return json(await bootstrap(env));
  if(method==='POST'&&path==='/api/scan'){
    const recent=await stateGet(env,'last_scan');if(recent&&Date.now()-Date.parse(recent.updatedAt)<MIN_SCAN_MS)return json({error:'Cooldown',nextAt:new Date(Date.parse(recent.updatedAt)+MIN_SCAN_MS).toISOString()},429);
    const [site,discovery]=await Promise.allSettled([checkSite(env),scanSources(env)]);
    return json({site:site.status==='fulfilled'?site.value:{state:'error'},research:discovery.status==='fulfilled'?discovery.value:{error:'Scan failed'}});
  }
  if(method==='POST'&&path==='/api/saved'){
    let data;try{data=await request.json();}catch{return json({error:'Invalid JSON'},400);}
    if(!/^lead_[0-9a-f]{1,8}$/.test(data.id)||typeof data.saved!=='boolean')return json({error:'Invalid request'},400);
    const row=await env.DB.prepare('SELECT id FROM opportunities WHERE id=?').bind(data.id).first();if(!row)return json({error:'Not found'},404);
    if(data.saved)await env.DB.prepare('INSERT OR IGNORE INTO saved(opportunity_id,created_at) VALUES(?,?)').bind(data.id,now()).run();
    else await env.DB.prepare('DELETE FROM saved WHERE opportunity_id=?').bind(data.id).run();
    return json({ok:true,id:data.id,saved:data.saved});
  }
  if(method==='POST'&&path==='/api/decision'){
    let data;try{data=await request.json();}catch{return json({error:'Invalid JSON'},400);}
    if(!/^lead_[0-9a-f]{1,8}$/.test(data.id)||!['approve','reject','snooze'].includes(data.action))return json({error:'Invalid decision'},400);
    const row=await env.DB.prepare('SELECT id FROM opportunities WHERE id=?').bind(data.id).first();if(!row)return json({error:'Not found'},404);
    await env.DB.prepare('INSERT INTO decisions(opportunity_id,action,updated_at) VALUES(?,?,?) ON CONFLICT(opportunity_id) DO UPDATE SET action=excluded.action,updated_at=excluded.updated_at').bind(data.id,data.action,now()).run();
    return json({ok:true,id:data.id,action:data.action});
  }
  return json({error:'Not found'},404);
}
export default {
  async fetch(request,env){
    const u=new URL(request.url);
    if(u.pathname==='/favicon.ico')return new Response(null,{status:204,headers:SAFE_HEADERS});
    // Entire app, including HTML and API, is founder-private.
    if(!(await authorized(request,env)))return new Response('Access required',{status:403,headers:SAFE_HEADERS});
    if(u.pathname.startsWith('/api/')){
      if(request.method!=='GET'&&request.headers.get('Origin')!==u.origin)return json({error:'Invalid origin'},403);
      if(!env.DB)return json({error:'Storage unavailable'},503);
      try{return await api(request,env,u)}catch{return json({error:'Temporary server error'},503);}
    }
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:SAFE_HEADERS});
    if(u.pathname!=='/')return new Response('Not found',{status:404,headers:SAFE_HEADERS});
    const headers={...SAFE_HEADERS,'content-type':'text/html; charset=utf-8','cache-control':'private, no-store'};
    return new Response(request.method==='HEAD'?null:PAGE_HTML,{headers});
  },
  async scheduled(event,env){
    if(!env.DB)return;
    await checkSite(env).catch(()=>{});
    const n=new Date(event.scheduledTime||Date.now());
    if(n.getUTCHours()%6===0)await scanSources(env).catch(()=>{});
    await statePut(env,'last_cron',{at:now()}).catch(()=>{});
  }
};
export const internals={classify,normalizeHN,normalizeDev,idFor,safeHttps,clean};