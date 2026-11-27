/**
 * Growth Intelligence candidate v1. Deterministic, project-independent research.
 * Pure functions: no network, filesystem, D1, mail, model, or mutation permissions.
 * Callers must supply previously collected, allowlisted public source evidence.
 */
export const PROJECTS=Object.freeze([
  {id:'yorphives',name:'YorpHives',stage:'active',
   audience:['Visitors seeking private browser tools','Independent makers'],
   keywords:['pdf','image','file','document','browser tool','privacy','converter','free tool'],
   productProfile:{offer:'Free browser-based utility workflows',value:'Help users complete routine file and document tasks with less friction.',
    integration:'Evaluate resource-directory inclusion, documentation references or compatible utility workflows.',
    partners:['Public software projects','Educational and resource directories','Relevant tool communities']}},
  {id:'globalgov',name:'globalGOV',stage:'research',
   audience:['Public-sector jobseekers','Students researching government careers'],
   keywords:['government job','public sector','jobseeker','recruitment','vacancy','civil service','career','exam','job'],
   productProfile:{offer:'Government employment discovery and career information',value:'Help jobseekers locate relevant public-sector opportunities.',
    integration:'Assess links from career resource pages, official-source references and educational guidance resources.',
    partners:['Educational institutions','Career resource publishers','Public-sector job information communities']}},
  {id:'taxpulse',name:'TaxPulse',stage:'research',
   audience:['Taxpayers seeking reliable calculations','Accountants and finance professionals'],
   keywords:['tax','income tax','taxpayer','statutory','filing','deduction','tax calculator','accountant'],
   productProfile:{offer:'Tax calculation and financial planning research',value:'Help taxpayers and finance professionals investigate calculation workflows.',
    integration:'Assess educational resource references, calculation verification and documented integration requirements.',
    partners:['Accounting educators','Finance resource publishers','Public financial software projects']}},
  {id:'hqventures',name:'HQventures',stage:'research',
   audience:['Organizations evaluating software workflows','Business process operators'],
   keywords:['workflow automation','business automation','business process','software development','workflow integration','enterprise software'],
   productProfile:{offer:'Founder-approved software product and service research',value:'Investigate software solutions for evidenced operational problems; delivery capability is not assumed.',
    integration:'Evaluate documented workflow requirements and feasibility before any founder-approved proposal.',
    partners:['Public software organizations','Businesses with documented workflow needs','Technology integration partners']}}
]);
export const SOURCE_HOSTS=Object.freeze([
  'news.ycombinator.com','hn.algolia.com','github.com','dev.to',
  'eprocure.gov.in','jharkhandtenders.gov.in','bidplus.gem.gov.in',
  'yorphives.com','www.yorphives.com','www.npmjs.com','pdfbox.apache.org','developer.usajobs.gov','openfisca.org','docs.n8n.io'
]);
const TYPE_ALLOW=new Set(['public-discussion','public-client-intent','official-tender-listing',
  'community-partner-mention','community-sponsorship-mention','public-repository',
  'public-demand-signal','first-party-aggregate','public-package','official-product-page']);
const STATE_ALLOW=new Set(['unreviewed','needs-evidence','approved-for-founder','rejected','founder-executed']);
const clean=(v,max=400)=>String(v??'')
  .replace(/<[^>]*>/g,' ').replace(/[^\S\n]+/g,' ')
  .replace(/[\u0000-\u001f\u007f]/g,' ')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-contact]')
  .trim().slice(0,max);
