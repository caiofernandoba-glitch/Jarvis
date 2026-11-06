import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/worker.js';

function token(secret='test-secret') { const p=Buffer.from(JSON.stringify({v:1,sub:'nutrition-test',scope:'assistant',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'); return `${p}.${createHmac('sha256',secret).update(p).digest('base64url')}`; }
const env={JARVIS_TOKEN_SECRET:'test-secret',ALLOW_IN_MEMORY_RATE_LIMITER:'true',RATE_LIMIT_PER_MINUTE:'100',ALLOW_INSECURE_LOCAL:'true'};
function request(body, auth=true, url='http://localhost/v1/assistant') { return new Request(url,{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:`Bearer ${token()}`}:{})},body:JSON.stringify(body)}); }
const food=(query, messages=[])=>({domain:'food',query,context:{date:'2026-11-05',messages}});
const app=(query, permissions=['read:nutrition','write:nutrition'])=>({domain:'app',query,context:{module:'nutrition',date:'2026-11-05',records:[],permissions}});
const originalFetch=globalThis.fetch;
test.after(()=>{globalThis.fetch=originalFetch;});

async function noNetwork(req) { let calls=0; globalThis.fetch=async()=>{calls++;throw new Error('network forbidden')}; const r=await worker.fetch(req,env); assert.equal(calls,0); return r; }

test('TACO food addition is deterministic, local, and scales all five nutrients',async()=>{
 const r=await noNetwork(request(food('registre 128 g de arroz, tipo 1, cozido'))); assert.equal(r.status,200);
 assert.deepEqual((await r.json()).foods,[{n:'Arroz, tipo 1, cozido',amount:128,unit:'g',k:163.84,p:3.2,c:35.97,f:0.26,fi:2.05}]);
});
test('decimal comma, kg and official citation work without Gemini or API key',async()=>{
 const r=await noNetwork(request(food('registre 1,5 kg de arroz, tipo 1, cozido'))); const data=await r.json();
 assert.equal(data.foods[0].amount,1500); assert.equal(data.foods[0].k,1920); assert.match(data.message,/TACO.*2011/); assert.match(data.message,/nada foi salvo/i);
});
test('published TACO null values remain null rather than invented',async()=>{
 const r=await noNetwork(request(food('registre 100 g de milho, amido, cru'))); const item=(await r.json()).foods[0];
 assert.equal(item.f,null); assert.equal(item.k,361); assert.equal(item.fi,0.7);
});
test('food information query has no side effect and research uses local TACO citation',async()=>{
 let r=await noNetwork(request(food('quanto tem em 100 g de arroz, tipo 1, cozido?'))); let data=await r.json(); assert.deepEqual(data.foods,[]); assert.match(data.message,/128 kcal/);
 r=await noNetwork(request({domain:'food_research',query:'proteína em 100 g de arroz, tipo 1, cozido',context:{}})); data=await r.json(); assert.equal(data.searched,false); assert.equal(data.sources.length,1); assert.match(data.sources[0].url,/nepa\.unicamp\.br/);
});
test('ambiguous variants, missing grams, units and unknown foods never create entries',async()=>{
 for(const q of ['registre 100 g de arroz branco','registre 100 g de feijão','registre 2 ovos','registre 250 ml de leite','registre 100 g de Marca Fantasia Ultra']) {
  const r=await noNetwork(request(food(q))); const data=await r.json(); assert.deepEqual(data.foods,[],q); assert.match(data.message,/Qual opção|gramas|Não encontrei/,q);
 }
});
test('food lists are all-or-nothing and limited to 30',async()=>{
 let r=await noNetwork(request(food('registre 100 g de arroz, tipo 1, cozido; 2 ovos'))); assert.deepEqual((await r.json()).foods,[]);
 r=await noNetwork(request(food(Array(31).fill('100 g de arroz, tipo 1, cozido').join('; ')))); assert.deepEqual((await r.json()).foods,[]);
});
test('negations, questions and historical/modification requests cannot add food',async()=>{
 for(const q of ['não registre 100 g de arroz, tipo 1, cozido','apague 100 g de arroz, tipo 1, cozido','registre 100 g de arroz, tipo 1, cozido ontem','calorias de 100 g de arroz, tipo 1, cozido?']) {
  const r=await noNetwork(request(food(q))); assert.deepEqual((await r.json()).foods,[],q);
 }
});
test('app nutrition creates exactly one canonical action only with write permission',async()=>{
 let r=await noNetwork(request(app('registre 128 g de arroz, tipo 1, cozido'))); let data=await r.json(); assert.equal(data.actions.length,1); assert.deepEqual(data.actions[0].data,{n:'Arroz, tipo 1, cozido',amount:128,unit:'g',k:163.84,p:3.2,c:35.97,f:0.26,fi:2.05});
 r=await noNetwork(request(app('registre 128 g de arroz, tipo 1, cozido',['read:nutrition']))); assert.deepEqual((await r.json()).actions,[]);
 r=await noNetwork(request(app('registre 100 g de arroz, tipo 1, cozido; 100 g de arroz, tipo 1, cozido'))); assert.deepEqual((await r.json()).actions,[]);
});
test('auth, rate limit and HTTPS still guard local nutrition before processing',async()=>{
 let r=await noNetwork(request(food('registre 100 g de arroz, tipo 1, cozido'),false)); assert.equal(r.status,401);
 r=await noNetwork(request(food('registre 100 g de arroz, tipo 1, cozido'),true,'https://example.invalid/v1/assistant')); assert.equal(r.status,200);
 r=await worker.fetch(request(food('registre 100 g de arroz, tipo 1, cozido'),true,'http://example.invalid/v1/assistant'),env); assert.equal(r.status,400); assert.equal((await r.json()).error.code,'https_required');
});
test('rate limit applies before local TACO processing',async()=>{
 const rateEnv={...env,JARVIS_TOKEN_SECRET:'rate-secret',RATE_LIMIT_PER_MINUTE:'1'};
 const make=()=>new Request('http://localhost/v1/assistant',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token('rate-secret')}`},body:JSON.stringify(food('registre 100 g de arroz, tipo 1, cozido'))});
 globalThis.fetch=async()=>{throw new Error('network forbidden');};
 assert.equal((await worker.fetch(make(),rateEnv)).status,200); const r=await worker.fetch(make(),rateEnv); assert.equal(r.status,429); assert.equal((await r.json()).error.code,'rate_limited');
});
test('nutrition management fallback has no Google Search tools',async()=>{
 let body; globalThis.fetch=async(_url,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'Abrindo.',actions:[{op:'navigate',module:'nutrition',data:{route:'history'}}]})}]}}]}));};
 const r=await worker.fetch(request(app('abrir histórico')), {...env,GEMINI_API_KEY:'test'}); assert.equal(r.status,200); assert.equal(body.tools,undefined); assert.equal(body.generationConfig.responseMimeType,'application/json');
});
