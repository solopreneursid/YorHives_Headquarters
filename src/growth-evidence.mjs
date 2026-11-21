/* YorpHives production growth evidence — observation only.
 * No credentials, tokens, visitor identities, mutation, or user-supplied URLs.
 * Only the fixed public, aggregate endpoint is read over HTTPS.
 */
export const GROWTH_SOURCE = 'https://yorphives.com/api/insights/growth';
const validCount=x=>Number.isSafeInteger(x)&&x>=0;
const validDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const safeUrl=x=>typeof x==='string'&&/^(?:tools|apps|products)\/[a-z0-9][a-z0-9-]*\/$/.test(x);
export function validateGrowth(x){
 if(x?.schemaVersion!==1||x?.available!==true||x?.periodDays!==30||
    !Array.isArray(x.daily)||x.daily.length!==30||
    !Array.isArray(x.ranked)||x.ranked.length>10||
    !Array.isArray(x.opportunities)||x.opportunities.length>5||
    !Number.isFinite(Date.parse(x.generatedAt||'')))throw Error('Invalid growth evidence schema');
 const daily=x.daily.map(r=>{
  if(!validDay(r.day)||!validCount(r.pageViews)||!validCount(r.completedActions))throw Error('Invalid daily aggregate');
  return {day:r.day,pageViews:r.pageViews,completedActions:r.completedActions};
 });
 if(new Set(daily.map(r=>r.day)).size!==30)throw Error('Duplicate daily aggregates');
 for(let i=1;i<daily.length;i++)if(Date.parse(daily[i].day)-Date.parse(daily[i-1].day)!==86400000)
   throw Error('Nonconsecutive daily series');
 const cmp=x.comparison;
 if(!cmp||!['recent7dCompletedActions','previous7dCompletedActions','recent7dPageViews','previous7dPageViews'].every(k=>validCount(cmp[k])))
   throw Error('Invalid weekly comparison');
 const ranked=x.ranked.map(r=>{
  if(!safeUrl(r.url)||typeof r.name!=='string'||r.name.length<1||r.name.length>100||
    !validCount(r.completedActions30d)||!validCount(r.completedActions7d)||!validCount(r.previous7d))throw Error('Invalid product aggregate');
  return {url:r.url,name:r.name,completedActions30d:r.completedActions30d,
    completedActions7d:r.completedActions7d,previous7d:r.previous7d};
 });
 if(new Set(ranked.map(x=>x.url)).size!==ranked.length)throw Error('Duplicate ranking');
 // Separately validate anonymous Free Tools pageviews. These are not sessions,
 // conversions, ad impressions or verified human visitors.
 const rawToolViews=x.toolPageViews===undefined?[]:x.toolPageViews;
 if(!Array.isArray(rawToolViews)||rawToolViews.length>10)throw Error('Invalid tool pageview rankings');
 const toolPageViews=rawToolViews.map(r=>{
  if(!/^tools\/[a-z0-9][a-z0-9-]*\/$/.test(String(r.url||''))||
    typeof r.name!=='string'||r.name.length<1||r.name.length>100||
    !validCount(r.pageViews30d)||!validCount(r.pageViews7d)||!validCount(r.previous7d)||
    r.pageViews7d>r.pageViews30d||r.previous7d>r.pageViews30d)
   throw Error('Invalid Free Tool pageview aggregate');
  return {url:r.url,name:r.name,pageViews30d:r.pageViews30d,
   pageViews7d:r.pageViews7d,previous7d:r.previous7d};
 });
 if(new Set(toolPageViews.map(r=>r.url)).size!==toolPageViews.length)
  throw Error('Duplicate tool pageview ranking');

 const opportunities=x.opportunities.map(r=>{
  if(!safeUrl(r.url)||!ranked.some(v=>v.url===r.url)||r.requiresFounderReview!==true||
    r.signal!=='increasing-completions'||!validCount(r.recent7d)||!validCount(r.previous7d))
    throw Error('Invalid opportunity signal');
  return {url:r.url,name:ranked.find(v=>v.url===r.url).name,
    recent7d:r.recent7d,previous7d:r.previous7d,action:'investigate',requiresFounderReview:true};
 });
 if(x.revenue?.available!==false||x.revenue?.amount!==null)throw Error('Revenue cannot be claimed without verified source');
 return {source:GROWTH_SOURCE,sourceType:'public-aggregate',available:true,
   fetchedAt:new Date().toISOString(),generatedAt:x.generatedAt,periodDays:30,
   daily,comparison:{...Object.fromEntries(Object.keys(cmp).filter(k=>['recent7dCompletedActions','previous7dCompletedActions','recent7dPageViews','previous7dPageViews'].includes(k)).map(k=>[k,cmp[k]]))},
   ranked,toolPageViews,opportunities,revenue:{available:false,amount:null},
   caution:'Browser-reported actions are indicative; sessions are not unique humans. Review every opportunity before action.',
   readOnly:true};
}
export async function loadGrowthEvidence(fetchFn=fetch){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetchFn(GROWTH_SOURCE,{method:'GET',redirect:'error',
   signal:controller.signal,headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok||!(response.headers.get('content-type')||'').toLowerCase().includes('application/json'))
   throw Error('Growth report unavailable');
  if(Number(response.headers.get('content-length')||0)>64000)throw Error('Growth report exceeds bound');
  const text=await response.text();
  if(text.length>64000)throw Error('Growth report exceeds bound');
  return validateGrowth(JSON.parse(text));
 }finally{clearTimeout(timer);}
}
