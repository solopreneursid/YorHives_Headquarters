import json, threading, http.server, os
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
STATE={'saved':[], 'decisions':[]}
LEADS=[
 {'id':'lead_ab1234','category':'Apps & Tools','title':'Privacy-first document toolkit','summary':'In-browser PDF tools. Validate licensing.','source':'Hacker News','url':'https://example.org/tool','source_date':'2026-11-16T03:00:00Z','first_seen':'2026-11-16T03:00:00Z','last_seen':'2026-11-16T03:00:00Z'},
 {'id':'lead_bb1234','category':'Technology','title':'AI agent memory framework','summary':'Open source research.','source':'DEV Community','url':'https://dev.to/test','source_date':'2026-11-16T03:00:00Z','first_seen':'2026-11-16T03:00:00Z','last_seen':'2026-11-16T03:00:00Z'}]
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def do_GET(self):
  if self.path=='/':
   body=(ROOT/'index.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(body);return
  if self.path=='/api/bootstrap':
   self.send_json({'site':{'state':'online','checkedAt':'2026-11-16T03:00:00Z'},'siteUpdatedAt':'2026-11-16T03:00:00Z','hq':{'state':'online','checkedAt':'2026-11-16T03:00:00Z'},'mind':{'state':'ready','detail':'AI available','model':'@cf/ibm-granite/granite-4.0-h-micro'},'scan':{'count':2,'completed':'2026-11-16T03:00:00Z','failedSources':[]},'opportunities':LEADS,'saved':STATE['saved'],'decisions':STATE['decisions']});return
  self.send_error(404)
 def do_POST(self):
  length=int(self.headers.get('Content-Length') or 0)
  data=json.loads(self.rfile.read(length) or b'{}')
  if self.path=='/api/saved':
   if data['saved'] and data['id'] not in STATE['saved']:STATE['saved'].append(data['id'])
   if not data['saved'] and data['id'] in STATE['saved']:STATE['saved'].remove(data['id'])
  if self.path=='/api/decision':
   STATE['decisions']=[x for x in STATE['decisions'] if x['opportunity_id']!=data['id']]+[{'opportunity_id':data['id'],'action':data['action'],'updated_at':'2026-11-16T03:00:00Z'}]
  self.send_json({'ok':True})
 def send_json(self,obj):
  body=json.dumps(obj).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=srv.serve_forever,daemon=True).start()
