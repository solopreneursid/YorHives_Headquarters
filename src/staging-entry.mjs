import candidate from './hq-worker.mjs';

const ALLOWED_POSTS=new Set([
 '/api/growth-intelligence/review',
 '/api/growth-intelligence/outcome',
 '/api/growth-intelligence/ai-analysis'
]);

export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(!['GET','HEAD'].includes(request.method)&&
     !(request.method==='POST'&&ALLOWED_POSTS.has(path)))
   return new Response('Staging mutation denied',{status:405,headers:{'cache-control':'no-store'}});
  return candidate.fetch(request,env,ctx);
 }
};
