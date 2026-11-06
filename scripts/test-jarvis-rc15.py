from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json,zipfile,subprocess,re,os
ROOT=Path.cwd();checks=[];errors=[]
def check(n,v):
 assert v,n
 checks.append(n);print('PASS',n,flush=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),lambda *a,**k:Quiet(*a,directory=str(ROOT),**k));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_address[1]}/output/jarvis-android/build/unsigned/assets/jarvis.html',wait_until='networkidle');page.wait_for_function('window.JarvisDashboard22 && window.JarvisShell')
  seed=page.evaluate('JSON.stringify(db)');page.evaluate('JarvisDashboard22.render()');check('render sem gravar',seed==page.evaluate('JSON.stringify(db)'))
  page.evaluate("selected='2026-11-04';db.config.initialWeight=124.5;db.config.weight=80;db.weights={'2026-10-20':108.9};render();window.seed15=JSON.stringify(db)")
  check('titulo conforme referencia',page.locator('.j15-weight h2').text_content()=='Meu peso')
  check('peso atual correto','108,90 kg'==page.locator('.j15-current').text_content())
  check('perda total correta','15,60 kg' in page.locator('.j15-change').text_content())
  check('uma pesagem real',page.locator('.j22-weight-point').count()==1)
  check('inicio nao e pesagem inventada',page.locator('.j15-initial-reference').count()==1 and 'sem data' in page.locator('.j15-initial-reference').locator('..').get_attribute('aria-label'))
  check('curva referencia tracejada',page.locator('.j15-reference-path').count()==1 and ' C' in page.locator('.j15-reference-path').get_attribute('d') and page.locator('.j22-weight-path').count()==0)
  check('area em degrade',page.locator('.j15-area').get_attribute('fill')=='url(#j15WeightFill)' and page.locator('#j15WeightFill stop').count()==2)
  check('grade vertical',page.locator('.j15-grid').count()==6)
  check('rotulos dos extremos',page.locator('.j22-weight-value').all_text_contents()==['124,50 kg','108,90 kg'])
  check('inicio sem data ficticia',page.locator('.j15-chart .j22-x-label').all_text_contents()==['Início*','20/10'])
  check('meta fora da curva','80,0 kg' in page.locator('.j22-journey-labels').text_content() and not '80' in page.locator('.j15-chart').text_content())
  check('barra percurso correta',abs(float(page.locator('.j22-journey-meter').get_attribute('aria-valuenow'))-35.05618)<.01)
  check('ausencia de previsao em semanas','sem prazo estimado' in page.locator('.j22-journey-caption').text_content())
  page.locator('.j15-help').click();check('ajuda acessivel',page.locator('#j15WeightHelp').is_visible() and page.locator('.j15-help').get_attribute('aria-expanded')=='true');page.locator('.j15-help').click()
  page.locator('.j15-chart g[role=button]').first.focus();page.keyboard.press('Enter');check('referencia acessivel','sem data registrada' in page.locator('.j22-weight-detail').text_content())
  page.locator('.j15-chart g[role=button]').last.focus();page.keyboard.press('Enter');check('pesagem acessivel','108,90 kg' in page.locator('.j22-weight-detail').text_content())
  for width in [320,360,390,430]:
   page.set_viewport_size({'width':width,'height':844});check('grafico sem overflow '+str(width),page.locator('.j15-weight').evaluate('e=>e.scrollWidth<=e.clientWidth+1'))
   check('alimentacao largura preservada '+str(width),page.locator('#homeFoodToday').evaluate('e=>Math.abs(e.getBoundingClientRect().width-e.parentElement.clientWidth)<2'))
  page.set_viewport_size({'width':390,'height':844});page.locator('.j15-weight').screenshot(path=str(ROOT/'output/jarvis-android/rc15-peso.png'));check('nenhum registro alterado',page.evaluate('JSON.stringify(db)===seed15'))
  check('personagem no inicio',page.locator('#home > .stage').first.evaluate("e=>e.previousElementSibling.tagName==='HEADER'"))
  page.evaluate("db.weights={};for(let i=0;i<40;i++)db.weights[dateShift(selected,-39+i)]=120-i*.25;db.weights['2026-11-05']=10;render();window.seed15=JSON.stringify(db)")
  check('40 pesagens sem futuro',page.locator('.j22-weight-point').count()==40)
  check('curva suavizada de pesos reais',' C' in page.locator('.j22-weight-path').get_attribute('d'))
  check('curva finita',not re.search('NaN|Infinity',page.locator('.j15-chart').inner_html()))
  check('datas legiveis',page.locator('.j15-chart .j22-x-label').count()<=4)
  page.locator('.j15-weight').screenshot(path=str(ROOT/'output/jarvis-android/rc15-peso-historico-teste.png'))
  check('historico preservado',page.evaluate('JSON.stringify(db)===seed15'))
  for vals,label in [("{'2026-11-01':100,'2026-11-02':100,'2026-11-03':100}",'plato'),("{'2026-11-01':100,'2026-11-02':112,'2026-11-03':99}",'oscilacao'),("{'2026-11-01':124.5}",'inicio igual pesagem')]:
   page.evaluate('db.weights='+vals+';render()');check('curva valida '+label,not re.search('NaN|Infinity',page.locator('.j15-chart').inner_html()))
  check('sem referencia duplicada',page.locator('.j15-initial-reference').count()==0 and page.locator('.j22-weight-point').count()==1)
  page.evaluate('db.weights={};render()');check('vazio sem pesagens inventadas',page.locator('.j22-weight-point').count()==0 and page.locator('.j15-initial-reference').count()==0 and page.locator('.j15-area').count()==0)
  page.evaluate("JarvisShell.go('nutrition')");styles=[page.locator(s).evaluate('e=>[getComputedStyle(e).backgroundImage,getComputedStyle(e).borderRadius]')for s in ['#topMealEntry','#foodChat22','#nutrition .jarvis-ai-card']];check('visual RC14 preservado',styles[0]==styles[1]==styles[2]);check('sem erros JS',not errors);b.close()
