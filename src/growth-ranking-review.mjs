/** Founder-reviewed shadow ranking: no changes to the live ordering. */
const GOOD=new Set(['exploratory-interest','evaluation-interest','commercial-interest','reported-agreement']);
const VALID=new Set([...GOOD,'negative','unknown','suppressed']);
export function shadowRanking(dossiers,history){
 if(!Array.isArray(dossiers)||dossiers.length>50||!Array.isArray(history)||history.length>100)throw TypeError('Invalid review cohort');
 const result=[];
 for(const d of dossiers){
  const pid=d.project.id,rows=history.filter(x=>x.projectId===pid&&x.founderReported===true&&VALID.has(x.intent)),seen=new Set();
  const unique=rows.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
  const measured=unique.filter(x=>x.intent!=='unknown'&&x.intent!=='suppressed');
  const ready=measured.length>=10;
  const positive=measured.filter(x=>GOOD.has(x.intent)).length;
  const adjustment=ready?Math.max(-5,Math.min(5,Math.round((positive/measured.length-.5)*10))):0;
  const excluded=new Set(unique.filter(x=>x.intent==='suppressed').map(x=>x.id));
  const candidates=(d.opportunities||[]).filter(x=>!excluded.has(x.id)).map(x=>({id:x.id,originalScore:x.relevanceScore,proposedScore:Math.max(0,Math.min(90,x.relevanceScore+adjustment))}));
  result.push({projectId:pid,measuredResponses:measured.length,positiveResponses:positive,adjustment,
   status:ready?'review-required':'insufficient-sample',suppressedIds:[...excluded],candidates,applied:false});
 }
 return {schemaVersion:1,method:'bounded project-level shadow calibration v1; not a conversion estimate',projects:result,
  founderReviewRequired:true,automaticRankingChanges:false};
}
