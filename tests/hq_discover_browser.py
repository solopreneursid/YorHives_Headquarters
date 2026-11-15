#!/usr/bin/env python3
"""Discover: real UI controls against deterministic HQ and public-GitHub API fixtures."""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text().replace('<link rel="stylesheet" href="./styles.css">','').replace('<script defer src="./dashboard.js"></script>','')
for name in ("yorphives-logo.webp","yorphives-mark.webp"):
    version="?v=ba0f325e" if name=="yorphives-logo.webp" else "?v=7f78695a"
    HTML=HTML.replace("./assets/"+name+version,"data:image/webp;base64,"+base64.b64encode((ROOT/"assets"/name).read_bytes()).decode())
CSS=(ROOT/"styles.css").read_text()
JS=(ROOT/"dashboard.js").read_text().replace(
    "if(!/^https?:$/.test(location.protocol))",
    "if(!/^https?:$/.test(location.protocol)&&!window.__hqTestMode)")
report={"schemaVersion":"yorphives.hq-intelligence.v1","generatedAt":"2026-11-16T02:00:00Z",
  "assets":[{"id":"site","kind":"website","status":"healthy"}],
  "products":[{"id":"p1","name":"Image helper","firstSeen":"2026-11-12T01:00:00Z","url":"https://yorphives.com/tools/image-helper"},
              {"id":"p2","name":"PDF utility","firstSeen":"2026-11-13T01:00:00Z","url":"https://yorphives.com/tools/pdf-utility"}],
  "opportunities":[
      {"id":"o1","title":"Local AI tooling","category":"technology","observedAt":"2026-11-14T01:00:00Z","evidence":["https://github.com/example/ai"]},
      {"id":"o2","title":"Small business workflows","category":"markets","observedAt":"2026-11-15T01:00:00Z"},
      {"id":"o3","title":"Revenue test","category":"revenue","observedAt":"2026-11-15T02:00:00Z"}],
  "comparisons":[{"id":"c1","competitor":"OtherPDF","observedAt":"2026-11-14T01:00:00Z"}],
  "findings":[],"changes":[],"activity":[],"securityWatch":[],"agents":[],
  "operating":{"pending":0,"queue":[],"threads":[]},"decisionJournal":{"available":False,"events":[]}}
github={"source":"github-public","total":30,"incomplete":False,"searchedAt":"2026-11-16T00:00:00Z",
  "items":[
    {"id":"open-ai/llm-agent","title":"open-ai/llm-agent","description":"Open LLM agent research",
      "url":"https://github.com/open-ai/llm-agent","license":"Apache-2.0",
      "stars":125,"category":"technology","language":"Python","updatedAt":"2026-11-14T12:00:00Z"},
    {"id":"acme/image-editor","title":"acme/image-editor","description":"Free image editor",
      "url":"https://github.com/acme/image-editor","license":"MIT",
      "stars":55,"category":"apps","language":"TypeScript","updatedAt":"2026-11-15T12:00:00Z"},
    {"id":"other/pdf-tool","title":"other/pdf-tool","description":"<img src=x onerror=alert(1)> utility",
      "url":"https://github.com/other/pdf-tool","license":None,
      "stars":2,"category":"apps","language":"Go","updatedAt":"2026-11-13T12:00:00Z"}
  ]}
