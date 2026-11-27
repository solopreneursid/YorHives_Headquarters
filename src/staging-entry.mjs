import candidate from './hq-worker.mjs';
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(!['GET','HEAD'].includes(request.method)&&!(request.method==='POST'&&['/api/growth-intelligence/review','/api/growth-intelligence/outcome'].includes(path)))return new Response('Staging mutation denied',{status:405});
 return candidate.fetch(request,env,ctx);
}};