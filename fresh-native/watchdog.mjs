/** Independent YorpHivesHQ heartbeat observer. Cloudflare only; no AI, no secrets, no mutating targets. */
const SITE='https://yorphives.com/';
const now=()=>new Date().toISOString();
export async function inspect(env,at=Date.now()){
 const row=await env.DB.prepare("SELECT updated_at FROM state WHERE key='last_cron'").first();
 const age=row?.updated_at?at-Date.parse(row.updated_at):Infinity;
 const runtimeState=age>=0&&age<45*60*1000?'online':row?'stale':'unknown';
 let siteState='unknown',status=null;
 try{const response=await fetch(SITE,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(6500)});status=response.status;siteState=status>=200&&status<400?'online':'error';await response.body?.cancel();}catch{siteState='error';}
 const report={state:runtimeState,site:siteState,siteHttpStatus:status,lastHQHeartbeat:row?.updated_at||null,checkedAt:new Date(at).toISOString(),scope:'same-provider-watchdog'};
 await env.DB.prepare('INSERT INTO state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('watchdog',JSON.stringify(report),now()).run();
 return report;
}
export default {
 async fetch(){return new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});},
 async scheduled(event,env){if(env.DB)await inspect(env).catch(()=>{});}
};