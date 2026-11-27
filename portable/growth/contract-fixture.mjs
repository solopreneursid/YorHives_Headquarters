/** Offline, bounded JSON interface fixture checks. No external API calls or credentials. */
import {readFileSync,lstatSync} from 'node:fs';
const TYPE=new Set(['string','number','integer','boolean','object','array','null']);
function typeOf(x,t){
 return t==='null'?x===null:t==='array'?Array.isArray(x):t==='object'?x!==null&&typeof x==='object'&&!Array.isArray(x):t==='integer'?Number.isSafeInteger(x):t==='number'?typeof x==='number'&&Number.isFinite(x):typeof x===t;
}
const TOKEN=/^[a-zA-Z0-9_-]{1,80}$/;
function field(data,path){
 let cursor=data;
 for(const segment of path.split('.')){
  if(!TOKEN.test(segment)||['__proto__','constructor','prototype'].includes(segment)||!cursor||typeof cursor!=='object'||!Object.hasOwn(cursor,segment))return {present:false};
  cursor=cursor[segment];
 }
 return {present:true,value:cursor};
}
export function checkCapturedContract(contract,fixture){
 if(!contract||typeof contract.interface!=='string'||contract.interface.length>100||
  typeof contract.version!=='string'||!contract.version||contract.version.length>40||
  !Number.isInteger(contract.expectedStatus)||contract.expectedStatus<100||contract.expectedStatus>599||
  !Array.isArray(contract.fields)||contract.fields.length<1||contract.fields.length>50||
  !contract.fields.every(x=>x&&typeof x.path==='string'&&x.path.length<=180&&x.path.split('.').length<=8&&x.path.split('.').every(s=>TOKEN.test(s)&&!['__proto__','constructor','prototype'].includes(s))&&TYPE.has(x.type))||
  !fixture||!Number.isInteger(fixture.status)||typeof fixture.contentType!=='string')throw TypeError('Invalid bounded interface fixture');
 const results=[{check:'http-status',passed:fixture.status===contract.expectedStatus},{check:'json-content-type',passed:/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(fixture.contentType)}];
 for(const f of contract.fields){
  const v=field(fixture.body,f.path);
  results.push({check:'field:'+f.path,passed:v.present&&typeOf(v.value,f.type)});
 }
 return {interface:contract.interface,version:contract.version,scope:'captured-local-fixture-only',passed:results.every(r=>r.passed),checks:results,liveCompatibilityVerified:false,licenseCompatibilityVerified:false,productionApproved:false};
}
export function readContractFixture(path){
 const s=lstatSync(path);
 if(!s.isFile()||s.isSymbolicLink()||s.size>100000)throw Error('Bounded fixture required');
 return JSON.parse(readFileSync(path,'utf8'));
}
