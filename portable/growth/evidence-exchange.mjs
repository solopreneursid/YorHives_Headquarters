/** Offline authenticated evidence exchange. A locally enrolled Ed25519 key is
 * the authority; a signature attests the export, not accuracy of public claims.
 * No private notes, response records, model secrets or outbound requests. */
import {createPrivateKey,createPublicKey,sign,verify,randomUUID,createHash} from 'node:crypto';
import {publicEvidencePacket} from './local-runtime.mjs';
const ID=/^[a-z][a-z0-9-]{2,39}$/;
const KEY=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_AGE=24*3600000;
function canonical(value){
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(!value||typeof value!=='object')throw Error('Invalid signed content');
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export function keyFingerprint(pem){
 const key=createPublicKey(pem);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 key required');
 return createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
}
export function signDossier(dossier,{tenant,privateKey,now=Date.now()}){
 if(!ID.test(tenant||''))throw Error('Invalid destination tenant');
 const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 key required');
 const packet=publicEvidencePacket(dossier);
 if(!packet.records.length)throw Error('No approved public evidence');
 const body={version:1,kind:'growth-public-evidence',tenant,nonce:randomUUID(),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+MAX_AGE).toISOString(),
  keyId:keyFingerprint(createPublicKey(key).export({type:'spki',format:'pem'})),packet};
 return {...body,signature:sign(null,Buffer.from(canonical(body)),key).toString('base64')};
}
export function verifyDossier(envelope,{tenant,publicKey,pinnedFingerprint,now=Date.now()}){
 if(!envelope||Object.keys(envelope).sort().join(',')!=='expiresAt,issuedAt,keyId,kind,nonce,packet,signature,tenant,version'||
 envelope.version!==1||envelope.kind!=='growth-public-evidence'||!ID.test(tenant||'')||envelope.tenant!==tenant||
 !UUID.test(envelope.nonce||'')||!KEY.test(pinnedFingerprint||'')||envelope.keyId!==pinnedFingerprint||
 keyFingerprint(publicKey)!==pinnedFingerprint||typeof envelope.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature))throw Error('Invalid evidence envelope or trust key');
 const issued=Date.parse(envelope.issuedAt),expires=Date.parse(envelope.expiresAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now+30000||expires<=now||expires-issued!==MAX_AGE)throw Error('Expired or future evidence envelope');
 const {signature,...body}=envelope;const bytes=Buffer.from(canonical(body));
 if(bytes.length>70000||!verify(null,bytes,createPublicKey(publicKey),Buffer.from(signature,'base64')))throw Error('Evidence signature invalid');
 const p=body.packet;
 const dossier={project:{id:p.project.id,name:p.project.name,productProfile:{offer:p.project.offer}},opportunities:p.records.map(x=>({id:x.id,title:x.title,summary:x.summary,sourceUrl:x.sourceUrl}))};
 if(canonical(publicEvidencePacket(dossier))!==canonical(p))throw Error('Invalid public evidence packet');
 return {nonce:body.nonce,dossier,keyId:body.keyId};
}