function safeLink(value){
 try {
  const u=new URL(String(value??''));
  if(u.protocol!=='https:'||u.username||u.password||u.port||!SOURCE_HOSTS.includes(u.hostname)||
     u.href.length>500)return null;
  u.hash='';
  for(const key of [...u.searchParams.keys()])
   if(/^utm_|^fbclid$|^gclid$/i.test(key))u.searchParams.delete(key);
  return u.href;
 }catch{return null}
}
function clock(value) {
 const ms=Date.parse(String(value??''));
 return Number.isFinite(ms)?ms:null;
}
function stableId(value){
 let n=2166136261;
 for(const ch of value)n=Math.imul(n^ch.charCodeAt(0),16777619);
 return (n>>>0).toString(36);
}
function tokenize(haystack,phrase){
 const escaped=phrase.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
 return new RegExp('(?:^|[^a-z0-9])'+escaped.replace(/\s+/g,'\\s+')+'(?:$|[^a-z0-9])','i').test(haystack);
}
export function configureProjects(projects=PROJECTS){
 if(!Array.isArray(projects)||projects.length===0||projects.length>50)
  throw new TypeError('Projects must be a nonempty bounded array');
 const seen=new Set();
 return projects.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[a-z][a-z0-9-]{1,39}$/.test(p.id)||seen.has(p.id)||
     typeof p.name!=='string'||!p.name.trim()||p.name.length>100||
     !Array.isArray(p.audience)||p.audience.length<1||p.audience.length>12||
     !Array.isArray(p.keywords)||p.keywords.length<1||p.keywords.length>40)
   throw new TypeError('Invalid or duplicate project configuration');
  if([...p.audience,...p.keywords].some(v=>typeof v!=='string'||v.length<2||v.length>100||
     !/^[\p{L}\p{N} .&/-]+$/u.test(v)))throw new TypeError('Unsafe project metadata');
  const profile=p.productProfile;
  if(profile!==undefined&&(!profile||typeof profile!=='object'||!['offer','value','integration'].every(k=>typeof profile[k]==='string'&&profile[k].trim().length>0&&profile[k].length<=240)||!Array.isArray(profile.partners)||profile.partners.length<1||profile.partners.length>12||profile.partners.some(x=>typeof x!=='string'||!x.trim()||x.length>100)))throw new TypeError('Invalid product profile');
  seen.add(p.id);
  return {id:p.id,name:clean(p.name,100),stage:clean(p.stage||'research',24),
    audience:p.audience.map(x=>clean(x,100)),keywords:p.keywords.map(x=>x.toLowerCase()),
    productProfile:profile?{offer:clean(profile.offer,240),value:clean(profile.value,240),integration:clean(profile.integration,240),partners:profile.partners.map(x=>clean(x,100))}:null};
 });
}
export function assessBusinessFit(project,{sourceType,matchedKeywords=[]}={}){
 const profile=project.productProfile;
 const categories={'public-package':'software-integration','official-product-page':'documentation-research','public-repository':'software-integration','community-partner-mention':'partnership',
  'community-sponsorship-mention':'sponsorship','public-client-intent':'public-request',
  'official-tender-listing':'procurement-research','public-discussion':'community-research',
  'public-demand-signal':'audience-research','first-party-aggregate':'adoption-research'};
 const kind=categories[sourceType]||'unclassified';
 return {kind,productOffer:profile?.offer||null,valueHypothesis:profile?.value||null,
  integrationHypothesis:profile?.integration||null,possiblePartnerTypes:profile?.partners||[],
  supportingTopics:matchedKeywords.slice(0,8),
  qualification:'topic-match-only',organizationVerified:false,commercialIntentVerified:false,
  contactPermissionVerified:false,
  nextValidation:kind==='procurement-research'?'Verify official notice, deadline, procurement eligibility and scope; no outreach or bid by HQ.':
    'Verify the organization or community, its actual need, the product capability, and permitted communication or listing process.',
  handoff:'founder-research-review',autoExecute:false};
}
export function qualifyOpportunity(project,signal,{now=new Date().toISOString()}={}){
 const current=clock(now);
 if(current===null)throw new TypeError('Invalid current time');
 const link=safeLink(signal?.sourceUrl||signal?.source_url);
 const timestamp=clock(signal?.observedAt||signal?.observed_at);
 const kind=String(signal?.sourceType||signal?.source_type||'');
 const title=clean(signal?.title,150);
 const summary=clean(signal?.summary||signal?.description,600);
 if(!link||timestamp===null||timestamp>current+300000||current-timestamp>90*86400000||
    !TYPE_ALLOW.has(kind)||title.length<8||summary.length<12)return null;
 const p=configureProjects([project])[0];
 if(signal?.projectId!==undefined&&signal.projectId!==p.id)return null;
 const body=(title+' '+summary).toLowerCase();
 const matches=p.keywords.filter(word=>tokenize(body,word)).slice(0,8);
 if(matches.length===0)return null;
 const ageDays=Math.max(0,Math.floor((current-timestamp)/86400000));
 const sourceWeight=kind==='official-tender-listing'?8:kind==='first-party-aggregate'?12:10;
 const score=Math.min(90,20+sourceWeight+Math.min(39,matches.length*13)+Math.max(0,20-Math.floor(ageDays/5)));
 // Public source mention is not evidence of actual demand, permission to contact, or earnings.
 return {id:'growth-'+stableId(p.id+'|'+link+'|'+title),projectId:p.id,
  title,summary,sourceUrl:link,sourceType:kind,observedAt:new Date(timestamp).toISOString(),
  relevanceScore:score,matchedKeywords:matches,
  businessFit:assessBusinessFit(p,{sourceType:kind,matchedKeywords:matches}),
  organization:kind==='official-product-page'?clean(signal.organization,100)||null:null,
  prospect:kind==='public-repository'&&signal?.provenance==='github-public-repository-search'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(signal.organization||'')&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(signal.repository||'')&&link==='https://github.com/'+signal.organization+'/'+signal.repository?{organization:signal.organization,repository:signal.repository,organizationUrl:'https://github.com/'+signal.organization,organizationAccountObserved:true,organizationAccountCrossChecked:signal.organizationAccountCrossChecked===true&&signal.organizationCrossCheck==='github-account-confirmed'&&signal.organizationEvidenceUrl==='https://github.com/'+signal.organization,legalEntityVerified:false,needVerified:false,contactPermissionVerified:false}:null,
  audienceHypothesis:p.audience[0],confidence:'unverified-public-signal',
  demandVerified:false,contactPermissionVerified:false,attributedUsers:null,verifiedRevenue:null,
  approvalStatus:'unreviewed',nextAction:'Founder: inspect the source and verify fit, consent and timing before any contact.',
  autoExecute:false};
}
export function buildGrowthIntelligence({projects=PROJECTS,signals=[],now=new Date().toISOString(),
  maxPerProject=8,metrics={}}={}){
 const configured=configureProjects(projects),at=clock(now);
 if(at===null||!Array.isArray(signals)||signals.length>2000||
    !Number.isInteger(maxPerProject)||maxPerProject<1||maxPerProject>50)
  throw new TypeError('Invalid research parameters');
 const dossiers=configured.map(project=>{
  const seen=new Set(),opportunities=[];
  for(const signal of signals){
   const candidate=qualifyOpportunity(project,signal,{now});
   if(candidate&&!seen.has(candidate.id)){
    seen.add(candidate.id);
    opportunities.push(candidate);
   }
  }
  opportunities.sort((a,b)=>b.relevanceScore-a.relevanceScore||
    b.observedAt.localeCompare(a.observedAt)||a.id.localeCompare(b.id));
  // This metric adapter expects already validated, first-party aggregate inputs.
  const m=metrics[project.id];
  const validMetric=v=>Number.isSafeInteger(v)&&v>=0;
  const measured=m&&m.sourceType==='first-party-aggregate'&&clock(m.observedAt)!==null&&
    clock(m.observedAt)<=at&&at-clock(m.observedAt)<=36*3600000&&
    validMetric(m.pageViews7d)&&validMetric(m.completedActions7d);
  return {project:{id:project.id,name:project.name,stage:project.stage,
    audiences:project.audience,productProfile:project.productProfile},opportunities:opportunities.slice(0,maxPerProject),
    qualifiedPublicSignals:opportunities.length,analytics:{
      available:Boolean(measured),source:measured?clean(m.source,250)||null:null,
      observedAt:measured?m.observedAt:null,
      pageViews7d:measured?m.pageViews7d:null,
      completedActions7d:measured?m.completedActions7d:null,
      uniqueUsers:null,payingCustomers:null,verifiedRevenue:null,
      limitations:'Browser-reported events are not unique users, conversions, or verified earnings.'}};
 });
 return {schemaVersion:1,module:'growth-intelligence',generatedAt:new Date(at).toISOString(),
  readOnly:true,autoOutreach:false,autoPublishing:false,projectCount:dossiers.length,
  dossiers,sourceRecordsConsidered:signals.length,
  caution:'Potential audiences and public discussions are research hypotheses; no contact or revenue is verified.'};
}
export function founderReview(opportunity,{decision,actor,at=new Date().toISOString(),note=''}={}){
 if(!opportunity||typeof opportunity.id!=='string'||!opportunity.id.startsWith('growth-')||
    actor!=='founder'||!STATE_ALLOW.has(decision)||clock(at)===null)
  throw new TypeError('Only founder-reviewed growth decisions are valid');
 const before=String(opportunity.approvalStatus||'unreviewed');
 if(!STATE_ALLOW.has(before)||before==='founder-executed')
  throw new TypeError('Invalid or finalized review state');
 if(decision==='founder-executed'&&before!=='approved-for-founder')
  throw new TypeError('Founder execution must follow approval');
 if(decision==='unreviewed'&&before!=='unreviewed')
  throw new TypeError('Cannot clear review decision');
 return {opportunityId:opportunity.id,projectId:opportunity.projectId,
  previousStatus:before,status:decision,actor:'founder',reviewedAt:new Date(at).toISOString(),
  note:clean(note,600),communicationSent:false,externalActionsPerformed:false};
}
export function prepareCommunicationDraft(opportunity,{channel='partnership',projectName=''}={}){
 if(!opportunity||typeof opportunity.id!=='string'||!opportunity.id.startsWith('growth-')||
    !['partnership','community'].includes(channel)||!safeLink(opportunity.sourceUrl))
  throw new TypeError('Verified public evidence reference required');
 const name=clean(projectName,100)||clean(opportunity.projectId,100);
 const topic=clean(opportunity.title,150);
 const fit=opportunity.businessFit;
 const proposed=clean(fit?.integrationHypothesis,240);
 const subject=channel==='partnership'?'Possible collaboration related to '+name:
  'A potentially useful resource from '+name;
 const body=channel==='partnership'?
  'Hello,\n\nI am researching whether '+name+
  ' could help with the topic discussed at the public source below. I would welcome a conversation only if it is relevant to your work.\n\nSource: '+
  opportunity.sourceUrl+'\n\nTopic: '+topic+'\n'+(proposed?'Possible area to explore: '+proposed+'\n':'')+'\nPlease disregard if this is not appropriate.\n':
  'I found this discussion relevant to '+name+
  '. A resource may be useful here, subject to the community rules and moderator approval.\n\nSource: '+
  opportunity.sourceUrl+'\n\nTopic: '+topic+'\n'+(proposed?'Possible area to explore: '+proposed+'\n':'');
 return {schemaVersion:1,id:'draft-'+opportunity.id,projectId:opportunity.projectId,
  opportunityId:opportunity.id,channel,subject,body,recipient:null,
  status:'requires-founder-review',sent:false,published:false,autoExecute:false};
}
