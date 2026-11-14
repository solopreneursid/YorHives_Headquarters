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
    selectedDetail: null
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
  const originLabel = () => state.origin === "preview" ? "Example only" : "Imported — unverified";
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const categoryIcons = { security: "shield", dependencies: "code", reliability: "activity", quality: "check", product: "layers", revenue: "dollar", technology: "radar" };
  const workerIcons = ["activity", "shield", "spark", "radar", "trend", "dollar"];

  function emptyState(title, message) {
    const wrapper = node("div", "empty-state");
    append(wrapper, icon("info"), node("strong", "", title), node("p", "", message));
    return wrapper;
  }

  function showView(view) {
    if (!["overview", "monitoring", "opportunities", "workforce", "activity", "governance"].includes(view)) view = "overview";
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
      overview: "Overview", monitoring: "Monitoring", opportunities: "Opportunities",
      workforce: "AI workforce", activity: "Activity & evidence", governance: "Governance"
    })[view];
    document.body.classList.remove("nav-open");
    $("sidebar-scrim").hidden = true;
    $("mobile-menu").setAttribute("aria-expanded", "false");
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    window.scrollTo({ top: 0, behavior: "instant" });
    $("main-content").focus({ preventScroll: true });
  }

  function renderMetrics() {
    const d = state.data;
    $("metric-assets").textContent = d.assets.length;
    $("metric-findings").textContent = d.findings.length;
    $("metric-opportunities").textContent = d.opportunities.length;
    $("metric-employees").textContent = d.agents.length;
    $("nav-finding-count").textContent = d.findings.length;
    $("metric-assets-caption").textContent = state.origin === "preview" ? "Illustrative system inventory" : "Systems listed in imported file";
    $("metric-findings-caption").textContent = state.origin === "preview" ? "Example open observations" : "Findings listed in imported file";
    $("metric-opportunities-caption").textContent = state.origin === "preview" ? "Example research leads" : "Leads listed in imported file";
    $("metric-employees-caption").textContent = state.origin === "preview" ? "Illustrative team structure" : "Departments in imported file";
    $("metric-assets-footer").textContent = state.origin === "preview" ? "Website + headquarters" : "Status not independently verified";
    $("metric-findings-footer").textContent = "For founder review";
    $("metric-opportunities-footer").textContent = "Validate before pursuing";
    $("metric-employees-footer").textContent = "Agent status requires telemetry";
    $("snapshot-date").textContent = state.origin === "preview" ? "Illustrative dashboard" : "Imported file · not independently verified";
    $("mode-label").textContent = state.origin === "preview" ? "Preview mode" : "Imported data";
    $("mode-chip").classList.toggle("imported", state.origin !== "preview");
    $("footer-mode").textContent = state.origin === "preview" ? "PREVIEW · NOT A LIVE HEALTH REPORT" : "IMPORTED DATA · NOT INDEPENDENTLY VERIFIED";
    $("brief-kind").textContent = state.origin === "preview" ? "EXAMPLE" : "IMPORTED";
    const notice = $("data-notice");
    notice.hidden = false;
    const noticeText = notice.querySelector("div");
    noticeText.textContent = state.origin === "preview"
      ? "Preview workspace — The records below are examples, not findings from a live scan. Import a report to explore your own observations."
      : "Imported report — These values came from a file in your browser. Headquarters has not independently checked them or connected to production systems.";
  }

  function renderBrief() {
    const { findings, opportunities, assets } = state.data;
    $("brief-summary").textContent = state.origin === "preview"
      ? "A focused daily briefing will distill thousands of signals into a handful of decisions. This is an illustrative example, not evidence of checks performed."
      : "This is a summary of the file you imported, not a live monitoring claim. Confirm the evidence and scope before taking action.";
    const items = [
      state.origin === "preview"
        ? "Review example monitoring signals to see how incidents are prioritized."
        : findings.length + " observation(s) in the imported report are available for review.",
      state.origin === "preview"
        ? "Explore sample business leads for future product and revenue growth."
        : opportunities.length + " growth lead(s) in the imported report may need validation.",
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
      append(top, category, node("span", "outline-pill", state.origin === "preview" ? "EXAMPLE" : "IMPORTED"));
      const bottom = node("div", "card-bottom");
      const open = node("button", "", "Explore lead"); open.type = "button"; open.append(icon("arrow"));
      open.addEventListener("click", () => showDetail(item, "opportunity"));
      append(bottom, node("small", "", item.confidence), open);
      append(card, top, node("h3", "", item.title), node("p", "", item.description), bottom);
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

  function renderAll() {
    renderMetrics();
    renderBrief();
    renderCoverage();
    renderPriorityInbox();
    renderOpportunityPreview();
    renderFindings();
    renderOpportunities();
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
    evidence.append(node("p", "source-note", (date ? "Reported at " + date + ". " : "No observation timestamp provided. ") + (state.origin === "preview" ? "This is fictitious demonstration content." : "This record was supplied by an imported file and has not been independently verified.")));
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
    const arrays = ["assets", "findings", "opportunities", "agents", "activity"];
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
        description: cleanText(o.description, 3000), recommendation: cleanText(o.recommendation, 3000),
        observedAt: cleanText(o.observedAt, 45), evidence: evidence(o)
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
    if (Object.values(normal).every(x => x.length === 0)) throw new Error("The report contains no dashboard records.");
    return normal;
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > 2_000_000) return showToast("That report is larger than the 2 MB limit.");
    try {
      const raw = JSON.parse(await file.text());
      const normal = normalizeData(raw);
      state.data = normal;
      state.origin = "imported";
      state.findingFilter = "all";
      state.opportunityFilter = "all";
      document.querySelectorAll("[data-finding-filter], [data-opportunity-filter]").forEach(button => {
        button.classList.toggle("is-selected", button.dataset.findingFilter === "all" || button.dataset.opportunityFilter === "all");
      });
      renderAll();
      showView("overview");
      showToast("Report opened locally. Data is not independently verified.");
    } catch (error) {
      showToast("Could not open report: " + cleanText(error.message, 110));
    } finally {
      $("report-upload").value = "";
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
      ...state.data.agents.map(item => ({ item, type: "agent", hint: "AI workforce" }))
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
        else { showView(type === "finding" ? "monitoring" : "opportunities"); showDetail(item, type); }
      });
      target.append(button);
    });
  }

  function initialize() {
    document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => showView(button.dataset.nav)));
    window.addEventListener("hashchange", () => showView(location.hash.replace("#", "")));
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
    $("how-trigger").addEventListener("click", () => $("help-dialog").showModal());
    $("help-close").addEventListener("click", () => $("help-dialog").close());
    $("help-done").addEventListener("click", () => $("help-dialog").close());
    $("notice-dismiss").addEventListener("click", () => { $("data-notice").hidden = true; });
    $("detail-close").addEventListener("click", () => $("detail-dialog").close());
    $("dialog-done").addEventListener("click", () => $("detail-dialog").close());
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
