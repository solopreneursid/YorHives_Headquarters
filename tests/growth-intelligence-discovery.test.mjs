import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryWindow,normalizeOrganizationRepositories,runProspectDiscovery,loadProspectDiscovery} from '../src/growth-prospect-discovery.mjs';
import {growthFromExistingEvidence} from '../src/growth-intelligence-adapter.mjs';

const NOW='2026-11-27T14:35:00.000Z';
const repoFixture={name:'tax-calculator',owner:{login:'ExampleTaxOrg',type:'Organization'},
 html_url:'https://github.com/ExampleTaxOrg/tax-calculator',private:false,archived:false,fork:false,
 description:'Open source income tax calculator with public tax filing verification.'};
function dbMock(initial=[]){
 const values=new Map(initial.map(x=>[x.key,x])),queries=[];
 return {values,queries,prepare(sql){
  const q={sql,args:[],bind(...args){this.args=args;return this;},
   async first(){return values.get(this.args[0])||null;},
   async all(){return {results:[...values.values()]};},
   async run(){
    const [key,value,checked_at]=this.args;
    const existing=values.get(key);
    if(sql.includes('WHERE substr(status.checked_at')&&existing&&existing.checked_at.slice(0,10)===checked_at.slice(0,10))
      return {meta:{changes:0}};
    values.set(key,{key,value,checked_at});return {meta:{changes:1}};
   }};
  queries.push(q);return q;
 }};
}
function reply(items,options={}){
 return new Response(JSON.stringify({items,incomplete_results:false,...options}),{status:200,
  headers:{'content-type':'application/json'}});
}
test('only four fixed project windows exist, each at one UTC minute',()=>{
 assert.equal(discoveryWindow(NOW).id,'taxpulse');
 assert.equal(discoveryWindow('2026-11-27T02:35:00Z').id,'yorphives');
 assert.equal(discoveryWindow('2026-11-27T08:35:00Z').id,'globalgov');
 assert.equal(discoveryWindow('2026-11-27T20:35:00Z').id,'hqventures');
 assert.equal(discoveryWindow('2026-11-27T14:40:00Z'),null);
 assert.equal(discoveryWindow('invalid'),null);
});
test('normalization permits only canonical public organization repository metadata',()=>{
 const records=normalizeOrganizationRepositories({items:[
  repoFixture,repoFixture,
  {...repoFixture,owner:{login:'ExampleTaxOrg',type:'User'}},
  {...repoFixture,private:true},
  {...repoFixture,archived:true},
  {...repoFixture,fork:true},
  {...repoFixture,html_url:'https://github.com.attacker.test/ExampleTaxOrg/tax-calculator'},
  {...repoFixture,html_url:'https://github.com/ExampleTaxOrg/tax-calculator?token=private'},
  {...repoFixture,owner:{login:'solopreneursid',type:'Organization'},html_url:'https://github.com/solopreneursid/tax-calculator'},
  {...repoFixture,name:'other',html_url:'https://github.com/ExampleTaxOrg/other',
   description:'Tax filing software contact person@example.org <script>alert(1)</script>'}
 ]},'taxpulse',NOW);
 assert.equal(records.length,2);
 assert.equal(records[0].organization,'ExampleTaxOrg');
 assert.equal(records[0].organizationAccountObserved,true);
 assert.equal(records[0].legalEntityVerified,false);
 assert.equal(records[0].commercialIntentVerified,false);
 assert.equal(records[0].contactPermissionVerified,false);
 assert.equal(records[0].needVerified,false);
 assert.equal(records[0].autoExecute,false);
 assert.ok(records[1].summary.includes('[redacted-contact]'));
 assert.ok(!records[1].summary.includes('<script>'));
 assert.throws(()=>normalizeOrganizationRepositories({items:[]},'unknown',NOW));
});
test('scheduled discovery is bounded and idempotent, uses only approved public GET',async()=>{
 const DB=dbMock(),requests=[];
 let budget=0;
 const options={reserveFetch:async()=>{budget++;return true;},fetchFn:async(url,opts)=>{
  requests.push({url,opts});return reply([repoFixture]);
 }};
 assert.equal(await runProspectDiscovery({DB},Date.parse(NOW),options),'taxpulse:observed');
 assert.equal(await runProspectDiscovery({DB},Date.parse(NOW),options),'already-checked');
 assert.equal(await runProspectDiscovery({DB},Date.parse(NOW)+300000,options),'outside-window');
 assert.equal(requests.length,1);
 assert.equal(budget,1);
 const url=new URL(requests[0].url);
 assert.equal(url.origin,'https://api.github.com');
 assert.equal(url.pathname,'/search/repositories');
 assert.match(url.searchParams.get('q'),/tax/);
 assert.equal(url.searchParams.get('per_page'),'12');
 assert.equal(requests[0].opts.method,'GET');
 assert.equal(requests[0].opts.redirect,'error');
 assert.equal(requests[0].opts.headers.authorization,undefined);
 const scans=await loadProspectDiscovery(DB,{now:Date.parse(NOW)+1000});
 const scan=scans.find(x=>x.projectId==='taxpulse');
 assert.equal(scan.state,'observed');
 assert.equal(scan.records.length,1);
 assert.equal(scans.find(x=>x.projectId==='globalgov').state,'not-yet-checked');
 const feed=growthFromExistingEvidence({prospectScans:scans,now:NOW});
 const dossier=feed.dossiers.find(x=>x.project.id==='taxpulse');
 assert.equal(dossier.opportunities.length,1);
 assert.equal(dossier.opportunities[0].prospect.organization,'ExampleTaxOrg');
 assert.equal(dossier.opportunities[0].demandVerified,false);
 assert.equal(dossier.opportunities[0].prospect.legalEntityVerified,false);
 assert.equal(feed.dossiers.filter(x=>x.project.id!=='taxpulse').flatMap(x=>x.opportunities).length,0);
});
test('budget failure and incomplete searches never report successful discovery',async()=>{
 const DB=dbMock();
 assert.equal(await runProspectDiscovery({DB},Date.parse(NOW),{
  reserveFetch:async()=>false,fetchFn:async()=>{throw Error('unexpected network')}
 }),'taxpulse:unavailable');
 assert.equal((await loadProspectDiscovery(DB,{now:Date.parse(NOW)})).find(x=>x.projectId==='taxpulse').state,'unavailable');
 const db2=dbMock();
 assert.equal(await runProspectDiscovery({DB:db2},Date.parse(NOW),{reserveFetch:async()=>true,
  fetchFn:async()=>reply([repoFixture],{incomplete_results:true})}),'taxpulse:unavailable');
 const db3=dbMock();
 assert.equal(await runProspectDiscovery({DB:db3},Date.parse(NOW),{reserveFetch:async()=>true,
  fetchFn:async()=>reply([])}),'taxpulse:checked-no-match');
});
test('expired evidence and inconsistent stored records fail closed',async()=>{
 const records=normalizeOrganizationRepositories({items:[repoFixture]},'taxpulse',NOW);
 const row={key:'growth_prospects_taxpulse',checked_at:NOW,value:JSON.stringify({
  schemaVersion:1,projectId:'taxpulse',checkedAt:NOW,state:'observed',records})};
 const DB=dbMock([row]);
 const stale=await loadProspectDiscovery(DB,{now:Date.parse(NOW)+37*3600000});
 assert.equal(stale.find(x=>x.projectId==='taxpulse').state,'stale-or-invalid');
 assert.deepEqual(stale.find(x=>x.projectId==='taxpulse').records,[]);
 DB.values.set(row.key,{...row,value:JSON.stringify({schemaVersion:1,projectId:'taxpulse',checkedAt:NOW,state:'observed',
  records:[{...records[0],sourceUrl:'https://attacker.test/repo'}]})});
 const invalid=await loadProspectDiscovery(DB,{now:Date.parse(NOW)});
 assert.equal(invalid.find(x=>x.projectId==='taxpulse').records.length,0);
});

