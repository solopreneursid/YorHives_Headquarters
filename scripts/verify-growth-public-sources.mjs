/** Real public source smoke test using the candidate collectors and disposable local SQLite.
 * No Cloudflare credentials, production database or arbitrary URL input.
 * Network results are observations, not fixture assertions or release approval.
 */
import {DatabaseSync} from 'node:sqlite';
import {runProspectDiscovery,loadProspectDiscovery} from '../src/growth-prospect-discovery.mjs';
import {runBusinessResearch,loadBusinessResearch,businessResearchWindow} from '../src/growth-business-research.mjs';
import {growthFromExistingEvidence} from '../src/growth-intelligence-adapter.mjs';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE status(key TEXT PRIMARY KEY,value TEXT NOT NULL,checked_at TEXT NOT NULL)');
const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};
const now=Date.now(),base=Math.floor(now/86400000)*86400000-86400000;
let budget=0;const requests=[];
const reserveFetch=async()=>++budget<=20;
const fetchFn=async(url,options)=>{
 const u=new URL(url);
 const evidence={host:u.hostname,path:u.pathname,httpStatus:null};
 requests.push(evidence);
 try{const r=await fetch(url,options);evidence.httpStatus=r.status;return r;}catch(e){evidence.failure=e.name;throw e;}
};
try{
 for(const hour of [2,8,14,20]){
  await runProspectDiscovery({DB},base+hour*3600000+35*60000,{reserveFetch,fetchFn,crossCheck:true});
  for(const day of [base,base+86400000])await runBusinessResearch({DB},day+hour*3600000+45*60000,{reserveFetch,fetchFn});
 }
 // Synthetic schedule instants only, never claimed as actual observation times.
 const asOf=base+2*86400000;
 const prospects=await loadProspectDiscovery(DB,{now:asOf});
 const business=await loadBusinessResearch(DB,{now:asOf});
 const dossier=growthFromExistingEvidence({prospectScans:prospects,businessScans:business,now:new Date(asOf).toISOString()});
 const results=[...dossier.prospectSources.map(x=>({...x,kind:'repository'})),...dossier.businessSources];
 const report={checkedAt:new Date(now).toISOString(),environment:'disposable CI SQLite; real public HTTP; simulated cron clock',productionVerified:false,
  requests:requests.length,results:results.map(({projectId,kind,state,observedCount})=>({projectId,kind,state,observedCount})),
  matchingOpportunities:dossier.dossiers.map(x=>({projectId:x.project.id,count:x.opportunities.length,crossChecked:x.opportunities.filter(o=>o.prospect?.organizationAccountCrossChecked).length})),
  transport:requests,allSourcesReachable:results.every(x=>['observed','checked-no-match'].includes(x.state))};
 console.log('PUBLIC_SOURCE_REPORT '+JSON.stringify(report));
 if(requests.length>20)throw Error('Exceeded request budget');
 if(!results.some(x=>['observed','checked-no-match'].includes(x.state)))throw Error('No public source usable');
}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
