/* RC8: real-record health charts and native Back integration. No migration or activation changes. */
(()=>{'use strict';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const nutrients=[['p','Proteínas','#74d5af'],['c','Carboidratos','#5edbea'],['fi','Fibras','#c09cff'],['f','Gorduras','#efbb72']];
let period=7,view='calories';
const knownNumber=v=>typeof v==='number'&&Number.isFinite(v);
const number=v=>knownNumber(v)?Number(v):0;
const f=(n,d=0)=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:d});
const dateLabel=d=>d.split('-').reverse().join('/');
const goalFor=k=>Number(db.config[k])>0?Number(db.config[k]):k==='fi'?25:1;
function svgEl(root,tag,attrs={},text){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;root.appendChild(el);return el}
function build(){
 const weight=$('weightProgressChart').closest('article'),calories=$('calorieChart').closest('article');
 const panel=document.createElement('section');panel.id='rc8HealthPanel';panel.setAttribute('aria-label','Nutrição e evolução de calorias e peso');
 panel.innerHTML='<div class="rc8-kicker">SEU ACOMPANHAMENTO</div><h2>Nutrição e evolução</h2><p class="rc8-caption" id="rc8ActiveDate"></p><div id="rc8Nutrients"></div><p id="rc8NutrientNote"></p><details class="rc8-targets" id="rc8Targets"><summary>Ajustar referências dos nutrientes</summary><div class="rc8-target-grid" id="rc8TargetInputs"></div><p class="rc8-caption">Referências pessoais editáveis, não prescrição nutricional. Fibras começam com referência de 25 g; ajuste com seu profissional.</p><button type="button" id="rc8SaveTargets">Salvar referências</button><p id="rc8TargetStatus" role="status"></p></details><div class="rc8-chart-controls"><div class="rc8-tabs" role="tablist" aria-label="Gráfico"><button type="button" role="tab" id="rc8TabCalories" aria-controls="rc8CaloriePane" aria-selected="true">Calorias</button><button type="button" role="tab" id="rc8TabWeight" aria-controls="rc8WeightPane" aria-selected="false">Peso</button></div><div class="rc8-ranges" aria-label="Período"><button type="button" data-range="7" aria-pressed="true">7d</button><button type="button" data-range="30" aria-pressed="false">30d</button><button type="button" data-range="90" aria-pressed="false">90d</button></div></div>';
 $('home').insertBefore(panel,$('homeFoodToday'));
 calories.id='rc8CaloriePane';calories.setAttribute('role','tabpanel');calories.setAttribute('aria-labelledby','rc8TabCalories');
 weight.id='rc8WeightPane';weight.setAttribute('role','tabpanel');weight.setAttribute('aria-labelledby','rc8TabWeight');
 panel.append(calories,weight);weight.hidden=true;
 calories.querySelector('.calorie-legend').innerHTML='<span><i class="rc8-legend-dot" style="background:#5edbea"></i>Consumo registrado</span><span><i class="rc8-legend-dot" style="background:#a5b1bd"></i>Limite diário</span>';
 weight.querySelector('.weight-journey-note').textContent='Somente pesagens registradas. A linha liga as medições, sem estimar pesos nos outros dias.';
 const note=document.createElement('p');note.id='rc8WeightPeriod';$('weightProgressChart').after(note);
 for(const [key,label,color] of nutrients){
  const el=document.createElement('article');el.className='rc8-nutrient';el.id='rc8Nutrient'+key;
  el.innerHTML='<div class="rc8-gauge"><svg viewBox="0 0 100 100" role="img" aria-label="'+label+'"><path d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28" pathLength="100" fill="none" stroke="#233742" stroke-width="5" stroke-linecap="round"/><path id="rc8Arc'+key+'" d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28" pathLength="100" fill="none" stroke="'+color+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 100"/><text id="rc8Percent'+key+'" x="50" y="54" text-anchor="middle" font-size="19" fill="#e8f9ff">—</text><text x="50" y="70" text-anchor="middle" font-size="8" fill="#8ba6b5">da referência</text></svg></div><h3>'+label+'</h3><div class="rc8-amount" id="rc8Amount'+key+'">—</div><small id="rc8Goal'+key+'"></small>';
  $('rc8Nutrients').appendChild(el);
  const labelEl=document.createElement('label');labelEl.textContent=label+' · g/dia';const input=document.createElement('input');input.id='rc8Target'+key;input.type='number';input.min='1';input.max='1000';input.step='0.1';input.value=goalFor(key);labelEl.appendChild(input);$('rc8TargetInputs').appendChild(labelEl);
 }
 $('rc8Targets').querySelector('summary').addEventListener('click',()=>{if(!$('rc8Targets').open)for(const [k]of nutrients)$('rc8Target'+k).value=goalFor(k)});
 $('rc8SaveTargets').onclick=()=>{const vals=nutrients.map(([k])=>Number($('rc8Target'+k).value));if(vals.some(v=>!Number.isFinite(v)||v<=0||v>1000)){$('rc8TargetStatus').textContent='Use valores entre 0,1 e 1.000 g.';return}for(let i=0;i<nutrients.length;i++)db.config[nutrients[i][0]]=vals[i];const ok=store();render();$('rc8TargetStatus').textContent=ok?'Referências salvas.':'Referências aplicadas nesta sessão. Não foi possível salvar no aparelho.'};
 $('rc8TabCalories').onclick=()=>setView('calories');$('rc8TabWeight').onclick=()=>setView('weight');
 panel.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{period=Number(b.dataset.range);panel.querySelectorAll('[data-range]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));update()});
 const jump=document.createElement('button');jump.className='rc8-go-health';jump.type='button';jump.textContent='Ver nutrientes, calorias e peso';jump.onclick=()=>{JarvisShell.go('home');panel.scrollIntoView({block:'start',behavior:'smooth'})};$('topMealEntry').after(jump);
 // The old three-column bars are superseded by the four complete rings, not deleted.
 const col=$('macroTrackp').closest('.macro-column');if(col&&col.parentElement)col.parentElement.hidden=true;
 const original=window.render;window.render=function(){const value=original.apply(this,arguments);update();return value};
 update();
}
function setView(v){view=v;$('rc8CaloriePane').hidden=v!=='calories';$('rc8WeightPane').hidden=v!=='weight';$('rc8TabCalories').setAttribute('aria-selected',String(v==='calories'));$('rc8TabWeight').setAttribute('aria-selected',String(v==='weight'));update()}
function updateRings(){
 const foods=day().foods||[];$('rc8ActiveDate').textContent='Registros de '+dateLabel(selected)+' · metas e histórico no mesmo painel';let partial=false;
 for(const [key,label] of nutrients){const known=foods.filter(x=>knownNumber(x[key])),sum=known.reduce((a,x)=>a+Number(x[key]),0),goal=goalFor(key),missing=known.length!==foods.length,percent=sum/goal*100,has=known.length>0;
  $('rc8Nutrient'+key).dataset.partial=String(missing);
  $('rc8Arc'+key).setAttribute('stroke-dasharray',(has?Math.min(100,Math.max(0,percent)):0)+' 100');
  $('rc8Percent'+key).textContent=has?f(percent)+'%':'—';
  $('rc8Amount'+key).textContent=has?f(sum,1)+' g':'— g';
  $('rc8Goal'+key).textContent='de '+f(goal,1)+' g'+(missing?' · parcial':'');
  $('rc8Nutrient'+key).querySelector('svg').setAttribute('aria-label',label+': '+(has?f(sum,1)+' de '+f(goal,1)+' gramas, '+f(percent)+' por cento':'sem registro')+(missing?', dados parciais':''));partial||=missing;
 }
 $('rc8NutrientNote').textContent=!foods.length?'Nenhuma refeição registrada nesta data. Ausência de registro não significa consumo zero.':partial?'Dados parciais: nutrientes ausentes em algum alimento não são considerados zero. Percentuais podem superar 100%; o arco para em 100%.':'Percentuais calculados com os alimentos da data selecionada. O arco para em 100%, mas o valor mostra o total real.';
}
function smooth(points){if(!points.length)return '';let d='M'+points[0].x+' '+points[0].y;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],mid=(a.x+b.x)/2;d+=' C'+mid+' '+a.y+' '+mid+' '+b.y+' '+b.x+' '+b.y}return d}
function chart(root,records,opts){
 root.replaceChildren();root.setAttribute('viewBox','0 0 320 190');root.setAttribute('role','img');root.setAttribute('aria-label',opts.title);svgEl(root,'title',{},opts.title);
 const left=30,right=300,top=20,bottom=142,start=dateShift(selected,-period+1),span=period-1;
 const values=records.map(x=>x.value);if(opts.goal!=null)values.push(opts.goal);
 let lo=opts.zero?0:Math.min(...values),hi=Math.max(...values);if(!values.length){lo=0;hi=1}else if(!opts.zero){let pad=Math.max((hi-lo)*.25,1);lo=Math.max(0,lo-pad);hi+=pad}else hi=Math.max(hi*1.18,1);
 const x=d=>left+(Date.parse(d+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000/span*(right-left),y=v=>bottom-(v-lo)/(hi-lo||1)*(bottom-top);
 for(let i=0;i<4;i++){const yy=top+i*(bottom-top)/3;svgEl(root,'line',{x1:left,x2:right,y1:yy,y2:yy,stroke:'#223541','stroke-width':.7,'stroke-dasharray':'2 4'});svgEl(root,'text',{x:left-5,y:yy+3,'text-anchor':'end',fill:'#728d9f','font-size':7},f(hi-i*(hi-lo)/3,opts.zero?0:1))}
 for(let i=0;i<4;i++){const d=dateShift(start,Math.round(i*span/3)),xx=x(d);svgEl(root,'line',{x1:xx,x2:xx,y1:top,y2:bottom,stroke:'#19303b','stroke-width':.7});svgEl(root,'text',{x:xx,y:165,'text-anchor':'middle',fill:'#83a5b7','font-size':9},d.slice(8)+'/'+d.slice(5,7))}
 if(opts.goal!=null){svgEl(root,'line',{x1:left,x2:right,y1:y(opts.goal),y2:y(opts.goal),stroke:'#a5b1bd','stroke-width':1,'stroke-dasharray':'4 4'});svgEl(root,'text',{x:right,y:y(opts.goal)-5,'text-anchor':'end',fill:'#a1b3bd','font-size':8},'Limite '+f(opts.goal))}
 const defs=svgEl(root,'defs'),gradient=svgEl(defs,'linearGradient',{id:opts.id+'Fill',x1:'0',y1:'0',x2:'0',y2:'1'});svgEl(gradient,'stop',{offset:'0%','stop-color':opts.color,'stop-opacity':.4});svgEl(gradient,'stop',{offset:'100%','stop-color':opts.color,'stop-opacity':.015});
 const pointRecords=records.map(r=>({...r,x:x(r.date),y:y(r.value)}));const groups=[];
 for(const p of pointRecords){const group=groups.at(-1),prev=group?.at(-1);if(!group||(opts.gaps&&Date.parse(p.date)-Date.parse(prev.date)>86400000))groups.push([p]);else group.push(p)}
 for(const pts of groups){if(pts.length>1){const path=smooth(pts);svgEl(root,'path',{class:'rc9-area',d:path+' L'+pts.at(-1).x+' '+bottom+' L'+pts[0].x+' '+bottom+' Z',fill:'url(#'+opts.id+'Fill)'});svgEl(root,'path',{d:path,fill:'none',stroke:opts.color,'stroke-width':2.8,'stroke-linecap':'round','stroke-linejoin':'round'})}else{const p=pts[0],half=Math.min(13,(right-left)/span/3),a=Math.max(left,p.x-half),b=Math.min(right,p.x+half);svgEl(root,'path',{class:'rc9-area rc9-single-area',d:'M'+a+' '+p.y+' L'+b+' '+p.y+' L'+b+' '+bottom+' L'+a+' '+bottom+' Z',fill:'url(#'+opts.id+'Fill)'});svgEl(root,'line',{x1:p.x,x2:p.x,y1:p.y,y2:bottom,stroke:opts.color,'stroke-width':1.4,'stroke-opacity':.7,'stroke-dasharray':'3 3'});svgEl(root,'title',{},'Faixa de uma única data registrada; não representa tendência.')}}
 for(const p of pointRecords){const g=svgEl(root,'g',{role:'button',tabindex:0,'aria-label':dateLabel(p.date)+': '+f(p.value,opts.zero?0:2)+' '+opts.unit}),circle=svgEl(g,'circle',{cx:p.x,cy:p.y,r:4,fill:'#e8fdff',stroke:opts.color,'stroke-width':1.5,class:'rc8-point'});svgEl(g,'title',{},dateLabel(p.date)+' · '+f(p.value,2)+' '+opts.unit);svgEl(g,'circle',{cx:p.x,cy:p.y,r:12,fill:'transparent'});const choose=()=>setDate(p.date);g.onclick=choose;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}};if(pointRecords.length<=9)svgEl(root,'text',{x:p.x,y:Math.max(10,p.y-11),'text-anchor':'middle',fill:'#c2dbe7','font-size':8},f(p.value,opts.zero?0:1))}
 if(!records.length)svgEl(root,'text',{x:165,y:87,'text-anchor':'middle',class:'rc8-chart-empty'},opts.zero?'Sem refeições neste período':'Sem pesagens neste período');
}
function update(){if(!$('rc8HealthPanel'))return;updateRings();const start=dateShift(selected,-period+1),cal=[];for(let i=period-1;i>=0;i--){const d=dateShift(selected,-i),foods=db.days[d]?.foods||[],known=foods.filter(x=>knownNumber(x.k));if(known.length)cal.push({date:d,value:known.reduce((a,x)=>a+Number(x.k),0),partial:known.length!==foods.length})}
 chart($('calorieChart'),cal,{id:'rc8Cal',zero:true,gaps:true,goal:Number(db.config.calories)||1500,color:'#5edbea',unit:'kcal',title:'Calorias registradas entre '+dateLabel(start)+' e '+dateLabel(selected)+'. Dias sem registros são lacunas.'});
 $('calorieChartPeriod').textContent=period+' dias até '+dateLabel(selected)+'. Toque num ponto para abrir a data. Dias sem registro não viram zero.'+(cal.some(x=>x.partial)?' * Subtotal parcial: algum alimento não tem calorias informadas.':'')+(cal.length===1?' Uma única data não define tendência.':'');
 if(!(day().foods||[]).length)$('calorieChartTotal').textContent='—';
 const weights=Object.entries(db.weights||{}).filter(([d,v])=>d<=selected&&Number.isFinite(Number(v))&&Number(v)>0).sort(([a],[b])=>a.localeCompare(b));const rows=weights.filter(([d])=>d>=start).map(([date,v])=>({date,value:Number(v)}));
 chart($('weightProgressChart'),rows,{id:'rc8Weight',zero:false,gaps:false,color:'#a4a6ff',unit:'kg',title:'Pesagens registradas entre '+dateLabel(start)+' e '+dateLabel(selected)+'.'});
 const last=weights.at(-1),current=last?Number(last[1]):null,goal=Number(db.config.weight)||80,initial=124.5,lost=current==null?0:initial-current,remaining=current==null?null:Math.max(0,current-goal),progress=current==null?0:Math.min(100,Math.max(0,lost/(initial-goal)*100));
 $('weightChartCurrent').textContent=current==null?'—':f(current,2);$('weightChartRemaining').textContent=remaining==null?'—':f(remaining,2);$('weightChartLost').textContent=current==null?'Sem pesagem':lost>=0?f(lost,2)+' kg eliminados':f(-lost,2)+' kg acima do início';$('weightChartDate').textContent=last?'Última até a data · '+dateLabel(last[0]):'Sem pesagem até esta data';$('weightLossFill').style.width=progress+'%';$('weightLossMeter').setAttribute('aria-valuenow',String(progress));$('weightLossMeter').setAttribute('aria-valuetext',f(progress,1)+'% do percurso');
 const labels=$('rc8WeightPane').querySelector('.weight-journey-labels');labels.lastElementChild.querySelector('b').textContent=f(goal,1)+' kg';$('rc8WeightPane').querySelector('.calorie-head span').textContent='Meta · '+f(goal,1)+' kg';
 $('rc8WeightPeriod').textContent=period+' dias · '+rows.length+' pesagem(ns)'+(rows.length===1?'. Uma medição é um ponto, não uma tendência.':'. Sem estimativas entre as medições.');
}
function initBack(){
 const active=()=>document.querySelector('.screen.active')?.id||'home';let current=active(),stack=[],goingBack=false,recordInitial=null;
 function observe(){const next=active();if(next===current)return;if(next==='record')recordInitial=$('recordValue').value;if(goingBack){goingBack=false;current=next;return}stack.push(current);if(stack.length>60)stack.shift();current=next}
 const observer=new MutationObserver(observe);document.querySelectorAll('.screen').forEach(e=>observer.observe(e,{attributes:true,attributeFilter:['class']}));
 window.JarvisNativeBack=function(){
  observe();const dialog=$('ai23Dialog');if(dialog&&!dialog.hidden){$('ai23Close').click();return true}
  if($('jarvisSidebar')&&!$('jarvisSidebar').hidden){JarvisShell.closeMenu();return true}
  if($('obsRestorePreview')&&!$('obsRestorePreview').hidden){$('obsCancelRestore').click();return true}
  if($('rc8Targets').open){$('rc8Targets').open=false;return true}
  const openDetails=document.querySelector('.screen.active details[open]');if(openDetails){openDetails.open=false;return true}
  const now=active();if(now==='home'&&!stack.length)return false;
  if(now==='record'){
   const input=$('recordValue');if(input&&input.value!==recordInitial&&!window.confirm('Voltar sem salvar este registro? O valor digitado será mantido no campo.'))return true;
  }
  let dest=stack.pop()||'home';while(dest===now&&stack.length)dest=stack.pop();if(dest===now)return false;
  goingBack=true;
  if(['record','settings','history'].includes(dest)){window.show(dest)}else JarvisShell.go(dest);
  const next=active();if(next===current)goingBack=false;else{current=next;goingBack=false}return true;
 };
}
build();initBack();window.JarvisHealthRC8={update,setView,getPeriod:()=>period};
})();