test('independent public organization account cross-check consumes one additional budgeted request only',async()=>{
 const DB=dbMock(),calls=[];let budget=0;
 const result=await runProspectDiscovery({DB},Date.parse(NOW),{crossCheck:true,reserveFetch:async()=>++budget<=2,fetchFn:async(url,options)=>{
  calls.push({url,method:options.method});
  if(url.startsWith('https://api.github.com/search/repositories?'))return reply([repoFixture]);
  assert.equal(url,'https://api.github.com/orgs/ExampleTaxOrg');
  return new Response(JSON.stringify({login:'ExampleTaxOrg',type:'Organization',html_url:'https://github.com/ExampleTaxOrg',email:'never-store@example.test'}),{headers:{'content-type':'application/json'}});
 }});
 assert.equal(result,'taxpulse:observed');assert.equal(calls.length,2);
 const scans=await loadProspectDiscovery(DB,{now:Date.parse(NOW)});
 const record=scans.find(x=>x.projectId==='taxpulse').records[0];
 assert.equal(record.organizationAccountCrossChecked,true);
 assert.equal(record.legalEntityVerified,false);
 assert.equal(record.email,undefined);
 const feed=growthFromExistingEvidence({prospectScans:scans,now:NOW});
 assert.equal(feed.dossiers.find(x=>x.project.id==='taxpulse').opportunities[0].prospect.organizationAccountCrossChecked,true);
});
