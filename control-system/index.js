const DASHBOARD_HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<meta name=\"robots\" content=\"noindex\">\n<title>YorpHives Headquarters — Control System</title>\n<style>\n:root{color-scheme:dark}*{box-sizing:border-box}\nbody{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;background:#0f172a;color:#f8fafc;padding:40px 20px;max-width:800px;margin:auto;line-height:1.55}\nh1{color:#38bdf8;font-size:clamp(23px,5vw,30px);line-height:1.2}h3{margin-top:0}p{color:#b6c6da}\n.card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;margin-bottom:20px}\nbutton{background:#0ea5e9;color:#fff;border:none;padding:12px 18px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:15px;min-height:44px}\nbutton:hover{background:#0284c7}button:focus-visible,input:focus-visible{outline:3px solid #7dd3fc;outline-offset:3px}button:disabled{opacity:.55;cursor:progress}\nbutton.secondary{background:#334155}button.secondary:hover{background:#475569}\ninput{padding:12px;border:1px solid #64748b;background:#0f172a;color:white;border-radius:6px;min-height:44px;min-width:0;flex:1;font-size:15px}\n.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px}\npre{background:#0f172a;padding:15px;border-radius:6px;overflow-x:auto;color:#38bdf8;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;min-height:110px}\n#notice{font-size:14px;color:#a9c5da;margin:10px 0 0}small{color:#94a3b8}#private{display:none}\n@media(max-width:480px){body{padding:22px 14px}.card{padding:16px}.actions>*{width:100%}}\n</style>\n</head>\n<body>\n<h1>🛡️ YorpHives Headquarters Control System</h1>\n<p>Private operational intelligence, website uptime, security-header checks and open-source product scouting.</p>\n<div class=\"card\" id=\"login\">\n  <h3>Private access</h3>\n  <form id=\"unlockForm\" class=\"actions\">\n    <input id=\"key\" type=\"password\" autocomplete=\"off\" placeholder=\"Enter preview access key\" aria-label=\"Preview access key\" required>\n    <button type=\"submit\">Unlock Dashboard</button>\n  </form>\n  <p id=\"loginNotice\" role=\"status\">Access key stays in this browser tab only.</p>\n</div>\n<div id=\"private\">\n  <div class=\"card\">\n    <h3>System Actions</h3>\n    <div class=\"actions\">\n      <button id=\"run\" type=\"button\">Run Manual Audit Now</button>\n      <button class=\"secondary\" id=\"refresh\" type=\"button\">Refresh Latest Report</button>\n      <button class=\"secondary\" id=\"lock\" type=\"button\">Lock</button>\n    </div>\n    <p id=\"notice\" role=\"status\" aria-live=\"polite\">Ready.</p>\n  </div>\n  <div class=\"card\">\n    <h3>Latest Intelligence Report</h3>\n    <pre id=\"report\" aria-live=\"polite\">Loading status...</pre>\n    <small>Scheduled checks run every six hours (UTC). Reports are stored in private Cloudflare KV.</small>\n  </div>\n</div>\n<script>\n(function(){\n  const byId=(id)=>document.getElementById(id);\n  let accessKey=sessionStorage.getItem(\"yorp-control-token\")||\"\";\n  function view(open){byId(\"login\").style.display=open?\"none\":\"block\";byId(\"private\").style.display=open?\"block\":\"none\"}\n  function notice(message){byId(\"notice\").textContent=message}\n  function lock(message){accessKey=\"\";sessionStorage.removeItem(\"yorp-control-token\");byId(\"key\").value=\"\";view(false);byId(\"loginNotice\").textContent=message||\"Dashboard locked.\"}\n  async function requestAudit(path,method){\n    const response=await fetch(path,{method:method||\"GET\",cache:\"no-store\",headers:{\"Authorization\":\"Bearer \"+accessKey}});\n    let data;try{data=await response.json()}catch(e){throw new Error(\"Invalid server response\")}\n    if(response.status===401){lock(\"Access key rejected. Enter a valid key.\");throw new Error(\"Unauthorized\")}\n    if(!response.ok)throw new Error(data.error||\"Request failed (\"+response.status+\")\");\n    return data;\n  }\n  async function refresh(){\n    notice(\"Loading latest report...\");\n    try{const report=await requestAudit(\"/api/status\");byId(\"report\").textContent=JSON.stringify(report,null,2);notice(report.timestamp?\"Report refreshed.\":\"No audits executed yet.\")}\n    catch(e){byId(\"report\").textContent=e.message;notice(e.message)}\n  }\n  byId(\"unlockForm\").addEventListener(\"submit\",function(e){\n    e.preventDefault();accessKey=byId(\"key\").value.trim();sessionStorage.setItem(\"yorp-control-token\",accessKey);view(true);refresh();\n  });\n  byId(\"run\").addEventListener(\"click\",async function(){\n    this.disabled=true;notice(\"Running fresh audit...\");byId(\"report\").textContent=\"Running fresh audit across the edge network...\";\n    try{const result=await requestAudit(\"/api/run-audit\",\"POST\");byId(\"report\").textContent=JSON.stringify(result.report,null,2);notice(\"Audit completed and stored.\")}\n    catch(e){byId(\"report\").textContent=e.message;notice(e.message)}\n    finally{this.disabled=false}\n  });\n  byId(\"refresh\").addEventListener(\"click\",refresh);\n  byId(\"lock\").addEventListener(\"click\",()=>lock());\n  if(accessKey){view(true);refresh()}else view(false);\n})();\n</script>\n</body>\n</html>";

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function authorized(request, env) {
  if (!env.CONTROL_TOKEN) return false;
  const encoder = new TextEncoder();
  const actual = request.headers.get("Authorization") || "";
  const expected = "Bearer " + env.CONTROL_TOKEN;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runYorpControlSystem(env));
  },

  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;

    if (path === "/" && request.method === "GET") {
      return new Response(DASHBOARD_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
          "X-Frame-Options": "DENY",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer"
        }
      });
    }

    const isStatus = path === "/api/status" || path === "/api/headquarters/status";
    const isRun = path === "/api/run-audit" || path === "/api/headquarters/run-audit";
    if (!isStatus && !isRun) return json({ error: "Not found" }, 404);
    if (request.method !== (isStatus ? "GET" : "POST")) return json({ error: "Method not allowed" }, 405);
    if (!(await authorized(request, env))) return json({ error: "Unauthorized" }, 401);
    if (!env.CONTROL_KV) return json({ error: "CONTROL_KV binding missing" }, 503);

    try {
      if (isStatus) {
        const latest = await env.CONTROL_KV.get("LATEST_AUDIT_REPORT", { type: "json" });
        return json(latest || { message: "No audits executed yet." });
      }
      const report = await runYorpControlSystem(env);
      return json({ success: true, report });
    } catch (error) {
      console.error("Control system audit failed", error);
      return json({ error: "Audit could not be completed." }, 500);
    }
  }
};

