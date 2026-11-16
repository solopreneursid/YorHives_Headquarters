"""Minimal browser smoke: compiled SHA-256 CSP permits exactly our inline app."""
import re, json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parents[1]
html=(p/'index.html').read_text()
script=re.search(r'<script>(.*?)</script>',html,re.S).group(1)
import hashlib,base64
sha='sha256-'+base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
from datetime import datetime, timezone
current=datetime.now(timezone.utc).isoformat()
data={'site':{'state':'online','checkedAt':current},'hq':{'state':'online','checkedAt':current},'mind':{'state':'not-connected'},'opportunities':[],'saved':[],'decisions':[],'budget':{'aiEnabled':False}}
policy="default-src 'none'; script-src '"+sha+"'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'"
content=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'">',1)
with sync_playwright() as pl:
 opts={'headless':True};
 if Path('/usr/bin/chromium').exists():opts['executable_path']='/usr/bin/chromium';opts['args']=['--no-sandbox']
 b=pl.chromium.launch(**opts);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("window.fetch=async()=>new Response("+json.dumps(json.dumps(data)) +",{status:200,headers:{'content-type':'application/json'}})")
 page.goto('about:blank')
 page.set_content(content,wait_until='domcontentloaded')
 page.locator('.demo-chip').get_by_text('Live').wait_for(timeout=10000)
 assert not errors,errors
 page.evaluate("location.hash='#/control'")
 page.get_by_role('heading',name='Control').wait_for(timeout=3000)
 print('PASS Strict CSP + UI boot + navigation')
 b.close()
