// Copy only three vetted browser files and two approved logo images. Never publish repository, secrets or evidence files.
import { copyFileSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const dest=join(here,"dist");
rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});
for(const item of ["index.html","styles.css","dashboard.js"]){
 const source=join(root,item),target=join(dest,item);
 const text=readFileSync(source,"utf8");
 if(/<script[^>]+src=["']https?:/i.test(text) || /<link[^>]+href=["']https?:/i.test(text)) {
   throw new Error("Unexpected externally hosted asset in "+item);
 }
 writeFileSync(target,text,"utf8");
}
// Brand assets are fixed, local, and explicitly allowlisted.
mkdirSync(join(dest,"assets"),{recursive:true});
for(const imageName of ["yorphives-logo.webp","yorphives-mark.webp"]){
  copyFileSync(join(root,"assets",imageName),join(dest,"assets",imageName));
}
console.log("Cloudflare assets: three UI files and two official logo images (no secrets).");
