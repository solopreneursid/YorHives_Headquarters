"""Revenue tab: real YorpHives-specific ideas, app health, founder decision, mobile layout."""
import json, http.server, threading, os
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
STAMP=datetime.now(timezone.utc).isoformat()
IDEAS=[{'id':'rev_d1e1a1','channel':'Advertising','title':'AdSense readiness on tool guides','summary':'Evaluate responsible ads on content guides.','next_step':'Check eligibility and placements.','priority':90,'effort':'Low','cost':'No new software.','risk':'AdSense approval is unverified.','target_path':None,'target_name':'YorpHives.com','basis':'Sitewide idea · revenue and traffic not verified','action':'new'},
       {'id':'rev_d1e1a2','channel':'Digital products','title':'Optional PDF presets or templates','summary':'Test reusable templates alongside Merge PDF.','next_step':'Validate interest first.','priority':75,'effort':'Medium','cost':'Payment fees may apply.','risk':'No demand data.','target_path':'/free-tools/merge-pdf','target_name':'Merge Pdf','basis':'Discovered tool route · HTTP checked','action':'new'}]
APPS=[{'path':'/free-tools/merge-pdf','title':'Merge Pdf','url':'https://yorphives.com/free-tools/merge-pdf','status':'online','http_status':200,'checked_at':STAMP}]
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_GET(self):
  if self.path=='/':
   body=(ROOT/'index.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
  self.send_response(404);self.end_headers()

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
passes=0
with sync_playwright() as p:
 for kind in (p.chromium,p.firefox,p.webkit):
  try:
   options={'headless':True}
   if kind.name=='chromium' and Path('/usr/bin/chromium').exists():options.update(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   browser=kind.launch(**options)
  except Exception:
   if os.environ.get('YHQ_REQUIRE_3_BROWSERS')=='1' or kind.name=='chromium':raise
   print('SKIP',kind.name);continue
  for width in (320,390,768,1024,1440):
   page=browser.new_page(viewport={'width':width,'height':850})
   boot={'site':{'state':'online','checkedAt':STAMP},'siteUpdatedAt':STAMP,'hq':{'state':'online','checkedAt':STAMP},'mind':{'state':'ready'},'scan':{'count':0,'completed':STAMP,'failedSources':[]},'opportunities':[], 'saved':[], 'decisions':[], 'evaluations':[], 'learning':[], 'sources':[], 'updateCandidates':[], 'budget':{'aiEnabled':True,'aiLimit':3,'siteAuditsLimit':4},'watchdog':{'state':'online','checkedAt':STAMP},'watchdogUpdatedAt':STAMP,
       'revenueIdeas':IDEAS,'appInventory':APPS,'appAudit':{'checkedAt':STAMP,'tracked':1,'sourceFailures':[]}}
   script='''window.MOCK='''+json.dumps(boot)+''';window.fetch=async(path,opts={})=>{const p=String(path);if(p==='/api/bootstrap')return new Response(JSON.stringify(window.MOCK),{status:200,headers:{'content-type':'application/json'}});if(p==='/api/revenue/decision'){const j=JSON.parse(opts.body);window.MOCK.revenueIdeas.find(x=>x.id===j.id).action=j.action;return new Response(JSON.stringify({ok:true}),{status:200})}if(p==='/api/revenue/scan')return new Response(JSON.stringify({ok:true,audit:{tracked:1}}),{status:200});return new Response(JSON.stringify({ok:true}),{status:200})};'''
   if os.environ.get('YHQ_REQUIRE_3_BROWSERS')=='1':
    page.add_init_script(script)
    page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
   else:
    html=(ROOT/'index.html').read_text().replace('<script>','<script>'+script+'</script><script>',1)
    page.set_content(html,wait_until='domcontentloaded')
   page.locator('.demo-chip').get_by_text('Live').wait_for(timeout=8000)
   page.evaluate("location.hash='#/discover'")
   page.locator('[data-cat="Revenue"]').click()
   assert page.get_by_role('heading',name='Revenue').count()==1
   assert page.locator('.revenue-idea').count()==2
   assert page.get_by_text('YorpHives.com',exact=False).count()>0
   assert page.locator('#revenue-results').get_by_text('LLM Releases').count()==0
   assert page.locator('.revenue-stats').get_by_text('1 tracked').count()==1
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(kind.name,width,'revenue overflow')
   page.locator('[data-revenue-detail]').first.click()
   assert page.get_by_text('No verified revenue, visitors or conversions').count()>0
   page.locator('[data-rev-action="shortlist"]').click()
   page.get_by_text('Shortlisted',exact=True).first.wait_for()
   assert page.locator('.revenue-idea').count()==2
   page.locator('#revenue-search').fill('PDF')
   assert page.locator('.revenue-idea').count()==1
   page.locator('#revenue-search').fill('')
   page.locator('#run-revenue-audit').click()
   page.get_by_role('heading',name='Revenue').wait_for()
   if width==390 and kind.name=='chromium':page.screenshot(path=str(ROOT/'revenue-mobile.png'),full_page=True)
   if width==1440 and kind.name=='chromium':page.screenshot(path=str(ROOT/'revenue-desktop.png'),full_page=True)
   page.evaluate("location.hash='#/growth'")
   page.get_by_text('YorpHives revenue opportunities').wait_for()
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(kind.name,width,'growth overflow')
   page.close();passes+=1
  browser.close()
server.shutdown()
print('PASS revenue',passes,'browser/viewport flows')