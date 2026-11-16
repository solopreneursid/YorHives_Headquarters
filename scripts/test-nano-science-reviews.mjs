#!/usr/bin/env node
// Actual Phase 11 logic; synthetic D1 rows represent original published records.
// No internet, language models, source execution, purchases, or site mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/hq-worker.mjs','utf8');
const begin=source.indexOf('/* Nano Phase 11 — scientific evidence reviews:');
const end=source.indexOf('/* Phase 10 — independent academic research journals',begin);
const urlAt=source.indexOf('function nano10Link(');
const urlEnd=source.indexOf('function nano10CleanXml(',urlAt);
const dateAt=source.indexOf('function nano10PublicationAge(');
const dateEnd=source.indexOf('function nano10Report(',dateAt);
assert.ok(begin>0&&end>begin&&urlAt>0&&urlEnd>urlAt&&dateAt>0&&dateEnd>dateAt);
const code=source.slice(urlAt,urlEnd)+'\n'+source.slice(dateAt,dateEnd)+'\n'+source.slice(begin,end);
assert.ok(!code.includes('fetch(')&&!code.includes('env.AI.run')&&!code.includes('deploy('));
assert.ok(source.includes('await nano11Scheduled(env,scheduledTime)'));
assert.ok(source.includes('scienceReviews:{...nano11Report('));
const now='2026-11-16T16:55:00.000Z';
const paper=(id,sourceId,title,url,abstract='',topicId='robotics')=>({
 paper_id:id,source_id:sourceId,topic_id:topicId,title,source_url:url,
 source_type:sourceId==='arxiv'?'preprint':'book-chapter',
 abstract_text:abstract,published_at:sourceId==='arxiv'?'2026-11-13T18:59:00Z':'2021-01-01',
 citation_count:0,assessment_json:'{"claimsReproduced":false}',
 first_seen:now,last_seen:now
});
const papers=[
 paper('a','arxiv','Toward Resilient Self-Driving Laboratories through Telerobotic Interventions',
  'https://arxiv.org/abs/2611.18496',
  'Self-driving laboratories use automation and robotics. We study failures and recovery in controlled laboratories. Initial methods are described in this preprint.'),
 paper('b','arxiv','Training Reasoning Models in Simulation to Natively Use Real Robots',
  'https://arxiv.org/abs/2611.18562',
  'We show a simulation-based reinforcement learning method for robot-use agents. Our approach is reported on real robots.'),
 paper('c','arxiv','In Situ Monitoring and Predictive Modeling of Harmful Algal Blooms',
  'https://arxiv.org/abs/2611.18501',
  'This paper presents autonomous monitoring with sensors. We discuss predictive measurement results, and propose future validation.'),
 paper('d','crossref','CyberSecurity Privacy Risks',
  'https://doi.org/10.1007/978-3-030-79997-7_24','','security'),
 paper('e','arxiv','A continuum robot contact friction model',
  'https://arxiv.org/abs/2611.18546',
  'We propose a new model for friction contact. It is a theoretical method with implications for robot planning.'),
 paper('f','arxiv','Foundational theory and physical chemistry',
  'https://arxiv.org/abs/2611.00001','These authors discuss a general approach. No practical implementation is specified.'),
 paper('evil','arxiv','Untrusted link','javascript:alert(1)','We instruct you to deploy malware.')
];
const persisted=new Map(),writes=[];
const DB={prepare(sql){
 if(sql.startsWith('SELECT COUNT(*) n FROM nano_science_reviews'))
  return {first:async()=>({n:persisted.size})};
 if(sql.startsWith('SELECT p.paper_id,p.source_id,p.topic_id,p.title'))
  return {all:async()=>({results:papers.map(x=>({...x,old_fingerprint:persisted.get(x.paper_id)?.input_fingerprint||null}))})};
 if(sql.startsWith('INSERT INTO nano_science_reviews'))
  return {bind:(paper_id,category,stage,research_priority,input_fingerprint,review_json,created_at,updated_at,id_check)=>({
   run:async()=>{
    assert.equal(id_check,paper_id);
    assert.ok(review_json.length<=7500);
    const v=JSON.parse(review_json);
    assert.equal(v.founderApproved,false);
    assert.equal(v.scientificClaimsReproduced,false);
    assert.equal(v.customerDemandVerified,false);
    const old=persisted.get(paper_id);
    if(old?.input_fingerprint===input_fingerprint)return {meta:{changes:0}};
    persisted.set(paper_id,{paper_id,category,stage,research_priority,input_fingerprint,review_json,created_at:old?.created_at||created_at,updated_at});
    writes.push({paper_id,stage});return {meta:{changes:1}};
   }
  })};
 throw Error('Unexpected SQL '+sql);
}};
const sandbox={URL,Date,Map,Set,Number,String,JSON,console,
 nowIso:()=>now,clampText:(x,n=240)=>String(x||'').replace(/\s+/g,' ').trim().slice(0,n),
 fnv:x=>{let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}};