finally:server.shutdown()
app=ROOT/'output/jarvis-android';bt=ROOT/'tools/android-sdk/build-tools/35.0.0';env=dict(os.environ,JAVA_HOME=str(ROOT/'tools/jdk17'));env['PATH']=str(ROOT/'tools/jdk17/bin')+':'+env['PATH']
def cert(path):
 r=subprocess.run([str(bt/'apksigner'),'verify','--print-certs',str(path)],capture_output=True,text=True,env=env);assert r.returncode==0;return re.search(r'Signer #1 certificate SHA-256 digest: (\S+)',r.stdout)[1]
a=app/'J.A.R.V.I.S-v2.3-rc15.apk';old=app/'J.A.R.V.I.S-v2.3-rc14.apk';check('assinatura compativel RC14',cert(a)==cert(old))
r=subprocess.run([str(bt/'aapt'),'dump','badging',str(a)],capture_output=True,text=True,env=env);check('pacote versao atualizacao',all(x in r.stdout.splitlines()[0]for x in ["name='br.com.caio.jarvis'","versionCode='29'","versionName='2.3-rc15'"]))
with zipfile.ZipFile(a)as z,zipfile.ZipFile(old)as prev:
 for rel in ['jarvis-assets/assistant-v23.js','jarvis-assets/health-rc8.js','jarvis-assets/gringotts.html']:
  check('logica preservada '+rel,z.read('assets/'+rel)==prev.read('assets/'+rel))
 check('Android nativo preservado',z.read('classes.dex')==prev.read('classes.dex'))
 for rel in ['jarvis.html','jarvis-assets/layout-rc9-extra.css','jarvis-assets/layout-rc9-extra.js']:check('asset atualizado '+rel,z.read('assets/'+rel)==(ROOT/'output'/rel).read_bytes())
 # Only the renderWeight function may change within the main HTML.
 def strip_weight(data):
  a=data.index('  function renderWeight(root, active) {');e=data.index('\n  function render() {',a);return data[:a]+data[e:]
 check('HTML alterado somente no desenho de peso',strip_weight(z.read('assets/jarvis.html').decode())==strip_weight(prev.read('assets/jarvis.html').decode()))
report={'checks_passed':len(checks),'errors':errors,'same_signature_RC14':True,'physical_install_test':'not run','screenshots_use_isolated_test_data':True};(app/'rc15-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
