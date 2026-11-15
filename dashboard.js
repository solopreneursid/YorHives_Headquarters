/* YorpHives Headquarters — dependency-free, read-only presentation layer.
   Nothing here scans, deploys, edits repositories, or contacts an external API.
   Imported JSON is displayed as unverified user-provided evidence, not live status. */
(() => {
  "use strict";

  const exampleData = {
    assets: [
      { id: "website", name: "YorpHives website", kind: "Public platform", status: "unknown", summary: "No live monitoring connected" },
      { id: "hq", name: "Headquarters", kind: "Private AI office", status: "unknown", summary: "No live monitoring connected" }
    ],
    findings: [
      { id: "f1", title: "Example: investigate exposed credentials", category: "security", priority: "high", asset: "YorpHives website", description: "An example alert showing how security evidence could be surfaced. A future read-only detector should identify suspicious credentials or secrets in files and logs, while keeping the secret values redacted.", recommendation: "If a real finding is confirmed, revoke the affected credential and inspect access history using a separate founder-owned process.", evidence: [], observedAt: "" },
      { id: "f2", title: "Example: review unsupported dependencies", category: "dependencies", priority: "medium", asset: "Headquarters", description: "A demonstration of an outdated-package finding. Real dependency checks will need package names, installed versions, advisory identifiers, and official support dates.", recommendation: "Compare current versions with maintainer support policy, test upgrades in isolation, and propose a founder-reviewed migration.", evidence: [], observedAt: "" },
      { id: "f3", title: "Example: independent uptime visibility", category: "reliability", priority: "medium", asset: "YorpHives website", description: "A demonstration of a monitoring coverage gap. This is not an actual outage or failed check.", recommendation: "Add independent HTTP, TLS, and synthetic journey probes; send observations to the evidence store without permitting infrastructure changes.", evidence: [], observedAt: "" }
    ],
    opportunities: [
      { id: "o1", title: "Niche workflow tools for small teams", category: "product", confidence: "Research needed", description: "Investigate repetitive business workflows where a focused, low-friction tool could provide obvious value to a specific user group.", recommendation: "Interview potential users, assess existing products, and validate willingness to pay with a narrow prototype before building.", evidence: [], observedAt: "" },
      { id: "o2", title: "Productized technical health reports", category: "revenue", confidence: "Research needed", description: "Explore paid, evidence-based website health reports as a potential service or product line. These are illustrative business ideas, not verified demand or income forecasts.", recommendation: "Research competition and pricing, clarify scope and legal obligations, and test whether customers will pay before offering it.", evidence: [], observedAt: "" },
      { id: "o3", title: "Self-hostable open-source bot candidates", category: "technology", confidence: "License review needed", description: "Evaluate free tools for dependency review, uptime detection, vulnerability scans, and browser checks. Candidates for further research include Renovate, Uptime Kuma, Trivy, and Playwright.", recommendation: "Independently verify each project's current license, maintenance, operating cost, security model, and suitability for self-hosting.", evidence: [], observedAt: "" }
    ],
    products: [
      { id: "demo-p1", name: "Example: Image Compressor", url: "", source: "sample", status: "unknown", features: ["Upload image", "Adjust quality"], firstSeen: "", lastChecked: "", active: true },
      { id: "demo-p2", name: "Example: Word Counter", url: "", source: "sample", status: "unknown", features: ["Count words"], firstSeen: "", lastChecked: "", active: true }
    ],
    changes: [
      { id: "demo-c1", url: "", kind: "new-product", severity: "info", summary: "Example: a newly published tool is detected and enrolled automatically.", occurredAt: "" },
      { id: "demo-c2", url: "", kind: "feature-surface-change", severity: "info", summary: "Example: a product's visible controls have changed and should be reviewed.", occurredAt: "" }
    ],
    comparisons: [
      { id: "demo-gap", product: "Example: Image Compressor", competitor: "Hypothetical competitor", missingFeatures: ["Batch processing", "AVIF support"], evidence: [], confidence: "Illustrative only", recommendation: "Validate competitor claims and user demand before prioritizing." }
    ],
    agents: [
      { id: "a1", name: "Engineering & Operations", responsibility: "System health, incidents, performance, maintainability, and safe architecture recommendations.", status: "not_connected" },
      { id: "a2", name: "Security & Independent QA", responsibility: "Vulnerabilities, regression evidence, independent testing, and trust boundaries.", status: "not_connected" },
      { id: "a3", name: "Research & Innovation", responsibility: "Open-source technology scouting, emerging standards, and reusable capabilities.", status: "not_connected" },
      { id: "a4", name: "Global Market Intelligence", responsibility: "Customer pain points, geographic demand signals, and market research.", status: "not_connected" },
      { id: "a5", name: "Product & Growth", responsibility: "Product hypotheses, acquisition opportunities, and user experience improvements.", status: "not_connected" },
      { id: "a6", name: "Revenue & Business", responsibility: "Monetization research, pricing hypotheses, and verified revenue reporting.", status: "not_connected" }
    ],
    activity: [
      { id: "ev1", title: "Example security observation", summary: "A sample activity entry would link to a redacted, reproducible finding.", kind: "security", occurredAt: "" },
      { id: "ev2", title: "Example technology research", summary: "An AI research brief would include open-source licensing and source URLs.", kind: "research", occurredAt: "" }
    ]
  };

  const state = {
    data: exampleData,
    origin: "preview",
    view: "overview",
    findingFilter: "all",
    opportunityFilter: "all",
    selectedDetail: null,
    feedFilter: "all"
  };

  const $ = (id) => document.getElementById(id);
  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-" + name);
    svg.append(use);
    return svg;
  };
  const node = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined && content !== null) element.textContent = String(content);
    return element;
  };
  const append = (parent, ...children) => { children.forEach(child => { if (child) parent.append(child); }); return parent; };
  const cleanText = (value, max = 1000) => typeof value === "string" ? value.slice(0, max).trim() : "";
  const cleanDate = (value) => {
    if (typeof value !== "string" || value.length > 45) return "";
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
  };
  const safeUrl = (input) => {
    try {
      const url = new URL(input);
      return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
    } catch (_) { return ""; }
  };
  const label = (word) => String(word || "").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
  const originLabel = () => state.origin === "preview" ? "Example only" : state.origin === "cloudflare" ? "Cloudflare scheduled evidence — unverified" : state.origin === "local" ? "Private local evidence — unverified" : "Imported — unverified";
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const categoryIcons = { security: "shield", dependencies: "code", reliability: "activity", quality: "check", product: "layers", revenue: "dollar", technology: "radar" };
  const workerIcons = ["activity", "shield", "spark", "radar", "trend", "dollar"];

  function emptyState(title, message) {
    const wrapper = node("div", "empty-state");
    append(wrapper, icon("info"), node("strong", "", title), node("p", "", message));
    return wrapper;
  }

  function showView(view) {
    if (!["overview", "monitoring", "opportunities", "products", "workforce", "activity", "governance"].includes(view)) view = "overview";
    state.view = view;
    document.querySelectorAll(".view").forEach(el => {
      const active = el.id === "view-" + view;
      el.hidden = !active;
      el.classList.toggle("is-visible", active);
    });
    document.querySelectorAll("[data-nav]").forEach(button => {
      const active = button.dataset.nav === view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $("breadcrumb-current").textContent = ({
      overview: "Home", monitoring: "Alerts", opportunities: "Ideas", products: "My tools",
      workforce: "AI team", activity: "History", governance: "Safety & access"
    })[view];
    document.body.classList.remove("nav-open");
    $("sidebar-scrim").hidden = true;
    $("mobile-menu").setAttribute("aria-expanded", "false");
    $("mobile-more").setAttribute("aria-expanded", "false");
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    window.scrollTo({ top: 0, behavior: "instant" });
    $("main-content").focus({ preventScroll: true });
  }

  function renderMetrics() {
    const d = state.data;
    const local = state.origin === "local" || state.origin === "cloudflare";
    const cloud = state.origin === "cloudflare";
    const preview = state.origin === "preview";
    $("metric-assets").textContent = d.assets.length;
    $("metric-findings").textContent = d.findings.length;
    $("metric-opportunities").textContent = d.opportunities.length;
    $("metric-employees").textContent = d.agents.length;
    $("nav-finding-count").textContent = d.findings.length;
    $("metric-assets-caption").textContent = preview ? "Illustrative system inventory" : local ? "Private collector inventory" : "Systems listed in imported file";
    $("metric-findings-caption").textContent = preview ? "Example open observations" : local ? "Local collector observations" : "Findings listed in imported file";
    $("metric-opportunities-caption").textContent = preview ? "Example research leads" : local ? "Collected research hypotheses" : "Leads listed in imported file";
    $("metric-employees-caption").textContent = preview ? "Illustrative team structure" : "Departments in selected report";
    $("metric-assets-footer").textContent = preview ? "Website + headquarters" : "Status not independently verified";
    $("metric-findings-footer").textContent = "For founder review";
    $("metric-opportunities-footer").textContent = "Validate before pursuing";
    $("metric-employees-footer").textContent = "Agent status requires telemetry";
    const observedAt = cleanDate(d.verification?.generatedAt || "");
    $("snapshot-date").textContent = preview ? "Illustrative dashboard" :
      local ? "Local evidence" + (observedAt ? " · " + observedAt : "") : "Imported file · not independently verified";
    $("mode-label").textContent = preview ? "Preview mode" : cloud ? "Cloudflare evidence" : local ? "Private evidence" : "Imported data";
    $("mode-chip").classList.toggle("imported", !preview);
    $("footer-mode").textContent = preview ? "PREVIEW · NOT A LIVE HEALTH REPORT" :
      cloud ? "CLOUDFLARE FREE · OBSERVATION ONLY" : local ? "PRIVATE COLLECTOR · EVIDENCE REQUIRES REVIEW" : "IMPORTED DATA · NOT INDEPENDENTLY VERIFIED";
    $("brief-kind").textContent = preview ? "EXAMPLE" : local ? "LOCAL REPORT" : "IMPORTED";
    const notice = $("data-notice");
    notice.hidden = false;
    const noticeText = notice.querySelector("div");
    noticeText.textContent = preview
      ? "Preview workspace — The records below are examples, not findings from a live scan. Import a report to explore your own observations."
      : local
        ? "Read-only collector report — These are recorded HTTP observations and research leads, not proof that every product feature works or that market demand exists."
        : "Imported report — These values came from a file in your browser. Headquarters has not independently checked them or connected to production systems.";
  }

  function renderHomeFeed() {
    const d=state.data;
    const preview=state.origin==="preview";
    const official=state.origin==="cloudflare" || state.origin==="local";
    const at=cleanDate(d.verification?.generatedAt);
    $("home-updated").textContent=preview?"You're viewing example updates · Not live":
      at?"Last update: "+at+" · "+(official?"Automatic report":"Imported report"):
      "Report timestamp unavailable · Check data source";

    // Hide low-level collector heartbeat keys from the founder's social feed.
    // They remain available in History for auditability.
    const meaningfulActivity=d.activity.filter(item=>
      !/^(last[ _-]?cron|discovery|research|security[ _-]?watch|site[ _-]?bundle[ _-]?fingerprint)$/i.test(item.title));
    $("home-alert-count").textContent=d.findings.length;
    $("home-idea-count").textContent=d.opportunities.length;
    $("home-tool-count").textContent=(state.origin==="cloudflare" && !d.verification?.complete)?"?":d.products.length;
    $("home-update-count").textContent=meaningfulActivity.length+d.changes.length;

    const site=d.assets.find(asset=>asset.kind==="website" || /yorphives website/i.test(asset.name));
    const sitePill=$("home-site-pill");
    const siteCopy=$("home-site-copy");
    sitePill.className="home-site-pill";
    if(preview || !site || site.status==="unknown"){
      sitePill.textContent=preview?"Example · not live":"Status not verified";
      sitePill.classList.add("unknown");
      siteCopy.textContent=preview?"This is an example screen, not a live website check.":
        "No reliable website status in this report yet. Check coverage before assuming the site works.";
    }else if(site.status==="healthy"){
      sitePill.textContent="Reported reachable";
      sitePill.classList.add("good");
      siteCopy.textContent="The latest recorded check reached the website. Individual tool features are not verified.";
    }else{
      sitePill.textContent="Issue reported";
      sitePill.classList.add("warning");
      siteCopy.textContent="A recent check reported a problem. Open Alerts and review the evidence.";
    }

    const lead=[...d.findings].sort((a,b)=>(priorityRank[a.priority]??3)-(priorityRank[b.priority]??3))[0];
    const opportunity=d.opportunities[0];
    const next=$("home-next-copy");
    const nextButton=$("home-next-action");
    if(lead){
      next.textContent="Review: "+lead.title+". Headquarters can suggest what to investigate, not make changes.";
      nextButton.dataset.nav="monitoring";
      nextButton.replaceChildren(document.createTextNode("Review alert "),icon("chevron"));
    }else if(state.origin==="cloudflare" && !d.verification?.complete){
      next.textContent="Your website tool list is incomplete. Review discovery before trusting comparisons.";
      nextButton.dataset.nav="products";
      nextButton.replaceChildren(document.createTextNode("See my tools "),icon("chevron"));
    }else if(opportunity){
      next.textContent="There is an idea worth looking at: "+opportunity.title+". Demand is not verified.";
      nextButton.dataset.nav="opportunities";
      nextButton.replaceChildren(document.createTextNode("Explore ideas "),icon("chevron"));
    }else{
      next.textContent="No decisions are listed in this report. Check coverage; an empty list isn't proof that all is well.";
      nextButton.dataset.nav="monitoring";
      nextButton.replaceChildren(document.createTextNode("Review coverage "),icon("chevron"));
    }

    const entries=[];
    d.findings.forEach(item=>entries.push({
      id:"alert-"+item.id,kind:"alerts",title:item.title,
      text:item.description || "A monitoring observation may need your review.",
      date:item.observedAt,chip:item.priority==="high"?"Needs attention":"For review",
      source:"Monitoring",icon:"shield",action:"Read recommendation",open:()=>showDetail(item,"finding")
    }));
    d.opportunities.forEach(item=>entries.push({
      id:"idea-"+item.id,kind:"ideas",title:item.title,
      text:item.description || "A research lead to investigate before investing.",
      date:item.observedAt,chip:item.kind==="catalog-unverified"?"Catalog incomplete":"Unverified idea",
      source:"Ideas",icon:"spark",action:"Explore idea",open:()=>showDetail(item,"opportunity")
    }));
    d.changes.forEach(item=>entries.push({
      id:"change-"+item.id,kind:"changes",title:item.kind==="new-product"?"New tool spotted":"Website change noticed",
      text:item.summary || "A change was observed. Review its source before drawing conclusions.",
      date:item.occurredAt,chip:"Observation",source:"My tools",icon:"layers",action:"View tools",
      open:()=>showView("products")
    }));
    meaningfulActivity.forEach(item=>entries.push({
      id:"activity-"+item.id,kind:"changes",title:item.title,
      text:item.summary || "An update was logged; see History for details.",
      date:item.occurredAt,chip:"Activity log",source:"HQ history",icon:"clock",action:"View history",
      open:()=>showView("activity")
    }));
    const groupOrder={alerts:0,changes:1,ideas:2};
    entries.sort((a,b)=>{
      const ad=Date.parse(a.date||""),bd=Date.parse(b.date||"");
      const atime=Number.isFinite(ad)?ad:0,btime=Number.isFinite(bd)?bd:0;
      return btime-atime || (groupOrder[a.kind]||0)-(groupOrder[b.kind]||0);
    });
    const filtered=entries.filter(entry=>state.feedFilter==="all" || entry.kind===state.feedFilter).slice(0,8);
    const parent=$("home-feed-list");
    parent.replaceChildren();
    if(!filtered.length){
      parent.append(emptyState(state.feedFilter==="all"?"No updates in this report":"Nothing in this category yet",
        "That doesn't mean everything is healthy. Check when your sources last reported, or choose another filter."));
      return;
    }
    for(const item of filtered){
      const card=node("article","feed-card feed-"+item.kind);
      const avatar=node("span","feed-avatar");
      avatar.append(icon(item.icon));
      const head=node("div","feed-card-top");
      const author=node("div","feed-author");
      append(author,node("strong","",item.source),
        node("small","",cleanDate(item.date)||"No timestamp"));
      const status=node("span","feed-provenance",preview?"EXAMPLE":state.origin==="cloudflare"?"REPORTED":"UNVERIFIED");
      append(head,avatar,author,status);
      const content=node("div","feed-card-content");
      const badge=node("span","feed-badge",item.chip);
      append(content,badge,node("h3","",item.title),
        node("p","",item.text.length>220?item.text.slice(0,217)+"…":item.text));
      const foot=node("div","feed-card-bottom");
      const action=node("button","feed-open",item.action);
      action.type="button";
      action.append(icon("chevron"));
      action.addEventListener("click",item.open);
      append(foot,node("span","feed-safe-note","Read-only · Your decision"),action);
      append(card,head,content,foot);
      parent.append(card);
    }
  }

  function renderBrief() {
    const { findings, opportunities, assets } = state.data;
    $("brief-summary").textContent = state.origin === "preview"
      ? "A focused daily briefing will distill thousands of signals into a handful of decisions. This is an illustrative example, not evidence of checks performed."
      : "This is a summary of the selected evidence report, not a guarantee of real-time monitoring. Confirm sources and scope before taking action.";
    const items = [
      state.origin === "preview"
        ? "Review example monitoring signals to see how incidents are prioritized."
        : findings.length + " observation(s) in the selected report are available for review.",
      state.origin === "preview"
        ? "Explore sample business leads for future product and revenue growth."
        : opportunities.length + " growth lead(s) in the selected report may need validation.",
      state.origin === "preview"
        ? "Connect evidence from your own detectors before trusting status."
        : assets.length + " asset(s) are represented. Imported status alone does not confirm uptime."
    ];
    const parent = $("brief-items");
    parent.replaceChildren();
    items.forEach((message, index) => {
      const entry = node("div", "brief-task");
      append(entry, node("span", "", String(index + 1).padStart(2, "0")), node("p", "", message));
      parent.append(entry);
    });
  }

  function assetStatus(asset) {
    if (state.origin === "preview" || asset.status === "unknown") return { label: "Not verified", kind: "unknown" };
    if (asset.status === "healthy") return { label: "Reported healthy", kind: "ok" };
    return { label: "Reported issue", kind: "issue" };
  }
  function renderCoverage() {
    const parent = $("system-health-grid");
    parent.replaceChildren();
    if (!state.data.assets.length) parent.append(emptyState("No assets listed", "Import asset inventory to populate this panel."));
    state.data.assets.slice(0, 8).forEach(asset => {
      const tile = node("div", "system-tile");
      const head = node("div", "system-tile-header");
      const status = assetStatus(asset);
      const dot = node("span", "status-bubble " + status.kind);
      append(head, icon("layers"), dot);
      append(tile, head, node("strong", "", asset.name), node("small", "", status.label));
      parent.append(tile);
    });
    $("coverage-note").textContent = state.origin === "preview"
      ? "Your systems, monitored independently. Status will appear after a trusted evidence feed is connected."
      : "Imported asset statuses are statements from the file, not independently checked measurements.";
    $("connection-title").textContent = state.origin === "preview" ? "Awaiting live evidence" : "Imported report in view";
    $("connection-subtitle").textContent = "No live detector is connected to this UI.";
  }

  function priorityPill(value) { return node("span", "severity-pill " + (value === "high" ? "" : value), label(value)); }

  function renderPriorityInbox() {
    const parent = $("priority-list");
    parent.replaceChildren();
    const findings = [...state.data.findings].sort((a,b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)).slice(0, 4);
    if (!findings.length) return parent.append(emptyState("No findings in this report", "That does not prove the systems are healthy. Check monitoring coverage."));
    findings.forEach(item => {
      const button = node("button", "priority-item");
      button.type = "button";
      const symbol = node("span", "priority-symbol"); symbol.append(icon(categoryIcons[item.category] || "info"));
      const main = node("span", "priority-item-main");
      append(main, node("strong", "", item.title), node("small", "", item.asset + " · " + originLabel()));
      append(button, symbol, main, priorityPill(item.priority), icon("chevron"));
      button.addEventListener("click", () => showDetail(item, "finding"));
      parent.append(button);
    });
  }

  function renderOpportunityPreview() {
    const parent = $("opportunity-preview");
    parent.replaceChildren();
    if (!state.data.opportunities.length) return parent.append(emptyState("No leads in this report", "Your research agents can eventually fill the radar with sourced opportunities."));
    state.data.opportunities.slice(0, 4).forEach(item => {
      const button = node("button", "opportunity-mini"); button.type = "button";
      const symbol = node("span", "opportunity-symbol"); symbol.append(icon(categoryIcons[item.category] || "radar"));
      const main = node("span", "opportunity-mini-main");
      append(main, node("strong", "", item.title), node("small", "", item.confidence + " · " + originLabel()));
      append(button, symbol, main, node("span", "opportunity-label", label(item.category)), icon("chevron"));
      button.addEventListener("click", () => showDetail(item, "opportunity"));
      parent.append(button);
    });
  }

  function renderFindings() {
    const findings = [...state.data.findings]
      .filter(item => state.findingFilter === "all" || item.category === state.findingFilter)
      .sort((a,b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3));
    const parent = $("findings-list");
    parent.replaceChildren();
    $("monitoring-count").textContent = findings.length + " record(s) · " + originLabel();
    if (!findings.length) return parent.append(emptyState("No matching findings", "Try another filter. An empty list is not proof of a clean scan."));
    findings.forEach(item => {
      const button = node("button", "finding-row"); button.type = "button";
      const primary = node("span", "finding-primary");
      const symbol = node("span", "priority-symbol"); symbol.append(icon(categoryIcons[item.category] || "info"));
      const details = node("span");
      append(details, node("strong", "", item.title), node("small", "", label(item.category) + " · " + originLabel()));
      append(primary, symbol, details);
      const review = node("span", "row-open", "Review"); review.append(icon("chevron"));
      append(button, primary, priorityPill(item.priority), node("span", "finding-asset", item.asset), review);
      button.addEventListener("click", () => showDetail(item, "finding"));
      parent.append(button);
    });
  }

  function renderSecurityWatch() {
    const parent = $("security-watch-list");
    parent.replaceChildren();
    const rows=state.data.securityWatch || [];
    if (!rows.length) {
      parent.append(emptyState("No verified advisory feed records",
        "The public advisory watch may not have run yet, or its source was unavailable. This does not prove your dependencies are secure."));
      return;
    }
    rows.forEach(record => {
      const card=node("article","security-advisory-row");
      const top=node("div","security-advisory-heading");
      append(top,node("strong","",record.title),node("span","security-advisory-level",record.severity.toUpperCase()+" · PUBLIC ADVISORY"));
      const body=node("p","",record.packages.length?"Named packages: "+record.packages.join(", "):"Affected package not established");
      const caveat=node("small","","Applicability to YorpHives is not verified · "+(cleanDate(record.observedAt)||"Time unavailable"));
      card.append(top,body,caveat);
      if(record.source && record.source.startsWith("https://github.com/advisories/")) {
        const link=node("a","source-link","View official advisory");
        link.href=record.source;link.target="_blank";link.rel="noopener noreferrer";
        card.append(link);
      }
      parent.append(card);
    });
  }

  function renderOpportunities() {
    const list = state.data.opportunities.filter(item => state.opportunityFilter === "all" || item.category === state.opportunityFilter);
    const parent = $("opportunities-grid");
    parent.replaceChildren();
    $("opportunity-count").textContent = list.length + " lead(s) · " + originLabel();
    if (!list.length) return parent.append(emptyState("No matching opportunities", "Try another filter, or import new research records."));
    list.forEach(item => {
      const card = node("article", "opportunity-card");
      const top = node("div", "opportunity-card-top");
      const category = node("span", "opportunity-category"); append(category, icon(categoryIcons[item.category] || "radar"), node("span", "", label(item.category)));
      append(top, category, node("span", "outline-pill",
        state.origin === "preview" ? "EXAMPLE" : state.origin === "cloudflare" ? "CLOUDFLARE" :
        state.origin === "local" ? "LOCAL" : "IMPORTED"));
      const bottom = node("div", "card-bottom");
      const open = node("button", "", "Explore lead"); open.type = "button"; open.append(icon("arrow"));
      open.addEventListener("click", () => showDetail(item, "opportunity"));
      append(bottom, node("small", "", item.confidence), open);
      const context = node("div", "lead-context", item.kind === "possible-existing-product" ?
        "POSSIBLE EXISTING TOOL · CHECK FEATURE PARITY" : item.kind === "potential-missing-product" ?
        "POSSIBLE NEW TOOL · VALIDATE DEMAND" : item.kind === "catalog-unverified" ?
        "CATALOG NOT VERIFIED · RESEARCH MENTION ONLY" : "UNVALIDATED RESEARCH LEAD");
      append(card, top, context, node("h3", "", item.title), node("p", "", item.description), bottom);
      parent.append(card);
    });
  }

  function renderWorkforce() {
    const parent = $("workforce-grid");
    parent.replaceChildren();
    if (!state.data.agents.length) return parent.append(emptyState("No departments listed", "Import an agent inventory to see their defined responsibilities."));
    state.data.agents.forEach((agent, index) => {
      const card = node("article", "worker-card");
      const top = node("div", "worker-card-top");
      const avatar = node("span", "worker-avatar"); avatar.append(icon(workerIcons[index % workerIcons.length]));
      append(top, avatar, node("span", "worker-id", "DEPT " + String(index + 1).padStart(2, "0")));
      const status = node("div", "worker-state");
      const bubble = node("span", "status-bubble unknown");
      const current = agent.status === "not_connected" ? "Telemetry not connected" : "Reported state: " + label(agent.status);
      append(status, bubble, node("span", "", current + (state.origin === "preview" ? " · example" : " · imported")));
      append(card, top, node("h3", "", agent.name), node("p", "", agent.responsibility), status);
      parent.append(card);
    });
  }

  function renderActivity() {
    const parent = $("activity-list");
    parent.replaceChildren();
    if (!state.data.activity.length) return parent.append(emptyState("No activity entries", "Connect an audit log or import an evidence report. No data does not mean no events."));
    state.data.activity.forEach(event => {
      const row = node("article", "activity-item");
      const symbol = node("span", "activity-symbol"); symbol.append(icon(event.kind === "security" ? "shield" : "activity"));
      const text = node("div");
      append(text, node("strong", "", event.title), node("p", "", event.summary),
        node("span", "activity-meta", (cleanDate(event.occurredAt) || "Time not provided") + " · " + originLabel()));
      append(row, symbol, text); parent.append(row);
    });
  }


  function renderProducts() {
    const products = state.data.products || [];
    const changes = state.data.changes || [];
    const comparisons = state.data.comparisons || [];
    const imported = state.origin !== "preview";
    const local = state.origin === "local" || state.origin === "cloudflare";
    const verifiedScan = imported && state.data.verification?.complete;
    $("product-total").textContent = products.length;
    $("product-new").textContent = changes.filter(item => item.kind === "new-product").length;
    $("product-changes-total").textContent = changes.length;
    $("product-comparisons-total").textContent = comparisons.length;
    const checked = products.filter(p => p.qaCheckedAt);
    const qaPassed = checked.filter(p => p.qaStatus === "passed").length;
    const qaFailed = checked.filter(p => p.qaStatus === "failed").length;
    const qaPending = checked.filter(p => p.qaStatus === "pending_confirmation").length;
    $("product-qa-total").textContent = state.origin === "cloudflare" ? "HTTP" : checked.length ? qaPassed + "/" + checked.length : "—";
    $("product-qa-caption").textContent = state.origin === "cloudflare"
      ? "Passive monitoring · no browser testing"
      : checked.length ? qaFailed + " confirmed alerts · " + qaPending + " awaiting confirmation"
      : "No browser checks reported";

    const spending = $("zero-cost-summary"); spending.replaceChildren();
    const guard = state.data.resourceBudget;
    if (!guard) {
      spending.append(emptyState("Budget telemetry unavailable",
        "Connect the isolated Cloudflare Free collector to see daily request counts and explicit disabled capabilities."));
    } else {
      const area = node("div", "budget-grid");
      const stats = [
        ["Public HTTP requests today", guard.used + " / " + (guard.limit || "not set"), guard.limit > 0 ? "Internal daily limit" : "No limit declared"],
        ["AI inference", guard.aiDisabled ? "OFF" : "Not verified", "No paid model calls expected"],
        ["Production browser testing", guard.browserDisabled ? "OFF" : "Not verified", "No browser sessions in this worker"]
      ];
      for (const [name, count, hint] of stats) {
        const tile = node("div", "budget-record");
        append(tile, node("span", "", name), node("strong", "", count), node("small", "", hint));
        area.append(tile);
      }
      spending.append(area);
    }
    $("catalog-kind").textContent = local ? "LOCAL REPORT" : imported ? "IMPORTED" : "EXAMPLE";
    $("discovery-status").textContent = !imported ? "Preview — not connected"
      : verifiedScan ? (local ? "Local discovery reported complete" : "Imported successful discovery")
        : (local ? "Local discovery incomplete — check scanner" : "Imported scan — incomplete or not independently confirmed");
    $("discovery-explainer").textContent = !imported
      ? "These are illustrative records. Actual monitoring begins after the scanner is installed on your server."
      : (local ? "Private collector report" : "Imported report") +
        (state.data.verification?.generatedAt ? " · " + (cleanDate(state.data.verification.generatedAt) || "undated") : "") +
        (local ? " · Periodic refresh enabled; evidence remains reviewable." : " · No live connection is established in this browser.");

    const inventory = $("product-catalog"); inventory.replaceChildren();
    if (!products.length) inventory.append(emptyState("No products in this report", "The discovery worker will enroll new tools from your sitemap, catalog links and optional manifest."));
    products.forEach(p => {
      const row = node("div", "product-record");
      const symbol = node("span", "product-record-icon"); symbol.append(icon("layers"));
      const main = node("div", "product-record-main");
      append(main, node("strong", "", p.name), node("small", "", (p.source || "Source unspecified") + " · " + (p.features.length ? p.features.length + " observed control(s)" : "No controls recorded")));
      const info = node("span", "product-record-info");
      info.append(node("span", "product-state " + (p.status === "healthy" && p.active ? "product-state-reachable" : ""), p.active ? (
        p.status === "healthy" ? "Reported reachable" : p.status === "degraded" ? "Reported degraded" : "Status unknown"
      ) : "No longer discoverable"));
      const qaLabels = {
        passed: "Browser rendered",
        failed: "QA alert",
        pending_confirmation: "Needs recheck",
        unverified: "Browser QA not verified"
      };
      const qa = node("span", "product-qa-badge qa-" + p.qaStatus,
        p.qaCheckedAt ? qaLabels[p.qaStatus] : "Browser QA not run");
      qa.title = p.qaCheckedAt ? "Browser observation: " + (cleanDate(p.qaCheckedAt) || "undated") +
        " · " + (p.qaReason || "No reason provided") : "No browser assurance check is recorded";
      info.append(qa);
      if (p.url) {
        const link = node("a", "product-url-link", "Open"); link.href = p.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.append(icon("external")); info.append(link);
      }
      append(row, symbol, main, info);
      inventory.append(row);
    });

    const feed = $("product-change-feed"); feed.replaceChildren();
    if (!changes.length) feed.append(emptyState("No recorded changes", "No change reports have been imported. That does not prove nothing changed."));
    changes.slice(0, 20).forEach(c => {
      const row = node("div", "product-change-record");
      const symbol = node("span", "product-change-mark " + (c.severity === "high" ? "urgent" : ""));
      symbol.append(icon(c.severity === "high" ? "shield" : c.kind === "new-product" ? "plus" : "refresh"));
      const main = node("div", "product-change-copy");
      append(main, node("strong", "", c.summary), node("small", "", label(c.kind) + " · " + (cleanDate(c.occurredAt) || originLabel())));
      append(row, symbol, main);
      feed.append(row);
    });

    const gaps = $("product-feature-gaps"); gaps.replaceChildren();
    if (!comparisons.length) gaps.append(emptyState("No verified competitor comparisons", "Growth research can collect leads now. Source-backed, feature-by-feature evaluation requires a documented competitor and matching product."));
    comparisons.forEach(c => {
      const card = node("article", "feature-gap-card");
      const top = node("div", "feature-gap-top");
      append(top, node("strong", "", (c.product || "YorpHives product") + " → " + (c.competitor || "Competitor")),
        node("span", "outline-pill", c.confidence || "Unverified"));
      const text = node("p", "", c.missingFeatures.length ? "Potential missing features: " + c.missingFeatures.join(" · ") : "No feature details supplied.");
      const next = node("p", "gap-next", c.recommendation || "Verify with direct evidence before considering changes.");
      append(card, top, text, next);
      const links = node("div", "gap-evidence");
      c.evidence.forEach(source => {
        const a = node("a", "", "Evidence source"); a.href = source; a.target = "_blank"; a.rel = "noopener noreferrer"; links.append(a);
      });
      if (!c.evidence.length) links.append(node("small", "", "No independent evidence supplied"));
      card.append(links);
      gaps.append(card);
    });
  }

  function renderAll() {
    renderMetrics();
    renderHomeFeed();
    renderBrief();
    renderCoverage();
    renderPriorityInbox();
    renderOpportunityPreview();
    renderFindings();
    renderSecurityWatch();
    renderOpportunities();
    renderProducts();
    renderWorkforce();
    renderActivity();
  }

  function showDetail(item, type) {
    state.selectedDetail = { item, type };
    $("detail-type").textContent = (type === "finding" ? "MONITORING FINDING" : "GROWTH OPPORTUNITY") + " · " + originLabel().toUpperCase();
    $("detail-title").textContent = item.title;
    $("detail-description").textContent = item.description;
    $("detail-action").textContent = item.recommendation || "No next step provided. Review the source evidence before acting.";
    const tags = $("detail-tags"); tags.replaceChildren();
    [
      label(item.category),
      type === "finding" ? "Priority: " + label(item.priority) : item.confidence,
      ...(type === "finding" ? [item.asset] : [])
    ].forEach(value => tags.append(node("span", "detail-tag", value)));
    const evidence = $("detail-evidence"); evidence.replaceChildren();
    const date = cleanDate(item.observedAt);
    evidence.append(node("p", "source-note", (date ? "Reported at " + date + ". " : "No observation timestamp provided. ") + (state.origin === "preview" ? "This is fictitious demonstration content." : "This record was supplied by a local or imported report and has not been independently verified.")));
    if (item.evidence.length) {
      item.evidence.forEach(url => {
        const link = node("a", "", url); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; evidence.append(link, document.createElement("br"));
      });
    } else evidence.append(node("p", "source-note", "No evidence links included. Treat this as a hypothesis until verified."));
    $("detail-dialog").showModal();
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function normalizeData(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The JSON root must be an object.");
    const arrays = ["assets", "findings", "opportunities", "products", "changes", "comparisons", "agents", "activity", "securityWatch"];
    for (const key of arrays) if (raw[key] !== undefined && !Array.isArray(raw[key])) throw new Error("'" + key + "' must be an array.");
    const items = (key) => (raw[key] || []).filter(x => x && typeof x === "object" && !Array.isArray(x)).slice(0, 200);
    const evidence = (item) => Array.isArray(item.evidence) ? item.evidence.slice(0, 10).map(safeUrl).filter(Boolean) : [];
    const normal = {
      assets: items("assets").map((a, i) => ({
        id: cleanText(a.id, 80) || "asset" + i, name: cleanText(a.name, 150) || "Unnamed asset",
        kind: cleanText(a.kind, 100), summary: cleanText(a.summary, 400),
        status: ["healthy", "degraded", "unknown"].includes(a.status) ? a.status : "unknown"
      })),
      findings: items("findings").map((f, i) => ({
        id: cleanText(f.id, 80) || "finding" + i, title: cleanText(f.title, 160) || "Untitled finding",
        category: ["security", "dependencies", "reliability", "quality"].includes(f.category) ? f.category : "quality",
        priority: ["high", "medium", "low"].includes(f.priority) ? f.priority : "medium",
        asset: cleanText(f.asset, 120) || "Unspecified asset", description: cleanText(f.description, 3000),
        recommendation: cleanText(f.recommendation, 3000), observedAt: cleanText(f.observedAt, 45), evidence: evidence(f)
      })),
      opportunities: items("opportunities").map((o, i) => ({
        id: cleanText(o.id, 80) || "opportunity" + i, title: cleanText(o.title, 160) || "Untitled lead",
        category: ["product", "revenue", "technology"].includes(o.category) ? o.category : "product",
        confidence: cleanText(o.confidence, 70) || "Unassessed",
        kind: ["potential-missing-product", "possible-existing-product", "catalog-unverified"].includes(o.kind) ? o.kind : "unvalidated-lead",
        description: cleanText(o.description, 3000), recommendation: cleanText(o.recommendation, 3000),
        observedAt: cleanText(o.observedAt, 45), evidence: evidence(o)
      })),
      securityWatch: items("securityWatch").map((a,i) => ({
        id: cleanText(a.id,60) || "public-advisory"+i,
        title: cleanText(a.title,180) || "Public security advisory",
        severity: ["high","critical"].includes(a.severity) ? a.severity : "unverified",
        packages: Array.isArray(a.packages) ? a.packages.slice(0,5).map(p => cleanText(p?.name,100)).filter(Boolean) : [],
        source: safeUrl(a.source), observedAt: cleanText(a.observedAt,45),
        applicability: "Not verified against YorpHives dependencies"
      })),
      products: items("products").map((p, i) => ({
        id: cleanText(p.id, 80) || "product" + i, name: cleanText(p.name, 160) || "Unnamed product",
        url: safeUrl(p.url) || "", source: cleanText(p.source, 80),
        status: ["healthy", "degraded", "unknown", "not_discoverable"].includes(p.status) ? p.status : "unknown",
        active: p.active !== false, firstSeen: cleanText(p.firstSeen, 45), lastChecked: cleanText(p.lastChecked, 45),
        qaStatus: ["passed", "failed", "pending_confirmation", "unverified"].includes(p.qaStatus) ? p.qaStatus : "unverified",
        qaCheckedAt: cleanText(p.qaCheckedAt, 45), qaReason: cleanText(p.qaReason, 100),
        features: Array.isArray(p.features) ? p.features.slice(0, 60).map(x => cleanText(x, 120)).filter(Boolean) : []
      })),
      changes: items("changes").map((c, i) => ({
        id: cleanText(c.id, 80) || "change" + i, kind: cleanText(c.kind, 80),
        summary: cleanText(c.summary, 600), url: safeUrl(c.url) || "",
        severity: cleanText(c.severity, 30), occurredAt: cleanText(c.occurredAt, 45)
      })),
      comparisons: items("comparisons").map((c, i) => ({
        id: cleanText(c.id, 80) || "gap" + i, product: cleanText(c.product, 160),
        competitor: cleanText(c.competitor, 160),
        missingFeatures: Array.isArray(c.missingFeatures) ? c.missingFeatures.slice(0, 40).map(x => cleanText(x, 130)).filter(Boolean) : [],
        confidence: cleanText(c.confidence, 100), recommendation: cleanText(c.recommendation, 800),
        evidence: evidence(c)
      })),
      agents: items("agents").map((a, i) => ({
        id: cleanText(a.id, 80) || "agent" + i, name: cleanText(a.name, 160) || "Unnamed department",
        responsibility: cleanText(a.responsibility, 1000),
        status: ["not_connected", "running", "idle", "error"].includes(a.status) ? a.status : "not_connected"
      })),
      activity: items("activity").map((a, i) => ({
        id: cleanText(a.id, 80) || "event" + i, title: cleanText(a.title, 160) || "Untitled activity",
        summary: cleanText(a.summary, 1000), kind: cleanText(a.kind, 30),
        occurredAt: cleanText(a.occurredAt, 45)
      }))
    };
    const rawBudget = raw.resourceBudget;
    if (rawBudget && typeof rawBudget === "object" && !Array.isArray(rawBudget)) {
      const publicFetches = rawBudget.publicFetches || {};
      const number = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000) : 0;
      normal.resourceBudget = {
        used: number(publicFetches.used),
        limit: number(publicFetches.limit),
        aiDisabled: rawBudget.aiCalls?.disabled === true,
        browserDisabled: rawBudget.browserMinutes?.disabled === true
      };
    }
    normal.verification = {
      complete: raw.pipeline?.products?.complete === true || raw.verification?.complete === true,
      generatedAt: cleanText(raw.pipeline?.generatedAt || raw.generatedAt, 45),
      method: cleanText(raw.pipeline?.products?.method || raw.verification?.method, 100),
      notes: Array.isArray(raw.pipeline?.errors) ? raw.pipeline.errors.slice(0, 5).map(x => cleanText(x, 200)) : []
    };
    if (arrays.every(key => normal[key].length === 0)) throw new Error("The report contains no dashboard records.");
    return normal;
  }

  function applyReport(raw, origin) {
    const normal = normalizeData(raw);
    state.data = normal;
    state.origin = origin;
    state.findingFilter = "all";
    state.opportunityFilter = "all";
    state.feedFilter = "all";
    document.querySelectorAll("[data-feed-filter]").forEach(button=>{
      const active=button.dataset.feedFilter==="all";
      button.classList.toggle("is-selected",active);
      button.setAttribute("aria-pressed",String(active));
    });
    document.querySelectorAll("[data-finding-filter], [data-opportunity-filter]").forEach(button => {
      button.classList.toggle("is-selected", button.dataset.findingFilter === "all" || button.dataset.opportunityFilter === "all");
    });
    renderAll();
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 2_000_000) return showToast("That report is larger than the 2 MB limit.");
    try {
      const raw = JSON.parse(await file.text());
      applyReport(raw, "imported");
      showView("overview");
      showToast("Report opened locally. Data is not independently verified.");
    } catch (error) {
      showToast("Could not open report: " + cleanText(error.message, 110));
    } finally {
      $("report-upload").value = "";
    }
  }

  async function loadLocalReport(notify = false) {
    if (!["http:", "https:"].includes(location.protocol)) {
      if (notify) showToast("Private evidence viewer is not connected in this preview.");
      return false;
    }
    try {
      const response = await fetch("/api/report", { credentials: "same-origin", cache: "no-store" });
      const mode = response.headers.get("X-YorpHives-HQ-Evidence");
      if (response.status !== 200 || !["readonly-local", "readonly-cloudflare"].includes(mode)) {
        if (notify) showToast("No fresh, authenticated private report is available.");
        return false;
      }
      const raw = await response.json();
      if (raw.schemaVersion !== "yorphives.hq-intelligence.v1" ||
          raw.pipeline?.readOnly !== true || !raw.pipeline?.generatedAt) {
        if (notify) showToast("Local evidence contract is invalid; no report applied.");
        return false;
      }
      if (state.origin === "imported" && !notify) return true;
      applyReport(raw, mode === "readonly-cloudflare" ? "cloudflare" : "local");
      if (notify) showToast("Read-only evidence refreshed. Check timestamps and sources.");
      return true;
    } catch (error) {
      if (notify) showToast("Private evidence unavailable: " + cleanText(error.message, 90));
      return false;
    }
  }

  function openSearch() {
    $("search-dialog").showModal();
    $("global-search").value = "";
    renderSearch("");
    $("global-search").focus();
  }

  function renderSearch(query) {
    const target = $("search-results"); target.replaceChildren();
    const term = query.trim().toLowerCase();
    const categories = [
      ...state.data.findings.map(item => ({ item, type: "finding", hint: "Monitoring · " + item.asset })),
      ...state.data.opportunities.map(item => ({ item, type: "opportunity", hint: "Opportunity · " + label(item.category) })),
      ...state.data.agents.map(item => ({ item, type: "agent", hint: "AI workforce" })),
      ...state.data.products.map(item => ({ item, type: "product", hint: "Product inventory" }))
    ];
    const results = categories.filter(({ item }) =>
      !term || [item.title, item.name, item.description, item.responsibility, item.asset].some(value => typeof value === "string" && value.toLowerCase().includes(term))
    ).slice(0, 14);
    if (!results.length) return target.append(emptyState("Nothing found", "Try another word, or import additional records."));
    results.forEach(({ item, type, hint }) => {
      const button = node("button", "search-result"); button.type = "button";
      append(button, node("strong", "", item.title || item.name), node("small", "", hint + " · " + originLabel()));
      button.addEventListener("click", () => {
        $("search-dialog").close();
        if (type === "agent") showView("workforce");
        else if (type === "product") showView("products");
        else { showView(type === "finding" ? "monitoring" : "opportunities"); showDetail(item, type); }
      });
      target.append(button);
    });
  }

  function initialize() {
    document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => showView(button.dataset.nav)));
    window.addEventListener("hashchange", () => showView(location.hash.replace("#", "")));
    document.querySelectorAll("[data-feed-filter]").forEach(chip=>chip.addEventListener("click",()=>{
      state.feedFilter=chip.dataset.feedFilter;
      document.querySelectorAll("[data-feed-filter]").forEach(button=>{
        const active=button===chip;
        button.classList.toggle("is-selected",active);
        button.setAttribute("aria-pressed",String(active));
      });
      renderHomeFeed();
    }));
    $("mobile-more").addEventListener("click",()=>{
      const open=document.body.classList.toggle("nav-open");
      $("sidebar-scrim").hidden=!open;
      $("mobile-menu").setAttribute("aria-expanded",String(open));
      $("mobile-more").setAttribute("aria-expanded",String(open));
    });
    document.querySelectorAll("[data-finding-filter]").forEach(button => button.addEventListener("click", () => {
      state.findingFilter = button.dataset.findingFilter;
      document.querySelectorAll("[data-finding-filter]").forEach(chip => chip.classList.toggle("is-selected", chip === button));
      renderFindings();
    }));
    document.querySelectorAll("[data-opportunity-filter]").forEach(button => button.addEventListener("click", () => {
      state.opportunityFilter = button.dataset.opportunityFilter;
      document.querySelectorAll("[data-opportunity-filter]").forEach(chip => chip.classList.toggle("is-selected", chip === button));
      renderOpportunities();
    }));
    $("mobile-menu").addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      $("sidebar-scrim").hidden = !open;
      $("mobile-menu").setAttribute("aria-expanded", String(open));
    });
    $("sidebar-scrim").addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      $("sidebar-scrim").hidden = true;
      $("mobile-menu").setAttribute("aria-expanded", "false");
    });
    $("import-trigger").addEventListener("click", () => $("report-upload").click());
    $("report-upload").addEventListener("change", (event) => importFile(event.target.files?.[0]));
    $("product-import-trigger").addEventListener("click", () => $("report-upload").click());
    $("product-refresh-trigger").addEventListener("click", () => loadLocalReport(true));
    $("how-trigger").addEventListener("click", () => $("help-dialog").showModal());
    $("help-close").addEventListener("click", () => $("help-dialog").close());
    $("help-done").addEventListener("click", () => $("help-dialog").close());
    $("notice-dismiss").addEventListener("click", () => { $("data-notice").hidden = true; });
    $("detail-close").addEventListener("click", () => $("detail-dialog").close());
    $("dialog-done").addEventListener("click", () => $("detail-dialog").close());
    // The keyboard hint is a label only; functionality supports both
    // Control+K and Command+K on all platforms.
    const shortcut=$("search-shortcut");
    if(shortcut){
      const platform=String(navigator.userAgentData?.platform || navigator.platform || "");
      shortcut.textContent=/Mac|iPad|iPhone/i.test(platform)?"⌘ K":"Ctrl K";
    }
    // Logout is a normal top-level navigation to Cloudflare Access's
    // documented revocation endpoint. No client-side-only pseudo logout.
    document.querySelectorAll('a[href="/cdn-cgi/access/logout"]').forEach(link=>{
      link.addEventListener("click",event=>{
        if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey ||
           event.shiftKey || event.altKey) return;
        document.body.classList.add("session-ending");
      });
    });
    // Never expose a cached, previously signed-in private dashboard when the
    // user hits Back from Cloudflare Access logout (BFCache restoration).
    window.addEventListener("pageshow",event=>{
      if(event.persisted) window.location.reload();
    });
    $("search-trigger").addEventListener("click", openSearch);
    $("global-search").addEventListener("input", (event) => renderSearch(event.target.value));
    $("copy-record").addEventListener("click", async () => {
      const selected = state.selectedDetail;
      if (!selected) return;
      const { item, type } = selected;
      const summary = [
        "YorpHives Headquarters — " + originLabel(),
        "Type: " + type, "Title: " + item.title, "Category: " + label(item.category),
        "Description: " + item.description, "Recommended next step: " + item.recommendation,
        "Evidence: " + (item.evidence.join(", ") || "None provided"),
        "Do not treat this as a verified finding without independent corroboration."
      ].join("\n");
      try {
        await navigator.clipboard.writeText(summary);
        showToast("Summary copied. Verify evidence before acting.");
      } catch (_) { showToast("Copy is unavailable in this browser context."); }
    });
    document.addEventListener("keydown", event => {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isSearchShortcut) {
        event.preventDefault();
        if (!$("search-dialog").open) openSearch();
      }
    });
    [$("detail-dialog"), $("help-dialog"), $("search-dialog")].forEach(dialog => dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    }));
    renderAll();
    showView(location.hash.slice(1) || "overview");
    // Read from the private same-origin viewer only; a static preview returns
    // 404 and does not enable periodic polling or contact a third party.
    loadLocalReport(false).then(available => {
      if (available) setInterval(() => {
        if (state.origin !== "imported") loadLocalReport(false);
      }, 60_000);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
