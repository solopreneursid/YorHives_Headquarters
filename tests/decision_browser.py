#!/usr/bin/env python3
"""Isolated founder journal UI regression; no live credentials or mutations."""
import functools,json,threading
from datetime import datetime,timezone
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def main():
    at=datetime.now(timezone.utc).isoformat()
    item={'id':'one','title':'Test observation','category':'reliability','priority':'high','asset':'Test asset','description':'Test evidence','recommendation':'Check independently','observedAt':at,'evidence':['https://example.com/evidence']}
    record={'id':'one','thread':'finding:one','type':'finding','title':item['title'],'contract':{'classification':'observation','freshness':'recent','owner':'Engineering & Operations','impact':'Test impact','confidence':'Needs independent review'}}
    report={'schemaVersion':'yorphives.hq-intelligence.v1','pipeline':{'readOnly':True,'generatedAt':at},'findings':[item],'decisionJournal':{'available':True,'events':[]},'operating':{'pending':1,'activeOpportunities':0,'queue':[record],'threads':[record]}}
    posts=[];errors=[]
    with ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT))) as server:
        threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
        with sync_playwright() as pw:
            browser=pw.chromium.launch();page=browser.new_page(viewport={'width':390,'height':844})
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/api/report',lambda route:route.fulfill(status=200,headers={'Content-Type':'application/json','X-YorpHives-HQ-Evidence':'readonly-cloudflare'},body=json.dumps(report)))
            def save(route):
                data=route.request.post_data_json;posts.append(data)
                assert route.request.headers['x-hq-founder-action']=='decision-v1'
                report['decisionJournal']['events'].insert(0,{'thread':'finding:one','kind':'finding','record_id':'one','title':item['title'],'state':data['state'],'revision':data['revision']+1,'note':data['note'],'created_at':at})
                report['operating']['queue']=[];report['operating']['pending']=0
                route.fulfill(status=201,content_type='application/json',body=json.dumps({'saved':True,'executionTriggered':False}))
            page.route('**/api/decisions',save)
            page.goto(base);page.locator('#decision-queue button').click()
            assert page.locator('#decision-save').is_enabled()
            page.locator('#decision-save').click();assert 'reason' in page.locator('#decision-error').inner_text()
            assert not posts
            page.locator('#decision-note').fill('Founder will investigate')
            page.locator('#decision-save').click();page.wait_for_function("document.querySelector('#decision-state').textContent==='Awaiting founder action'")
            assert len(posts)==1 and posts[0]['revision']==0
            assert 'implemented' in page.locator('#decision-next').inner_html()
            assert 'verified' not in page.locator('#decision-next').inner_html()
            page.locator('#detail-dialog summary').filter(has_text='Previous decisions').click()
            assert 'Founder will investigate' in page.locator('#decision-detail-history').inner_text()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
            page.locator('#detail-close').click();page.locator('.decision-workspace summary').click()
            assert page.locator('#decision-history button').count()==1
            assert not errors,errors
            # Imported data can never grant the founder write capability.
            page.locator('#report-upload').set_input_files({'name':'report.json','mimeType':'application/json','buffer':json.dumps(report).encode()})
            page.locator('#decision-history button').click();assert page.locator('#decision-save').is_disabled()
            browser.close()
        server.shutdown()
    print('PASS founder journal mobile UI, save/reload/history, transition gating and imported-write refusal')
if __name__=='__main__':main()
