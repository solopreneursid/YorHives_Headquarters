// Portable deterministic Products ranking. Attention proxies are not visitors or revenue.
const dayMs=86400000;
const stamp=x=>{const n=Date.parse(String(x||''));return Number.isFinite(n)?n:0;};
const sourceGroup=u=>/^https:\/\/github\.com\//i.test(u)?'github':/^https:\/\/news\.ycombinator\.com\//i.test(u)?'hn':/npmjs\.com/.test(u)?'npm':/addons\.mozilla\.org/.test(u)?'addons':'other';
function productId(u){
 let m=/^https:\/\/github\.com\/([a-z0-9_.-]+\/[a-z0-9_.-]+)(?:[/?#]|$)/i.exec(u);if(m)return 'gh:'+m[1].toLowerCase();
 m=/^https:\/\/news\.ycombinator\.com\/item\?id=(\d+)/i.exec(u);if(m)return 'hn:'+m[1];
 m=/^https:\/\/www\.npmjs\.com\/package\/([^?#]+)/i.exec(u);if(m)return 'npm:'+decodeURIComponent(m[1]).replace(/\/$/,'');
 m=/^https:\/\/addons\.mozilla\.org\/[^?#]*\/addon\/([a-z0-9_-]+)/i.exec(u);return m?'firefox:'+m[1]:null;
}
function businessIdea(title){
 const s=String(title||'').toLowerCase();
 if(/emulator|crack|piracy|paywall bypass/.test(s))return 'Check intellectual-property and misuse risks before any original alternative.';
 if(/pdf|document|file|ocr|converter/.test(s))return 'Test a private no-login tool; explore paid bulk/offline team workflows.';
 if(/agent|workflow|automation|assistant|skill|model|browser/.test(s))return 'Test one simpler, model-neutral local-first workflow and paid setup/support.';
 if(/monitor|security|backup|analytic|server/.test(s))return 'Explore a self-hosted, auditable tool and optional paid support.';
 if(/image|design|video|pixel/.test(s))return 'Explore a niche private editor with paid batch/export features.';
 return 'Interview users, build one differentiated self-hostable feature, and validate support revenue.';
}
export function rankProducts(rows,signals,now=Date.now()){
 const measurements=new Map();
 for(const v of signals||[]){
  if(!/^20\d\d-\d\d-\d\d$/.test(String(v.observed_day))||!['github_stars','hn_points','firefox_daily_users','npm_downloads_7d'].includes(v.metric)||!Number.isSafeInteger(Number(v.value))||Number(v.value)<0)continue;
  const key=v.product_id+'|'+v.metric;
  if(!measurements.has(key))measurements.set(key,new Map());
  measurements.get(key).set(v.observed_day,Number(v.value));
 }
 const rowsOut=[];
 for(const x of rows||[]){
  if(!x?.source_url||!stamp(x.observed_at))continue;
  const id=productId(x.source_url);let best=[],metric=null;
  for(const m of ['github_stars','hn_points','firefox_daily_users','npm_downloads_7d']){
   const a=[...(measurements.get(id+'|'+m)?.entries()||[])].sort((a,b)=>a[0].localeCompare(b[0]));
   if(a.length>best.length){best=a;metric=m}
  }
  const n=best.length,days=n>=2?(stamp(best[n-1][0])-stamp(best[0][0]))/dayMs:0;
  const delta=days>0?best[n-1][1]-best[0][1]:null;
  const upSteps=best.reduce((sum,entry,i)=>sum+(i>0&&entry[1]>best[i-1][1]?1:0),0);
  const rate=days>0?delta/days:0,pctPerDay=days>0?100*delta/Math.max(1,best[0][1])/days:0;
  const cutoff={github_stars:[10,3],hn_points:[12,20],firefox_daily_users:[25,5],npm_downloads_7d:[200,20]};
  const min=cutoff[metric]||[Infinity,Infinity];
  let grade='listing-only',score=20,action='Listing · growth unverified';
  if(n){grade='one-snapshot';score=32;action='Popular · growth unverified'}
  if(delta!==null){grade=delta>0?'early-growth':'flat-or-down';score=delta>0?49:24;action=delta>0?'Early growth · needs confirmation':'Flat or declining · monitor'}
  if(n>=3&&days>=2&&delta>0&&upSteps>=2&&rate>=min[0]&&pctPerDay>=min[1]){grade='multi-day-growth';score=68;action='Repeated multi-day growth · investigate'}
  if(/agent|workflow|automation|pdf|document|monitor|privacy|self.?host|browser|converter|tool/i.test(x.title||''))score+=7;
  if(now-stamp(x.observed_at)>7*dayMs)score-=7;
  const evidence=n?(n+' dated '+metric+' sample(s); '+(delta===null?'growth not yet measurable.':('change '+(delta>=0?'+':'')+delta+' in '+days.toFixed(1)+' days.'))):'No repeated popularity measurements.';
  rowsOut.push({id:x.id,title:x.title,signal:evidence+' '+String(x.description||''),opportunity:'INVESTIGATE: '+businessIdea(x.title),
   evidenceUrl:x.source_url,score:Math.max(0,Math.min(85,score)),kind:x.kind,observedAt:x.observed_at,
   action,evidenceGrade:grade,samples:n,sourceFamily:sourceGroup(x.source_url),trafficVerified:false,revenueVerified:false});
 }
 rowsOut.sort((a,b)=>b.score-a.score||stamp(b.observedAt)-stamp(a.observedAt));
 const max={github:16,hn:7,npm:5,addons:5,other:8},seen=new Set(),familyCounts=new Map(),out=[];
 function accept(x,strict){
  if(seen.has(x.evidenceUrl)||strict&&(familyCounts.get(x.sourceFamily)||0)>=(max[x.sourceFamily]||8))return;
  out.push(x);seen.add(x.evidenceUrl);familyCounts.set(x.sourceFamily,(familyCounts.get(x.sourceFamily)||0)+1);
 }
 for(const x of rowsOut){if(out.length>=30)break;accept(x,true)}
 for(const x of rowsOut){if(out.length>=30)break;accept(x,false)}
 return out;
}