async function runYorpControlSystem(env) {
  const targetUrl = env.TARGET_URL || "https://yorphives.com";
  const auditLog = {
    timestamp: new Date().toISOString(),
    uptime: await checkUptime(targetUrl),
    security: await checkSecurityHeaders(targetUrl),
    marketScout: await scoutOpenSourceProducts()
  };
  if (!env.CONTROL_KV) throw new Error("CONTROL_KV binding missing");
  await env.CONTROL_KV.put("LATEST_AUDIT_REPORT", JSON.stringify(auditLog));
  return auditLog;
}

async function checkUptime(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "YorpHives-HQ-Auditor/1.0" }
    });
    return {
      status: res.status === 200 ? "UP" : "DOWN",
      statusCode: res.status,
      error: res.status !== 200 ? "HTTP " + res.status : null
    };
  } catch (error) {
    return { status: "DOWN", statusCode: 0, error: error.message };
  }
}

async function checkSecurityHeaders(url) {
  const warnings = [];
  try {
    const res = await fetch(url, { method: "HEAD" });
    const headers = res.headers;
    if (!headers.get("strict-transport-security")) warnings.push("Missing HSTS header (Vulnerability risk)");
    if (!headers.get("content-security-policy")) warnings.push("Missing Content-Security-Policy (CSP)");
    const poweredBy = headers.get("x-powered-by");
    if (poweredBy) warnings.push("Exposing technology stack via X-Powered-By: " + poweredBy);
  } catch (error) {
    warnings.push("Could not fetch headers: " + error.message);
  }
  return { warnings };
}

async function scoutOpenSourceProducts() {
  try {
    const ghRes = await fetch(
      "https://api.github.com/search/repositories?q=topic:ai+topic:serverless+created:>2026-10-01&sort=stars&order=desc&per_page=1",
      { headers: { "User-Agent": "YorpHives-Scout", "Accept": "application/vnd.github+json" } }
    );
    if (!ghRes.ok) throw new Error("GitHub API HTTP " + ghRes.status);
    const data = await ghRes.json();
    if (data.items && data.items.length > 0) {
      const repo = data.items[0];
      return {
        title: repo.full_name,
        description: repo.description || "High-velocity open source utility.",
        revenueAngle: "Packaged as a managed serverless micro-SaaS extension with zero-infrastructure overhead."
      };
    }
  } catch (error) {
    console.warn("GitHub scout unavailable; displaying fallback suggestion", error.message);
  }
  return {
    title: "Edge-Cached AI Micro-Tools",
    description: "Lightweight Wasm modules running directly on Cloudflare Workers for zero-server billing.",
    revenueAngle: "Tiered micro-subscriptions for automated developer workflows.",
    source: "fallback suggestion; not a verified GitHub discovery"
  };
}
