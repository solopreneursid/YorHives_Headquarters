import {gitBlob} from './verify-current-hq.mjs';
export function singleLiveVersion(deployments){
 const versions=deployments?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||versions[0].percentage!==100||
  !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(versions[0].version_id||''))
  throw Error('Live deployment is missing or split; release denied.');
 return versions[0].version_id;
}
export function isReviewedSource(current,hashes){
 const expected=new Map(Object.entries(hashes||{}));
 return expected.size===8&&current.size===8&&[...expected].every(([name,sha])=>
  current.has(name)&&gitBlob(current.get(name))===sha);
}
