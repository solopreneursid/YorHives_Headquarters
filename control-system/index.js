const DASHBOARD_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n    <meta name=\"robots\" content=\"noindex\">\n    <title>YorpHives Headquarters</title>\n    <style>\n        :root { --bg: #0f172a; --card: #1e293b; --border: #334155; --text: #f8fafc; --accent: #38bdf8; --green: #22c55e; --red: #ef4444; }\n        body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 30px; max-width: 1000px; margin: auto; }\n        .hidden { display: none !important; }\n        .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }\n        h1, h2, h3 { color: var(--accent); margin-top: 0; }\n        input[type=\"password\"] { background: #0f172a; border: 1px solid var(--border); color: white; padding: 12px; border-radius: 6px; width: 300px; font-size: 16px; }\n        button { background: var(--accent); color: #0f172a; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px; }\n        button:hover { background: #0ea5e9; }\n        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }\n        .badge-healthy { background: rgba(34,197,94,0.2); color: var(--green); }\n        .badge-alert { background: rgba(239,68,68,0.2); color: var(--red); }\n        ul { padding-left: 20px; }\n        li { margin-bottom: 8px; }\n        input[type=\"password\"] { max-width: 100%; box-sizing: border-box; }\n    button { min-height: 44px; }\n    button:focus-visible,input:focus-visible { outline: 3px solid #7dd3fc; outline-offset: 3px; }\n    #auth-error { min-height: 1.3em; color: #fca5a5; font-size: 13px; }\n    #audit-status { font-size: 13px; color: #94a3b8; }\n    @media(max-width:600px) { body{padding:16px} #auth-screen{margin:45px auto !important;} #dashboard header{display:block !important;} #dashboard header button{width:100%; margin-top:10px} .card{padding:16px} }\n    </style>\n</head>\n<body>\n\n    <!-- LOGIN SCREEN -->\n    <div id=\"auth-screen\" class=\"card\" style=\"max-width: 450px; margin: 100px auto; text-align: center;\">\n        <h1>🛡️ YorpHives Headquarters</h1>\n        <p>Private operational intelligence and control system.</p>\n        <div style=\"margin: 20px 0;\">\n            <input type=\"password\" id=\"access-key\" placeholder=\"Enter private access key\" autocomplete=\"off\" aria-label=\"Private access key\">\n        </div>\n        <button onclick=\"unlockDashboard()\">Unlock Dashboard</button>\n        <p id=\"auth-error\" role=\"alert\"></p>\n        <p style=\"font-size: 12px; color: #64748b; margin-top: 15px;\">Access key stays stored in this browser session only.</p>\n    </div>\n\n    <!-- MAIN DASHBOARD -->\n    <div id=\"dashboard\" class=\"hidden\">\n        <header style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;\">\n            <div>\n                <h1>🛡️ YorpHives Headquarters</h1>\n                <p>Autonomous Edge Control System & Chief Operations Officer</p>\n            </div>\n            <button id=\"audit-button\" onclick=\"runAudit()\" style=\"background: #22c55e; color: #0f172a;\">Run Full Audit Now</button>\n        </header>\n\n        <p id=\"audit-status\" role=\"status\" aria-live=\"polite\"></p>\n        <!-- System Health & Uptime -->\n        <div class=\"card\">\n            <h3>🌐 Website Health & Uptime</h3>\n            <div id=\"health-content\">Loading health status...</div>\n        </div>\n\n        <!-- Vulnerabilities & Security -->\n        <div class=\"card\">\n            <h3>🔒 Vulnerabilities & Security Headers</h3>\n            <ul id=\"security-content\">Loading security audit...</ul>\n        </div>\n\n        <!-- Open Source Product Scout -->\n        <div class=\"card\">\n            <h3>💡 Open-Source Product & Integration Scouting</h3>\n            <div id=\"scout-content\">Loading market research feeds...</div>\n        </div>\n\n        <!-- Expansion Strategy -->\n        <div class=\"card\">\n            <h3>📈 Website Expansion Strategy</h3>\n            <div id=\"expansion-content\">Loading expansion metrics...</div>\n        </div>\n\n        <!-- Revenue Opportunities -->\n        <div class=\"card\">\n            <h3>💰 Revenue Generation Opportunities</h3>\n            <div id=\"revenue-content\">Loading monetization intelligence...</div>\n        </div>\n    </div>\n\n    <script>\n        const WORKER_URL = window.location.origin; // Same-origin API; no wildcard CORS or cross-site key forwarding\n\n        function unlockDashboard() {\n            const key = document.getElementById('access-key').value.trim();\n            if (!key) return alert(\"Please enter your access key.\");\n            document.getElementById('auth-error').textContent = '';\n            sessionStorage.setItem('hq_key', key);\n            verifyAndLoad();\n        }\n\n        async function verifyAndLoad() {\n            const key = sessionStorage.getItem('hq_key');\n            if (!key) return;\n\n            try {\n                const res = await fetch(`${WORKER_URL}/api/status`, {\n                    headers: { \"X-Access-Key\": key }\n                });\n                if (res.status === 401) {\n                    document.getElementById(\"auth-error\").textContent = \"Invalid access key. Try again.\";\n                    sessionStorage.removeItem('hq_key');\n                    return;\n                }\n                if (!res.ok) throw new Error(\"Status request failed (HTTP \" + res.status + \")\");\n                const data = await res.json();\n                renderDashboard(data);\n                document.getElementById('auth-screen').classList.add('hidden');\n                document.getElementById('dashboard').classList.remove('hidden');\n            } catch (err) {\n                document.getElementById(\"auth-error\").textContent = \"Failed to connect to Headquarters worker edge.\";\n            }\n        }\n\n        async function runAudit() {\n            const key = sessionStorage.getItem('hq_key');\n            const button = document.getElementById('audit-button');\n            button.disabled = true;\n            document.getElementById('audit-status').textContent = \"Running edge diagnostic audit...\";\n            try {\n                const res = await fetch(`${WORKER_URL}/api/run-audit`, {\n                    method: \"POST\",\n                    headers: { \"X-Access-Key\": key }\n                });\n                if (!res.ok) throw new Error(\"Audit failed (HTTP \" + res.status + \")\");\n                const data = await res.json();\n                renderDashboard(data.report);\n                document.getElementById('audit-status').textContent = \"Audit completed and saved.\";\n            } catch (err) {\n                document.getElementById('audit-status').textContent = err.message;\n            } finally {\n                button.disabled = false;\n            }\n        }\n\n        function safe(value) {\n            return String(value ?? \"\").replace(/[&<>\"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]));\n        }\n\n        function renderDashboard(data) {\n            if (!data || data.message || !data.health || !Array.isArray(data.security) || !Array.isArray(data.marketScout)) {\n                document.getElementById('health-content').textContent = \"No audit data recorded yet. Click Run Full Audit Now.\";\n                for (const id of [\"security-content\",\"scout-content\",\"expansion-content\",\"revenue-content\"]) document.getElementById(id).textContent = \"Awaiting first audit.\";\n                return;\n            }\n\n            // Health\n            const h = data.health;\n            document.getElementById('health-content').innerHTML = `\n                <p>Status: <span class=\"badge ${h.status === 'HEALTHY' ? 'badge-healthy' : 'badge-alert'}\">${safe(h.status)}</span> (HTTP ${safe(h.statusCode)})</p>\n                <p>Response Latency: <strong>${safe(h.latencyMs)}ms</strong></p>\n                <p>Notes: ${safe(h.notes)}</p>\n                <p style=\"font-size: 12px; color: #94a3b8;\">Last Audited: ${safe(data.timestamp)}</p>\n            `;\n\n            // Security\n            let secHtml = \"\";\n            (data.security || []).forEach(issue => {\n                secHtml += `<li><strong>[${safe(issue.type)}]</strong> (${safe(issue.severity)}): ${safe(issue.message)}</li>`;\n            });\n            document.getElementById('security-content').innerHTML = secHtml;\n\n            // Scout\n            let scoutHtml = \"\";\n            (data.marketScout || []).forEach(item => {\n                scoutHtml += `<div style=\"margin-bottom: 15px; border-bottom: 1px solid #334155; padding-bottom: 10px;\">\n                    <strong>${safe(item.title)}</strong> ${item.stars ? `⭐ ${safe(item.stars)}` : ''}<br>\n                    <p style=\"margin: 5px 0; color: #cbd5e1;\">${safe(item.description)}</p>\n                    <span style=\"font-size: 13px; color: #38bdf8;\">💡 Angle: ${safe(item.integrationAngle)}</span>\n                </div>`;\n            });\n            document.getElementById('scout-content').innerHTML = scoutHtml;\n\n            // Expansion\n            let expHtml = \"\";\n            (data.expansion || []).forEach(exp => {\n                expHtml += `<p><strong>${safe(exp.module)}</strong> [${safe(exp.status)}]<br><span style=\"color: #cbd5e1;\">${safe(exp.recommendation)}</span></p>`;\n            });\n            document.getElementById('expansion-content').innerHTML = expHtml;\n\n            // Revenue\n            let revHtml = \"\";\n            (data.revenue || []).forEach(rev => {\n                revHtml += `<p><strong>${safe(rev.model)}</strong> (Potential: ${safe(rev.potential)})<br><span style=\"color: #cbd5e1;\">${safe(rev.strategy)}</span></p>`;\n            });\n            document.getElementById('revenue-content').innerHTML = revHtml;\n        }\n\n        // Auto-load if key is already in session\n        if (sessionStorage.getItem('hq_key')) {\n            verifyAndLoad();\n        }\n    document.getElementById(\"access-key\").addEventListener(\"keydown\", (event) => { if (event.key === \"Enter\") unlockDashboard(); });\n    </script>\n</body>\n</html>\n";
async function keysMatch(actual, expected) {
  if (!actual || !expected) return false;
  const coder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", coder.encode(actual)),
    crypto.subtle.digest("SHA-256", coder.encode(expected))
  ]);
  const a = new Uint8Array(leftHash), b = new Uint8Array(rightHash);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export default {
  // Cron Trigger: Background automated check
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runYorpControlSystem(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const kv = env.CONTROL_KV;

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(DASHBOARD_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    const corsHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    };
    const isStatus = url.pathname === "/api/status" || url.pathname === "/api/headquarters/status";
    const isRun = url.pathname === "/api/run-audit" || url.pathname === "/api/headquarters/run-audit";
    if (!isStatus && !isRun) return new Response(JSON.stringify({error:"Not found"}), {status:404, headers:corsHeaders});
    if (request.method !== (isStatus ? "GET" : "POST")) {
      return new Response(JSON.stringify({error:"Method not allowed"}), {status:405, headers:corsHeaders});
    }

    // Production authentication uses only the encrypted HQ_ACCESS_KEY secret.
    // Never accept keys through query strings or legacy shared bindings.
    const clientKey = request.headers.get("X-Access-Key") || "";
    const configuredKey = env.HQ_ACCESS_KEY;
    if (!configuredKey || !(await keysMatch(clientKey, configuredKey))) {
      return new Response(JSON.stringify({ error: "Unauthorized. Private access only." }), {
        status: 401,
        headers: corsHeaders
      });
    }
    if (!kv) return new Response(JSON.stringify({error:"CONTROL_KV missing"}), {status:503,headers:corsHeaders});

    // Route 1: Fetch latest intelligence report
    if (isStatus) {
      const report = await kv.get("LATEST_AUDIT_REPORT", { type: "json" });
      return new Response(JSON.stringify(report && report.health && Array.isArray(report.security) && Array.isArray(report.marketScout) ? report : { message: "No five-module audit executed yet. Click Run Full Audit Now." }), {
        headers: corsHeaders
      });
    }

    // Route 2: Trigger a full system audit manually
    if (isRun) {
      const report = await runYorpControlSystem(env);
      return new Response(JSON.stringify({ success: true, report }), {
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ message: "YorpHives HQ Engine Active 🛡️" }), { headers: corsHeaders });
  }
};

