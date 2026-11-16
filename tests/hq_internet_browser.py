#!/usr/bin/env python3
"""Internet-first Discover regression: live-feed contract mocked, browser controls real."""
import os, json, base64
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/"index.html").read_text().replace('<link rel="stylesheet" href="./styles.css">','').replace('<script defer src="./dashboard.js"></script>','')
for name in ("yorphives-logo.webp","yorphives-mark.webp"):
    ver="?v=ba0f325e" if name=="yorphives-logo.webp" else "?v=7f78695a"
    HTML=HTML.replace("./assets/"+name+ver,"data:image/webp;base64,"+base64.b64encode((ROOT/"assets"/name).read_bytes()).decode())
CSS=(ROOT/"styles.css").read_text()
JS=(ROOT/"dashboard.js").read_text().replace("if(!/^https?:$/.test(location.protocol))","if(!/^https?:$/.test(location.protocol)&&!window.__hqTestMode)")
REPORT={"schemaVersion":"yorphives.hq-intelligence.v1","generatedAt":"2026-11-15T23:20:00Z",
  "assets":[{"id":"web","name":"YorpHives","kind":"website","status":"healthy"}],
  "products":[{"id":"site-tool","name":"Old site product","status":"healthy"}],
  "findings":[],"opportunities":[],"comparisons":[],"changes":[],"activity":[],"securityWatch":[],
  "operating":{"queue":[],"threads":[],"pending":0},"decisionJournal":{"events":[],"available":False}}
def item(id,title,cat,score=2):
    return {"id":"hn-"+str(id),"title":title,"category":cat,"description":"Public submission to investigate",
      "source":"Hacker News","sourceUrl":"https://news.ycombinator.com/item?id="+str(id),
      "url":"https://example.com/project-"+str(id),"score":score,"commentCount":3,"price":"Unknown",
      "postedAt":"2026-11-15T14:00:00Z","verified":False}
LAUNCHES={"source":"hacker-news-public","channel":"launches","checkedAt":"2026-11-15T20:00:00Z","incomplete":False,
   "items":[item(201,"PDF image editor","apps",3),item(202,"Self-hosted agent framework","technology",8),
            item(203,"Jobs for teachers","markets",5),item(204,"Alternative to a CRM","competitors",2),
            item(205,"Invoice subscription billing","revenue",15),item(206,"Universal design builder","apps",10)]}
SIGNALS={"source":"hacker-news-public","channel":"signals","checkedAt":"2026-11-15T21:00:00Z","incomplete":False,
   "items":[item(207,"New customer demand","markets",12),item(208,"Monetization strategy","revenue",9)]}

