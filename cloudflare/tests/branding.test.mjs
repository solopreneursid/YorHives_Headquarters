import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
test("Official HQ branding contains the approved original WebP files",()=>{
  const html=readFileSync(join(root,"index.html"),"utf8");
  assert.match(html,/class="brand-logo" src="\.\/assets\/yorphives-logo\.webp"/);
  assert.match(html,/class="mobile-brand-icon" src="\.\/assets\/yorphives-mark\.webp"/);
  assert.match(html,/<link rel="icon" type="image\/webp" href="\.\/assets\/yorphives-mark\.webp">/);
  assert.doesNotMatch(html,/brand-symbol|FOUNDER SPACE/);
  for(const name of ["yorphives-logo.webp","yorphives-mark.webp"]){
    const bytes=readFileSync(join(root,"assets",name));
    assert.equal(bytes.toString("ascii",0,4),"RIFF");
    assert.equal(bytes.toString("ascii",8,12),"WEBP");
    assert(bytes.length>4000 && bytes.length<150000);
  }
});
test("Pilot only serves official logo to authenticated founder",async()=>{
  execFileSync(process.execPath,[join(root,"cloudflare/build-standalone.mjs")],{cwd:root,timeout:20000});
  const {default:worker}=await import(pathToFileURL(join(root,"cloudflare/.generated/standalone-worker.mjs")).href);
  const owner="owner-test@example.com",aud="test-brand-audience-at-least-10";
  const env={ACCESS_OWNER_EMAIL:owner,ACCESS_AUD:aud};
  const founder={access:{aud,async getIdentity(){return {email:owner};}}};
  for(const name of ["yorphives-logo.webp","yorphives-mark.webp"]){
    const route="/assets/"+name;
    const request=new Request("https://hq.example.workers.dev"+route);
    const anonymous=await worker.fetch(request,env,{});
    assert.equal(anonymous.status,403);
    const served=await worker.fetch(request,env,founder);
    assert.equal(served.status,200);
    assert.equal(served.headers.get("content-type"),"image/webp");
    const bytes=new Uint8Array(await served.arrayBuffer());
    assert.equal(Buffer.from(bytes).toString("ascii",0,4),"RIFF");
    assert.deepEqual(bytes,new Uint8Array(readFileSync(join(root,"assets",name))));
    const head=await worker.fetch(new Request(request.url,{method:"HEAD"}),env,founder);
    assert.equal(head.status,200);
    assert.equal((await head.arrayBuffer()).byteLength,0);
  }
  const unknown=await worker.fetch(new Request("https://hq.example.workers.dev/assets/unapproved.webp"),env,founder);
  assert.equal(unknown.status,503);
});
