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
/** First-party browser-reported signals, not AdSense, Search Console or visitors.
 * No modeled RPM, earnings, invented impressions or user-identifying telemetry.
 * Null means not connected, never 0.
 */
export function freeToolsRevenueReadiness(growth,{now=new Date().toISOString()}={}){
 const base={schemaVersion:1,readOnly:true,source:'https://yorphives.com/api/insights/growth',
  measurement:'first-party aggregate browser events; not independently verified people or advertising',
  available:false,status:'not-connected',observedAt:null,
  pageViews7d:null,previousPageViews7d:null,sitewidePageViews:true,
  completedActions7d:null,previousCompletedActions7d:null,
  topToolActions:[],topToolPageViews:[],uniqueVisitors:null,adImpressions:null,adSenseEarnings:null,
  currency:null,adsApproved:null,recommendations:[],
  disclaimer:'Pageviews are sitewide browser-reported events, not unique visitors, free-tool-only traffic, ad impressions or income.'};
 if(growth?.available!==true||growth.source!==base.source||!Array.isArray(growth.ranked)||
    !Number.isFinite(Date.parse(growth.generatedAt||''))||!Number.isFinite(Date.parse(now)))return {
  ...base,recommendations:[{priority:'important',title:'Confirm first-party activity feed',
   nextAction:'Check read-only public growth endpoint availability; do not infer visitors or ad earnings from missing data.'}]};
 const c=growth.comparison||{};
 if(!['recent7dPageViews','previous7dPageViews','recent7dCompletedActions','previous7dCompletedActions']
   .every(k=>validCount(c[k])))return {...base,status:'invalid-data'};
 const timestamp=Date.parse(growth.generatedAt),age=Date.parse(now)-timestamp;
 if(age < -300000||age > 36*3600000)return {...base,status:'stale',observedAt:growth.generatedAt,
  recommendations:[{priority:'important',title:'Refresh traffic evidence',
    nextAction:'Investigate why aggregate browser activity is stale before interpreting search or revenue performance.'}]};
 const tools=growth.ranked.filter(x=>/^tools\/[a-z0-9-]+\/$/.test(String(x.url||''))&&
    validCount(x.completedActions7d)&&validCount(x.previous7d))
  .sort((a,b)=>b.completedActions7d-a.completedActions7d).slice(0,5)
  .map(x=>({name:text(x.name,90),path:x.url,
   completedActions7d:x.completedActions7d,previousCompletedActions7d:x.previous7d}));
 const topToolPageViews=(Array.isArray(growth.toolPageViews)?growth.toolPageViews:[])
  .filter(x=>/^tools\/[a-z0-9-]+\/$/.test(String(x.url||''))&&validCount(x.pageViews7d)&&
    validCount(x.pageViews30d)&&validCount(x.previous7d))
  .sort((a,b)=>b.pageViews7d-a.pageViews7d).slice(0,5)
  .map(x=>({name:text(x.name,90),path:x.url,pageViews7d:x.pageViews7d,
    previousPageViews7d:x.previous7d}));
 const recommendations=[];
 if(topToolPageViews.length)recommendations.push({priority:'improvement',
   title:'Review Free Tools with observed page demand',
   evidence:'Per-tool browser pageview events show some activity; these are not verified visitors, ad impressions, or conversions.',
   nextAction:'Prioritize usability, search metadata, and tool success checks on these pages using verified engagement evidence.'});
 if(c.recent7dCompletedActions===0)recommendations.push({
  priority:'important',title:'Verify Free Tools usage instrumentation',
  evidence:c.recent7dPageViews+' reported sitewide pageviews and no recorded tool completions in the recent seven-day window.',
  nextAction:'Check a representative tool-completion event end-to-end and confirm privacy protections; do not infer zero tool use from missing completions.'});
 if(!tools.length)recommendations.push({
  priority:'improvement',title:'Wait for meaningful per-tool evidence',
  evidence:'The public aggregate feed contains no ranked Free Tools with recorded completions.',
  nextAction:'Continue uptime/SEO audits and collect genuine anonymous actions before prioritizing tools by demand.'});
 else recommendations.push({
  priority:'improvement',title:'Review tools with observed repeat usage',
  evidence:'The top-five list is based on browser-reported tool actions, not people, customer purchases or advertiser value.',
  nextAction:'Review real user experience and search intent for these tools before choosing editorial improvements.'});
 recommendations.push({
  priority:'approval-gated',title:'Keep AdSense optimization in research mode',
  evidence:'Verified earnings, advertiser impressions, publisher approval and consent state are not connected to this feed.',
  nextAction:'After AdSense Ready and privacy/consent verification, connect aggregate reporting before testing any Free Tools-only ad placements.'});
 return {...base,available:true,status:'browser-reported-only',observedAt:growth.generatedAt,
  pageViews7d:c.recent7dPageViews,previousPageViews7d:c.previous7dPageViews,
  completedActions7d:c.recent7dCompletedActions,
  previousCompletedActions7d:c.previous7dCompletedActions,
  topToolActions:tools,topToolPageViews,recommendations};
}

