// Founder-manual transition for exactly one private inbox service.
// Automatic releases may only preserve an already installed, matching binding.
import assert from 'node:assert/strict';
const addition={name:'HQCONNECT_INBOX',type:'service',service:'yorphives-hqconnect-inbox'};
const compact=xs=>xs.map(({name,type})=>({name,type})).sort((a,b)=>a.name.localeCompare(b.name));
export function planInboxBinding(live,expected,manual){
 assert.ok(Array.isArray(live)&&Array.isArray(expected));
 const existing=live.filter(x=>x.name===addition.name);
 assert.ok(existing.length<=1,'Duplicate inbox binding');
 if(existing.length){
  assert.equal(existing[0].type,addition.type);
  assert.equal(existing[0].service,addition.service,'Inbox service target changed');
  assert.deepEqual(compact(live),compact(expected),'Live binding inventory changed');
  return [];
 }
 assert.equal(manual,true,'The inbox binding requires founder-manual release');
 assert.deepEqual(compact([...live,addition]),compact(expected),'Unexpected binding inventory change');
 return [addition];
}
