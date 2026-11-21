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


/**
 * Read-only public-repository evidence adapter for Free Tools Operations.
 * GitHub is the source of our scheduled watchdog records, not an intermediary
 * to the production website. No GitHub token, write API, paid SDK or webhook.
 */
const REPO='solopreneursid/YorpHives_Website';
const API='https://api.github.com/repos/'+REPO;
const WORKFLOW='free-tools-long-run-watchdog.yml';
const MAX_BYTES=350000;
const TIMEOUT_MS=4300;
const FRESH_MS=36*60*60*1000;
const safeText=(value,n=200)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n):'';
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const issueId=v=>Number.isInteger(v)&&v>0&&v<99999999?v:null;
const isPublicIssueUrl=(url,n)=>typeof url==='string'&&
 url===`https://github.com/${REPO}/issues/${n}`;
export async function readPublicEvidence(url,{fetcher=fetch}={}){
 if(typeof url!=='string'||!url.startsWith(API+'/'))throw Error('Unexpected repository evidence URL');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
 try{
  const resp=await fetcher(url,{method:'GET',signal:ctrl.signal,redirect:'error',headers:{
   accept:'application/vnd.github+json','user-agent':'YorpHivesHQ-ReadOnly-FreeTools-Ops/1.0'}});
  if(resp.status!==200||!/application\/json/i.test(resp.headers.get('content-type')||''))
   throw Error('GitHub evidence unavailable (HTTP '+resp.status+')');
  const declared=Number(resp.headers.get('content-length')||0);
  if(declared>MAX_BYTES)throw Error('GitHub evidence oversized');
  const raw=await resp.text();
  if(raw.length>MAX_BYTES)throw Error('GitHub evidence oversized');
  return JSON.parse(raw);
 }finally{clearTimeout(timer)}
}
function normalizeIssue(item,kind){
 const n=issueId(item?.number);
 if(!n||!isPublicIssueUrl(item?.html_url,n)||item?.state!=='open')return null;
 const updatedAt=date(item.updated_at);
 if(!updatedAt)return null;
 return {id:kind+':'+n,kind,number:n,title:safeText(item.title,150),
  severity:kind==='incident'?'critical':'improvement',status:'open',updatedAt,
  evidenceUrl:item.html_url,description:kind==='incident'?
   'Scheduled watchdog reported a problem. Review the attached run evidence before changing production.':
   'SEO auditor recorded potential improvements. These are review suggestions, not proven ranking problems.',
  nextAction:kind==='incident'?'Review the failed run and affected tool before approving a fix.':
   'Review the SEO report and prioritize pages with real user or search evidence.'};
}
export function assessFreeToolsEvidence({runs,issues,now=Date.now()}={}){
 const base={schemaVersion:1,source:'github-public-repository-evidence',
  readOnly:true,automaticRemediation:false,adsActivated:false,
  evidenceVerified:false,status:'unverified',checkedAt:new Date(now).toISOString(),
  lastRun:null,summary:{critical:0,improvements:0,checkedTools:null},
  incidents:[],improvements:[],nextAction:'Check the GitHub monitoring workflow for a completed run.',
  digest:{daily:'No verified Free Tools monitoring report.',weekly:'No verified SEO recommendations.'}};
 if(!runs||!Array.isArray(runs.workflow_runs)||!Array.isArray(issues))
  return {...base,reason:'source-unavailable'};
 const completed=runs.workflow_runs.filter(x=>x?.status==='completed'&&date(x.updated_at));
 const latest=completed.sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0];
 const lastRun=latest?{id:Number.isSafeInteger(latest.id)?latest.id:null,
  state:latest.conclusion==='success'?'passed':latest.conclusion==='failure'?'failed':'unverified',
  finishedAt:date(latest.updated_at),
  url:typeof latest.html_url==='string'&&latest.html_url.startsWith(`https://github.com/${REPO}/actions/runs/`)?
   latest.html_url:null}:null;
 const stale=!lastRun||now-Date.parse(lastRun.finishedAt)>FRESH_MS||
  Date.parse(lastRun.finishedAt)>now+5*60000;
 const incidents=issues.filter(x=>x?.title==='YorpHives Free Tools watchdog failure').map(x=>normalizeIssue(x,'incident')).filter(Boolean);
 const improvements=issues.filter(x=>x?.title==='YorpHives Free Tools SEO review').map(x=>normalizeIssue(x,'improvement')).filter(Boolean);
 const critical=incidents.length+(lastRun?.state==='failed'&&!incidents.length?1:0);
 let status=stale?'unverified':critical||lastRun?.state==='failed'?'attention':lastRun?.state==='passed'?'healthy':'unverified';
 const reason=stale?'monitoring-run-missing-or-stale':null;
 const nextAction=critical?'Open the latest failed run and incident evidence. Review and approve any fix.':
  status==='unverified'?'Verify the scheduled workflow is active and completing successfully.':
  improvements.length?'Review prioritized SEO opportunities when convenient.':'No intervention needed.';
 const digest={daily:critical?critical+' Free Tools monitoring incident(s) need investigation.':
  status==='healthy'?'Recent scheduled monitoring passed; no critical incidents recorded.':
   'Scheduled monitoring is not verified as current.',
  weekly:improvements.length?improvements.length+' SEO review issue(s) are open. Check the report and prioritize by traffic evidence.':
   'No tracked SEO review issue; this is not proof that no improvements exist.'};
 return {...base,evidenceVerified:!stale&&lastRun?.state==='passed',status,reason,lastRun,
  summary:{critical,improvements:improvements.length,checkedTools:null},
  incidents,improvements,nextAction,digest};
}
export async function loadFreeToolsOperations({fetcher=fetch,now=()=>Date.now()}={}){
 const urls=[API+'/actions/workflows/'+WORKFLOW+'/runs?per_page=8',API+'/issues?state=open&per_page=30'];
 const [runs,issues]=await Promise.allSettled(urls.map(url=>readPublicEvidence(url,{fetcher})));
 const value=x=>x.status==='fulfilled'?x.value:null;
 const result=assessFreeToolsEvidence({runs:value(runs),issues:value(issues),now:now()});
 return {...result,sourceAvailability:{workflow:runs.status==='fulfilled',issues:issues.status==='fulfilled'},
  reason:runs.status==='rejected'||issues.status==='rejected'?'source-unavailable':result.reason};
}
