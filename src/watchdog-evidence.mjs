/**
 * YorpHives HQ read-only adapter for the independent edge watchdog.
 * The Cloudflare service binding is direct Worker-to-Worker (no API keys,
 * public proxy, MCP intermediary, KV permission, repository or deploy access).
 * A compatible self-hosted HTTP Fetcher can replace it.
 */
const WATCHDOG_ORIGIN='https://watchdog.internal';
const CHECK_IDS=['home','agent-api','capabilities','analytics','growth','model','missing'];
const ALLOWED=new Set(CHECK_IDS);
const MAX_RESPONSE_BYTES=65536;
const MAX_AGE_MS=35*60*1000;
const FUTURE_ALLOWANCE_MS=5*60*1000;
function validDate(value,nowMs){
 const t=typeof value==='string'?Date.parse(value):NaN;
 return Number.isFinite(t)&&t<=nowMs+FUTURE_ALLOWANCE_MS&&t>=nowMs-8*86400000?t:NaN;
}
const safeIds=ids=>Array.isArray(ids)?[...new Set(ids.filter(x=>typeof x==='string'&&ALLOWED.has(x)))].slice(0,7):[];
function safeChecks(checks){
 if(!Array.isArray(checks)||checks.length!==CHECK_IDS.length)return null;
 const found=new Set(),out=[];
 for(const x of checks){
  if(!x||!ALLOWED.has(x.id)||typeof x.ok!=='boolean'||found.has(x.id))return null;
  found.add(x.id);
  out.push({id:x.id,ok:x.ok,
   latencyMs:Number.isFinite(x.latencyMs)?Math.round(Math.max(0,Math.min(x.latencyMs,120000))):null,
   reason:typeof x.reason==='string'&&/^[a-z0-9-]{1,45}$/.test(x.reason)?x.reason:null});
 }
 return out.sort((a,b)=>CHECK_IDS.indexOf(a.id)-CHECK_IDS.indexOf(b.id));
}
async function readJson(fetcher,path){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),4500);
 try{
  const request=new Request(WATCHDOG_ORIGIN+path,{method:'GET',redirect:'manual',
   headers:{'accept':'application/json'},signal:ac.signal});
  const response=await fetcher.fetch(request);
  if(![200,503].includes(response.status)||response.redirected)return null;
  if(!/application\/json/i.test(response.headers.get('content-type')||''))return null;
  if(Number(response.headers.get('content-length')||0)>MAX_RESPONSE_BYTES)return null;
  const raw=await response.text();
  if(raw.length>MAX_RESPONSE_BYTES)return null;
  return JSON.parse(raw);
 }catch{return null}
 finally{clearTimeout(timer)}
}
function statusReport(raw,nowMs){
 if(!raw||raw.available!==true)return {available:false,state:'unavailable',reason:'no-current-watchdog-report'};
 const timestamp=validDate(raw.checkedAt,nowMs);
 const checks=safeChecks(raw.checks);
 if(!Number.isFinite(timestamp)||!checks)return {available:false,state:'unavailable',reason:'invalid-watchdog-evidence'};
 const stale=nowMs-timestamp>MAX_AGE_MS||raw.stale===true;
 const inconsistent=raw.healthy===true&&checks.some(x=>!x.ok);
 const healthy=raw.healthy===true&&!stale&&!inconsistent&&checks.every(x=>x.ok);
 const state=inconsistent?'unavailable':stale?'stale':healthy?'healthy':'degraded';
 return {available:!inconsistent,state,healthy,stale,checkedAt:new Date(timestamp).toISOString(),
  ageMinutes:Math.max(0,Math.floor((nowMs-timestamp)/60000)),
  checks,failedChecks:checks.filter(x=>!x.ok).map(x=>x.id),
  failureStreak:Number.isSafeInteger(raw.failureStreak)?
   Math.min(1000,Math.max(0,raw.failureStreak)):0,
  reason:inconsistent?'inconsistent-watchdog-evidence':undefined};
}
function historyReports(raw,nowMs){
 if(!raw||raw.available!==true||raw.schemaVersion!==1||!Array.isArray(raw.records))return null;
 return raw.records.slice(-24).map(row=>{
  const checked=validDate(row?.checkedAt,nowMs);
  if(!Number.isFinite(checked)||typeof row?.healthy!=='boolean')return null;
  const failures=safeIds(row.failedChecks);
  return {checkedAt:new Date(checked).toISOString(),healthy:row.healthy,
   failedChecks:failures,failureStreak:Number.isSafeInteger(row.failureStreak)?
    Math.min(1000,Math.max(0,row.failureStreak)):0};
 }).filter(Boolean).sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));
}
/**
 * Founder-facing deterministic triage. Two separate scheduled observations of
 * the SAME failed probe are required for "sustained"; do not infer persistence
 * from a generic failureStreak (which can span unrelated probes).
 */
