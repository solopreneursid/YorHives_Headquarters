/**
 * Founder review journal. Local D1 only. No network, outbound communications,
 * project mutation, or action execution. Identity is enforced by the caller's
 * Cloudflare Access and same-origin founder action guard, not request data.
 */
import {persistGrowthEvidence} from './growth-intelligence-store.mjs';
const STATES=new Set(['unreviewed','needs-evidence','approved-for-founder','rejected','founder-executed']);
const ID=/^growth-[a-z0-9]{1,12}$/;
const cleanNote=x=>x.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-contact]').trim();
export function allowedReviewTransitions(state){
 if(state==='approved-for-founder')return ['needs-evidence','rejected','founder-executed'];
 if(['unreviewed','needs-evidence','rejected'].includes(state))return ['needs-evidence','approved-for-founder','rejected'].filter(s=>s!==state);
 return [];
}
export function validateGrowthReview(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).some(k=>!['opportunityId','revision','decision','note'].includes(k))||
    typeof value.opportunityId!=='string'||!ID.test(value.opportunityId)||
    !Number.isSafeInteger(value.revision)||value.revision<0||
    !STATES.has(value.decision)||value.decision==='unreviewed'||
    typeof value.note!=='string'||value.note.length>600)return null;
 const note=cleanNote(value.note);
 if(!note)return null;
 return {opportunityId:value.opportunityId,revision:value.revision,decision:value.decision,note};
}
export async function growthReviewReady(db){
 try{
  const r=await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('growth_review_guard','growth_review_projection','growth_review_no_update','growth_review_no_delete')").all();
  const names=new Set((r.results||[]).map(x=>x.name));
  return ['growth_review_guard','growth_review_projection','growth_review_no_update','growth_review_no_delete'].every(n=>names.has(n));
 }catch{return false;}
}
export async function loadGrowthReviewStates(db,opportunities){
 if(!Array.isArray(opportunities)||opportunities.length>100)throw TypeError('Invalid review set');
 const valid=opportunities.filter(o=>ID.test(o?.id||''));
 if(!valid.length)return new Map();
 const ids=[...new Set(valid.map(o=>o.id))];
 const q='SELECT o.id,o.project_id,o.title,o.approval_status,s.source_url,'+
  'COALESCE((SELECT MAX(r.id) FROM growth_reviews r WHERE r.opportunity_id=o.id),0) AS revision '+
  'FROM growth_opportunities o JOIN growth_sources s ON s.id=o.source_id WHERE o.id IN ('+
  ids.map(()=>'?').join(',')+')';
 const r=await db.prepare(q).bind(...ids).all(),byId=new Map();
 for(const row of r.results||[]){
  if(!valid.some(o=>o.id===row.id&&o.projectId===row.project_id&&o.sourceUrl===row.source_url&&o.title===row.title)||
     !STATES.has(row.approval_status)||!Number.isSafeInteger(row.revision)||row.revision<0)continue;
  byId.set(row.id,{status:row.approval_status,revision:row.revision});
 }
 return byId;
}
export async function recordGrowthReview(db,dossier,opportunity,input,{at=new Date().toISOString()}={}){
 const v=validateGrowthReview(input);
 if(!v||!opportunity||opportunity.id!==v.opportunityId||!dossier?.project||opportunity.projectId!==dossier.project.id||
    !Number.isFinite(Date.parse(at)))return {status:400,error:'Invalid founder review'};
 // Check exact existing identity before any upsert; a conflicting ID is not
 // allowed to overwrite another opportunity or silently reuse its decisions.
 const prior=await db.prepare('SELECT o.project_id,o.title,s.source_url FROM growth_opportunities o JOIN growth_sources s ON s.id=o.source_id WHERE o.id=?').bind(opportunity.id).first();
 if(prior&&(prior.project_id!==opportunity.projectId||prior.title!==opportunity.title||prior.source_url!==opportunity.sourceUrl))
  return {status:409,error:'Opportunity identity conflict'};
 if(!prior){
  if(v.revision!==0)return {status:409,error:'Review changed; reload evidence'};
  await persistGrowthEvidence(db,[{project:dossier.project,opportunities:[{...opportunity,approvalStatus:'unreviewed'}]}],{observedAt:at});
 }
 const states=await loadGrowthReviewStates(db,[opportunity]),state=states.get(opportunity.id);
 if(!state||state.revision!==v.revision)return {status:409,error:'Review changed; reload evidence'};
 if(!allowedReviewTransitions(state.status).includes(v.decision))return {status:409,error:'Transition not allowed'};
 // The conditional insert + SQL trigger is atomic, including audit/projection.
 // Revision matching prevents ABA/lost updates across concurrent requests.
 const r=await db.prepare(
  'INSERT INTO growth_reviews(opportunity_id,from_status,to_status,review_note,reviewed_at,reviewed_by) '+
  "SELECT o.id,o.approval_status,?,?,?,'founder' FROM growth_opportunities o "+
  'JOIN growth_sources s ON s.id=o.source_id WHERE o.id=? AND o.project_id=? AND o.title=? AND s.source_url=? '+
  'AND o.approval_status=? AND COALESCE((SELECT MAX(id) FROM growth_reviews WHERE opportunity_id=o.id),0)=?'
 ).bind(v.decision,v.note,at,opportunity.id,opportunity.projectId,opportunity.title,opportunity.sourceUrl,state.status,v.revision).run();
 if(Number(r.meta?.changes||0)!==1)return {status:409,error:'Review changed; reload evidence'};
 return {status:200,recorded:true,decision:v.decision,externalActionsPerformed:false};
}
