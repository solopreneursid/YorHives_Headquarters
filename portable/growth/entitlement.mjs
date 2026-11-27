/** Offline commercial entitlement primitives. No payment processing, telemetry or automatic renewal. */
import {createPublicKey,createPrivateKey,sign,verify} from 'node:crypto';
const ID=/^[a-z][a-z0-9-]{2,39}$/;
const PLANS=new Set(['evaluation','standard','professional']);
function body(x){
 if(!x||x.version!==1||!ID.test(x.customerId||'')||!PLANS.has(x.plan)||typeof x.issuedAt!=='string'||typeof x.expiresAt!=='string')throw Error('Invalid entitlement');
 const start=Date.parse(x.issuedAt),end=Date.parse(x.expiresAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>366*86400000)throw Error('Invalid entitlement period');
 return JSON.stringify({version:1,customerId:x.customerId,plan:x.plan,issuedAt:x.issuedAt,expiresAt:x.expiresAt});
}
export function issueEntitlement(record,privateKey){
 const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 required');
 const canonical=body(record);
 return {...JSON.parse(canonical),signature:sign(null,Buffer.from(canonical),key).toString('base64')};
}
export function verifyEntitlement(record,{customerId,publicKey,now=Date.now()}){
 if(!record||record.customerId!==customerId||typeof record.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(record.signature))throw Error('Entitlement identity mismatch');
 const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(body(record)),key,Buffer.from(record.signature,'base64')))throw Error('Invalid entitlement signature');
 if(Date.parse(record.issuedAt)>now||Date.parse(record.expiresAt)<=now)throw Error('Entitlement not active');
 return {customerId,plan:record.plan,expiresAt:record.expiresAt,paidSubscriptionVerified:false,automaticRenewal:false};
}