export function assessWatchdogAlert(latest,history=[]){
 const safe={severity:'none',actionable:false,kind:'none',affectedIds:[],incidentKey:null,firstObserved:null,summary:'No sustained website failures'};
 if(!latest?.available){
  return {...safe,severity:'caution',kind:'monitor-unverified',summary:'Independent monitoring could not be verified'};
 }
 if(latest.state==='stale'){
  return {...safe,severity:'critical',actionable:true,kind:'monitor-stale',
   incidentKey:'monitor-stale:'+latest.checkedAt,firstObserved:latest.checkedAt,
   summary:'Website monitoring is delayed; last independent check is too old'};
 }
 if(latest.state==='healthy')return safe;
 if(latest.state!=='degraded')return {...safe,severity:'caution',kind:'monitor-unverified',
  summary:'Independent monitoring evidence is inconsistent'};
 const failures=safeIds(latest.failedChecks),nowMs=Date.parse(latest.checkedAt);
 if(!failures.length||!Number.isFinite(nowMs))return {...safe,severity:'caution',
  kind:'unconfirmed-issue',summary:'Monitor reported a problem; check the evidence'};
 const ordered=Array.isArray(history)?history.filter(x=>Number.isFinite(Date.parse(x?.checkedAt))).
  slice().sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt)):[];
 const latestRecord=ordered.find(x=>x.checkedAt===latest.checkedAt);
 const previous=latestRecord&&ordered.find(x=>{
  const delta=nowMs-Date.parse(x.checkedAt);
  return delta>0&&delta<=30*60000;
 });
 const repeated=previous?failures.filter(id=>safeIds(previous.failedChecks).includes(id)):[];
 if(!repeated.length)return {...safe,severity:'caution',kind:'first-observation',
  affectedIds:failures,firstObserved:latest.checkedAt,
  summary:'A website check failed; waiting for an independent repeat'};
 // Preserve the incident ID throughout consecutive failures of these probes.
 let first=previous.checkedAt,olderTime=Date.parse(first);
 for(const x of ordered.filter(x=>Date.parse(x.checkedAt)<olderTime)){
  const delta=olderTime-Date.parse(x.checkedAt);
  if(delta<=0||delta>30*60000||!repeated.every(id=>safeIds(x.failedChecks).includes(id)))break;
  first=x.checkedAt;olderTime=Date.parse(x.checkedAt);
 }
 return {...safe,severity:'critical',actionable:true,kind:'sustained-failure',
  affectedIds:repeated.sort((a,b)=>CHECK_IDS.indexOf(a)-CHECK_IDS.indexOf(b)),
  incidentKey:'repeat:'+repeated.join(',')+':'+first,firstObserved:first,
  summary:'Repeated failure detected on '+repeated.length+' website check'+(repeated.length===1?'':'s')};
}

export async function loadWatchdogEvidence(env,{now=()=>Date.now()}={}){
 const source={source:'independent-edge-watchdog',readOnly:true,automaticRemediation:false};
 if(typeof env?.EDGE_WATCHDOG?.fetch!=='function')return {...source,available:false,state:'unavailable',
  historyAvailable:false,history:[],reason:'watchdog-service-not-connected',
  alert:assessWatchdogAlert({available:false})};
 const nowMs=now();
 const [status,history]=await Promise.all([
  readJson(env.EDGE_WATCHDOG,'/status'),readJson(env.EDGE_WATCHDOG,'/history')
 ]);
 const latest=statusReport(status,nowMs),recent=historyReports(history,nowMs);
 return {...source,...latest,historyAvailable:recent!==null,history:recent||[],alert:assessWatchdogAlert(latest,recent||[])};
}
export const WATCHDOG_CHECK_IDS=Object.freeze([...CHECK_IDS]);