async function runYorpControlSystem(env) {
  const targetUrl = env.TARGET_URL || "https://yorphives.com";
  const kv = env.CONTROL_KV;
  const timestamp = new Date().toISOString();

  let auditLog = {
    timestamp: timestamp,
    health: await checkWebsiteHealth(targetUrl),
    security: await checkVulnerabilities(targetUrl),
    marketScout: await scoutOpenSourceProducts(),
    expansion: evaluateWebsiteExpansion(),
    revenue: generateRevenueOpportunities()
  };

  await kv.put("LATEST_AUDIT_REPORT", JSON.stringify(auditLog));
  return auditLog;
}

// 1. Website Health & Bug Pinger
async function checkWebsiteHealth(url) {
  try {
    const start = Date.now();
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": "YorpHives-HQ-Auditor/1.0" } });
    const latency = Date.now() - start;

    return {
      status: res.status === 200 ? "HEALTHY" : "DEGRADED",
      statusCode: res.status,
      latencyMs: latency,
      notes: res.status === 200 ? "Homepage responded with HTTP 200 OK." : `Unexpected status code: ${res.status}`
    };
  } catch (err) {
    return { status: "DOWN", statusCode: 0, latencyMs: 0, notes: `Connection failed: ${err.message}` };
  }
}

// 2. Vulnerability & Deprecation Scanner
async function checkVulnerabilities(url) {
  let issues = [];
  try {
    const res = await fetch(url, { method: "HEAD" });
    const headers = res.headers;

    if (!headers.get("strict-transport-security")) {
      issues.push({ type: "Vulnerability", severity: "Medium", message: "Missing HSTS header. Risk of protocol downgrade attacks." });
    }
    if (!headers.get("content-security-policy")) {
      issues.push({ type: "Vulnerability", severity: "High", message: "Missing Content-Security-Policy (CSP). Increased XSS vulnerability surface." });
    }
    const poweredBy = headers.get("x-powered-by");
    if (poweredBy) {
      issues.push({ type: "Deprecation/Exposure", severity: "Low", message: `Exposing tech stack signature: X-Powered-By: ${poweredBy}` });
    }
  } catch (err) {
    issues.push({ type: "System Error", severity: "High", message: `Could not inspect security headers: ${err.message}` });
  }

  if (issues.length === 0) {
    issues.push({ type: "Secure", severity: "None", message: "No issues detected in these security headers; this is not a full vulnerability scan." });
  }
  return issues;
}

