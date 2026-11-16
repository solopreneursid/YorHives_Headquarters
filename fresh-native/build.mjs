/** Build inline-sha256-CSP deployable Worker with original founder logo unchanged. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.dirname(new URL(import.meta.url).pathname);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8').trim();
const match=html.match(/<script>([\s\S]*?)<\/script>/);
if(!match||!match[1].trim().endsWith('render();reload();')||match[1].trim()!==js)throw Error('HTML inline script does not match app.js');
if(!html.includes('data:image/')||!html.includes('brand-logo'))throw Error('Founder brand logo missing');
const scriptHash='sha256-'+crypto.createHash('sha256').update(match[1]).digest('base64');
let code=fs.readFileSync(path.join(root,'worker.mjs'),'utf8');
if(!code.includes("'__PAGE_HTML_BUILD_REPLACEMENT__'")||!code.includes("'__INLINE_SCRIPT_HASH__'"))throw Error('Missing build markers');
code=code.replace("'__PAGE_HTML_BUILD_REPLACEMENT__'",JSON.stringify(html)).replace("'__INLINE_SCRIPT_HASH__'",JSON.stringify(scriptHash));
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/worker.mjs'),code);
console.log(JSON.stringify({bytes:Buffer.byteLength(code),htmlBytes:Buffer.byteLength(html),inlineScriptHash:scriptHash}));