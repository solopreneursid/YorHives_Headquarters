#!/usr/bin/env node
/** Local host readiness report. No credentials, private dossiers, remote calls, or installs. */
import {arch,platform,release,availableParallelism,totalmem,freemem} from 'node:os';
import {statfsSync} from 'node:fs';
const model=process.env.GROWTH_LOCAL_MODEL||'';
const root=process.env.GROWTH_PRIVATE_ROOT||process.cwd();
const report={schemaVersion:1,checkedAt:new Date().toISOString(),nodeVersion:process.versions.node,
 platform:platform(),architecture:arch(),kernel:release(),logicalCpuAvailable:availableParallelism(),
 totalRamMiB:Math.floor(totalmem()/1048576),availableRamMiB:Math.floor(freemem()/1048576),availableDiskMiB:null,
 localModelEndpoint:'127.0.0.1:11434',modelConfigured:Boolean(model),modelAvailable:false,
 localServiceAvailable:false,modelQualityVerified:false,modelServerMemoryMeasured:false,issues:[]};
try{const fs=statfsSync(root,{bigint:true});report.availableDiskMiB=Number(fs.bavail*fs.bsize/1048576n);}
catch{report.issues.push('Private storage path missing or unavailable');}
if(Number(process.versions.node.split('.')[0])<22)report.issues.push('Node 22 or newer required');
if(!model||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,100}$/.test(model))report.issues.push('Select an installed local model tag');
try{
 const res=await fetch('http://127.0.0.1:11434/api/tags',{method:'GET',redirect:'error',signal:AbortSignal.timeout(3000)});
 if(!res.ok||!res.body)throw Error('Model endpoint unavailable');
 const reader=res.body.getReader(),decoder=new TextDecoder();let data='',bytes=0;
 try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.byteLength;if(bytes>131072)throw Error('Model inventory exceeds bound');data+=decoder.decode(x.value,{stream:true});}data+=decoder.decode();}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const inventory=JSON.parse(data);
 if(!Array.isArray(inventory.models))throw Error('Invalid model inventory');
 report.localServiceAvailable=true;
 report.modelAvailable=Boolean(model)&&inventory.models.some(x=>x?.name===model||x?.model===model);
 if(model&&!report.modelAvailable)report.issues.push('Configured model not present in local inventory');
}catch{report.issues.push('Local Ollama API unavailable or invalid');}
report.readyForBenchmark=report.issues.length===0&&report.modelAvailable;
console.log(JSON.stringify(report,null,2));
if(!report.readyForBenchmark)process.exitCode=1;