// 3. Open-Source Product Scout (GitHub API)
async function scoutOpenSourceProducts() {
  try {
    const ghRes = await fetch("https://api.github.com/search/repositories?q=topic:ai+topic:serverless+created:>2026-10-01&sort=stars&order=desc&per_page=3", {
      headers: { "User-Agent": "YorpHives-Scout", "Accept": "application/vnd.github+json" }
    });
    if (!ghRes.ok) throw new Error("GitHub API HTTP " + ghRes.status);
    const data = await ghRes.json();
    if (data.items && data.items.length > 0) {
      return data.items.map(repo => ({
        title: repo.full_name,
        description: repo.description || "No description provided.",
        stars: repo.stargazers_count,
        url: repo.html_url,
        integrationAngle: "Can be packaged as a lightweight serverless micro-extension or white-labeled tool."
      }));
    }
  } catch (e) {
    // Fallback if rate limited
  }
  return [{
    title: "Edge-Cached AI Micro-Tools",
    source: "fallback suggestion, not a verified GitHub repository",
    description: "Lightweight Wasm modules running directly on Cloudflare Workers.",
    integrationAngle: "Zero-infrastructure micro-SaaS wrapper."
  }];
}

// 4. Website Expansion Evaluator
function evaluateWebsiteExpansion() {
  return [
    {
      module: "Documorph Integration",
      status: "Ready for Development",
      recommendation: "Deploy client-side PDF/document transformation tools as an edge-native utility to capture organic developer traffic."
    },
    {
      module: "Automated Sitemap & SEO Indexing",
      status: "Recommended",
      recommendation: "Implement automated sitemap generation via Cloudflare Workers cron to speed up search engine indexing for new micro-utilities."
    }
  ];
}

// 5. Revenue Generation & Opportunity Scans
function generateRevenueOpportunities() {
  return [
    {
      model: "Micro-SaaS Utility Tiers",
      potential: "High",
      strategy: "Offer free basic client-side file/text utilities with paid API export tiers managed via zero-database stripe/razorpay webhook edge links."
    },
    {
      model: "Developer Toolkit Bundles",
      potential: "Medium",
      strategy: "Bundle automated utility scripts into a single private developer subscription package."
    }
  ];
}
