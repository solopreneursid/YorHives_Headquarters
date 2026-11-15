// Copy ONLY three vetted browser assets. Never publish repository, secrets or evidence files.
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
console.log("Cloudflare staging assets built: index.html, styles.css, dashboard.js (no secrets or project files).");
