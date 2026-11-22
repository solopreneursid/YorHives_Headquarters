// Private service-binding-only HQconnect reader and batched notification adapter.
// The HQ-facing fetch contract is GET-only. It cannot update enquiries, access
// source code, deploy, or send customer information to an AI model.
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const cursor=value=>/^\d{1,15}$/.test(String(value||''))&&Number.isSafeInteger(Number(value))?Number(value):null;
async function inbox(request,env){
 if(request.method!=='GET')return json({available:false},405);
 const url=new URL(request.url);
 if(url.pathname!=='/inbox')return json({available:false},404);
 const raw=url.searchParams.get('before');
 const before=raw===null?Number.MAX_SAFE_INTEGER:cursor(raw);
 if(before===null||before<1||[...url.searchParams.keys()].some(k=>k!=='before'))return json({available:false},400);
 if(!env.HQCONNECT_DB)return json({available:false,reason:'database-unavailable'},503);
 try{
  const rows=await env.HQCONNECT_DB.prepare('SELECT rowid AS sequence,created_at,request_type,name,email,project,message,timeline,budget,status FROM hqconnect_requests WHERE rowid < ? ORDER BY rowid DESC LIMIT 26').bind(before).all();
  const records=Array.isArray(rows.results)?rows.results:[];
  const page=records.slice(0,25);
  const status=await env.HQCONNECT_DB.prepare('SELECT last_attempt_at,last_accepted_at,last_error_at FROM hqconnect_notification_checkpoint WHERE id=1').first();
  return json({available:true,readOnly:true,records:page.map(({sequence,...record})=>record),
   next:records.length>25?String(page.at(-1).sequence):null,
   notification:{lastAttemptAt:status?.last_attempt_at||null,lastAcceptedAt:status?.last_accepted_at||null,lastErrorAt:status?.last_error_at||null}});
 }catch{return json({available:false,reason:'inbox-unavailable'},503)}
}
// Sending is deliberately a narrow adapter. A self-hosted implementation can
// replace it without changing the private reader or visitor form contract.
async function notify(env){
 if(!env.HQCONNECT_DB||!env.NOTIFY_EMAIL?.send||!env.NOTIFY_TO||!env.NOTIFY_FROM)throw Error('Notification configuration unavailable');
 const db=env.HQCONNECT_DB;
 const state=await db.prepare('SELECT last_rowid,last_created_at FROM hqconnect_notification_checkpoint WHERE id=1').first();
 const last=Number(state?.last_rowid||0);
 if(!Number.isSafeInteger(last)||last<0)throw Error('Notification checkpoint invalid');
 const lastCreated=String(state?.last_created_at||'');
 const latest=await db.prepare('SELECT MAX(rowid) AS sequence,MAX(created_at) AS created_at FROM hqconnect_requests').first();
 const sequence=Number(latest?.sequence||0),created=String(latest?.created_at||'');
 if(!Number.isSafeInteger(sequence)||sequence<0)throw Error('Notification sequence invalid');
 if(sequence<=last&&created<=lastCreated)return {newEnquiries:false};
 const now=new Date().toISOString();
 try{
  await env.NOTIFY_EMAIL.send({to:env.NOTIFY_TO,from:env.NOTIFY_FROM,
   subject:'New HQconnect enquiry',
   text:'A new enquiry is waiting. Sign in to your private YorpHives Headquarters and open Revenue to review it. No customer details are included in this notification.'});
 }catch{
  await db.prepare('INSERT INTO hqconnect_notification_checkpoint(id,last_rowid,last_attempt_at,last_error_at) VALUES(1,0,?,?) ON CONFLICT(id) DO UPDATE SET last_attempt_at=excluded.last_attempt_at,last_error_at=excluded.last_error_at').bind(now,now).run();
  throw Error('Notification submission failed; will retry');
 }
 // Advance only after the mail service accepted the message. If this write
 // fails, retrying may duplicate a notification but cannot lose an enquiry.
 await db.prepare('INSERT INTO hqconnect_notification_checkpoint(id,last_rowid,last_created_at,last_attempt_at,last_accepted_at,last_error_at) VALUES(1,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET last_rowid=excluded.last_rowid,last_created_at=excluded.last_created_at,last_attempt_at=excluded.last_attempt_at,last_accepted_at=excluded.last_accepted_at,last_error_at=NULL').bind(Math.max(sequence,last),created>lastCreated?created:lastCreated,now,now).run();
 return {newEnquiries:true,accepted:true};
}
export default {fetch:inbox,async scheduled(_controller,env){await notify(env)}};
export {inbox,notify};
