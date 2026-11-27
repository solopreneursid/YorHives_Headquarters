/** Read-only business research: fixed public package API and reviewed documentation URLs. */
import {robotsPermit} from './revenue-research.mjs';
const AGENT='YorpHivesHQ-GrowthResearch';
export const RESEARCH_SOURCES=Object.freeze([
 {projectId:'yorphives',hour:2,query:'pdf browser',organization:'Apache PDFBox',url:'https://pdfbox.apache.org/'},
 {projectId:'globalgov',hour:8,query:'government jobs',organization:'USAJOBS',url:'https://developer.usajobs.gov/api-reference/job-apis'},
 {projectId:'taxpulse',hour:14,query:'income tax calculator',organization:'OpenFisca',url:'https://openfisca.org/doc/openfisca-web-api/'},
 {projectId:'hqventures',hour:20,query:'workflow automation',organization:'n8n',url:'https://docs.n8n.io/'}
].map(Object.freeze));
const clean=(s,n=380)=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|lt|gt|nbsp);/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-contact]').replace(/\s+/g,' ').trim().slice(0,n);
const packageName=/^(?:@[a-z0-9][a-z0-9._-]{0,63}\/)?[a-z0-9][a-z0-9._-]{0,100}$/;
const key=(id,kind)=>'growth_business_'+id+'_'+kind;
export function businessResearchWindow(time){
 const d=new Date(time);
 if(!Number.isFinite(+d)||d.getUTCMinutes()!==45)return null;
 const spec=RESEARCH_SOURCES.find(s=>s.hour===d.getUTCHours());
 return spec?{...spec,kind:Math.floor(+d/86400000)%2===0?'package':'website'}:null;
}
export function normalizePackageSearch(raw,spec,at){
 if(!Array.isArray(raw?.objects))throw Error('invalid-package-search');
 const seen=new Set(),out=[];
 for(const item of raw.objects.slice(0,12)){
  const p=item?.package,n=p?.name,desc=clean(p?.description);
  if(!packageName.test(n||'')||seen.has(n)||desc.length<12)continue;
  seen.add(n);
  out.push({projectId:spec.projectId,title:'Public package: '+n,summary:desc,sourceType:'public-package',
   sourceUrl:'https://www.npmjs.com/package/'+n,observedAt:at,provenance:'npm-public-registry',
   packageName:n,organizationVerified:false,commercialIntentVerified:false,contactPermissionVerified:false});
  if(out.length===6)break;
 }
 return out;
}
export function normalizeProductPage(html,spec,at){
 if(typeof html!=='string'||html.length>180000)throw Error('invalid-document');
 const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],120);
 const body=html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
 const meta=[...html.matchAll(/<meta\b[^>]{0,1500}>/gi)].map(m=>m[0]).find(m=>/\bname\s*=\s*["']description["']/i.test(m));
 const desc=clean(meta?.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find(Boolean));
 const paragraphs=[...body.matchAll(/<(?:h1|h2|p)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|p)>/gi)].slice(0,30).map(m=>clean(m[1],250)).filter(x=>x.length>=20);
 const summary=clean([desc,...paragraphs.slice(0,4)].filter(Boolean).join(' '));
 if(title.length<3||summary.length<12)return [];
 return [{projectId:spec.projectId,title:'Official documentation: '+spec.organization,summary,
  sourceType:'official-product-page',sourceUrl:spec.url,observedAt:at,organization:spec.organization,
  provenance:'reviewed-official-documentation',pageTitle:title,organizationVerified:false,
  commercialIntentVerified:false,contactPermissionVerified:false}];
}
async function boundedGet(env,url,kind,{reserveFetch,fetchFn}){
 const u=new URL(url),registry=u.origin==='https://registry.npmjs.org'&&u.pathname==='/-/v1/search';
 const allowedPage=RESEARCH_SOURCES.some(s=>s.url===url||new URL(s.url).origin+'/robots.txt'===url);
 if((!registry&&!allowedPage)||u.username||u.password||u.port||!await reserveFetch(env))throw Error('source-or-budget-denied');
 const limit=kind==='robots'?32000:180000;
 const response=await fetchFn(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000),
  headers:{'user-agent':AGENT,accept:kind==='package'?'application/json':kind==='robots'?'text/plain':'text/html'}});
 if(kind==='robots'&&response.status===404)return '';
 if(response.status!==200)throw Error('source-http-'+response.status);
 if(Number(response.headers.get('content-length')||0)>limit)throw Error('oversized-source');
 if(!response.body||
    !String(response.headers.get('content-type')).toLowerCase().includes(kind==='package'?'application/json':kind==='robots'?'text/plain':'text/html'))throw Error('public-source-unavailable');
 const reader=response.body.getReader(),decoder=new TextDecoder();let total=0,text='';
 try{for(;;){const v=await reader.read();if(v.done)break;total+=v.value.byteLength;if(total>limit)throw Error('oversized-source');text+=decoder.decode(v.value,{stream:true});}return text+decoder.decode();}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function runBusinessResearch(env,time,{reserveFetch,fetchFn=fetch}={}){
 const spec=businessResearchWindow(time);if(!spec)return 'outside-window';
 if(!env?.DB||typeof reserveFetch!=='function')throw Error('missing-storage');
 const at=new Date(time).toISOString(),id=key(spec.projectId,spec.kind);
 const base={schemaVersion:1,projectId:spec.projectId,kind:spec.kind,checkedAt:at,state:'started',records:[]};
 const claim=await env.DB.prepare('INSERT INTO status(key,value,checked_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=excluded.checked_at WHERE substr(status.checked_at,1,10)<>substr(excluded.checked_at,1,10)').bind(id,JSON.stringify(base),at).run();
 if(!Number(claim.meta?.changes||0))return 'already-checked';
 let data={...base,state:'unavailable'};
 try{
  let records;
  if(spec.kind==='package'){
   const q=new URLSearchParams({text:spec.query,size:'8'});
   records=normalizePackageSearch(JSON.parse(await boundedGet(env,'https://registry.npmjs.org/-/v1/search?'+q,'package',{reserveFetch,fetchFn})),spec,at);
  }else{
   const u=new URL(spec.url),robots=await boundedGet(env,u.origin+'/robots.txt','robots',{reserveFetch,fetchFn});
   if(!robotsPermit(robots,AGENT,u.pathname))throw Error('robots-denied');
   records=normalizeProductPage(await boundedGet(env,spec.url,'website',{reserveFetch,fetchFn}),spec,at);
  }
  data={...base,state:records.length?'observed':'checked-no-match',records};
 }catch(error){data={...data,reason:/^(?:source-http-\d{3}|oversized-source|robots-denied|source-or-budget-denied|public-source-unavailable|invalid-document|invalid-package-search)$/.test(error?.message||'')?error.message:'transport-or-parse-failure'};}
 await env.DB.prepare('UPDATE status SET value=? WHERE key=? AND checked_at=?').bind(JSON.stringify(data),id,at).run();
 return spec.projectId+':'+spec.kind+':'+data.state;
}
export async function loadBusinessResearch(db,{now=Date.now()}={}){
 const specs=RESEARCH_SOURCES.flatMap(s=>['package','website'].map(kind=>({...s,kind})));
 const keys=specs.map(s=>key(s.projectId,s.kind));
 const rows=await db.prepare('SELECT key,value,checked_at FROM status WHERE key IN ('+keys.map(()=>'?').join(',')+')').bind(...keys).all();
 const byKey=new Map((rows.results||[]).map(r=>[r.key,r]));
 return specs.map(s=>{
  const row=byKey.get(key(s.projectId,s.kind)),base={projectId:s.projectId,kind:s.kind,checkedAt:row?.checked_at||null,records:[]};
  if(!row)return {...base,state:'not-yet-checked'};
  try{
   const x=JSON.parse(row.value),age=now-Date.parse(x.checkedAt);
   if(x.schemaVersion!==1||x.projectId!==s.projectId||x.kind!==s.kind||x.checkedAt!==row.checked_at||!Number.isFinite(age)||age<0||age>60*3600000||!Array.isArray(x.records)||x.records.length>6||!['observed','started','unavailable','checked-no-match'].includes(x.state))throw Error('invalid');
   const records=x.state==='observed'?x.records.filter(r=>r.projectId===s.projectId&&r.observedAt===x.checkedAt&&typeof r.summary==='string'&&r.summary.length<=380&&
    (s.kind==='website'?r.sourceType==='official-product-page'&&r.sourceUrl===s.url&&r.organization===s.organization:r.sourceType==='public-package'&&packageName.test(r.packageName||'')&&r.sourceUrl==='https://www.npmjs.com/package/'+r.packageName)):[];
   return {...base,state:x.state,records,reason:typeof x.reason==='string'?x.reason.slice(0,80):null};
  }catch{return {...base,state:'stale-or-invalid'};}
 });
}
