import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import worker from '../src/hq-worker.mjs';
import {openCustomerWorkspace} from '../portable/growth/local-runtime.mjs';
import {signDossier,verifyDossier,keyFingerprint} from '../portable/growth/evidence-exchange.mjs';
import {issueEntitlement,verifyEntitlement} from '../portable/growth/entitlement.mjs';
import {shadowRanking} from '../src/growth-ranking-review.mjs';
const dossier={project:{id:'taxpulse',name:'TaxPulse',productProfile:{offer:'Tax planning research'}},opportunities:[{id:'growth-abc',title:'Tax API documentation',summary:'Public tax calculation API',sourceUrl:'https://openfisca.org/doc/openfisca-web-api/'}]};
test('signed evidence rejects tampering, cross-tenant import, wrong key, expiry and replay',()=>{
 const key=generateKeyPairSync('ed25519'),other=generateKeyPairSync('ed25519');
 const privateKey=key.privateKey.export({format:'pem',type:'pkcs8'}),publicKey=key.publicKey.export({format:'pem',type:'spki'}),now=Date.now(),pinnedFingerprint=keyFingerprint(publicKey);
 const envelope=signDossier(dossier,{tenant:'customer-a',privateKey,now}),options={tenant:'customer-a',publicKey,pinnedFingerprint,now};
 const accepted=verifyDossier(envelope,options);assert.equal(accepted.dossier.opportunities.length,1);
 assert.throws(()=>verifyDossier({...envelope,packet:{...envelope.packet,project:{...envelope.packet.project,name:'Tampered'}}},options));
 assert.throws(()=>verifyDossier(envelope,{...options,tenant:'customer-b'}));
 assert.throws(()=>verifyDossier(envelope,{...options,publicKey:other.publicKey.export({format:'pem',type:'spki'})}));
 assert.throws(()=>verifyDossier(envelope,{...options,now:now+86400000}));
 const root=mkdtempSync(join(tmpdir(),'growth-sync-'));let w;
 try{w=openCustomerWorkspace(root,'customer-a');w.claimEnvelope(accepted.nonce,accepted.keyId);w.close();w=openCustomerWorkspace(root,'customer-a');assert.throws(()=>w.claimEnvelope(accepted.nonce,accepted.keyId),/already imported/);}
 finally{w?.close();rmSync(root,{recursive:true,force:true});}
});
test('signed commercial entitlement rejects wrong customer, modification and expiration',()=>{
 const key=generateKeyPairSync('ed25519'),privateKey=key.privateKey.export({format:'pem',type:'pkcs8'}),publicKey=key.publicKey.export({format:'pem',type:'spki'}),now=Date.now();
 const license=issueEntitlement({version:1,customerId:'customer-a',plan:'standard',issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+1000).toISOString()},privateKey);
 const opt={customerId:'customer-a',publicKey,now};
 assert.equal(verifyEntitlement(license,opt).paidSubscriptionVerified,false);
 assert.throws(()=>verifyEntitlement({...license,plan:'professional'},opt));
 assert.throws(()=>verifyEntitlement(license,{...opt,customerId:'customer-b'}));
 assert.throws(()=>verifyEntitlement(license,{...opt,now:now+2000}));
});
test('shadow ranking is bounded, excludes suppression and requires minimum independent opportunity cohort',()=>{
 const data=[{project:{id:'taxpulse'},opportunities:[{id:'growth-a',relevanceScore:60},{id:'growth-b',relevanceScore:70}]}];
 const history=Array.from({length:10},(_,i)=>({id:'old-'+i,projectId:'taxpulse',founderReported:true,intent:'evaluation-interest'}));
 const r=shadowRanking(data,[...history,{id:'growth-b',projectId:'taxpulse',founderReported:true,intent:'suppressed'}]);
 assert.equal(r.projects[0].adjustment,5);assert.equal(r.projects[0].status,'review-required');assert.equal(r.projects[0].applied,false);
 assert.deepEqual(r.projects[0].candidates,[{id:'growth-a',originalScore:60,proposedScore:65}]);
 assert.equal(shadowRanking(data,[history[0],history[0]]).projects[0].status,'insufficient-sample');
 assert.equal(data[0].opportunities[0].relevanceScore,60);
});
test('actual Worker founder review and response routes execute on real isolated SQLite',async()=>{
 const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE status(key TEXT PRIMARY KEY,value TEXT,checked_at TEXT); CREATE TABLE opportunities(id TEXT PRIMARY KEY,title TEXT,description TEXT,recommendation TEXT,source_url TEXT,observed_at TEXT,score INTEGER,kind TEXT);");
 for(const name of readdirSync(new URL('../migrations/growth/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../migrations/growth/'+name,import.meta.url),'utf8'));
 db.prepare("INSERT INTO opportunities VALUES(?,?,?,?,?,?,?,?)").run('synthetic','Tax filing calculation discussion','Public tax filing and income tax deduction discussion','Research only','https://news.ycombinator.com/item?id=123',new Date().toISOString(),60,'revenue-research');
 const DB={prepare(sql){let args=[];return {sql,bind(...v){args=v;return this;},get args(){return args;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(stmts){db.exec('BEGIN');try{const results=[];for(const stmt of stmts)results.push(await stmt.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,ACCESS_OWNER_EMAIL:'founder@example.test',ACCESS_AUD:'synthetic-audience',HQ_DECISIONS_ENABLED:'true'},ctx={access:{aud:env.ACCESS_AUD,async getIdentity(){return {email:env.ACCESS_OWNER_EMAIL}}}},base='https://hq.example.test/api/growth-intelligence';
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('not connected',{status:503});
 const get=async()=>{const r=await worker.fetch(new Request(base),env,ctx);assert.equal(r.status,200);return r.json();};
 const post=async(path,action,body)=>worker.fetch(new Request(base+'/'+path,{method:'POST',headers:{origin:'https://hq.example.test','content-type':'application/json','x-hq-founder-action':action},body:JSON.stringify(body)}),env,ctx);
 try{
  let feed=await get();assert.equal(feed.reviewEnabled,true);assert.equal(feed.outcomesEnabled,true);
  let o=feed.dossiers.find(x=>x.project.id==='taxpulse').opportunities[0];
  const review={opportunityId:o.id,revision:0,decision:'approved-for-founder',note:'Synthetic review'};
  let response=await post('review','growth-review-v1',review);assert.equal(response.status,200,await response.text());
  response=await post('review','growth-review-v1',review);assert.equal(response.status,409);
  feed=await get();o=feed.dossiers.find(x=>x.project.id==='taxpulse').opportunities[0];assert.equal(o.approvalStatus,'approved-for-founder');
  response=await post('review','growth-review-v1',{...review,revision:o.reviewRevision,decision:'founder-executed'});assert.equal(response.status,200,await response.text());
  const event={opportunityId:o.id,eventKey:'11111111-1111-4111-8111-111111111111',outcome:'requested-demo',occurredAt:new Date().toISOString()};
  response=await post('outcome','growth-outcome-v1',event);assert.equal(response.status,200,await response.text());
  response=await post('outcome','growth-outcome-v1',event);assert.equal(response.status,200);
  feed=await get();assert.equal(feed.outcomes[0].intent,'evaluation-interest');assert.equal(feed.outcomes[0].reportCount,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM growth_reviews').get().n,2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM growth_intent_events').get().n,1);
 }finally{globalThis.fetch=oldFetch;db.close();}
});

test('offline interface contract distinguishes fixture compatibility from live integration approval',async()=>{
 const {checkCapturedContract}=await import('../portable/growth/contract-fixture.mjs');
 const contract={interface:'Synthetic tax response',version:'1',expectedStatus:200,fields:[{path:'result.total',type:'integer'},{path:'result.currency',type:'string'}]};
 const sample={status:200,contentType:'application/json; charset=utf-8',body:{result:{total:100,currency:'INR'}}};
 const result=checkCapturedContract(contract,sample);
 assert.equal(result.passed,true);assert.equal(result.liveCompatibilityVerified,false);assert.equal(result.licenseCompatibilityVerified,false);
 assert.equal(checkCapturedContract(contract,{...sample,body:{result:{total:'100',currency:'INR'}}}).passed,false);
 assert.equal(checkCapturedContract(contract,{...sample,contentType:'text/html'}).passed,false);
 assert.throws(()=>checkCapturedContract({...contract,fields:[{path:'__proto__.polluted',type:'object'}]},sample));
});