with sync_playwright() as pw:
    engines=(pw.chromium,) if os.getenv("HQ_CHROMIUM_ONLY") else (pw.chromium,pw.firefox,pw.webkit)
    for engine in engines:
        args={"headless":True}
        if engine.name=="chromium" and Path("/usr/bin/chromium").exists():
            args.update(executable_path="/usr/bin/chromium",args=["--no-sandbox","--disable-dev-shm-usage"])
        browser=engine.launch(**args)
        for width in (320,390,768,1440):
            page=browser.new_page(viewport={"width":width,"height":820})
            errors=[]
            page.on("pageerror",lambda e:errors.append(str(e)))
            page.set_content(HTML)
            page.add_style_tag(content=CSS)
            page.evaluate("""args=>{
                window.__hqTestMode=true;window.__discoverCalls=[];
                window.fetch=async path=>{
                    if(path==='/api/report')return new Response(JSON.stringify(args.report),{status:200,headers:{'content-type':'application/json'}});
                    if(path.startsWith('/api/discover?q=')){
                        const q=new URL(path,'https://hq.local').searchParams.get('q');
                        window.__discoverCalls.push(q);
                        await new Promise(resolve=>setTimeout(resolve,12));
                        if(q==='rate limit')return new Response(JSON.stringify({error:'GitHub search is rate-limited. Retry later.'}),{status:429});
                        if(q==='nothing here')return new Response(JSON.stringify({...args.github,items:[],total:0}),{status:200});
                        return new Response(JSON.stringify(args.github),{status:200});
                    }
                    throw Error('Unexpected URL: '+path);
                };
            }""",{"report":report,"github":github})
            page.add_script_tag(content=JS)
            page.wait_for_function("document.querySelector('.provenance')?.textContent.includes('Live report')")
            page.evaluate("location.hash='discover'")
            page.wait_for_timeout(30)
            assert page.locator("h1").inner_text()=="Discover"
            assert page.locator('[data-discover-source="hq"]').get_attribute("aria-pressed")=="true"
            assert page.locator(".lead-card").count()==6
            assert page.evaluate("window.__discoverCalls.length")==0
            # HQ records: categories, query, sort, saved, source details.
            page.locator('[data-discover-filter="technology"]').click()
            assert page.locator(".lead-card").count()==1
            page.locator("#discover-query").fill("AI tooling")
            assert page.locator(".lead-card").count()==1
            page.locator("#discover-query").fill("nonexistent")
            assert page.locator(".lead-card").count()==0
            page.locator("#discover-query").fill("")
            page.locator(".save-btn").first.click()
            page.locator('[data-action="toggle-saved"]').click()
            assert page.locator(".lead-card").count()==1
            page.locator(".lead-body").first.click()
            assert page.locator("#detail-drawer").is_visible()
            assert page.locator('a[href="https://github.com/example/ai"]').count()==1
            page.keyboard.press("Escape")
            page.locator('[data-discover-source="github"]').click()
            assert page.evaluate("window.__discoverCalls.length")==0
            assert page.locator(".lead-card").count()==0
            assert page.locator('button[type="submit"].discover-submit').is_visible()
            # Public search: live endpoint, result metadata, source/candidate disclaimer.
            page.locator("#github-query").fill("pdf tools")
            page.locator(".discover-submit").click()
            page.wait_for_function("document.querySelectorAll('.lead-card').length === 3")
            assert page.evaluate("window.__discoverCalls")==["pdf tools"]
            assert "125" in page.locator(".lead-card").first.inner_text()
            assert "License" in page.locator(".page-footnote").inner_text()
            assert page.locator(".lead-card").count()==3
            assert page.locator("img[onerror]").count()==0
            page.locator("#github-sort").select_option("name")
            assert "acme/image-editor" in page.locator(".lead-card").first.inner_text()
            page.locator("#github-sort").select_option("newest")
            assert "acme/image-editor" in page.locator(".lead-card").first.inner_text()
            page.locator('[data-github-filter="technology"]').click()
            assert page.locator(".lead-card").count()==1
            page.locator('[data-github-filter="apps"]').click()
            assert page.locator(".lead-card").count()==2
            page.locator('[data-github-filter="all"]').click()
            assert page.locator(".lead-card").count()==3
            page.locator(".lead-card").first.locator("[data-github-save]").click()
            page.locator('[data-action="github-saved"]').click()
            assert page.locator(".lead-card").count()==1
            page.locator(".lead-body").first.click()
            assert page.locator("#detail-drawer").is_visible()
            assert page.locator('a[href^="https://github.com/"]').count()>=1
            assert "License" in page.locator("#detail-drawer").inner_text()
            page.keyboard.press("Escape")
            # Saved candidates remain available after switching sources and clearing search.
            page.locator('[data-discover-source="hq"]').click()
            page.locator('[data-discover-source="github"]').click()
            assert page.locator(".lead-card").count()==1
            page.locator("#github-query").fill("nothing here")
            page.locator(".discover-submit").click()
            page.wait_for_function("document.querySelector('.discover-live-status')?.textContent.includes('0 public')")
            assert page.locator(".lead-card").count()==1 # saved shortlist remains explicit
            page.locator('[data-action="github-saved"]').click()
            assert page.locator(".lead-card").count()==0
            assert "No matching projects" in page.locator("#page-root").inner_text()
            page.locator("#github-query").fill("invalid!")
            before=page.evaluate("window.__discoverCalls.length")
            page.locator(".discover-submit").click()
            assert "Enter 2–64" in page.locator(".discover-live-status").inner_text()
            assert page.evaluate("window.__discoverCalls.length")==before
            page.locator("#github-query").fill("rate limit")
            page.locator(".discover-submit").click()
            page.wait_for_function("document.querySelector('.discover-live-status')?.textContent.includes('rate-limited')")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),(engine.name,width,"overflow")
            assert not errors,(engine.name,width,errors)
            print("PASS Discover",engine.name,width)
            page.close()
        browser.close()
