/**
 * Fixed-scope public organization/project discovery.
 * GitHub's public repository search API only; no arbitrary URLs, user profiles,
 * contacts, README downloads, messaging, credentials or external writes.
 * One bounded scheduled GET per project/day, through HQ's shared fetch budget.
 */
const SPECS=Object.freeze([
 {id:'yorphives',hour:2,query:'topic:pdf'},
 {id:'globalgov',hour:8,query:'government jobs in:name,description'},
 {id:'taxpulse',hour:14,query:'"tax calculator" in:name,description'},
 {id:'hqventures',hour:20,query:'topic:workflow-automation'}
]);
const HOST='https://api.github.com/search/repositories';
const MAX_BYTES=180000,MAX_ROWS=8,MAX_AGE=36*3600000;
const slug=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const day=t=>new Date(t).toISOString().slice(0,10);
const clean=(v,n)=>String(v??'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ')
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-contact]').replace(/\s+/g,' ').trim().slice(0,n);
const key=id=>'growth_prospects_'+id;
const COOLDOWN_KEY='growth_github_source_cooldown';
export function githubCooldown(response,clockMs=Date.now()){
 if(![403,429].includes(response?.status))return null;
 const remaining=response.headers.get('x-ratelimit-remaining');
 const retry=response.headers.get('retry-after');
 const reset=response.headers.get('x-ratelimit-reset');
 const retrySeconds=retry&&/^\d{1,7}$/.test(retry)?Number(retry):retry?Math.ceil((Date.parse(retry)-clockMs)/1000):0;
 const resetSeconds=reset&&/^\d{1,12}$/.test(reset)?Math.ceil(Number(reset)-clockMs/1000):0;
 const limited=response.status===429||remaining==='0'||Boolean(retry);
 const hinted=Math.max(0,Number.isFinite(retrySeconds)?retrySeconds:0,remaining==='0'&&Number.isFinite(resetSeconds)?resetSeconds:0);
 return {reason:limited?'github-rate-limited':'source-http-403',
  durationMs:Math.max(limited?60000:12*3600000,Math.min(24*3600000,hinted*1000))};
}
async function applyCooldown(db,response,time){
 const decision=githubCooldown(response);
 if(!decision)return null;
 const until=new Date(Number(time)+decision.durationMs).toISOString();
 await db.prepare('INSERT INTO status(key,value,checked_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=excluded.checked_at WHERE status.value<excluded.value')
  .bind(COOLDOWN_KEY,until,new Date(time).toISOString()).run();
 return decision.reason;
}
export function discoveryWindow(time){
 const t=new Date(time);
 if(!Number.isFinite(t.getTime())||t.getUTCMinutes()!==35)return null;
 return SPECS.find(x=>x.hour===t.getUTCHours())||null;
}
export function normalizeOrganizationRepositories(payload,projectId,observedAt){
 if(!SPECS.some(x=>x.id===projectId)||!Number.isFinite(Date.parse(observedAt))||
    !Array.isArray(payload?.items))throw TypeError('Invalid repository search evidence');
 const records=[],seen=new Set();
 for(const r of payload.items.slice(0,20)){
  const org=r?.owner?.login, name=r?.name;
  if(r?.owner?.type!=='Organization'||!slug.test(org||'')||!slug.test(name||'')||
    org.toLowerCase()==='solopreneursid'||r.private!==false||r.archived!==false||r.fork!==false||
    typeof r.description!=='string'||r.description.trim().length<12)continue;
  const canonical='https://github.com/'+org+'/'+name;
  if(r.html_url!==canonical||seen.has(canonical.toLowerCase()))continue;
  seen.add(canonical.toLowerCase());
  const summary=clean(r.description,380),title=clean(name.replace(/[-_]/g,' '),100);
  if(summary.length<12||title.length<3)continue;
  records.push({projectId,organization:org,repository:name,sourceUrl:canonical,
   organizationUrl:'https://github.com/'+org,observedAt,summary,
   title:'Public repository: '+title,sourceType:'public-repository',
   provenance:'github-public-repository-search',organizationAccountObserved:true,
   legalEntityVerified:false,needVerified:false,contactPermissionVerified:false,
   commercialIntentVerified:false,autoExecute:false});
  if(records.length>=MAX_ROWS)break;
 }
 return records;
}
async function boundedJson(response){
 if(!response.ok||!String(response.headers.get('content-type')).includes('application/json')||
    Number(response.headers.get('content-length')||0)>MAX_BYTES||!response.body)
  throw Error(response.status!==200?'source-http-'+response.status:'invalid-or-oversized-source');
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let total=0,body='';
 try{while(true){const x=await reader.read();if(x.done)break;
  total+=x.value.byteLength;if(total>MAX_BYTES)throw Error('public-source-oversized');
  body+=decoder.decode(x.value,{stream:true});}
  body+=decoder.decode();return JSON.parse(body);
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function save(db,id,data){
 const value=JSON.stringify(data);
 if(value.length>20000)throw Error('snapshot-oversized');
 await db.prepare('INSERT INTO status(key,value,checked_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=excluded.checked_at')
  .bind(key(id),value,data.checkedAt).run();
}
export async function runProspectDiscovery(env,time,{reserveFetch,fetchFn=fetch,crossCheck=false}={}){
 const spec=discoveryWindow(time);
 if(!spec)return 'outside-window';
 if(!env?.DB||typeof reserveFetch!=='function')throw Error('missing-evidence-storage');
 const at=new Date(time).toISOString(),previous=await env.DB.prepare('SELECT checked_at FROM status WHERE key=?').bind(key(spec.id)).first();
 if(previous?.checked_at&&String(previous.checked_at).slice(0,10)===day(time))return 'already-checked';
 // Claim the day before outbound I/O; interruptions remain visible as incomplete.
 const claim=await env.DB.prepare('INSERT INTO status(key,value,checked_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=excluded.checked_at WHERE substr(status.checked_at,1,10)<>substr(excluded.checked_at,1,10)')
  .bind(key(spec.id),JSON.stringify({schemaVersion:1,projectId:spec.id,checkedAt:at,state:'started',records:[]}),at).run();
 if(!Number(claim.meta?.changes||0))return 'already-checked';
 let data={schemaVersion:1,projectId:spec.id,checkedAt:at,state:'unavailable',records:[]};
 try{
  const cooldown=await env.DB.prepare('SELECT value FROM status WHERE key=?').bind(COOLDOWN_KEY).first();
  if(cooldown&&Number.isFinite(Date.parse(cooldown.value))&&Date.parse(cooldown.value)>Date.parse(at))throw Error('github-source-cooldown');
  if(!await reserveFetch(env))throw Error('shared-fetch-budget-exhausted');
  const query=new URLSearchParams({q:spec.query+' archived:false fork:false is:public',sort:'updated',order:'desc',per_page:'12'});
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),4500);
  try{
   const r=await fetchFn(HOST+'?'+query,{method:'GET',redirect:'error',cache:'no-store',
    headers:{accept:'application/vnd.github+json','user-agent':'YorpHivesHQ-ReadOnly'},signal:ctl.signal});
   const restriction=await applyCooldown(env.DB,r,Date.parse(at));
   if(restriction)throw Error(restriction);
   const raw=await boundedJson(r);
   if(raw.incomplete_results===true)throw Error('incomplete-public-search');
   const records=normalizeOrganizationRepositories(raw,spec.id,at);
   if(crossCheck&&records.length){
    const candidate=records[0];
    candidate.organizationCrossCheck='unavailable';
    try{
     if(await reserveFetch(env)){
      const orgUrl='https://api.github.com/orgs/'+encodeURIComponent(candidate.organization);
      const orgResponse=await fetchFn(orgUrl,{method:'GET',redirect:'error',cache:'no-store',
       headers:{accept:'application/vnd.github+json','user-agent':'YorpHivesHQ-ReadOnly'},signal:AbortSignal.timeout(4500)});
      const restriction=await applyCooldown(env.DB,orgResponse,Date.parse(at));
      if(restriction)throw Error(restriction);
      const org=await boundedJson(orgResponse);
      const valid=typeof org.login==='string'&&org.login.toLowerCase()===candidate.organization.toLowerCase()&&org.type==='Organization'&&org.html_url==='https://github.com/'+org.login;
      candidate.organizationCrossCheck=valid?'github-account-confirmed':'identity-mismatch';
      candidate.organizationAccountCrossChecked=valid;
      if(valid)candidate.organizationEvidenceUrl=org.html_url;
     }
    }catch{}
   }
   data={...data,state:records.length?'observed':'checked-no-match',records};
  }finally{clearTimeout(timer);}
 }catch(error){data={...data,state:'unavailable',records:[],reason:/^(?:source-http-\d{3}|invalid-or-oversized-source|public-source-oversized|incomplete-public-search|shared-fetch-budget-exhausted|github-rate-limited|github-source-cooldown)$/.test(error?.message||'')?error.message:'transport-or-parse-failure'};}
 await save(env.DB,spec.id,data);
 return spec.id+':'+data.state;
}
export async function loadProspectDiscovery(db,{now=Date.now()}={}){
 const result=await db.prepare("SELECT key,value,checked_at FROM status WHERE key IN ('growth_prospects_yorphives','growth_prospects_globalgov','growth_prospects_taxpulse','growth_prospects_hqventures')").all();
 const rows=new Map((result.results||[]).map(r=>[r.key,r]));
 return SPECS.map(spec=>{
  const row=rows.get(key(spec.id));
  if(!row)return {projectId:spec.id,state:'not-yet-checked',checkedAt:null,records:[]};
  try{
   const x=JSON.parse(row.value),age=now-Date.parse(x.checkedAt);
   if(x.schemaVersion!==1||x.projectId!==spec.id||!Array.isArray(x.records)||
      x.records.length>MAX_ROWS||!Number.isFinite(age)||age<0||age>MAX_AGE||
      !['observed','checked-no-match','started','unavailable'].includes(x.state))
    return {projectId:spec.id,state:'stale-or-invalid',checkedAt:row.checked_at,records:[]};
   const records=x.state==='observed'?x.records.filter(r=>r.projectId===spec.id&&r.provenance==='github-public-repository-search'&&
    slug.test(r.organization||'')&&slug.test(r.repository||'')&&r.sourceUrl==='https://github.com/'+r.organization+'/'+r.repository&&
    typeof r.summary==='string'&&r.summary.length<=380):[];
   return {projectId:spec.id,state:x.state,checkedAt:x.checkedAt,records,reason:typeof x.reason==='string'?x.reason.slice(0,80):null};
  }catch{return {projectId:spec.id,state:'invalid-snapshot',checkedAt:row.checked_at,records:[]};}
 });
}
