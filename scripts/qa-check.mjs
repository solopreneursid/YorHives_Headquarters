#!/usr/bin/env node
/* Dependency-free, read-only quality checks for the Headquarters static UI.
   Safe as a pre-merge check on a copied checkout; emits reviewdog RDJSONL. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
const root = path.resolve(positional[0] || path.join(here, ".."));
const rdjsonl = process.argv.includes("--rdjsonl");
const findings = [];

function report(file, line, level, rule, message) {
  findings.push({ file, line: Math.max(1, line || 1), level, rule, message });
}
function read(file) {
  try { return fs.readFileSync(path.join(root, file), "utf8"); }
  catch (_) { report(file, 1, "ERROR", "missing-file", file + " is missing or unreadable"); return ""; }
}
function lineAt(text, offset) { return text.slice(0, offset).split("\n").length; }

const html = read("index.html");
const js = read("dashboard.js");
const css = read("styles.css");

const syntactic = spawnSync(process.execPath, ["--check", path.join(root, "dashboard.js")], { encoding: "utf8", timeout: 15000 });
if (syntactic.status !== 0) {
  report("dashboard.js", 1, "ERROR", "javascript-syntax", (syntactic.stderr || "JavaScript syntax validation failed").slice(0, 800));
}

const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(m => m[1]));
const used = [...js.matchAll(/\$\(\s*["']([^"']+)["']\s*\)/g)];
for (const match of used) {
  if (!ids.has(match[1])) report("dashboard.js", lineAt(js, match.index), "ERROR", "missing-dom-target", 'JavaScript references absent DOM id "' + match[1] + '"');
}
const idCounts = new Map();
for (const match of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) {
  idCounts.set(match[1], (idCounts.get(match[1]) || 0) + 1);
  if (idCounts.get(match[1]) === 2) report("index.html", lineAt(html, match.index), "ERROR", "duplicate-id", 'Duplicate DOM id "' + match[1] + '"');
}
const views = new Set([...html.matchAll(/\bid=["']view-([a-z-]+)["']/g)].map(m => m[1]));
for (const match of html.matchAll(/data-nav=["']([a-z-]+)["']/g)) {
  if (!views.has(match[1])) report("index.html", lineAt(html, match.index), "ERROR", "broken-navigation", 'Navigation points to missing view "' + match[1] + '"');
}
if (!/<script\b[^>]*\bsrc=["']\.\/dashboard\.js["']/i.test(html)) report("index.html", 1, "ERROR", "script-reference", "Expected local dashboard.js script tag");
if (!/<link\b[^>]*\bhref=["']\.\/styles\.css["']/i.test(html)) report("index.html", 1, "ERROR", "style-reference", "Expected local styles.css reference");
if (/<script\b[^>]*\bsrc=["']https?:\/\//i.test(html)) report("index.html", 1, "ERROR", "remote-script", "Remote JS is prohibited in the HQ interface");
if (/<link\b[^>]*\bhref=["']https?:\/\//i.test(html)) report("index.html", 1, "ERROR", "remote-styles", "Remote styles are prohibited in the HQ interface");

for (const [expr, rule, message] of [
  [/\.innerHTML\s*=/g, "unsafe-html", "Prefer textContent or DOM construction for untrusted findings"],
  [/\beval\s*\(/g, "eval", "Avoid evaluating imported code"],
  [/\bnew\s+Function\s*\(/g, "dynamic-function", "Avoid runtime source compilation"],
  [/\bfetch\s*\(\s*(?!["\x27]\/api\/report["\x27])/g, "external-network", "Only the authenticated same-origin /api/report endpoint is permitted"]
]) {
  for (const match of js.matchAll(expr)) report("dashboard.js", lineAt(js, match.index), "WARNING", rule, message);
}
if (!/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/.test(css)) {
  report("styles.css", 1, "WARNING", "hidden-style", "Hidden views may be displayed when flex/grid CSS overrides the hidden attribute");
}
if (!html.includes("PREVIEW") && !js.includes('origin: "preview"')) {
  report("index.html", 1, "ERROR", "provenance", "Preview records must not masquerade as live monitoring");
}
if (!html.includes('id="view-governance"')) {
  report("index.html", 1, "ERROR", "governance", "Governance screen is required");
}
if (rdjsonl) {
  for (const f of findings) {
    const row = {
      message: f.message,
      location: { path: f.file, range: { start: { line: f.line, column: 1 } } },
      severity: f.level,
      code: { value: "yorphives/" + f.rule, url: "https://github.com/solopreneursid/YorHives_Headquarters" }
    };
    process.stdout.write(JSON.stringify(row) + "\n");
  }
} else {
  for (const f of findings) console.log(f.level + " " + f.file + ":" + f.line + " [" + f.rule + "] " + f.message);
  console.log("Review result: " + findings.filter(f => f.level === "ERROR").length + " error(s), " + findings.filter(f => f.level === "WARNING").length + " warning(s)");
}
process.exitCode = findings.some(f => f.level === "ERROR") ? 1 : 0;