function revenueFit(title){
 const s=String(title||'').toLowerCase();
 if(/\b(job|career|resume|cv|recruit|interview)\b/.test(s))return {lane:'HQventures · research',category:'govradar',audience:'GovRadar jobseekers',effort:'medium',next:'Verify repeat GovRadar use and interview jobseekers about one useful paid application workflow.',risk:'Candidate privacy, job-source rights and ongoing data accuracy.'};
 if(/(?:(?:\bai\b|\bgenerative\b|\bcredits\b).*(?:\bimage\b|\bphoto\b)|(?:\bimage\b|\bphoto\b).*(?:\bai\b|\bgenerative\b|\bcredits\b))/.test(s))return {lane:'HQventures · research',category:'hqventures',audience:'Buyers of a privacy-focused creative AI product',effort:'high',next:'Check paying demand for a narrowly differentiated image workflow, compare existing free tools, and independently estimate model inference cost before proposing any credits or subscriptions.',risk:'AI compute costs, image rights, privacy, market competition, paid unit economics and customer acquisition are not validated.'};
 if(/\b(pdf|image|photo|file|convert|compress|browser|tool|extension|document)\b/.test(s))return {lane:'Free Tools · research',category:'free-tools',audience:'People using a private no-login tool',effort:'low-to-medium',next:'Check real usage of related Free Tools, improve the free workflow and only consider ads with eligible traffic.',risk:'Do not paywall Free Tools or reduce usability with ads.'};
 if(/\b(agent|automation|workflow|saas|ai|startup|mobile|app|business|software|marketing|creator|newsletter|subscription|product)\b/.test(s))return {lane:'HQventures · research',category:'hqventures',audience:'Potential buyers for a narrow tool or app',effort:'high',next:'Verify buyer pain, competition, legal rights and operating cost; propose a founder-approved one-feature pilot only after validation.',risk:'Support, model cost, security, maintenance and price acceptance unverified.'};
 return {lane:'Market watch',category:'unclassified',audience:'Unverified',effort:'unassessed',next:'Identify an actual buyer and relevance to YorpHives before treating this as an opportunity.',risk:'Unvalidated business fit and costs.'};
}
// Evidence-backed program pages are reference opportunities, not program approval,
// current terms, affiliate commissions, traffic, or YorpHives earnings.
const programCandidates=Object.freeze([
 {id:'namecheap-official-affiliate',title:'Evaluate Namecheap domain affiliate program',
  channel:'Affiliate · optional editorial',programType:'affiliate',sourceUrl:'https://www.namecheap.com/affiliates/',
  priorityScore:51,evidence:'The provider publishes an official affiliate program page. YorpHives is not enrolled; traffic, regional eligibility, terms and expected commissions are unverified.',
  nextAction:'Confirm that Free Tools visitors have genuine domain-purchase intent; review current program terms and disclosure requirements before a founder-approved application.',
  risk:'Sales depend on an appropriate audience. No implied affiliate endorsement, tracked referrals or current payout entitlement.'},
 {id:'digitalocean-official-affiliate',title:'Evaluate DigitalOcean infrastructure affiliate program',
  channel:'Affiliate · optional editorial',programType:'affiliate',sourceUrl:'https://www.digitalocean.com/affiliates',
  priorityScore:47,evidence:'The provider publishes an official affiliate page. This is a program to evaluate, not a YorpHives partnership or verified commission.',
  nextAction:'Verify whether developer-oriented visitors actually want hosting guidance, current referral terms and regional availability before any voluntary referral test.',
  risk:'Never introduce a hosting vendor as a dependency of YorpHives. Referral demand, approval and money remain unverified.'},
 {id:'cloudflare-official-powerup',title:'Evaluate Cloudflare PowerUP service-partner fit',
  channel:'Partnership · research',programType:'partnership',sourceUrl:'https://www.cloudflare.com/partners/power-up-program/',
  priorityScore:43,evidence:'Cloudflare publishes a partner program for services and customer referrals. This does not establish YorpHives eligibility or referral compensation.',
  nextAction:'Review actual partner qualifications and whether YorpHives can deliver meaningful customer services. Founder decides whether to apply.',
  risk:'No confirmed referral fee, approval, partner status, or committed customer volume.'}
]);
function rankedPrograms(){
 return programCandidates.map(x=>({...x,rank:null,method:'Research existing official published program',
  stage:'Published program page · application unverified',evidenceStatus:'First-party program page; no YorpHives enrollment',
  buildEffortHypothesis:'review only',buyerDemandVerified:false,trafficVerified:false,revenueVerified:false,
  approvalRequired:true,autoExecute:false}));
}


