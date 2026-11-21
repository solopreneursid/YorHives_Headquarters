/* YorpHivesHQ Revenue: evidence-led, portable, strictly read-only recommendations.
 * No checkout, AdSense configuration, publishing, external writes, paid APIs or agent actions.
 * Income is unknown unless connected to a verified payment/payout/ledger source.
 */
const safeLink=x=>{
 try{const u=new URL(String(x||''));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.href.length<=500?u.href:null}
 catch{return null}
};
const text=(x,max=360)=>String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const validDay=x=>typeof x==='string'&&/^20\d{2}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'));
const validCount=x=>Number.isSafeInteger(x)&&x>=0;
function growthEvidence(growth){
 if(growth?.available!==true||growth?.source!=='https://yorphives.com/api/insights/growth'||!Array.isArray(growth.ranked))
  return {available:false,status:'Not connected',note:'Verified per-tool visitors and ad impressions are unavailable. Do not estimate advertising earnings.',source:null};
 const tools=growth.ranked.filter(x=>String(x.url||'').startsWith('tools/')&&validCount(x.completedActions7d))
  .sort((a,b)=>b.completedActions7d-a.completedActions7d);
 const best=tools[0]||null;
 return {available:true,status:'Browser-reported activity only',
  note:'Browser-reported completions do not establish unique visitors, advertiser impressions, paying customers or revenue.',
  source:'https://yorphives.com/api/insights/growth',
  observedAt:validDay(String(growth.generatedAt||'').slice(0,10))?growth.generatedAt:null,
  topFreeTool:best?{name:text(best.name,100),path:best.url,completedActions7d:best.completedActions7d}:null};
}
function revenueFit(title){
 const s=String(title||'').toLowerCase();
 if(/\b(job|career|resume|cv|recruit|interview)\b/.test(s))return {lane:'HQventures · research',category:'govradar',audience:'GovRadar jobseekers',effort:'medium',next:'Verify repeat GovRadar use and interview jobseekers about one useful paid application workflow.',risk:'Candidate privacy, job-source rights and ongoing data accuracy.'};
 if(/\b(pdf|image|photo|file|convert|compress|browser|tool|extension|document)\b/.test(s))return {lane:'Free Tools · research',category:'free-tools',audience:'People using a private no-login tool',effort:'low-to-medium',next:'Check real usage of related Free Tools, improve the free workflow and only consider ads with eligible traffic.',risk:'Do not paywall Free Tools or reduce usability with ads.'};
 if(/\b(agent|automation|workflow|saas|ai|startup|mobile|app|business|software|marketing|creator|newsletter|subscription|product)\b/.test(s))return {lane:'HQventures · research',category:'hqventures',audience:'Potential buyers for a narrow tool or app',effort:'high',next:'Verify buyer pain, competition, legal rights and operating cost; propose a founder-approved one-feature pilot only after validation.',risk:'Support, model cost, security, maintenance and price acceptance unverified.'};
 return {lane:'Market watch',category:'unclassified',audience:'Unverified',effort:'unassessed',next:'Identify an actual buyer and relevance to YorpHives before treating this as an opportunity.',risk:'Unvalidated business fit and costs.'};
}
function normalizeMarket(rows,now){
 const nowMs=Date.parse(now)||Date.now(),out=[],seen=new Set();
 for(const x of (Array.isArray(rows)?rows:[])){
  if(!x||!['revenue-trend','revenue-research'].includes(x.kind))continue;
  const link=safeLink(x.source_url),title=text(x.title,120),at=Date.parse(String(x.observed_at||''));
  if(!link||!title||!Number.isFinite(at)||at>nowMs+300000||(nowMs-at)>120*86400000)continue;
  const key=link+'|'+title.toLowerCase();if(seen.has(key))continue;seen.add(key);
  const fit=revenueFit(title),reported=x.kind==='revenue-trend';
  const priority=Math.max(0,Math.min(85,Math.min(80,Math.max(10,Math.floor(Number(x.score)||20)))+
    (fit.category==='unclassified'?-15:0)-(nowMs-at>30*86400000?10:0)));
  out.push({title,sourceUrl:link,observedAt:new Date(at).toISOString(),summary:text(x.description,300),
   nextAction:text(x.recommendation,350),classification:reported?'Third-party reported claim · not independently verified':'Public discussion or maker statement · earnings unverified',
   sourceType:reported?'reported-claim':'public-discussion',audienceHypothesis:fit.audience,
   category:fit.category,relevanceScore:priority,effortHypothesis:fit.effort,
   nextValidation:fit.next,risk:fit.risk,channel:fit.lane,
   yorphivesRevenue:false,trafficVerified:false,profitVerified:false,buyerDemandVerified:false});
 }
 return out.sort((a,b)=>b.relevanceScore-a.relevanceScore||b.observedAt.localeCompare(a.observedAt)).slice(0,40);
}
function revenueSourceHealth(rows){
 const specs=[['revenue_research_hn_mrr','Hacker News · maker revenue'],['revenue_research_makers','IndieMakerList · maker feed'],['revenue_research_hn_pricing','Hacker News · pricing']];
 const byKey=new Map((Array.isArray(rows)?rows:[]).map(x=>[x.key,x]));
 return specs.map(([id,name])=>{const r=byKey.get(id),status=String(r?.value||'not-yet-checked');
  return {name,status,checkedAt:r?.checked_at||null,available:status.startsWith('ok:'),
   note:status.startsWith('unavailable:')?'Public source unavailable; no restrictions bypassed.':'Public attention is not proof of income.'};
 });
}
export function buildRevenueIntelligence({growth=null,externalRows=[],researchRows=[],sourceStatuses=[],now=new Date().toISOString()}={}){
 const activity=growthEvidence(growth);
 const opportunities=[
  {id:'hqventures-product-sales',rank:1,channel:'HQventures',title:'Validate a paid HQventures product',
   method:'Founder-approved product sales or premium features',
   stage:'Research first',evidenceStatus:'Customer demand and payments not verified',
   evidence:'HQventures is the product-sales business area. No payment ledger, verified orders, customers or conversion data is connected.',
   nextAction:'Select one founder-approved HQventures product; verify repeat usage and customer demand, then design a small paid test.',
   risk:'Hosting, support, payment processing, refunds, privacy and product maintenance require independent cost review.',
   sourceUrl:'https://yorphives.com/hqventures/',approvalRequired:true,autoExecute:false},
  {id:'free-tools-advertising',rank:2,channel:'Free Tools only',title:'Evaluate advertising on Free Tools',
   method:'Ads only after founder approval and publisher-policy clearance',
   stage:'Approval and traffic evidence needed',evidenceStatus:activity.available?activity.status:'Advertising income and site visitors not verified',
   evidence:activity.available?activity.note:'No verified ad impressions, AdSense approval, per-tool unique visitors or income connected.',
   nextAction:'Review genuine Free Tools page traffic and Google AdSense approval; test unobtrusive ad placements only on Free Tools after explicit founder approval.',
   risk:'Ad policy compliance, loading speed, user trust and the low-maintenance Free Tools requirement.',
   sourceUrl:'https://yorphives.com/free-tools/',approvalRequired:true,autoExecute:false},
  {id:'free-tools-sponsorship',rank:3,channel:'Free Tools only',title:'Research relevant tool sponsorship',
   method:'Clearly labeled, founder-approved sponsorship proposals',
   stage:'Buyer and audience evidence needed',evidenceStatus:'No sponsor contracts, attributable audience or confirmed sales',
   evidence:'The tool directory offers a potential niche placement, not proof that sponsors will pay.',
   nextAction:'Identify the highest-use Free Tools category, validate audience quality and request sponsor interest before proposing any placement.',
   risk:'Disclosure requirements, biased recommendations, user experience and contract fulfilment.',
   sourceUrl:'https://yorphives.com/free-tools/',approvalRequired:true,autoExecute:false}
 ];
 const marketSignals=normalizeMarket([...(Array.isArray(externalRows)?externalRows:[]),...(Array.isArray(researchRows)?researchRows:[])],now);
 const filtered=[],byCategory=new Map(),byType=new Map();
 for(const lead of marketSignals){
  if(lead.category==='unclassified'||(byCategory.get(lead.category)||0)>=3||
     (byType.get(lead.sourceType)||0)>=5)continue;
  filtered.push({id:'revenue-lead-'+filtered.length+'-'+lead.sourceUrl.slice(-18),
   channel:lead.channel,title:'Investigate: '+lead.title,stage:'Founder research',
   method:'Research one narrow buyer problem before deciding on monetization',
   evidenceStatus:lead.classification,evidence:lead.summary,nextAction:lead.nextValidation,
   risk:lead.risk,sourceUrl:lead.sourceUrl,observedAt:lead.observedAt,priorityScore:lead.relevanceScore,
   buildEffortHypothesis:lead.effortHypothesis,buyerDemandVerified:false,trafficVerified:false,
   revenueVerified:false,approvalRequired:true,autoExecute:false});
  byCategory.set(lead.category,(byCategory.get(lead.category)||0)+1);
  byType.set(lead.sourceType,(byType.get(lead.sourceType)||0)+1);
  if(filtered.length>=7)break;
 }
 const ranked=[...opportunities.map((o,i)=>({...o,priorityScore:[70,62,46][i],
  buyerDemandVerified:false,trafficVerified:false,revenueVerified:false,
  buildEffortHypothesis:'unassessed'})),...filtered]
  .sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,10).map((x,i)=>({...x,rank:i+1}));
 const sources=revenueSourceHealth(sourceStatuses);
 return {schemaVersion:1,readOnly:true,generatedAt:Number.isFinite(Date.parse(now))?new Date(now).toISOString():new Date().toISOString(),
  verifiedEarnings:{available:false,amount:null,currency:null,reason:'No authenticated YorpHives payout, sales or accounting data connected. Unknown is not zero.'},
  constraints:{advertisingScope:'Free Tools only',adFreeAreas:['Home','HQventures','HQconnect','YorpHivesHQ'],
   freeToolsRemainFree:true,hqventuresOnlyFounderApprovedProducts:true,supportButton:'remains disabled',
   noAutomaticPublishing:true,noAutomaticMonetization:true,noPurchases:true},
  activity,opportunities:ranked,marketSignals:marketSignals.slice(0,10),sources,
  researchedOpportunities:filtered.length,sourceScansCompleted:sources.filter(x=>x.checkedAt!==null).length,
  disclaimer:'Opportunity cards and third-party claims are research hypotheses, not verified YorpHives earnings, customer demand or projections.'};
}