pass_count=0
with sync_playwright() as p:
 for browser_type in (p.chromium,p.firefox,p.webkit):
  options={'headless':True}
  if browser_type.name=='chromium' and Path('/usr/bin/chromium').exists():
   options['executable_path']='/usr/bin/chromium'
   options['args']=['--no-sandbox','--disable-dev-shm-usage']
  try:browser=browser_type.launch(**options)
  except Exception as exc:
   if os.environ.get('YHQ_REQUIRE_3_BROWSERS')=='1' or browser_type.name=='chromium':raise
   print('SKIP',browser_type.name,'browser not installed')
   continue
  for width in (320,390,768,1024,1440):
   STATE['saved']=[];STATE['decisions']=[]
   page=browser.new_page(viewport={'width':width,'height':850},is_mobile=False)
   errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
   current=datetime.now(timezone.utc).isoformat();bootstrap={'site':{'state':'online','checkedAt':current},'siteUpdatedAt':current,'hq':{'state':'online','checkedAt':current},'mind':{'state':'ready','detail':'AI available','model':'@cf/ibm-granite/granite-4.0-h-micro'},'scan':{'count':2,'completed':current,'failedSources':[]},'opportunities':LEADS,'saved':[], 'decisions':[], 'evaluations':[], 'learning':[], 'sources':[], 'updateCandidates':[], 'budget':{'aiEnabled':True,'aiUsed':0,'aiLimit':3,'scansUsed':1,'scansLimit':8,'sourceFetchesPerScan':5}, 'watchdog':{'state':'online','checkedAt':current},'watchdogUpdatedAt':current}
   script='''window.MOCK='''+json.dumps(bootstrap)+''';window.fetch=async function(path,options={}){let p=String(path);if(p==='/api/bootstrap')return new Response(JSON.stringify(window.MOCK),{status:200,headers:{'content-type':'application/json'}});if(p==='/api/saved'){let d=JSON.parse(options.body);window.MOCK.saved=d.saved?[...new Set([...window.MOCK.saved,d.id])]:window.MOCK.saved.filter(x=>x!==d.id);return new Response('{"ok":true}',{status:200})}if(p==='/api/ai/evaluate'){let d=JSON.parse(options.body);window.MOCK.evaluations=[...window.MOCK.evaluations,{opportunity_id:d.id,model:'granite',reason:'Possible fit',risk:'Unverified demand',next_step:'Interview users',fit_score:4,evaluated_at:new Date().toISOString()}];return new Response('{"ok":true}',{status:200})}if(p==='/api/decision'){let d=JSON.parse(options.body);window.MOCK.decisions=window.MOCK.decisions.filter(x=>x.opportunity_id!==d.id).concat([{opportunity_id:d.id,action:d.action,updated_at:new Date().toISOString()}]);return new Response('{"ok":true}',{status:200})}return new Response('{"ok":true}',{status:200})};'''
   # CI uses a real local URL to test actual browser history. Restricted local runners may block loopback.
   if os.environ.get('YHQ_REQUIRE_3_BROWSERS')=='1':
    page.add_init_script(script)
    page.goto(f'http://127.0.0.1:{srv.server_port}/',wait_until='domcontentloaded')
   else:
    html=(ROOT/'index.html').read_text().replace('<script>','<script>'+script+'</script><script>',1)
    page.set_content(html,wait_until='domcontentloaded')
   page.locator('.demo-chip').get_by_text('Live').wait_for(timeout=5000)
   assert page.get_by_text('YorpHives.com').count()>0
   assert page.locator('.status-grid .status-panel').count()==3
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(browser_type.name,width,'overflow home')
   page.evaluate("location.hash='#/discover'")
   page.get_by_role('heading',name='Discover').wait_for()
   assert page.locator('.idea').count()==2
   page.locator('[data-cat="Technology"]').click()
   assert page.locator('.idea').count()==1
   page.locator('[data-cat="All"]').click()
   page.locator('#idea-search').fill('document')
   assert page.locator('.idea').count()==1
   page.locator('#idea-search').fill('')
   page.locator('.idea [data-detail]').first.click()
   assert page.locator('#overlay').get_attribute('class').find('on')>=0
   assert page.get_by_role('link',name='Open source').count()==1
   page.locator('[data-evaluate]').click()
   page.get_by_text('Possible fit').wait_for(timeout=10000)
   assert page.locator('#drawer').get_by_text('AI interpretation').count()==1
   page.keyboard.press('Escape')
   assert page.locator('#overlay').get_attribute('class').find('on')<0
   page.locator('.idea [data-save]').first.click()
   page.locator('#toast').get_by_text('Saved').wait_for()
   page.evaluate("location.hash='#/decisions'")
   page.get_by_role('heading',name='Decisions').wait_for()
   assert page.locator('.decision-card').count()>=1
   page.locator('[data-decision="approve"]').first.click()
   page.get_by_text('approve',exact=True).first.wait_for()
   for section in ('team','growth','control'):
    page.evaluate(f"location.hash='#/{section}'")
    page.wait_for_timeout(50)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(browser_type.name,width,section,'overflow')
   page.locator('#export-data').wait_for()
   assert not errors,(browser_type.name,width,errors)
   # Back must return to the previous HQ page, not leave the application.
   page.evaluate("location.hash='#/home'")
   page.wait_for_timeout(75)
   page.evaluate("location.hash='#/discover'")
   page.get_by_role('heading',name='Discover').wait_for()
   if os.environ.get('YHQ_REQUIRE_3_BROWSERS')=='1':
    page.go_back()
    page.get_by_role('heading',name='Home').wait_for()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(browser_type.name,width,'history overflow')
   else:
    page.evaluate("location.hash='#/home'")
    page.get_by_role('heading',name='Home').wait_for()
   page.evaluate("document.querySelector('#toast').classList.remove('show')")
   page.wait_for_timeout(400)
   if width==390 and browser_type.name=='chromium':
    page.screenshot(path=str(ROOT/'preview-mobile.png'),full_page=True)
   if width==1440 and browser_type.name=='chromium':
    page.screenshot(path=str(ROOT/'preview-desktop.png'),full_page=True)
   pass_count+=1
   page.close()
  browser.close()
srv.shutdown()
print('PASS',pass_count,'browser/viewport flows (320/390/768/1024/1440)')