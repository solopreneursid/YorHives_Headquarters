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
export function buildRevenueIntelligence({growth=null,externalRows=[],now=new Date().toISOString()}={}){
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
 const seen=new Set();
 const marketSignals=(Array.isArray(externalRows)?externalRows:[]).filter(x=>x&&x.kind==='revenue-trend').map(x=>{
  const url=safeLink(x.source_url),title=text(x.title,120),date=Date.parse(String(x.observed_at||''));
  if(!url||!title||!Number.isFinite(date))return null;
  const key=url+'|'+title.toLowerCase();if(seen.has(key))return null;seen.add(key);
  return {title,sourceUrl:url,observedAt:new Date(date).toISOString(),summary:text(x.description,300),
   nextAction:text(x.recommendation,350),classification:'Third-party reported claim · not independently verified',
   yorphivesRevenue:false,trafficVerified:false,profitVerified:false};
 }).filter(Boolean).sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).slice(0,8);
 return {schemaVersion:1,readOnly:true,generatedAt:Number.isFinite(Date.parse(now))?new Date(now).toISOString():new Date().toISOString(),
  verifiedEarnings:{available:false,amount:null,currency:null,reason:'No authenticated YorpHives payout, sales or accounting data connected. Unknown is not zero.'},
  constraints:{advertisingScope:'Free Tools only',adFreeAreas:['Home','HQventures','HQconnect','YorpHivesHQ'],
   freeToolsRemainFree:true,hqventuresOnlyFounderApprovedProducts:true,supportButton:'remains disabled',
   noAutomaticPublishing:true,noAutomaticMonetization:true,noPurchases:true},
  activity,opportunities,marketSignals,
  disclaimer:'Opportunity cards and third-party claims are research hypotheses, not verified YorpHives earnings, customer demand or projections.'};
}
