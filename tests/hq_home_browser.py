#!/usr/bin/env python3
"""Home UI: all buttons and actions against a synthetic, local-only HQ API."""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text().replace('<link rel="stylesheet" href="./styles.css">','').replace('<script defer src="./dashboard.js"></script>','')
# Offline browser tests load the two real artwork files as data URIs.
for logoFile in ("yorphives-logo.webp","yorphives-mark.webp"):
    source=ROOT/"assets"/logoFile
    HTML=HTML.replace("./assets/"+logoFile+("?v=ba0f325e" if logoFile=="yorphives-logo.webp" else "?v=7f78695a"),"data:image/webp;base64,"+base64.b64encode(source.read_bytes()).decode())
CSS=(ROOT/"styles.css").read_text()
JS=(ROOT/"dashboard.js").read_text().replace("if(!/^https?:$/.test(location.protocol))","if(!/^https?:$/.test(location.protocol)&&!window.__hqTestMode)")

def report():
    return {
      "schemaVersion":"yorphives.hq-intelligence.v1","generatedAt":"2026-11-15T12:00:00Z",
      "assets":[{"kind":"website","status":"healthy","name":"YorpHives","id":"site"}],
      "findings":[{"id":f"f{i}","title":f"Test alert {i}","priority":"high","observedAt":"2026-11-15T10:00:00Z"} for i in range(22)],
      "opportunities":[
        {"id":"o1","title":"Open-source test utility","category":"technology","observedAt":"2026-11-15T11:00:00Z"},
        {"id":"o2","title":"Revenue idea","category":"revenue","observedAt":"2026-11-15T11:10:00Z"}
      ],
      "activity":[],"changes":[{"id":"c1","title":"Website updated","occurredAt":"2026-11-15T11:30:00Z"}],
      "comparisons":[],"products":[],"securityWatch":[],"agents":[],
      "hqHealth":{"status":"responding","api":"responding","database":"responding","collector":"current"},
      "operating":{"pending":2,"activeOpportunities":0,"aiStatus":"Not connected","threads":[],
        "queue":[{"id":"f0","type":"finding","title":"Test alert 0","status":"proposed"}]},
      "decisionJournal":{"available":True,"events":[]}
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
            page.on("pageerror",lambda error:errors.append(str(error)))
            page.set_content(HTML)
            page.add_style_tag(content=CSS)
            page.evaluate("""data=>{
              window.__hqTestMode=true;
              window.__reportRequests=0;
              window.fetch=async(path,options={})=>{
                if(path==='/api/report'){
                  window.__reportRequests++;
                  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
                }
                throw Error('Unexpected request: '+path);
              };
            }""",report())
            page.add_script_tag(content=JS)
            page.wait_for_function("document.querySelector('.provenance')?.textContent.includes('Live report')")
            assert page.locator(".stat-action").count()==4
            assert page.locator(".brand-symbol").count()==0
            assert page.locator(".brand-label strong").inner_text()=="YorpHives"
            for logo in (".brand-logo",".mobile-brand-icon"):
                assert page.locator(logo).count()==1
                page.wait_for_function("(css)=>document.querySelector(css)?.naturalWidth>0",arg=logo)
            assert page.locator('link[rel="icon"]').get_attribute("href").startswith("data:image/webp;base64,")
            assert page.locator('a[aria-label="Open YorpHives website"]').get_attribute("href")=="https://yorphives.com/"
            assert page.locator(".pulse-row").count()==20
            assert page.locator(".pulse-count").inner_text()=="20 / 20"
            assert page.locator(".pulse-list").evaluate("(e)=>e.scrollHeight>e.clientHeight")
            # Each Pulse tab must actually filter the twenty most recent records.
            for key,expected in (("research",2),("changes",1),("alerts",17),("all",20)):
                page.locator(f'[data-pulse-filter="{key}"]').click()
                assert page.locator(".pulse-row").count()==expected,(engine.name,width,key)
            page.locator("#pulse-query").fill("Open-source")
            assert page.locator(".pulse-row").count()==1
            assert "Open-source" in page.locator(".pulse-row").first.inner_text()
            page.locator('[data-action="clear-pulse-search"]').click()
            assert page.locator("#pulse-query").input_value()==""
            assert page.locator(".pulse-row").count()==20
            page.locator(".pulse-row").first.click()
            assert page.locator("#detail-drawer").is_visible()
            page.keyboard.press("Escape")
            assert page.locator("#detail-drawer").is_hidden()
            # Four metrics are actionable, including the two service-health cards.
            for label,target in (("YorpHives.com","HQ Control"),("Headquarters","HQ Control"),
                                 ("To review","Decisions"),("Research","Discover")):
                page.locator(".stat-action").filter(has_text=label).first.click()
                assert page.locator("h1").inner_text()==target,(engine.name,width,label)
                page.evaluate("location.hash='home'")
                page.wait_for_timeout(30)
            page.locator(".shortcut-row [data-page='team']").click()
            assert page.locator("h1").inner_text()=="AI Employees"
            page.evaluate("location.hash='home'")
            page.wait_for_timeout(30)
            page.locator('[data-detail="review"]').first.click()
            assert page.locator("#detail-drawer").is_visible()
            page.keyboard.press("Escape")
            # Private exports must be JSON downloads, not remote API writes.
            with page.expect_download() as download_info:
                page.locator('.quick-grid [data-action="export-report"]').click()
            assert download_info.value.suggested_filename=="hq-evidence-private.json"
            # Clipboard-denied fallback must present selectable text.
            page.evaluate("""()=>Object.defineProperty(navigator,'clipboard',{configurable:true,
              value:{writeText:async()=>{throw Error('denied')}}})""")
            page.locator('.quick-grid [data-action="copy-summary"]').click()
            assert page.locator("#copy-modal").is_visible()
            assert "Headquarters: Responding" in page.locator("#copy-text").input_value()
            page.locator("#copy-close").click()
            assert not page.locator("#copy-modal").is_visible()
            baseline=page.evaluate("window.__reportRequests")
            page.locator('.quick-grid [data-action="refresh"]').click()
            page.wait_for_function("(previous)=>window.__reportRequests>previous",arg=baseline)
            page.wait_for_function("document.querySelector('#toast')?.textContent.includes('Report refreshed')")
            # File import clearly remains local. Explicit refresh reconnects to live.
            page.locator("#report-file").set_input_files({
                "name":"private-hq.json","mimeType":"application/json","buffer":json.dumps(report()).encode()
            })
            page.wait_for_function("document.querySelector('.provenance')?.textContent.includes('Imported report')")
            assert page.locator(".stat-action").first.locator("strong").inner_text()=="Imported"
            page.locator('.quick-grid [data-action="refresh"]').click()
            page.wait_for_function("document.querySelector('.provenance')?.textContent.includes('Live report')")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+2")
            assert not errors,(engine.name,width,errors)
            print("PASS Home",engine.name,width)
            page.close()
        browser.close()
