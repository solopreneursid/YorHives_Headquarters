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
// Build cost and monetization are hypotheses, never reported business results.
function businessAssessment(title){
 const s=String(title||'').toLowerCase();
 if(/(?:^|[ /-])(?:sdk|awesome|curated list|example projects|tutorial|boilerplate)(?:$|[ /-])|alibabacloud.*sdk/.test(s))
  return {fit:'reference',audience:'Developers researching building blocks',mvp:'Treat as implementation reference, not a standalone customer product.',revenueTest:'Find an actual workflow and paying buyer first.',effort:'not estimated'};
 if(/job|career|resume|cv match|recruit|interview|\bats\b/.test(s))
  return {fit:'existing-product',audience:'Job seekers using GovRadar',mvp:'Offer a private job-to-CV fit checklist and saved application workflow.',revenueTest:'Ask GovRadar users about paid tailored exports before building.',effort:'medium'};
 if(/pdf|ocr|converter|file handling|file transfer|file manager/.test(s))
  return {fit:'existing-tools',audience:'Visitors using YorpHives Free Tools',mvp:'Test one private, no-login document task with accessible bulk actions.',revenueTest:'Validate demand for paid batch/offline team workflows.',effort:'low-to-medium'};
 if(/meeting|transcrib|minutes|note.?tak/.test(s))
  return {fit:'new-market',audience:'People needing private meeting notes',mvp:'Test a local-first, consent-aware meeting summary workflow.',revenueTest:'Validate paid exports and transcription operating costs.',effort:'high'};
 if(/agent|workflow|automat|assistant|browser|agent memory/.test(s))
  return {fit:'new-market',audience:'Teams with repeatable manual workflows',mvp:'Test one narrow model-neutral, self-hostable assistant task.',revenueTest:'Validate a paid setup/support pilot with real users.',effort:'high'};
 if(/document|file/.test(s))
  return {fit:'existing-tools',audience:'Visitors using YorpHives Free Tools',mvp:'Test one private, no-login document task with accessible bulk actions.',revenueTest:'Validate demand for paid batch/offline team workflows.',effort:'low-to-medium'};
 if(/server|deploy|monitor|secur|backup|analytic/.test(s))
  return {fit:'new-market',audience:'Self-hosted operators',mvp:'Test one narrow audit/health dashboard with secure defaults.',revenueTest:'Validate paid deployment support rather than assuming SaaS demand.',effort:'high'};
 if(/image|photo|design|video|pixel/.test(s))
  return {fit:'new-market',audience:'Creators needing repeatable edits',mvp:'Test a niche private editor with batch/export support.',revenueTest:'Price paid exports only after measuring compute costs.',effort:'medium-to-high'};
 return {fit:'unclassified',audience:'Customer segment not yet verified',mvp:businessIdea(title),revenueTest:'Interview prospective users before proposing a paid tier.',effort:'unassessed'};
}
export function rankProducts(rows,signals,now=Date.now()){
 const measurements=new Map();
 for(const v of signals||[]){
  if(!/^20\d\d-\d\d-\d\d$/.test(String(v.observed_day))||!['github_stars','hn_points','firefox_daily_users','npm_downloads_7d'].includes(v.metric)||!Number.isSafeInteger(Number(v.value))||Number(v.value)<0)continue;
  const key=v.product_id+'|'+v.metric;
  if(!measurements.has(key))measurements.set(key,new Map());
  measurements.get(key).set(v.observed_day,Number(v.value));
 }
 // A Hacker News discussion ID must refer to one launch. Exclude inconsistent
 // historical labels rather than attributing another product's points to a title.
 const hnTitles=new Map(),conflictingHnUrls=new Set();
 for(const x of rows||[]){
  const u=String(x?.source_url||'');
  if(!/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/.test(u))continue;
  const title=String(x.title||'').trim().replace(/\s+/g,' ').toLowerCase();
  if(!title)continue;
  if(hnTitles.has(u)&&hnTitles.get(u)!==title)conflictingHnUrls.add(u);
  else if(!hnTitles.has(u))hnTitles.set(u,title);
 }
 const rowsOut=[];
 for(const x of rows||[]){
  if(!x?.source_url||conflictingHnUrls.has(x.source_url)||!stamp(x.observed_at))continue;
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
  const meaningful=delta!==null&&delta>0&&rate>=min[0]&&pctPerDay>=min[1];
  const assessment=businessAssessment(x.title);
  let grade='listing-only',score=20,action='Listing · growth unverified';
  if(n){grade='one-snapshot';score=32;action='Popular · growth unverified'}
  if(delta!==null){grade=delta>0?'early-growth':'flat-or-down';score=delta>0?(meaningful?49:34):24;action=delta>0?(meaningful?'Early growth · needs confirmation':'Small movement · growth unverified'):'Flat or declining · monitor'}
  if(n>=3&&days>=2&&delta>0&&upSteps>=2&&rate>=min[0]&&pctPerDay>=min[1]){grade='multi-day-growth';score=68;action='Repeated multi-day growth · investigate'}
  if(/agent|workflow|automation|pdf|document|monitor|privacy|self.?host|browser|converter|tool|job|career|resume/i.test(x.title||''))score+=7;
  if(['existing-product','existing-tools'].includes(assessment.fit))score+=4;
  if(assessment.fit==='reference'){score-=25;action='Technical reference · not a product launch';}
  if(now-stamp(x.observed_at)>7*dayMs)score-=7;
  const evidence=n?(n+' dated '+metric+' sample(s); '+(delta===null?'growth not yet measurable.':('change '+(delta>=0?'+':'')+delta+' in '+days.toFixed(1)+' days.'))):'No repeated popularity measurements.';
  rowsOut.push({id:x.id,title:x.title,signal:evidence+' '+String(x.description||''),opportunity:'INVESTIGATE: '+assessment.mvp+' '+assessment.revenueTest,
   evidenceUrl:x.source_url,score:Math.max(0,Math.min(85,score)),kind:x.kind,observedAt:x.observed_at,
   action,evidenceGrade:grade,samples:n,sourceFamily:sourceGroup(x.source_url),
   commercialFit:assessment.fit,customerHypothesis:assessment.audience,buildEffortHypothesis:assessment.effort,
   nextValidation:'Verify user demand, competitor differentiation, source code/license rights and operating costs.',
   trafficVerified:false,revenueVerified:false,buyerDemandVerified:false,licenseVerified:false});
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