with sync_playwright() as pw:
    engines=(pw.chromium,) if os.getenv("HQ_CHROMIUM_ONLY") else (pw.chromium,pw.firefox,pw.webkit)
    for engine in engines:
        options={"headless":True}
        if engine.name=="chromium" and Path("/usr/bin/chromium").exists():
            options.update(executable_path="/usr/bin/chromium",args=["--no-sandbox","--disable-dev-shm-usage"])
        browser=engine.launch(**options)
        for width in (320,390,768,1440):
            page=browser.new_page(viewport={"width":width,"height":840},accept_downloads=True)
            errors=[]
            page.on("pageerror",lambda err:errors.append(str(err)))
            page.set_content(HTML)
            page.add_style_tag(content=CSS)
            page.evaluate("""args=>{
              window.__hqTestMode=true;window.__feedQueries=[];window.__failFeed=false;
              window.fetch=async path=>{
                if(path==='/api/report')return new Response(JSON.stringify(args.report),{status:200,headers:{'content-type':'application/json'}});
                if(path.startsWith('/api/discover/feed?')){
                  const channel=new URL(path,'https://hq.test').searchParams.get('channel');
                  window.__feedQueries.push(channel);
                  await new Promise(resolve=>setTimeout(resolve,15));
                  if(window.__failFeed)return new Response(JSON.stringify({error:'Public source unavailable.'}),{status:503});
                  const data=channel==='signals'?args.signals:args.launches;
                  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
                }
                throw Error('Unexpected request: '+path);
              };
            }""",{"report":REPORT,"launches":LAUNCHES,"signals":SIGNALS})
            page.add_script_tag(content=JS)
            page.wait_for_function("document.querySelector('.provenance')?.textContent.includes('Live report')")
            page.evaluate("location.hash='discover'")
            page.wait_for_function("document.querySelectorAll('[data-detail=web]').length===6")
            assert page.locator('[data-discover-source="explore"]').get_attribute("aria-pressed")=="true"
            assert page.locator('[data-detail="product"]').count()==0
            assert page.locator(".discover-source-card").count()==8
            for domain in ("https://betalist.com/","https://trustmrr.com/","https://microlaunch.net/",
                           "https://www.uneed.best/","https://arrfounder.com/"):
                site=page.locator(f'.discover-source-card[href="{domain}"]')
                assert site.count()==1
                assert site.get_attribute("target")=="_blank"
            assert page.evaluate("window.__feedQueries")==["launches"]
            assert page.locator(".lead-card").count()==6
            for category,n in (("apps",2),("technology",1),("markets",1),
                               ("competitors",1),("revenue",1),("all",6)):
                page.locator(f'[data-web-filter="{category}"]').click()
                assert page.locator(".lead-card").count()==n,(engine.name,width,category)
                assert page.locator(".discover-source-card").count()>=1
            page.locator("#web-query").fill("invoice")
            assert page.locator(".lead-card").count()==1
            assert "Invoice" in page.locator(".lead-card").first.inner_text()
            page.locator("#web-query").fill("")
            page.locator("#web-sort").select_option("score")
            assert "Invoice" in page.locator(".lead-card").first.inner_text()
            page.locator(".lead-card").first.locator("[data-web-save]").click()
            page.locator('[data-action="web-saved"]').click()
            assert page.locator(".lead-card").count()==1
            with page.expect_download() as download:
                page.locator('[data-action="web-export"]').click()
            assert download.value.suggested_filename=="hq-internet-opportunities.json"
            exported=json.loads(Path(download.value.path()).read_text())
            assert exported["source"]=="public-hacker-news"
            assert len(exported["opportunities"])==1
            page.locator(".lead-body").first.click()
            assert page.locator("#detail-drawer").is_visible()
            detail=page.locator("#detail-drawer").inner_text()
            for phrase in ("Why consider it?","Potential next move","Cost or pricing","not a validated"):
                assert phrase in detail,(engine.name,width,phrase,detail)
            assert page.locator('#detail-drawer a[href="https://news.ycombinator.com/item?id=205"]').count()==1
            page.keyboard.press("Escape")
            page.locator('[data-action="web-saved"]').click()
            page.locator('[data-web-channel="signals"]').click()
            page.wait_for_function("document.querySelectorAll('[data-detail=web]').length===2")
            assert page.evaluate("window.__feedQueries")==["launches","signals"]
            assert page.locator(".lead-card").count()==2
            page.locator('[data-web-filter="markets"]').click()
            assert page.locator(".lead-card").count()==1
            page.evaluate("window.__failFeed=true")
            page.locator('[data-action="web-refresh"]').click()
            page.wait_for_function("document.querySelector('.discover-live-status')?.textContent.includes('Public source unavailable')")
            assert page.locator(".lead-card").count()==1 # labeled, cached prior findings remain
            page.locator('[data-discover-source="github"]').click()
            assert page.locator("#github-query").count()==1
            assert page.locator('[data-detail="product"]').count()==0
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),(engine.name,width)
            assert not errors,(engine.name,width,errors)
            print("PASS Internet Discover",engine.name,width)
            page.close()
        browser.close()
