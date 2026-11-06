import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {TACO_DATA} from '../src/taco-data.js';
import {localNutrition} from '../src/taco.js';
const {default:worker}=await import(process.env.TACO_WORKER||'../src/worker.js');
globalThis.crypto??=webcrypto;
const env={JARVIS_TOKEN_SECRET:'offline-coverage-test-only',ALLOW_IN_MEMORY_RATE_LIMITER:'true',RATE_LIMIT_PER_MINUTE:'10000',ALLOW_INSECURE_LOCAL:'true'};
const payload=Buffer.from(JSON.stringify({v:1,sub:'coverage-test',scope:'assistant',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
const token=payload+'.'+createHmac('sha256',env.JARVIS_TOKEN_SECRET).update(payload).digest('base64url');
const app=(query,history=[],permissions=['read:nutrition','write:nutrition'])=>({domain:'app',query,context:{module:'home',date:'2026-11-05',records:[],history,permissions}});
let calls=0;const originalFetch=globalThis.fetch;
test.before(()=>{globalThis.fetch=async()=>{calls++;throw Error('No upstream allowed');};});
test.after(()=>{globalThis.fetch=originalFetch;assert.equal(calls,0);});
async function run(body){const r=await worker.fetch(new Request('http://localhost/v1/assistant',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)}),env);assert.equal(r.status,200,body.query);return r.json();}
const round=n=>Math.round((n+Number.EPSILON*Math.max(1,Math.abs(n)))*100)/100;
const nutrients=[['k','energy_kcal'],['p','protein_g'],['c','carbohydrate_g'],['f','lipids_g'],['fi','dietary_fiber_g']];
for(const domain of ['app','food'])test(`all 597 canonical names resolve locally in ${domain}, including catalog numbers and compound foods`,async()=>{
 assert.equal(TACO_DATA.foods.length,597);
 for(const row of TACO_DATA.foods){const grams=domain==='app'?100:37;const query=`Registrar ${grams}g ${row.description}`;const result=await run(domain==='app'?app(query):{domain,query,context:{date:'2026-11-05',messages:[]}});const data=domain==='app'?result.actions[0]?.data:result.foods[0];assert.ok(data,row.description+': '+result.message);assert.equal(data.n,row.description);assert.equal(data.amount,grams);assert.equal(data.unit,'g');for(const [key,source] of nutrients)assert.equal(data[key],row.per_100g_edible_portion[source]===null?null:round(row.per_100g_edible_portion[source]*grams/100),row.description+': '+key);}
});
test('pear screenshot wording, plurals, accents, mass aliases and decimal comma all stay local',async()=>{
 for(const q of ['50g Pera Williams crua','Registrar alimentação\n50g Pera Williams crua','comi 50 gramas de pera Williams crua','Registrar 50gr peras Williams cruas','Registrar 0,05kg pêra Williams crua']){const r=await run(app(q));assert.deepEqual(r.actions[0]?.data,{n:'Pêra, Williams, crua',amount:50,unit:'g',k:26.5,p:0.3,c:7,f:0.05,fi:1.5});}
});
test('pear variety is never guessed or confused with orange; rice preparation is preserved',async()=>{
 const p=await run(app('Registrar 50g peras'));assert.deepEqual(p.actions,[]);assert.match(p.message,/Pêra, Park, crua/);assert.match(p.message,/Pêra, Williams, crua/);assert.doesNotMatch(p.message,/Laranja/);
 const r=await run(app('Registrar 50g arroz cozido'));assert.deepEqual(r.actions,[]);assert.match(r.message,/tipo 1, cozido/);assert.match(r.message,/tipo 2, cozido/);assert.doesNotMatch(r.message,/, cru(?:\b|\|)/);
});
test('lookup after failed nutrient request recovers the latest food without proposing a duplicate',async()=>{
 const h=[{role:'user',text:'Registrar 50g Pera Williams crua'},{role:'assistant',text:'Preciso dos valores de calorias porque não possuo uma base de dados nutricional integrada.'}];
 for(const q of ['Consegue buscar no sistema?','Pode consultar na base?','Pesquise na TACO']){const r=await run(app(q,h));assert.deepEqual(r.actions,[]);assert.match(r.message,/26.5 kcal/);assert.match(r.message,/TACO/);}
 h.push({role:'user',text:'Consegue buscar no sistema?'});const r=await run(app('Consegue buscar no sistema?',h));assert.deepEqual(r.actions,[]);assert.match(r.message,/26.5 kcal/);
});
test('lookup cannot reuse completed, unrelated, ambiguous or historical records',()=>{
 const q='Consegue buscar no sistema?';
 for(const answer of ['Estimativa nutricional calculada. Nada foi salvo ainda.','Registro salvo.','Vamos falar de contas.'])assert.equal(localNutrition(app(q,[{role:'user',text:'Registrar 50g pera Williams crua'},{role:'assistant',text:answer}])),null);
 assert.equal(localNutrition(app(q,[{role:'user',text:'Registrar 50g pera Williams crua ontem'},{role:'assistant',text:'Não possuo uma base de dados nutricional.'}])),null);
 const r=localNutrition(app(q,[{role:'user',text:'Registrar 50g pera'},{role:'assistant',text:'Qual opção exata?'}]));assert.deepEqual(r.actions,[]);assert.match(r.message,/Qual opção/);
});
test('unknown foods, unit weights and ml never invent nutrition data',async()=>{
 for(const q of ['Registrar alimentação 50g Marca Fantasia Ultra','Registrar alimentação 2 peras Williams cruas','Registrar alimentação 250 ml leite']){const r=await run(app(q));assert.deepEqual(r.actions,[]);assert.match(r.message,/Não encontrei|gramas/);}
});
test('bare pear weight continuation stays local and preserves permissions',async()=>{
 const first='Registrar alimentação\n2 peras Williams cruas';const pending=await run(app(first));assert.deepEqual(pending.actions,[]);assert.match(pending.message,/peso total em gramas/);const history=[{role:'user',text:first},{role:'assistant',text:pending.message}];assert.equal((await run(app('50gr',history))).actions[0].data.k,26.5);assert.deepEqual((await run(app('50gr',history,['read:nutrition']))).actions,[]);
});
