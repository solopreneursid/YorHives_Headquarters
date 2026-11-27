#!/usr/bin/env node
import {openCustomerWorkspace,readBoundedDossier,runSpecialists} from './local-runtime.mjs';
const [action,tenant,file]=process.argv.slice(2);
const root=process.env.GROWTH_PRIVATE_ROOT,model=process.env.GROWTH_LOCAL_MODEL;
if(!root||!['analyze','list'].includes(action)||!tenant||(action==='analyze'&&(!file||!model))){
 console.error('Usage: GROWTH_PRIVATE_ROOT=/private/path GROWTH_LOCAL_MODEL=local-model node portable/growth/cli.mjs analyze tenant-id dossier.json');
 console.error('       GROWTH_PRIVATE_ROOT=/private/path node portable/growth/cli.mjs list tenant-id');
 process.exitCode=2;
}else{
 let workspace;
 try{
  workspace=openCustomerWorkspace(root,tenant);
  const result=action==='list'?workspace.list():await runSpecialists(workspace,readBoundedDossier(file),{model});
  console.log(JSON.stringify(result,null,2));
  if(action==='analyze'&&!result.available)process.exitCode=1;
 }catch(error){console.error('Local research failed: '+String(error.message||'unknown').slice(0,180));process.exitCode=1;}
 finally{workspace?.close();}
}