// Verified FIRST-PARTY procurement portals: these are search channels, NOT confirmed open bids.
const officialGovernmentPortals=Object.freeze([
 {id:'central-procurement-india',title:'Find central-government software and digital-service tenders',
  channel:'Government contracts · India',priorityScore:39,sourceUrl:'https://eprocure.gov.in/eprocure/app',
  whoMightPay:'Indian ministries, central public institutions and other eligible government buyers — specific buyer not yet identified.',
  whyPay:'Government entities publish competitive procurements for software, systems and services; the presence of a portal does not mean YorpHives is eligible.',
  nextAction:'Search the official portal for software, web application, digital documents or automation tenders; record bid reference, buyer, scope, deadline, bidder qualifications, EMD/fees and corrigenda before considering a bid.',
  evidence:'Official Indian government eProcurement search portal. This is a discovery channel, not an individually verified tender or award.',
  risk:'Experience, turnover, certificates, eligibility, bidder registration, digital signature, tax obligations, project delivery and contract conditions may disqualify a sole founder.'},
 {id:'jharkhand-procurement',title:'Explore Jharkhand government IT and automation projects',
  channel:'Government contracts · Jharkhand',priorityScore:37,sourceUrl:'https://jharkhandtenders.gov.in/nicgep/app',
  whoMightPay:'Jharkhand departments, boards and state institutions with issued tenders — issuing body to be verified.',
  whyPay:'State procurement can commission websites, records digitization, software operations and similar services, but individual notices must be checked.',
  nextAction:'Search the official Jharkhand portal for relevant current IT tenders; check the exact tender ID, closing date, specifications, local eligibility, DSC, fees, and past-experience conditions.',
  evidence:'Official Government of Jharkhand eProcurement portal. No particular award, contract value or active tender is asserted.',
  risk:'State-specific conditions, qualifications, guarantee/EMD and execution scope are unknown until the tender documents are read.'},
 {id:'gem-government-marketplace',title:'Investigate GeM software and IT service bids',
  channel:'Government contracts · GeM',priorityScore:35,sourceUrl:'https://bidplus.gem.gov.in/all-bids',
  whoMightPay:'Public-sector GeM buyers seeking eligible goods or services — individual buyer not yet selected.',
  whyPay:'The government marketplace publishes bids for services and products; the existence of listings is not evidence of a suitable active opportunity.',
  nextAction:'Search GeM for software development, websites, cloud-adjacent services and digitization; independently verify bid ID, deadline, GeM seller eligibility, categories, taxes and contract terms.',
  evidence:'Official GeM bid listing. Access may require an interactive browser; HQ does not bypass restricted collection.',
  risk:'Seller onboarding, category restrictions, bid eligibility, service delivery and financial guarantees may apply.'}
]);
function governmentPortalCards(){
 return officialGovernmentPortals.map(x=>({...x,method:'Review official public procurement and assess bid feasibility',
  stage:'Official portal · specific tender not yet verified',evidenceStatus:'First-party portal, no verified live project',
  buildEffortHypothesis:'TBD after tender document',buyerDemandVerified:false,trafficVerified:false,revenueVerified:false,
  approvalRequired:true,autoExecute:false}));
}
function closingTime(description){
 const m=String(description||'').match(/Bid closing:\s*(20\d\d-\d\d-\d\d)\s+([0-2]\d:[0-5]\d)\s+IST/i);
 if(!m)return null;const n=Date.parse(m[1]+'T'+m[2]+':00+05:30');return Number.isFinite(n)?{ms:n,local:m[1]+' '+m[2]+' IST'}:null;
}
function explainOpportunity(o){
 let who=o.whoMightPay,why=o.whyPay;
 const kind=String(o.id||'')+' '+String(o.channel||'');
 if(!who){
  if(/government|tender/i.test(kind)){who='Issuing public buyer in the official notice — exact buyer unverified.';
   why='Government service procurement may pay for the work specified in the tender, only through an eligible competitive award.';}
  else if(/affiliate/i.test(kind)){who='Affiliate program operator, only after approval and attributable qualifying referrals.';
   why='An approved affiliate program may pay a commission for eligible conversions; no conversion or payout has occurred.';}
  else if(/partner/i.test(kind)){who='A potential commercial partner, once mutual deliverables and payment terms are agreed.';
   why='Distribution, referrals or software services may have commercial value, but no agreement or fees are verified.';}
  else if(/sponsor|advertis|adsense/i.test(kind)){who='Qualified advertisers or sponsor brands reaching the relevant Free Tools audience.';
   why='Advertising placement may be valuable if verified eligible visits and publisher rules support it.';}
  else if(/client/i.test(kind)){who='Potential client described in the original public request — budget and intent unverified.';
   why='The requester may need a paid software, document or automation service, if the work and terms can be confirmed.';}
  else if(/free tools/i.test(kind)){who='Relevant advertisers, not existing Free Tools users.';
   why='Advertising may support free access only with verified audience and publisher permission.';}
  else{who='Potential paying users of the founder-approved product — demand unverified.';
   why='Solving a specific repeat problem may justify a paid product if independent buyer validation succeeds.';}
 }
 return {...o,whoMightPay:who,whyPay:why,
  nextAction:o.nextAction||o.nextValidation||'Review the original source and independently validate the opportunity before any founder decision.'};
}

