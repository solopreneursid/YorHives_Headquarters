/**
 * Internal D1 persistence for already qualified, public Growth Intelligence.
 * Writes ONLY to the dedicated HQ growth_* evidence tables; no outbound I/O.
 * The caller must apply the growth SQL migration after release approval.
 */
const projectId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{1,39}$/.test(id);
const validText=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
function requireDb(db){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')
  throw new TypeError('D1 database with prepare and batch is required');
}
async function stableSourceId(card){
 const identity=card.sourceUrl+'|'+card.sourceType+'|'+card.observedAt;
 const raw=new TextEncoder().encode(identity);
 const digest=await crypto.subtle.digest('SHA-256',raw);
 return 'gs-'+Array.from(new Uint8Array(digest)).slice(0,20)
  .map(x=>x.toString(16).padStart(2,'0')).join('');
}
function validCard(card,project){
 return card&&projectId(card.projectId)&&card.projectId===project.id&&
  typeof card.id==='string'&&/^growth-[a-z0-9]{1,12}$/.test(card.id)&&
  validText(card.title,150)&&validText(card.summary,600)&&
  validText(card.audienceHypothesis,100)&&validDate(card.observedAt)&&
  Number.isInteger(card.relevanceScore)&&card.relevanceScore>=0&&
  card.relevanceScore<=100&&
  typeof card.sourceUrl==='string'&&card.sourceUrl.length<=500&&
  typeof card.sourceType==='string'&&card.sourceType.length<=70&&
  card.demandVerified===false&&card.verifiedRevenue===null&&
  card.approvalStatus==='unreviewed'&&card.autoExecute===false;
}
/** Idempotent, evidence-only upserts. Review decisions are intentionally retained. */
export async function persistGrowthEvidence(db,dossiers,{observedAt=new Date().toISOString()}={}){
 requireDb(db);
 if(!Array.isArray(dossiers)||dossiers.length>10||!validDate(observedAt))
  throw new TypeError('Invalid growth snapshot');
 const statements=[],ids=new Set();
 for(const dossier of dossiers){
  const p=dossier?.project;
  if(!p||!projectId(p.id)||ids.has(p.id)||!validText(p.name,100)||
     !Array.isArray(p.audiences)||p.audiences.length>12||
     !Array.isArray(dossier.opportunities)||dossier.opportunities.length>8)
   throw new TypeError('Invalid or duplicate project dossier');
  ids.add(p.id);
  statements.push(db.prepare(
   'INSERT INTO growth_projects(id,name,stage) VALUES (?,?,?) '+
   'ON CONFLICT(id) DO UPDATE SET name=excluded.name,stage=excluded.stage,updated_at=excluded.updated_at'
  ).bind(p.id,p.name,String(p.stage||'research').slice(0,24)));
  for(let i=0;i<p.audiences.length;i++){
   if(!validText(p.audiences[i],100))throw new TypeError('Invalid audience');
   statements.push(db.prepare(
    'INSERT INTO growth_audiences(id,project_id,label) VALUES (?,?,?) '+
    'ON CONFLICT(id) DO UPDATE SET label=excluded.label'
   ).bind('ga-'+p.id+'-'+i,p.id,p.audiences[i]));
  }
  for(const card of dossier.opportunities){
   if(!validCard(card,p))throw new TypeError('Invalid public evidence opportunity');
   const sourceId=await stableSourceId(card);
   statements.push(db.prepare(
    'INSERT INTO growth_sources(id,source_url,source_type,observed_at,status) VALUES (?,?,?,?,?) '+
    'ON CONFLICT(id) DO NOTHING'
   ).bind(sourceId,card.sourceUrl,card.sourceType,card.observedAt,'public-observed'));
   statements.push(db.prepare(
    'INSERT INTO growth_opportunities(id,project_id,source_id,title,summary,relevance_score,'+
    'audience_hypothesis,discovered_at) VALUES (?,?,?,?,?,?,?,?) '+
    'ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,'+
    'relevance_score=excluded.relevance_score,updated_at=excluded.updated_at'
   ).bind(card.id,p.id,sourceId,card.title,card.summary,card.relevanceScore,
    card.audienceHypothesis,card.observedAt));
  }
 }
 if(statements.length===0)return {storedProjects:0,statements:0};
 // D1 batch is transactional; failures propagate and must not be masked as success.
 await db.batch(statements);
 return {storedProjects:ids.size,statements:statements.length};
}
/** Founder-only view adapter; must remain behind the HQ Access guard. */
export async function readGrowthProject(db,id,{limit=30}={}){
 if(!db||typeof db.prepare!=='function'||!projectId(id)||
    !Number.isInteger(limit)||limit<1||limit>50)throw new TypeError('Invalid read request');
 const project=await db.prepare('SELECT id,name,stage,updated_at FROM growth_projects WHERE id=?').bind(id).first();
 if(!project)return {available:false,readOnly:true,projectId:id,opportunities:[]};
 const result=await db.prepare(
  'SELECT o.id,o.title,o.summary,o.relevance_score,o.audience_hypothesis,'+
  'o.demand_verified,o.approval_status,o.discovered_at,'+
  's.source_url,s.source_type,s.observed_at '+
  'FROM growth_opportunities o JOIN growth_sources s ON s.id=o.source_id '+
  'WHERE o.project_id=? ORDER BY o.relevance_score DESC,o.discovered_at DESC LIMIT ?'
 ).bind(id,limit).all();
 return {schemaVersion:1,readOnly:true,available:true,project,
  opportunities:(result.results||[]).map(x=>({
   id:x.id,title:x.title,summary:x.summary,relevanceScore:x.relevance_score,
   audienceHypothesis:x.audience_hypothesis,demandVerified:x.demand_verified===1,
   approvalStatus:x.approval_status,discoveredAt:x.discovered_at,
   sourceUrl:x.source_url,sourceType:x.source_type,observedAt:x.observed_at,
   autoExecute:false,verifiedRevenue:null})),
  revenueVerified:false,externalActionsAllowed:false};
}