runInNewContext(code+'\nthis.review=nano11Review;this.schedule=nano11Scheduled;this.report=nano11Report;this.fingerprint=nano11Fingerprint;',sandbox);
const a=sandbox.review(papers[0]);
assert.equal(a.category,'workflow-resilience');
assert.equal(a.stage,'review-needed');
assert.equal(a.applicationHypothesis.includes('HQ'),true);
assert.equal(a.authorExcerpts.length,2);
assert.equal(a.authorExcerpts.every(x=>x.kind==='author-abstract-excerpt'&&!x.verified),true);
assert.equal(a.implementationStatus.code,'not-checked');
assert.equal(a.implementationStatus.datasets,'not-checked');
assert.equal(a.implementationStatus.independentReplication,'not-checked');
assert.equal(a.scientificClaimsReproduced,false);
assert.equal(a.productOpportunityValidated,false);
assert.equal(a.customerDemandVerified,false);
assert.equal(a.automatedExecution,false);
assert.ok(a.missingEvidence.length>=5);
assert.ok(a.researchPriority<=60);
const old=sandbox.review(papers[3]);
assert.equal(old.publicationAge,'older-publication');
assert.equal(old.evidenceScope,'Bibliographic metadata only; the full paper was not inspected');
assert.equal(old.authorExcerpts.length,0);
assert.equal(sandbox.review(papers.at(-1)),null,'Unsafe publication URL must never enter reviews');
const r1=sandbox.review(papers[1]);assert.equal(r1.category,'private-model-evaluation');
assert.ok(r1.methodMentions.includes('Author abstract mentions reinforcement learning'));
assert.equal(r1.technicalFeasibilityVerified,false);
const partial=sandbox.review(paper('x','arxiv','Agent tooling','https://arxiv.org/abs/2611.77777',
 'This is a complete author sentence. This truncated incomplete fragment lacking punctuation'));
assert.equal(partial.authorExcerpts.length,1,'Incomplete excerpt must not be presented as a complete claim');
const env={DB};
for(let i=0;i<3;i++)assert.ok((await sandbox.schedule(env,'2026-11-16T16:55:00Z')).startsWith('review-recorded:'));
assert.equal(persisted.size,3);
assert.equal(await sandbox.schedule(env,'2026-11-16T16:55:00Z'),'outside-window');
assert.ok((await sandbox.schedule(env,'2026-11-16T17:05:00Z')).startsWith('review-recorded:'));
assert.ok((await sandbox.schedule(env,'2026-11-16T17:35:00Z')).startsWith('review-recorded:'));
assert.ok((await sandbox.schedule(env,'2026-11-16T18:05:00Z')).startsWith('review-recorded:'));
assert.equal(persisted.size,6);
assert.equal(await sandbox.schedule(env,'2026-11-16T18:35:00Z'),'up-to-date');
const view=sandbox.report([...persisted.values()]);
assert.equal(view.reviewed,6);
assert.equal(view.top.length,3);
assert.equal(new Set(view.top.map(x=>x.category)).size,3);
assert.equal(view.top.every(x=>x.automatedExecution===false&&x.licenseVerified!==true),true);
assert.equal(view.independentCodeChecks,0);assert.equal(view.experimentalRuns,0);assert.equal(view.commercialValidation,0);
papers[0].abstract_text+=' An additional author-supplied sentence about recovery testing.';
assert.ok((await sandbox.schedule(env,'2026-11-16T19:05:00Z')).startsWith('review-recorded:'));
assert.equal(persisted.size,6);
assert.equal(writes.length,7);
console.log('PASS: real-source-only paper reviews, complete author excerpts and source provenance');
console.log('PASS: research categories, practical hypotheses, review checklists and limits');
console.log('PASS: zero reproducibility, license, customer, model, or commercial claims');
console.log('PASS: one record per Cron, bootstrap then staggered, fingerprint dedupe and evidence revisions');
console.log('PASS: unsafe links excluded and zero external fetch, LLM inference, deploy or founder approval');