function normalizeMarket(rows,now){
 const nowMs=Date.parse(now)||Date.now(),out=[],seen=new Set();
 for(const x of (Array.isArray(rows)?rows:[])){
  if(!x||!['revenue-trend','revenue-research','revenue-client','revenue-affiliate','revenue-partnership','revenue-sponsorship','revenue-government'].includes(x.kind))continue;
  const link=safeLink(x.source_url),title=text(x.title,120),at=Date.parse(String(x.observed_at||''));
  if(!link||!title||!Number.isFinite(at)||at>nowMs+300000||(nowMs-at)>120*86400000)continue;
  const key=link+'|'+title.toLowerCase();if(seen.has(key))continue;seen.add(key);
  const government=x.kind==='revenue-government';
  const expiry=government?closingTime(x.description):null;
  if(government&&(!expiry||expiry.ms<=nowMs||expiry.ms>nowMs+90*86400000||
   !['https://eprocure.gov.in/eprocure/app','https://jharkhandtenders.gov.in/nicgep/app'].includes(link)))continue;
  const fit=revenueFit(title),reported=x.kind==='revenue-trend';
  const channel=x.kind.slice('revenue-'.length);
  const profile=channel==='government'?{sourceType:'official-tender-listing',channel:'Government project · verify eligibility',
    next:'Search the exact tender reference on the original official portal. Check buyer, scope, closing time '+(expiry?.local||'')+', bidder enrollment/DSC, financial/experience criteria, EMD, taxes and corrigenda before proposing a bid.',
    risk:'A tender listing does NOT establish qualification, contract value, win probability, ability to deliver or awarded revenue.',
    category:'government',effort:'scope and eligibility unknown'}:
   channel==='client'?{sourceType:'public-client-intent',channel:'Potential client · unqualified',
    next:'Open the original request and verify paid project intent, scope, budget, freshness and fit before any founder-approved response.',
    risk:'No signed client, payment, active request or permission to solicit is verified.',category:'client',effort:'unassessed'}:
   channel==='partnership'?{sourceType:'community-partner-mention',channel:'Partnership · investigation',
    next:'Verify the organization, actual commercial collaboration terms and mutual audience relevance. Founder approves contact.',
    risk:'No partner agreement, compensation or active opening is verified.',category:'partnership',effort:'unassessed'}:
   channel==='affiliate'?{sourceType:'community-affiliate-mention',channel:'Affiliate · investigation',
    next:'Check the program first-party link and eligibility; community mentions are not offers or guaranteed commissions.',
    risk:'No confirmed program acceptance, payout or buyers.',category:'affiliate',effort:'unassessed'}:
   channel==='sponsorship'?{sourceType:'community-sponsorship-mention',channel:'Sponsorship · investigation',
    next:'Verify sponsor budget, category, site reach and advertisement suitability before discussing a placement.',
    risk:'No sponsor contract, advertiser or qualified audience confirmed.',category:'sponsorship',effort:'unassessed'}:null;
  const priority=Math.max(0,Math.min(85,Math.min(80,Math.max(10,Math.floor(Number(x.score)||20)))+
    (fit.category==='unclassified'&&!profile?-15:0)-(nowMs-at>30*86400000?10:0)));
  out.push({title,sourceUrl:link,observedAt:new Date(at).toISOString(),summary:text(x.description,300),
   nextAction:text(x.recommendation,350),classification:reported?'Third-party reported claim · not independently verified':
    profile?profile.sourceType==='public-client-intent'?'Public client request signal · NOT a qualified lead':
    'Public commercial mention · offer/terms unverified':'Public discussion or maker statement · earnings unverified',
   sourceType:reported?'reported-claim':profile?profile.sourceType:'public-discussion',
   bidDeadline:government?expiry.local:null,
   audienceHypothesis:profile?.sourceType==='public-client-intent'?'Possible buyer requesting a service, unverified':fit.audience,
   category:profile?.category||fit.category,relevanceScore:priority,effortHypothesis:profile?.effort||fit.effort,
   nextValidation:profile?.next||fit.next,risk:profile?.risk||fit.risk,channel:profile?.channel||fit.lane,
   yorphivesRevenue:false,trafficVerified:false,profitVerified:false,buyerDemandVerified:false});
 }
 return out.sort((a,b)=>b.relevanceScore-a.relevanceScore||b.observedAt.localeCompare(a.observedAt)).slice(0,40);
}
function revenueSourceHealth(rows){
 const specs=[
  ['revenue_research_gov_cppp','India · official central eProcurement'],
  ['revenue_research_hn_affiliates','Hacker News · affiliate mentions'],
  ['revenue_research_hn_sponsors','Hacker News · sponsorship mentions'],
  ['revenue_research_hn_mrr','Hacker News · maker revenue'],
  ['revenue_research_hn_clients','Hacker News · potential public client requests'],
  ['revenue_research_makers','IndieMakerList · maker feed'],
  ['revenue_research_hn_partners','Hacker News · partnership mentions'],
  ['revenue_research_hn_pricing','Hacker News · pricing'],
  ['revenue_research_gov_jharkhand','Jharkhand · official state eProcurement']];
 const byKey=new Map((Array.isArray(rows)?rows:[]).map(x=>[x.key,x]));
 return specs.map(([id,name])=>{
  const r=byKey.get(id),status=String(r?.value||'not-yet-checked');
  const leads=Number(status.match(/^ok:(\d+)/)?.[1]||0);
  const empty=status.startsWith('empty-public-evidence:')||status.startsWith('empty-public-listing:');
  const blocked=status.startsWith('unavailable:');
  const state=blocked?'source-unavailable':empty?'checked-no-match':status.startsWith('ok:')?'leads-found':'not-yet-checked';
  return {name,status,checkedAt:r?.checked_at||null,available:empty||state==='leads-found',
   state,qualifyingLeads:state==='leads-found'?leads:0,
   note:blocked?'Source unavailable or restricted; no access bypassed.':
    empty?'Source checked successfully but no matching qualified leads found.':
    state==='not-yet-checked'?'Scheduled scan not recorded yet.':
    'Public attention is not proof of company revenue or confirmed contracts.'};
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
   sourceUrl:'https://yorphives.com/free-tools/',approvalRequired:true,autoExecute:false},
  {id:'client-service-validation',channel:'Paid services · possible clients',title:'Look for customers needing small automation or document tools',
   method:'Founder-approved service project, proposal or custom product',
   stage:'Awaiting verified public prospects',evidenceStatus:'No signed clients or confirmed budgets',
   evidence:'HQ searches public requests that mention development, automation, dashboards and document workflows. A public request is not an identified paying client.',
   nextAction:'Review source-backed requests for real budget and scope. Offer services only after founder approval; never send unsolicited messages automatically.',
   risk:'Scams, scope creep, delivery capacity, data privacy and invoices; no clients yet.',
   sourceUrl:'https://news.ycombinator.com/',approvalRequired:true,autoExecute:false}
 ];
 const marketSignals=normalizeMarket([...(Array.isArray(externalRows)?externalRows:[]),...(Array.isArray(researchRows)?researchRows:[])],now);
 const filtered=[],byCategory=new Map(),byType=new Map();
 for(const lead of marketSignals){
  // Source-reported revenue stays in Market Intelligence; never auto-promote a claim to an investment priority.
  if(!['official-tender-listing','public-discussion','public-client-intent','community-partner-mention','community-sponsorship-mention'].includes(lead.sourceType)||lead.category==='unclassified'||(byCategory.get(lead.category)||0)>=(lead.category==='government'?2:3)||
     (byType.get(lead.sourceType)||0)>=5)continue;
  filtered.push({id:'revenue-lead-'+filtered.length+'-'+lead.sourceUrl.slice(-18),
   channel:lead.channel,title:'Investigate: '+lead.title,stage:'Founder research',
   method:'Research one narrow buyer problem before deciding on monetization',
   evidenceStatus:lead.classification,evidence:lead.summary,nextAction:lead.nextValidation,
   risk:lead.risk,sourceUrl:lead.sourceUrl,observedAt:lead.observedAt,
   bidDeadline:lead.bidDeadline||null,
   priorityScore:lead.sourceType==='official-tender-listing'?Math.min(77,lead.relevanceScore+9):
    lead.sourceType==='public-client-intent'?Math.min(86,lead.relevanceScore+20):
    ['community-partner-mention','community-sponsorship-mention'].includes(lead.sourceType)?
      Math.min(69,lead.relevanceScore+12):lead.relevanceScore,
   buildEffortHypothesis:lead.effortHypothesis,buyerDemandVerified:false,trafficVerified:false,
   revenueVerified:false,approvalRequired:true,autoExecute:false});
  byCategory.set(lead.category,(byCategory.get(lead.category)||0)+1);
  byType.set(lead.sourceType,(byType.get(lead.sourceType)||0)+1);
  if(filtered.length>=7)break;
 }
 const ranked=[...opportunities.map((o,i)=>({...o,priorityScore:[70,62,46,54][i],
  buyerDemandVerified:false,trafficVerified:false,revenueVerified:false,
  buildEffortHypothesis:'unassessed'})),...rankedPrograms(),...governmentPortalCards(),...filtered]
  .sort((a,b)=>b.priorityScore-a.priorityScore).slice(0,10).map((x,i)=>explainOpportunity({...x,rank:i+1}));
 const sources=revenueSourceHealth(sourceStatuses);
 return {schemaVersion:1,readOnly:true,generatedAt:Number.isFinite(Date.parse(now))?new Date(now).toISOString():new Date().toISOString(),
  verifiedEarnings:{available:false,amount:null,currency:null,reason:'No authenticated YorpHives payout, sales or accounting data connected. Unknown is not zero.'},
  constraints:{advertisingScope:'Free Tools only',adFreeAreas:['Home','HQventures','HQconnect','YorpHivesHQ'],
   freeToolsRemainFree:true,hqventuresOnlyFounderApprovedProducts:true,supportButton:'remains disabled',
   noAutomaticPublishing:true,noAutomaticMonetization:true,noPurchases:true},
  activity,freeToolsReadiness:freeToolsRevenueReadiness(growth,{now}),opportunities:ranked,marketSignals:marketSignals.filter(x=>!filtered.some(f=>f.sourceUrl===x.sourceUrl&&f.title==='Investigate: '+x.title)).slice(0,10),sources,
  researchedOpportunities:filtered.length,sourceScansCompleted:sources.filter(x=>x.checkedAt!==null).length,
  disclaimer:'Opportunity cards and third-party claims are research hypotheses, not verified YorpHives earnings, customer demand or projections.'};
}
