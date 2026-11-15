#!/usr/bin/env python3
"""Offline cross-engine responsive and sign-out smoke tests.
Only the local UI is served. The Cloudflare logout navigation is intercepted
by a synthetic page; this test never authenticates against a live account.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
VIEW_NAMES=("overview","monitoring","products","opportunities","workforce","activity","governance")
BREAKPOINTS=(320,360,375,390,430,600,768,820,860,861,1024,1280,1440,1920)
DEEP_CHECK_WIDTHS=(320,390,768,1024,1440)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

def is_non_overflowing(page):
    return page.evaluate("""() => ({
      okay: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
      scroll: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      offenders:[...document.querySelectorAll('body *')]
        .filter(el => {const r=el.getBoundingClientRect();return r.width>0 && r.right>innerWidth+2 &&
          getComputedStyle(el).display!=='none';})
        .slice(0,5).map(el => ({tag:el.tagName,id:el.id,cls:String(el.className).slice(0,75),
          right:Math.round(el.getBoundingClientRect().right)}))
    })""")

def run_engine(browser_type,base):
    browser=browser_type.launch(headless=True)
    context=browser.new_context(viewport={"width":390,"height":844},reduced_motion="reduce")
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e: errors.append(str(e)))
    page.goto(base+"/",wait_until="domcontentloaded")
    page.locator("#home-feed-list .feed-card").first.wait_for()
    assert page.locator('a[href="/cdn-cgi/access/logout"]').count()==2
    assert page.locator(".topbar-signout").get_attribute("aria-label")=="Sign out of Headquarters"
    assert page.locator(".sidebar-signout").inner_text().strip()=="Sign out"
    assert page.locator("meta[name='viewport']").get_attribute("content").find("viewport-fit=cover")>=0

    for width in BREAKPOINTS:
        page.set_viewport_size({"width":width,"height":720})
        layout=is_non_overflowing(page)
        assert layout["okay"], f"{browser_type.name} home {width}px overflow: {layout}"
        assert page.locator(".topbar-signout").is_visible(), f"{browser_type.name}: signout hidden at {width}"
        if width<=860:
            assert page.locator(".home-mobile-tabs").is_visible(), f"{browser_type.name}: missing mobile tabs {width}"
        else:
            assert not page.locator(".home-mobile-tabs").is_visible(), f"{browser_type.name}: mobile tabs on desktop {width}"

        if width in DEEP_CHECK_WIDTHS:
            for view in VIEW_NAMES:
                page.evaluate("(view) => [...document.querySelectorAll(\'.sidebar [data-nav]\')].find(el=>el.dataset.nav===view).click()", view)
                assert page.locator("#view-"+view).is_visible()
                layout=is_non_overflowing(page)
                assert layout["okay"], f"{browser_type.name} {width}px {view} overflow: {layout}"
            page.evaluate("document.querySelector(\'.sidebar [data-nav=overview]\').click()")
            if width<=860:
                page.locator("#mobile-more").click()
                assert page.locator("#sidebar").is_visible()
                assert page.locator(".sidebar-signout").is_visible()
                # Tap outside the drawer. The scrim center sits underneath the drawer on tiny phones.
                page.mouse.click(width-5, 160)
                assert not page.evaluate("document.body.classList.contains('nav-open')")
                assert page.locator("#sidebar-scrim").is_hidden()

    # Rotated phones/tablets should not force sideways scrolling.
    for width,height in ((667,375),(844,390),(1024,768),(1180,820)):
        page.set_viewport_size({"width":width,"height":height})
        for view in ("overview","monitoring","products"):
            page.evaluate("(view) => [...document.querySelectorAll('.sidebar [data-nav]')].find(el=>el.dataset.nav===view).click()",view)
            layout=is_non_overflowing(page)
            assert layout["okay"], f"{browser_type.name} landscape {width}x{height} {view}: {layout}"
    page.evaluate("document.querySelector('.sidebar [data-nav=overview]').click()")

    page.set_viewport_size({"width":390,"height":844})
    page.locator("#home-full-report > summary").click()
    assert page.locator("#home-full-report").evaluate("(e)=>e.open")
    layout=is_non_overflowing(page)
    assert layout["okay"], f"{browser_type.name} expanded Full report overflow: {layout}"

    page.route(base+"/cdn-cgi/access/logout", lambda route: route.fulfill(
        status=200,content_type="text/html",
        body="<html><body><main id='logged-out'>Simulated signed-out page</main></body></html>"
    ))
    page.locator(".topbar-signout").click()
    page.wait_for_url(base+"/cdn-cgi/access/logout")
    assert page.locator("#logged-out").inner_text()=="Simulated signed-out page"
    assert not errors, f"{browser_type.name} JS errors: {errors}"
    context.close()
    browser.close()
    print(f"PASS {browser_type.name}: {len(BREAKPOINTS)} widths, {len(VIEW_NAMES)} screens, mobile menu and real logout navigation",flush=True)

def main():
    handler=functools.partial(QuietHandler,directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1",0),handler) as server:
        worker=threading.Thread(target=server.serve_forever,daemon=True)
        worker.start()
        base=f"http://127.0.0.1:{server.server_port}"
        try:
            with sync_playwright() as pw:
                for engine in (pw.chromium,pw.firefox,pw.webkit):
                    run_engine(engine,base)
        finally:
            server.shutdown()
            server.server_close()

if __name__=="__main__":
    main()
