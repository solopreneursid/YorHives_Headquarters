#!/usr/bin/env python3
"""Offline six-page browser regression. All HQ API requests are mocked."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text().replace(
    '<link rel="stylesheet" href="./styles.css">', '').replace(
    '<script defer src="./dashboard.js"></script>', '')
CSS = (ROOT / "styles.css").read_text()
JS = (ROOT / "dashboard.js").read_text().replace(
    "if(!/^https?:$/.test(location.protocol))",
    "if(!/^https?:$/.test(location.protocol)&&!window.__hqTestMode)")

def report():
    return {
      "schemaVersion":"yorphives.hq-intelligence.v1",
      "generatedAt":"2026-11-15T12:00:00Z",
      "assets":[{"id":"website","kind":"website","name":"YorpHives","status":"healthy"}],
      "products":[{"id":"p1","name":"PDF utility","discoveryConfidence":"published"},
                  {"id":"p2","name":"Candidate","discoveryConfidence":"candidate"}],
      "findings":[{"id":f"f{i}","title":f"Test alert {i}","priority":"high",
                   "description":"Synthetic evidence","observedAt":"2026-11-15T10:00:00Z"} for i in range(22)],
      "opportunities":[{"id":"o1","title":"Open-source test utility","category":"technology"},
                       {"id":"o2","title":"Revenue idea","category":"revenue"}],
      "activity":[],"changes":[],"comparisons":[],"securityWatch":[],"agents":[],
      "operating":{"pending":2,"activeOpportunities":0,"aiStatus":"Not connected",
                   "queue":[{"id":"f0","type":"finding","title":"Test alert 0","status":"proposed"},
                            {"id":"o1","type":"opportunity","title":"Open-source test utility","status":"proposed"}],
                   "threads":[]},
      "decisionJournal":{"available":True,"events":[]},
      "resourceBudget":{"publicFetches":{"used":8,"limit":900}},
      "hqHealth":{"status":"responding","api":"responding","database":"responding","collector":"current","lastCollectorCheck":"2026-11-15T11:59:00Z","staleAfterMinutes":20,"independentCheck":"external-access-gate-only"},
      "verification":{"complete":False}
    }

with sync_playwright() as pw:
  engines=(pw.chromium,) if os.getenv("HQ_CHROMIUM_ONLY") else (pw.chromium,pw.firefox,pw.webkit)
  for engine in engines:
    options={"headless":True}
    if engine.name=="chromium" and Path("/usr/bin/chromium").exists():
      options.update(executable_path="/usr/bin/chromium",args=["--no-sandbox","--disable-dev-shm-usage"])
    browser=engine.launch(**options)
    for width in (320,390,768,1440):
      page=browser.new_page(viewport={"width":width,"height":820},accept_downloads=True)
      errors=[]
      page.on("pageerror",lambda e:errors.append(str(e)))
      page.set_content(HTML)
      page.add_style_tag(content=CSS)
      page.evaluate("""(report)=>{
        window.__hqTestMode=true;window.__calls=[];
        window.fetch=async (path,options={})=>{
          if(path==='/api/report')return new Response(JSON.stringify(report),
            {status:200,headers:{'content-type':'application/json'}});
          if(path==='/api/decisions'){
            window.__calls.push({body:JSON.parse(options.body),method:options.method,header:options.headers['x-hq-founder-action']});
            return new Response(JSON.stringify({saved:true,executionTriggered:false}),
              {status:201,headers:{'content-type':'application/json'}});
          }
          throw Error('Unexpected fetch');
        };
      }""",report())
      page.add_script_tag(content=JS)
      page.wait_for_function("document.querySelector('.provenance')?.textContent.includes('Live report')")
      pages=[("home","Home"),("discover","Discover"),("team","AI Employees"),("decisions","Decisions"),("growth","Growth"),("control","HQ Control")]
      for slug,title in pages:
        page.evaluate("(slug)=>location.hash=slug",slug)
        page.wait_for_timeout(20)
        assert page.locator("h1").inner_text()==title,(engine.name,width,slug)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),(engine.name,width,slug,"overflow")
      page.evaluate("location.hash='home'")
      page.wait_for_timeout(25)
      assert page.locator(".stat").filter(has_text="Headquarters").filter(has_text="Responding").count()==1
      assert page.locator(".pulse-row").count()==20
      page.evaluate("location.hash='discover'")
      page.wait_for_timeout(25)
      page.locator('[data-discover-filter="technology"]').first.click()
      assert page.locator(".lead-card").count()==1
      page.locator(".save-btn").first.click()
      page.locator('[data-action="toggle-saved"]').click()
      assert page.locator(".lead-card").count()==1
      page.evaluate("location.hash='team'")
      page.wait_for_timeout(25)
      page.locator(".member-card").first.click()
      assert page.locator("#detail-drawer").is_visible()
      page.keyboard.press("Escape")
      assert page.locator("#detail-drawer").is_hidden()
      page.evaluate("location.hash='decisions'")
      page.wait_for_timeout(25)
      page.locator('[data-detail="review"][data-id="0"]').click()
      form=page.locator("#decision-form")
      assert form.count()==1
      form.locator("#decision-state").select_option("accepted")
      form.locator("#decision-reason").fill("Reviewed in synthetic test")
      form.locator("#decision-submit").click()
      page.wait_for_timeout(65)
      saved=page.evaluate("window.__calls.at(-1)")
      assert saved and saved["method"]=="POST" and saved["header"]=="decision-v1"
      assert saved["body"]["id"]=="f0" and saved["body"]["state"]=="accepted"
      page.evaluate("location.hash='growth'")
      page.wait_for_timeout(25)
      page.locator("#product-filter").select_option("candidate")
      assert page.locator('.record-row[data-detail="product"]').count()==1
      page.evaluate("location.hash='control'")
      page.wait_for_timeout(25)
      assert page.locator(".system-card").filter(has_text="HQ API").filter(has_text="Responding").count()==1
      assert page.locator(".system-card").filter(has_text="HQ database").filter(has_text="Responding").count()==1
      assert page.locator(".system-card").filter(has_text="HQ scheduler").filter(has_text="Current").count()==1
      page.locator("#compact-toggle").check()
      assert page.locator("body").evaluate("(e)=>e.classList.contains('compact-mode')")
      assert not errors,(engine.name,width,errors)
      print("PASS",engine.name,width,"6 pages and founder actions")
      page.close()
    browser.close()
