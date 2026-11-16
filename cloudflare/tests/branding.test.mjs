import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
test("Official HQ branding contains the approved original WebP files",()=>{
  const html=readFileSync(join(root,"index.html"),"utf8");
  assert.match(html,/class="brand-logo" src="\.\/assets\/yorphives-logo\.webp\?v=ba0f325e"/);
  assert.match(html,/class="brand-label"><strong>YorpHives<\/strong><small>HEADQUARTERS<\/small>/);
  assert.match(html,/class="mobile-brand-icon" src="\.\/assets\/yorphives-mark\.webp\?v=7f78695a"/);
  assert.match(html,/<link rel="icon" type="image\/webp" href="\.\/assets\/yorphives-mark\.webp\?v=7f78695a">/);
  assert.doesNotMatch(html,/brand-symbol|FOUNDER SPACE/);
  const approvedHashes={"yorphives-logo.webp":"ba0f325ea6109cee438aecd2624f656558f23a254aeb5c502e26c302cffa4114","yorphives-mark.webp":"7f78695ae874e7f72c524227e84c639faa0370fe4199802a40b917d7721fcb22"};
  for(const name of ["yorphives-logo.webp","yorphives-mark.webp"]){
    const bytes=readFileSync(join(root,"assets",name));
    assert.equal(bytes.toString("ascii",0,4),"RIFF");
    assert.equal(bytes.toString("ascii",8,12),"WEBP");
    assert(bytes.length>4000 && bytes.length<150000);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),approvedHashes[name]);
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
