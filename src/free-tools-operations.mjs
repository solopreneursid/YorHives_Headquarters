/**
 * Read-only public-repository evidence adapter for Free Tools Operations.
 * GitHub is the source of our scheduled watchdog records, not an intermediary
 * to the production website. No GitHub token, write API, paid SDK or webhook.
 */
const REPO='solopreneursid/YorpHives_Website';
const API='https://api.github.com/repos/'+REPO;
const WORKFLOW='free-tools-long-run-watchdog.yml';
const MAX_BYTES=65000;
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
 const urls=[API+'/actions/workflows/'+WORKFLOW+'/runs?per_page=8',API+'/issues?state=open&per_page=50'];
 const [runs,issues]=await Promise.allSettled(urls.map(url=>readPublicEvidence(url,{fetcher})));
 const value=x=>x.status==='fulfilled'?x.value:null;
 const result=assessFreeToolsEvidence({runs:value(runs),issues:value(issues),now:now()});
 return {...result,sourceAvailability:{workflow:runs.status==='fulfilled',issues:issues.status==='fulfilled'},
  reason:runs.status==='rejected'||issues.status==='rejected'?'source-unavailable':result.reason};
}
