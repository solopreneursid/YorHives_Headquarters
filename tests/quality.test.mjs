import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const self = path.dirname(fileURLToPath(import.meta.url));
const checker = path.resolve(self, "../scripts/qa-check.mjs");
const makeFixture = () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "yorphives-qa-"));
  fs.writeFileSync(path.join(folder, "index.html"), '<!doctype html><html><head><link href="./styles.css" rel="stylesheet"><script defer src="./dashboard.js"></script></head><body><button data-nav="governance">go</button><section id="view-governance"></section><div id="okay"></div></body></html>');
  fs.writeFileSync(path.join(folder, "dashboard.js"), 'const $ = (id) => document.getElementById(id); $("okay"); const state = { origin: "preview" };\n');
  fs.writeFileSync(path.join(folder, "styles.css"), "[hidden] { display: none !important; }\n");
  return folder;
};
const run = (folder, format = []) => spawnSync(process.execPath, [checker, folder, ...format], { encoding: "utf8", timeout: 15000 });

test("valid fixture passes deterministic reviewer", (t) => {
  const folder = makeFixture(); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const result = run(folder);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("missing element ID is a blocking issue", (t) => {
  const folder = makeFixture(); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.appendFileSync(path.join(folder, "dashboard.js"), '$("missing-control");\n');
  const result = run(folder);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /missing-dom-target/);
});

test("invalid JavaScript is rejected", (t) => {
  const folder = makeFixture(); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.appendFileSync(path.join(folder, "dashboard.js"), "function broken( {\n");
  const result = run(folder);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /javascript-syntax/);
});

test("dangerous DOM sink produces a warning", (t) => {
  const folder = makeFixture(); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.appendFileSync(path.join(folder, "dashboard.js"), "document.body.innerHTML = '<h1>unsafe</h1>';\n");
  const result = run(folder);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /unsafe-html/);
});

test("reviewdog output uses machine-readable diagnostics", (t) => {
  const folder = makeFixture(); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.appendFileSync(path.join(folder, "dashboard.js"), '$("missing-control");\n');
  const result = run(folder, ["--rdjsonl"]);
  assert.equal(result.status, 1);
  const records = result.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(records[0].location.path, "dashboard.js");
  assert.equal(records[0].severity, "ERROR");
});
