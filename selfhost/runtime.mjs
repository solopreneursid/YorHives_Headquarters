/** Founder-owned Node 24+ adapter. No third-party packages. Loopback only. */
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {readFileSync,readdirSync,mkdirSync,chmodSync,statSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import worker from '../cloudflare/src/worker.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets={'/':'index.html','/index.html':'index.html','/dashboard.js':'dashboard.js','/styles.css':'styles.css'};
const security={'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
export function openDatabase(directory){
  let state=resolve(directory);
  if(state===ROOT||state.startsWith(ROOT+'/'))throw Error('Evidence must be outside the source checkout');
  mkdirSync(state,{recursive:true,mode:0o700});
  state=realpathSync(state);
  for(let parent=state;;parent=dirname(parent)){if(existsSync(join(parent,'.git'))||parent===ROOT)throw Error('Evidence must be outside Git worktrees');if(dirname(parent)===parent)break;}
  if(statSync(state).mode&0o077)throw Error('State directory must have mode 0700');
  const path=join(state,'hq-runtime.sqlite');if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('Database symlinks are not allowed');
  const sqlite=new DatabaseSync(path);chmodSync(path,0o600);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY);');
  for(const name of readdirSync(join(ROOT,'cloudflare/migrations')).filter(x=>x.endsWith('.sql')).sort()){
    if(sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name))continue;
    sqlite.exec('BEGIN IMMEDIATE');
    try{sqlite.exec(readFileSync(join(ROOT,'cloudflare/migrations',name),'utf8'));sqlite.prepare('INSERT INTO schema_migrations VALUES(?)').run(name);sqlite.exec('COMMIT');}
    catch(error){sqlite.exec('ROLLBACK');sqlite.close();throw error;}
  }
  const DB={prepare(sql){const stmt=sqlite.prepare(sql);let args=[];return{
    bind(...values){args=values;return this;},async first(){return stmt.get(...args)||null;},
    async all(){return{results:stmt.all(...args)};},async run(){return{meta:stmt.run(...args)};}
  };}};
  return {sqlite,DB,path};
}
async function bodyBytes(req,max=8192){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>max)throw Error('body-limit');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
const loginPage='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private YorpHives HQ</title><link rel="stylesheet" href="/login.css"><main><h1>YorpHives Headquarters</h1><p>Founder sign-in · private local server</p><form method="post" action="/login"><label for="password">Founder password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>Sign in</button></form><p>Use a secure SSH tunnel when connecting from another device.</p></main></html>';
const loginCss='body{font:16px/1.6 system-ui;background:#f5f7fb;color:#203d45;margin:0;padding:24px}main{max-width:440px;margin:10vh auto;background:white;padding:28px;border-radius:20px}input,button{box-sizing:border-box;display:block;width:100%;padding:14px;margin:12px 0;border:1px solid #789;border-radius:9px;font:inherit}button{background:#086d60;color:white}';
export function createRuntime({stateDir,password,port=8765,clock=()=>Date.now()}){
  if(typeof password!=='string'||password.length<24||password.length>256)throw Error('HQ_OWNER_PASSWORD must contain 24–256 characters');
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
  const database=openDatabase(stateDir),sessions=new Map(),attempts=new Map();
  const salt=randomBytes(16),passwordHash=scryptSync(password,salt,32);
  const env={DB:database.DB,HQ_DECISIONS_ENABLED:'true',ACCESS_OWNER_EMAIL:'founder@localhost.invalid',ACCESS_AUD:'selfhost-founder-session-v1',ASSETS:{async fetch(request){
    const path=new URL(request.url).pathname,file=assets[path];
    if(!file)return new Response('Not found',{status:404,headers:security});
    return new Response(readFileSync(join(ROOT,file)),{headers:{...security,'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'}});
  }}};
  let busy=false,activeScan=null;
  async function scan(at=clock()){
    if(busy)return {status:'already-running'};busy=true;
    try{const before=await env.DB.prepare("SELECT checked_at FROM status WHERE key='last_cron'").first();let pending;await worker.scheduled({scheduledTime:at},env,{waitUntil(p){pending=p;}});activeScan=pending;await pending;const after=await env.DB.prepare("SELECT checked_at FROM status WHERE key='last_cron'").first();return{status:after?.checked_at&&after.checked_at!==before?.checked_at?'completed':'unverified-or-failed'};}
    finally{busy=false;activeScan=null;}
  }
  const server=createServer(async(req,res)=>{
    const send=(status,body,headers={})=>{res.writeHead(status,{...security,'content-type':'text/plain; charset=utf-8',...headers});res.end(req.method==='HEAD'?undefined:body);};
    const origin='http://127.0.0.1:'+server.address().port;
    // A strict Host allowlist also prevents DNS rebinding on this loopback service.
    if(req.headers.host!=='127.0.0.1:'+server.address().port)return send(403,'Invalid host');
    try{
      const path=new URL(req.url,origin).pathname;
      for(const [key,until] of sessions)if(until<=clock())sessions.delete(key);
      if(path==='/login.css'&&req.method==='GET')return send(200,loginCss,{'content-type':'text/css'});
      if(path==='/login'&&req.method==='GET')return send(200,loginPage,{'content-type':'text/html; charset=utf-8'});
      if(path==='/login'&&req.method==='POST'){
        if(req.headers.origin!==origin||req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')return send(403,'Same-origin login required');
        const now=clock();const history=(attempts.get('founder')||[]).filter(x=>x>now-15*60000);
        if(history.length>=5)return send(429,'Too many attempts; wait 15 minutes');
        const submitted=new URLSearchParams((await bodyBytes(req,2048)).toString()).get('password')||'';
        if(submitted.length>256||!timingSafeEqual(passwordHash,scryptSync(submitted,salt,32))){attempts.set('founder',[...history,now]);return send(401,'Sign-in failed');}
        attempts.delete('founder');if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
        const token=randomBytes(32).toString('hex');sessions.set(token,now+8*3600000);
        return send(303,'Signed in',{location:'/', 'set-cookie':`hq_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
      }
      const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hq_session='))?.slice(11);
      if(path==='/cdn-cgi/access/logout'&&req.method==='GET'){
        sessions.delete(token);return send(303,'Signed out',{location:'/login','set-cookie':'hq_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
      }
      if(!token||!sessions.has(token))return send(303,'Sign in required',{location:'/login'});
      const bytes=['GET','HEAD'].includes(req.method)?undefined:await bodyBytes(req);
      const request=new Request(origin+req.url,{method:req.method,headers:req.headers,body:bytes});
      const result=await worker.fetch(request,env,{access:{aud:env.ACCESS_AUD,async getIdentity(){return{email:env.ACCESS_OWNER_EMAIL};}}});
      const headers=Object.fromEntries(result.headers);if(headers['x-yorphives-hq-evidence'])headers['x-yorphives-hq-evidence']='readonly-selfhost';
      send(result.status,Buffer.from(await result.arrayBuffer()),headers);
    }catch(error){send(error.message==='body-limit'?413:503,'Request could not be completed');}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return{server,scan,database,listen:()=>new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>accept(server.address()));}),async close(){await new Promise(resolve=>server.close(resolve));if(activeScan)await activeScan;database.sqlite.close();}};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  process.umask(0o077);
  const runtime=createRuntime({stateDir:process.env.HQ_STATE_DIR||join(process.env.HOME,'.local/state/yorphives-runtime'),password:process.env.HQ_OWNER_PASSWORD,port:Number(process.env.HQ_PORT||8765)});
  await runtime.listen();console.log('Private HQ listening on loopback port '+runtime.server.address().port);
  // No overlapping scans; absolute five-minute buckets preserve the existing budget.
  let bucket=-1;const tick=()=>{const next=Math.floor(Date.now()/300000);if(next!==bucket){bucket=next;runtime.scan(next*300000).catch(()=>console.error('Collector unavailable'));}};
  const timer=setInterval(tick,1000);tick();
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{clearInterval(timer);await runtime.close();process.exit(0);});
}
