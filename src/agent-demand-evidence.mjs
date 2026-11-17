/**
 * Private Headquarters: read-only, identity-free public agent utility demand.
 * Cloudflare Analytics SQL is optional and replaceable by a local query adapter.
 * NO API credentials, request content, user IPs, cookies, payment info or D1 writes.
 */
const ALLOWED=new Set(['word_count','slugify','case_convert','percentage','discount']);
const QUERY=`SELECT blob1 AS tool, SUM(_sample_interval * double1) AS calls
FROM events.analyticsEngine."yorphives_agent_usage_v1"
WHERE timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY blob1
ORDER BY calls DESC
LIMIT 10`;
export const AGENT_DEMAND_SOURCE='yorphives-agent-api-aggregate';
const cleanCount=x=>{
 const n=typeof x==='string'&&/^\d{1,13}$/.test(x)?Number(x):x;
 return Number.isSafeInteger(n)&&n>=0?n:null;
};
export function validateAgentDemand(rows,now=Date.now()){
 if(!Array.isArray(rows)||rows.length>10)throw Error('invalid-results');
 const found=new Set(),details=[];
 for(const row of rows){
  if(!row||!ALLOWED.has(row.tool)||found.has(row.tool))throw Error('invalid-tool');
  const count=cleanCount(row.calls);
  if(count===null)throw Error('invalid-count');
  found.add(row.tool);
  details.push({tool:row.tool,estimatedCalls:count});
 }
 const sum=details.reduce((a,x)=>a+x.estimatedCalls,0);
 return {available:true,readOnly:true,source:AGENT_DEMAND_SOURCE,
  windowDays:7,generatedAt:new Date(now).toISOString(),
  sampling:'approximate',confidence:'recorded successful calls, not unique users',
  estimatedTotal:sum,charged:false,revenueVerified:false,verifiedRevenue:null,
  tools:details.sort((a,b)=>b.estimatedCalls-a.estimatedCalls)};
}
export async function loadAgentDemand(env,{now=()=>Date.now()}={}){
 const fail=reason=>({available:false,readOnly:true,source:AGENT_DEMAND_SOURCE,
  reason,windowDays:7,revenueVerified:false,verifiedRevenue:null,tools:[]});
 if(typeof env?.ANALYTICS_SQL?.query!=='function')
  return fail('aggregate-query-binding-unavailable');
 try{
  const result=await env.ANALYTICS_SQL.query({query:QUERY});
  if(!result||!Array.isArray(result.data)||result.data.length>10)
   return fail('invalid-aggregate-response');
  return validateAgentDemand(result.data,now());
 }catch{return fail('agent-demand-temporarily-unavailable');}
}
export const AGENT_DEMAND_QUERY=QUERY;
