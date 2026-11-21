/* Portable bounded revenue research. Reads permitted public HN search and openly
 * published IndieMakerList feed, writes ONLY evidence to HQ's own SQLite/D1.
 * Money mentioned by strangers is NOT YorpHives revenue or independently audited.
 * Zero agents, deployments, payment operations, ads, subscriptions or paid APIs.
 */
const minuteMs=60000;
const specs=Object.freeze([
 {id:'hn-mrr',hour:9,minute:25,kind:'hn',term:'mrr',site:'https://hn.algolia.com/api',name:'Hacker News · maker revenue conversations'},
 {id:'makers',hour:15,minute:25,kind:'feed',site:'https://indiemakerlist.com/feed.xml',name:'IndieMakerList · public maker feed'},
 {id:'hn-pricing',hour:21,minute:25,kind:'hn',term:'pricing',site:'https://hn.algolia.com/api',name:'Hacker News · pricing discussions'}
]);
const clean=(x,n=200)=>String(x??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const safeLink=x=>{try{const v=new URL(String(x));return v.protocol==='https:'&&!v.username&&!v.password&&!v.port&&v.href.length<500?v.href:null}catch{return null}};
const validDate=x=>{const n=Date.parse(String(x||''));return Number.isFinite(n)&&n>0?n:0};
const shortId=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36)};
const relevant=/\b(mrr|arr|revenue|profit|paying|paid|pricing|subscription|customers?|monetiz|sponsor|affiliate|advertis|charge|bootstrapp|indie\s?hacker)\b/i;
const restricted=/\b(?:casino|betting|gambling|porn|crypto pump|token launch|gun sales|exploit kit)\b/i;
const days=(a,b)=>Math.max(0,(a-b)/(86400000));
function niche(title){
 const s=title.toLowerCase();
 if(/\b(job|career|resume|cv|interview|recruit|hiring)\b/.test(s))return 'govradar';
 if(/\b(pdf|image|photo|file|convert|compress|browser|tool|extension|document)\b/.test(s))return 'free-tools';
 if(/\b(agent|ai|automation|workflow|saas|startup|mobile|app|business|software|marketing|creator|newsletter|subscription|product)\b/.test(s))return 'hqventures';
 return 'market-watch';
}
function draft({id,title,sourceUrl,sourceLabel,observedAt,description,attention=0}){
 const category=niche(title);
 return {id:'rr-'+shortId(id),title:clean(title,115),description:clean(description,350),
  recommendation:'RESEARCH ONLY: '+(category==='govradar'?'Assess a narrow jobseeker workflow for GovRadar. ':category==='free-tools'?'Assess a private, free tool workflow and optional approved Free Tools monetization. ':category==='hqventures'?'Investigate a narrow founder-approved HQventures product experiment. ':'Study the business model and buyer problem before considering any fit. ')+
  'Verify the original source, customers, competition, licensing and costs. No verified YorpHives revenue.',
  source_url:sourceUrl,observed_at:observedAt,kind:'revenue-research',
  score:Math.min(65,25+(category==='market-watch'?0:12)+Math.min(22,Math.floor(Math.max(0,attention)/5))),sourceLabel};
}
export function normalizeHnRevenue(hits,at,term){
 const now=validDate(at),out=[],seen=new Set();
 if(!now||!['mrr','pricing'].includes(term)||!Array.isArray(hits))return [];
 for(const x of hits.slice(0,40)){
  const id=String(x?.objectID||'');
  const title=clean(x?.title,110),t=validDate(x?.created_at);
  const points=Number(x?.points||0),comments=Number(x?.num_comments||0);
  if(!/^\d+$/.test(id)||!title||!relevant.test(title)||restricted.test(title)||
    !t||t>now+minuteMs||days(now,t)>30||!Number.isSafeInteger(points)||points<5||
    !Number.isSafeInteger(comments)||comments<2||seen.has(id))continue;
  seen.add(id);
  const sourceUrl='https://news.ycombinator.com/item?id='+id;
  const d=draft({id:'hn:'+id,title,sourceUrl,sourceLabel:'Public Hacker News discussion',
   observedAt:new Date(t).toISOString(),attention:Math.min(99,points+comments),
   description:'Public discussion ('+points+' points, '+comments+' comments). These are community attention proxies; buyer demand and any revenue statement are unverified.'});
  out.push(d);if(out.length>=6)break;
 }
 return out;
}
const decode=x=>String(x||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const field=(v,name)=>{const re=new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i');return decode(v.match(re)?.[1]||'').replace(/^<!\[CDATA\[/,'').replace(/\]\]>$/,'').trim()};
export function normalizeMakerFeed(xml,at){
 if(typeof xml!=='string'||xml.length>96000||!/(\<rss|\<feed|\<item|\<entry)/i.test(xml))return [];
 const now=validDate(at),out=[],seen=new Set();
 if(!now)return [];
 const items=[...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0,50);
 for(const [,raw] of items){
  const title=clean(field(raw,'title'),110),link=field(raw,'link')||raw.match(/<link\s+[^>]*href="([^"]+)"/i)?.[1];
  const url=safeLink(link),date=validDate(field(raw,'pubDate')||field(raw,'updated')||field(raw,'published'));
  if(!title||!url||new URL(url).hostname!=='indiemakerlist.com'||restricted.test(title)||!relevant.test(title)||
    !date||date>now+minuteMs||days(now,date)>90||seen.has(url))continue;
  seen.add(url);
  const d=draft({id:'makers:'+url,title,sourceUrl:url,sourceLabel:'IndieMakerList public maker feed',
   observedAt:new Date(date).toISOString(),description:'Public maker statement or listing from an independent publisher. Revenue figures, if any, are self-reported or source-attributed and have NOT been independently verified by HQ.'});
  out.push(d);if(out.length>=6)break;
 }
 return out;
}
async function boundedGet(url,{fetchFn=fetch,limit=96000}={}){
 const target=new URL(url);
 if(target.protocol!=='https:'||target.username||target.password||target.port)throw Error('unapproved-url');
 if(!((target.hostname==='hn.algolia.com'&&target.pathname==='/api/v1/search_by_date')||
   (target.hostname==='indiemakerlist.com'&&target.pathname==='/feed.xml')))throw Error('source-not-allowlisted');
 const resp=await fetchFn(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(8000),
  headers:{accept:target.hostname==='hn.algolia.com'?'application/json':'application/atom+xml, application/rss+xml, application/xml','user-agent':'YorpHivesHQ-RevenueResearch/1.0'}});
 if(!resp||resp.status!==200)throw Error('source-http-'+String(resp?.status||'unknown'));
 const length=Number(resp.headers?.get?.('content-length')||0);
 if(Number.isFinite(length)&&length>limit){try{await resp.body?.cancel()}catch{}throw Error('public-source-too-large')}
 const reader=resp.body?.getReader?.();if(!reader)throw Error('empty-source-body');
 const decoder=new TextDecoder();let result='',bytes=0;
 try{while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>limit)throw Error('public-source-too-large');result+=decoder.decode(r.value,{stream:true})}}
 finally{try{await reader.cancel()}catch{}try{reader.releaseLock()}catch{}}
 return result+decoder.decode();
}
export function revenueResearchWindow(time){
 const d=new Date(time);if(!Number.isFinite(d.getTime()))return null;
 return specs.find(x=>x.hour===d.getUTCHours()&&x.minute===d.getUTCMinutes())||null;
}
export async function runRevenueResearch(env,scheduledTime,{reserveFetch,fetchFn=fetch}={}){
 const source=revenueResearchWindow(scheduledTime);
 if(!source)return 'outside-window';
 if(!env?.DB||typeof reserveFetch!=='function')throw Error('missing-evidence-storage');
 const at=new Date(scheduledTime).toISOString(),since=new Date(Date.parse(at)-30*86400000).toISOString();
 const statusKey='revenue_research_'+source.id.replace(/-/g,'_');
 let result='empty:0',count=0;
 try{
  if(!await reserveFetch(env))throw Error('public-fetch-budget-exhausted');
  let entries=[];
  if(source.kind==='hn'){
   const url='https://hn.algolia.com/api/v1/search_by_date?tags=story&query='+encodeURIComponent(source.term)+
    '&numericFilters='+encodeURIComponent('created_at_i>'+(Math.floor(Date.parse(since)/1000)))+'&hitsPerPage=20';
   const payload=JSON.parse(await boundedGet(url,{fetchFn}));
   if(!Array.isArray(payload?.hits))throw Error('invalid-public-search-response');
   entries=normalizeHnRevenue(payload.hits,at,source.term);
  }else entries=normalizeMakerFeed(await boundedGet(source.site,{fetchFn}),at);
  for(const e of entries){
   await env.DB.prepare('INSERT INTO opportunities(id,title,description,recommendation,source_url,observed_at,score,kind) VALUES(?,?,?,?,?,?,?,?) '+
    'ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,recommendation=excluded.recommendation,score=excluded.score,kind=excluded.kind')
    .bind(e.id,e.title,e.description,e.recommendation,e.source_url,e.observed_at,e.score,e.kind).run();count++;
  }
  result=count?'ok:'+count:'empty-public-evidence:0';
 }catch(error){result='unavailable:'+clean(error?.message||'source-error',60)}
 await env.DB.prepare('INSERT INTO status(key,value,checked_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,checked_at=excluded.checked_at')
  .bind(statusKey,result,at).run();
 // Own evidence only, bounded retention, no changes to unrelated source data.
 if(source.id==='hn-pricing')
  await env.DB.prepare("DELETE FROM opportunities WHERE kind='revenue-research' AND observed_at<?")
   .bind(new Date(Date.parse(at)-120*86400000).toISOString()).run();
 return source.id+':'+result;
}
export const revenueResearchSources=specs.map(s=>({id:'revenue_research_'+s.id.replace(/-/g,'_'),name:s.name,url:s.site}));
