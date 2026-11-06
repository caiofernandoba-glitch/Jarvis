from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json,re,zipfile,subprocess,os
ROOT=Path.cwd();app=ROOT/'output/jarvis-android';checks=[];errors=[];baseline=app/'reports/visual-rc16-before'
def check(n,v):
 assert v,n
 checks.append(n);print('PASS',n,flush=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),lambda *a,**k:Quiet(*a,directory=str(ROOT),**k));Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_address[1]}/output/jarvis.html'
selectors=['body','.shell','#home','#homeFoodToday','.j15-weight','.j22-weight-path','.j22-weight-point','#food','#library','#nutrition','#topMealEntry']
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  contexts=[];pages=[];palettes=[];geometry=[]
  for old in [True,False]:
   ctx=b.new_context(viewport={'width':390,'height':844});contexts.append(ctx)
   if old:
    ctx.route('**/output/jarvis.html',lambda r:r.fulfill(path=str(baseline/'jarvis.html'),content_type='text/html'))
    ctx.route('**/jarvis-assets/gringotts.html',lambda r:r.fulfill(path=str(baseline/'gringotts.html'),content_type='text/html'))
   page=ctx.new_page();pages.append(page);page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(url,wait_until='networkidle');page.wait_for_function('window.JarvisDashboard22 && window.JarvisShell')
   page.evaluate("selected='2026-11-04';db.config.initialWeight=124.5;db.config.weight=80;db.weights={'2026-10-20':108.9,'2026-11-01':108.4,'2026-11-04':107.9};render();window.seed16=JSON.stringify(db)")
   page.evaluate('document.fonts.ready');page.wait_for_timeout(350)
   palettes.append({s:page.locator(s).first.evaluate('e=>{let s=getComputedStyle(e);return [s.color,s.backgroundColor,s.backgroundImage,s.fill,s.stroke]}') for s in selectors if page.locator(s).count()})
   geometry.append(page.locator('.j15-chart').evaluate('e=>Array.from(e.querySelectorAll("path,circle,line")).map(n=>[n.tagName,n.getAttribute("d"),n.getAttribute("cx"),n.getAttribute("cy"),n.getAttribute("r")])'))
  page=pages[1]
  check('cores e fundos originais preservados',palettes[0]==palettes[1])
  check('geometria e valores de peso identicos',geometry[0]==geometry[1])
  check('Poppins local carregada',page.evaluate("document.fonts.check('400 16px Poppins')&&document.fonts.check('700 16px Poppins')"))
  for sel in ['body','#food','#library','#nutrition','.j15-weight h2','.j22-weight-value','button','input']:
   if page.locator(sel).count():check('fonte uniforme '+sel,'Poppins' in page.locator(sel).first.evaluate('e=>getComputedStyle(e).fontFamily'))
  check('curva com profundidade','jarvisRc16CurveShadow' in page.locator('.j22-weight-path').evaluate('e=>getComputedStyle(e).filter'))
  check('filtro da curva presente',page.locator('#jarvisRc16CurveShadow').count()>0)
  page.locator('.j15-weight').screenshot(path=str(app/'rc16-peso.png'))
  page.screenshot(path=str(app/'rc16-inicio.png'),full_page=True)
  check('visual nao altera registros',page.evaluate('JSON.stringify(db)===seed16'))
  for w in [320,360,390,430]:
   page.set_viewport_size({'width':w,'height':844})
   check('peso sem overflow '+str(w),page.locator('.j15-weight').evaluate('e=>e.scrollWidth<=e.clientWidth+1'))
   check('documento sem overflow '+str(w),page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  page.set_viewport_size({'width':390,'height':844})
  page.evaluate("JarvisShell.go('nutrition')");page.screenshot(path=str(app/'rc16-alimentacao.png'),full_page=True)
  check('nutricao registros intactos',page.evaluate('JSON.stringify(db)===seed16'))
  page.evaluate("JarvisShell.go('gringotts')")
  frame=page.frame_locator('#gringottsFrame');frame.locator('.donut').wait_for();page.wait_for_timeout(650)
  check('fonte financeira uniforme','Poppins' in frame.locator('h1').evaluate('e=>getComputedStyle(e).fontFamily'))
  check('filtro financeiro presente',frame.locator('#jarvisRc16SoftShadow').count()>0)
  check('barras financeiras com relevo','jarvisRc16SoftShadow' in frame.locator('.bar-income').first.evaluate('e=>getComputedStyle(e).filter'))
  check('donut com profundidade',frame.locator('.donut').evaluate('e=>getComputedStyle(e).boxShadow')!='none')
  page.screenshot(path=str(app/'rc16-financas.png'),full_page=True)
  page.emulate_media(reduced_motion='reduce');check('movimento reduzido',page.locator('.j22-weight-path').evaluate('e=>getComputedStyle(e).animationName')=='none')
  check('sem erros JavaScript',not errors)
  b.close()
finally:server.shutdown()
# No existing script, business logic or storage code was changed, only the two additive imports.
main=(ROOT/'output/jarvis.html').read_text();before=(baseline/'jarvis.html').read_text()
check('logica principal intacta',main.replace('<link rel="stylesheet" href="jarvis-assets/visual-rc16.css"/><script src="jarvis-assets/visual-rc16.js"></script>','')==before)
finance=(ROOT/'output/jarvis-assets/gringotts.html').read_text();prev=(baseline/'gringotts.html').read_text()
check('logica financeira intacta',finance.replace('<link rel="stylesheet" href="visual-rc16.css"/><script defer src="visual-rc16.js"></script>','')==prev)
bt=ROOT/'tools/android-sdk/build-tools/35.0.0';env=dict(os.environ,JAVA_HOME=str(ROOT/'tools/jdk17'));env['PATH']=str(ROOT/'tools/jdk17/bin')+':'+env['PATH']
def cert(path):
 r=subprocess.run([str(bt/'apksigner'),'verify','--print-certs',str(path)],capture_output=True,text=True,env=env);assert r.returncode==0;return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)',r.stdout)[1]
a=app/'J.A.R.V.I.S-v2.3-rc16.apk';old=app/'J.A.R.V.I.S-v2.3-rc15.apk'
check('assinatura compativel RC15',cert(a)==cert(old))
r=subprocess.run([str(bt/'aapt'),'dump','badging',str(a)],capture_output=True,text=True,env=env)
check('pacote e versao de atualizacao',all(x in r.stdout.splitlines()[0]for x in ["name='br.com.caio.jarvis'","versionCode='30'","versionName='2.3-rc16'"]))
with zipfile.ZipFile(a)as z,zipfile.ZipFile(old)as prev:
 check('codigo Android nativo intacto',z.read('classes.dex')==prev.read('classes.dex'))
 for name in prev.namelist():
  if name.startswith('assets/') and not name.endswith('/') and name not in ['assets/jarvis.html','assets/jarvis-assets/gringotts.html']:
   check('asset original intacto '+name,z.read(name)==prev.read(name))
 for name in ['visual-rc16.css','visual-rc16.js','fonts/Poppins-Regular-400.ttf','fonts/Poppins-Medium-500.ttf','fonts/Poppins-SemiBold-600.ttf','fonts/Poppins-Bold-700.ttf']:
  check('recurso novo empacotado '+name,z.read('assets/jarvis-assets/'+name)==(ROOT/'output/jarvis-assets'/name).read_bytes())
report={'checks_passed':len(checks),'errors':errors,'physical_install_test':'not run','screenshots_use_isolated_test_data':True,'palette_unchanged':True,'same_signature_RC15':True}
(app/'rc16-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
