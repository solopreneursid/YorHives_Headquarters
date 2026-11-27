#!/usr/bin/env node
import {readFileSync,lstatSync,writeFileSync} from 'node:fs';
import {openCustomerWorkspace,readBoundedDossier,runSpecialists} from './local-runtime.mjs';
import {signDossier,verifyDossier,keyFingerprint} from './evidence-exchange.mjs';
const [action,tenant,file,output]=process.argv.slice(2);
const root=process.env.GROWTH_PRIVATE_ROOT,model=process.env.GROWTH_LOCAL_MODEL;
function keyFile(path,secret=false){
 if(!path)throw Error('Explicit enrolled key path required');
 const info=lstatSync(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size>8192||secret&&(info.mode&0o077)!==0)throw Error('Unsafe key file');
 return readFileSync(path,'utf8');
}
let workspace;
try{
 if(action==='fingerprint'){console.log(keyFingerprint(keyFile(process.env.GROWTH_SIGN_PUBLIC_KEY)));}
 else if(action==='sign'){
  if(!tenant||!file||!output)throw Error('Usage: sign tenant-id dossier.json signed.json');
  const signed=signDossier(readBoundedDossier(file),{tenant,privateKey:keyFile(process.env.GROWTH_SIGN_PRIVATE_KEY,true)});
  writeFileSync(output,JSON.stringify(signed,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({signed:true,tenant,keyId:signed.keyId,expiresAt:signed.expiresAt}));
 }else{
  if(!root||!tenant||!['analyze','list','import','benchmark'].includes(action)||action!=='list'&&(!file||!model))throw Error('Usage: analyze|import|benchmark tenant-id dossier.json; list tenant-id; sign tenant-id dossier.json signed.json; fingerprint');
  if(process.env.GROWTH_CUSTOMER_ID&&process.env.GROWTH_CUSTOMER_ID!==tenant)throw Error('Customer installation identity mismatch');
  if(process.env.GROWTH_REQUIRE_SIGNED==='true'&&!['import','list'].includes(action))throw Error('Signed evidence import required by installation policy');
  workspace=openCustomerWorkspace(root,tenant);
  let result;
  if(action==='list')result=workspace.list();
  else if(action==='import'){
   const accepted=verifyDossier(readBoundedDossier(file),{tenant,publicKey:keyFile(process.env.GROWTH_SIGN_PUBLIC_KEY),pinnedFingerprint:process.env.GROWTH_SIGN_KEY_ID});
   workspace.claimEnvelope(accepted.nonce,accepted.keyId);
   result=await runSpecialists(workspace,accepted.dossier,{model});
  }else{
   const started=performance.now(),rssBefore=process.memoryUsage().rss;
   result=await runSpecialists(workspace,readBoundedDossier(file),{model});
   if(action==='benchmark')result={...result,benchmark:{model,elapsedMs:Math.round(performance.now()-started),runnerRssBeforeBytes:rssBefore,runnerRssAfterBytes:process.memoryUsage().rss,modelServerMemoryMeasured:false,qualityIndependentlyVerified:false}};
  }
  console.log(JSON.stringify(result,null,2));
  if(action!=='list'&&!result.available)process.exitCode=1;
 }
}catch(error){console.error('Local research failed: '+String(error.message||'unknown').slice(0,180));process.exitCode=1;}
finally{workspace?.close();}
