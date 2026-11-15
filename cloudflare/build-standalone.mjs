// Reproducible zero-dependency packaging for a private Cloudflare API pilot.
// Does not deploy or add any feature dependencies.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
const here=dirname(fileURLToPath(import.meta.url));
const approved=["index.html","styles.css","dashboard.js"];
const paths={"/index.html":approved[0],"/styles.css":approved[1],"/dashboard.js":approved[2]};
const bundle={};
for(const [route,path] of Object.entries(paths)){
  const data=readFileSync(resolve(here,"..",path),"utf8");
  if(data.length>120000) throw new Error("Oversized UI asset: "+path);
  bundle[route]=data;
}
const worker=readFileSync(join(here,"src","worker.mjs"),"utf8");
const marker="const PILOT_STATIC_BUNDLE = null;";
if(worker.split(marker).length!==2)throw Error("Expected one pilot bundle injection point");
const compiled=worker.replace(marker,"const PILOT_STATIC_BUNDLE = "+JSON.stringify(bundle)+";");
const target=join(here,".generated");
mkdirSync(target,{recursive:true});
writeFileSync(join(target,"standalone-worker.mjs"),compiled,"utf8");
console.log("Built self-contained private pilot Worker with three allowlisted UI assets.");
