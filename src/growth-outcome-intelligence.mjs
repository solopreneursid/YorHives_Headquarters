/** Structured founder-reported response journal: no private message text, contact addresses or revenue claims. */
const OUTCOMES=Object.freeze({'no-response':'unknown','declined':'negative','asked-information':'exploratory-interest','requested-demo':'evaluation-interest','requested-proposal':'commercial-interest','founder-reported-agreement':'reported-agreement','do-not-contact':'suppressed'});
const ID=/^growth-[a-z0-9]{1,12}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateOutcome(value,now=Date.now()){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['opportunityId','eventKey','outcome','occurredAt'].includes(k))||!ID.test(value.opportunityId||'')||!UUID.test(value.eventKey||'')||!Object.hasOwn(OUTCOMES,value.outcome)||typeof value.occurredAt!=='string')return null;
 const t=Date.parse(value.occurredAt);
 if(!Number.isFinite(t)||t>now||t<now-365*86400000)return null;
 return {opportunityId:value.opportunityId,eventKey:value.eventKey.toLowerCase(),outcome:value.outcome,occurredAt:new Date(t).toISOString()};
}
export function inferFounderIntent(events){
 if(!Array.isArray(events)||events.length>1000)throw TypeError('Invalid outcome history');
 const ordered=events.filter(e=>Object.hasOwn(OUTCOMES,e.outcome)&&e.source_type==='founder-attested').sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))||Number(b.id)-Number(a.id));
 const suppressed=ordered.some(x=>x.outcome==='do-not-contact'),latest=ordered[0];
 return {state:suppressed?'suppressed':latest?OUTCOMES[latest.outcome]:'unknown',
  lastReportedOutcome:latest?.outcome||null,founderReported:!!latest,contactSuppressed:suppressed,
  verifiedCommercialIntent:false,verifiedRevenue:null,autoExecute:false};
}
export async function outcomeReady(db){
 try{const r=await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('growth_intent_insert_guard','growth_intent_no_update','growth_intent_no_delete')").all();return new Set((r.results||[]).map(x=>x.name)).size===3;}catch{return false;}
}
export async function recordFounderOutcome(db,input,{now=Date.now()}={}){
 const v=validateOutcome(input,now);if(!v)return {status:400,error:'Invalid structured founder outcome'};
 const r=await db.prepare("INSERT INTO growth_intent_events(opportunity_id,event_key,outcome,occurred_at,recorded_at) SELECT id,?,?,?,? FROM growth_opportunities WHERE id=? AND approval_status='founder-executed' ON CONFLICT(event_key) DO NOTHING").bind(v.eventKey,v.outcome,v.occurredAt,new Date(now).toISOString(),v.opportunityId).run();
 if(Number(r.meta?.changes||0)===1)return {status:200,recorded:true,externalActionsPerformed:false};
 const old=await db.prepare('SELECT opportunity_id,outcome,occurred_at FROM growth_intent_events WHERE event_key=?').bind(v.eventKey).first();
 if(old?.opportunity_id===v.opportunityId&&old.outcome===v.outcome&&old.occurred_at===v.occurredAt)return {status:200,recorded:true,duplicate:true,externalActionsPerformed:false};
 return {status:409,error:'Manual founder action required or event identity conflict'};
}
export async function loadOutcomeHistory(db){
 const result=await db.prepare("SELECT o.id,o.project_id,o.title,o.approval_status,COUNT(e.id) AS report_count,MAX(CASE WHEN e.outcome='do-not-contact' THEN 1 ELSE 0 END) AS suppressed,(SELECT outcome FROM growth_intent_events WHERE opportunity_id=o.id ORDER BY occurred_at DESC,id DESC LIMIT 1) AS latest FROM growth_opportunities o LEFT JOIN growth_intent_events e ON e.opportunity_id=o.id WHERE o.approval_status='founder-executed' GROUP BY o.id ORDER BY o.updated_at DESC LIMIT 100").all();
 return (result.results||[]).map(r=>({id:r.id,projectId:r.project_id,title:r.title,reportCount:r.report_count,
  intent:r.suppressed===1?'suppressed':OUTCOMES[r.latest]||'unknown',lastReportedOutcome:r.latest||null,
  founderReported:r.report_count>0,verifiedCommercialIntent:false,verifiedRevenue:null,autoExecute:false}));
}
export function summarizeOutcomeLearning(history){
 const groups=new Map();
 for(const x of history){const p=groups.get(x.projectId)||{projectId:x.projectId,manualActions:0,reportedInterest:0,suppressed:0,unknown:0};p.manualActions++;if(['exploratory-interest','evaluation-interest','commercial-interest','reported-agreement'].includes(x.intent))p.reportedInterest++;if(x.intent==='suppressed')p.suppressed++;if(x.intent==='unknown')p.unknown++;groups.set(x.projectId,p);}
 return {coverage:'latest 100 manually executed opportunities; founder-attested only',projects:[...groups.values()],automaticRankingChanges:false,verifiedRevenue:null};
}
