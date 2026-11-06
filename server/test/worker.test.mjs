import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/worker.js';

function token(secret = 'test-secret') { const p = Buffer.from(JSON.stringify({ v:1, sub:'test-device', scope:'assistant', exp:Math.floor(Date.now()/1000)+3600 })).toString('base64url'); return `${p}.${createHmac('sha256',secret).update(p).digest('base64url')}`; }
const env = { GEMINI_API_KEY:'test-key', JARVIS_TOKEN_SECRET:'test-secret', ALLOW_IN_MEMORY_RATE_LIMITER:'true', RATE_LIMIT_PER_MINUTE:'100', ALLOW_INSECURE_LOCAL:'true' };
function req(body, extra = {}) { return new Request('http://localhost/v1/assistant', { method:'POST', headers:{ 'content-type':'application/json', authorization:`Bearer ${token()}`, ...extra.headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }); }
function appInput() { return { domain:'app', query:'Registre 500 ml de água', context:{ module:'hydration', date:'2026-11-04', records:[{id:'water-1',module:'hydration',date:'2026-11-04',label:'Água',value:250,unit:'ml',fields:{manual:true,ml:250}}], permissions:['read:hydration','write:hydration'] } }; }
const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

test('health is minimal and public', async () => { const r = await worker.fetch(new Request('https://example.invalid/health'), {}); assert.equal(r.status,200); assert.deepEqual(await r.json(),{ok:true,service:'jarvis-gemini-proxy'}); });
test('rejects unauthenticated request before upstream', async () => { const r = await worker.fetch(new Request('http://localhost/v1/assistant',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),env); assert.equal(r.status,401); assert.equal((await r.json()).error.code,'unauthorized'); });
test('rejects unknown request and context fields', async () => { let x=appInput(); x.sneaky='no'; let r=await worker.fetch(req(x),env); assert.equal(r.status,400); x=appInput(); x.context.extra=true; r=await worker.fetch(req(x),env); assert.equal(r.status,400); });
test('validates and returns constrained app actions with mocked upstream', async () => { globalThis.fetch = async () => new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'Registrado.',actions:[{op:'add',module:'hydration',date:'2026-11-04',data:{ml:500}}]})}]}}]}),{status:200}); const r=await worker.fetch(req(appInput()),env); assert.equal(r.status,200); assert.deepEqual(await r.json(),{message:'Registrado.',actions:[{op:'add',module:'hydration',date:'2026-11-04',data:{ml:500}}]}); });
test('rejects model update action for ID absent from trusted records', async () => { globalThis.fetch = async () => new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'ok',actions:[{op:'delete',module:'hydration',id:'invented'}]})}]}}]})); const r=await worker.fetch(req(appInput()),env); assert.equal(r.status,502); assert.equal((await r.json()).error.code,'invalid_upstream_response'); });
test('food research is local TACO data and never calls upstream', async () => { let calls=0; globalThis.fetch=async()=>{calls++;throw new Error('network forbidden');}; const r=await worker.fetch(req({domain:'food_research',query:'proteína em 100 g de arroz, tipo 1, cozido',context:{}}),env); assert.equal(r.status,200); const data=await r.json(); assert.equal(calls,0); assert.equal(data.searched,false); assert.match(data.sources[0].url,/nepa\.unicamp\.br/); });
test('rejects payload over 70KB', async () => { const huge='x'.repeat(72*1024); const r=await worker.fetch(req(JSON.stringify({domain:'food',query:huge,context:{}})),env); assert.equal(r.status,413); });

test('accepts representative native contexts for all six domains', async () => {
  const cases=[
    {domain:'food',query:'2 ovos',context:{date:'2026-11-04',messages:[{role:'user',content:'2 ovos'}]},out:{message:'Estimativa.',foods:[]}},
    {domain:'reading',query:'O que ocorreu?',context:{bookTitle:'Livro teste',pages:[1,2],excerpt:'Trecho suficiente do livro.',messages:[{role:'user',content:'O que ocorreu?'}]},out:{message:'Só o trecho sustenta isto.',foods:[]}},
    {domain:'finance',query:'registre conta',context:{selected:null},out:{action:'clarify',entry:null,targetId:null,message:'Informe a data.'}},
    {domain:'food_research',query:'proteína do ovo',context:{},out:{text:'Resultado pesquisado.',sources:[],searched:false,hasSuggestions:false}},
    {domain:'reading_summary',query:'Explique o trecho selecionado.',context:{module:'library',date:'2026-11-04',records:[{excerpt:'Livro: Teste\nPáginas do PDF: 1\n\nTrecho suficiente.'}],history:[],permissions:[]},out:{text:'Explicação baseada no trecho.'}},
    {domain:'app',query:'registre água',context:appInput().context,out:{message:'Proposta.',actions:[{op:'add',module:'hydration',date:'2026-11-04',data:{ml:500}}]}}
  ];
  for(const c of cases){ globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(c.out)}]}}]})); const r=await worker.fetch(req({domain:c.domain,query:c.query,context:c.context}),env); assert.equal(r.status,200, c.domain); }
});
test('rejects app writes without module permission, mismatched record module, and invalid reading pages', async () => {
  globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'x',actions:[{op:'update',module:'hydration',id:'water-1',data:{ml:500}}]})}]}}]}));
  const noWrite=appInput();noWrite.context.permissions=['read:hydration'];let r=await worker.fetch(req(noWrite),env);assert.equal(r.status,502);
  const wrong=appInput();wrong.context.permissions=['write:nutrition'];r=await worker.fetch(req(wrong),env);assert.equal(r.status,502);
  const reading={domain:'reading',query:'?',context:{bookTitle:'x',pages:[0],excerpt:'texto',messages:[]}};r=await worker.fetch(req(reading),env);assert.equal(r.status,400);
});
test('accepts native library add and hydration weight; rejects legacy ops and noncanonical settings', async () => {
  const x={domain:'app',query:'leitura',context:{module:'library',date:'2026-11-04',records:[],permissions:['write:library']}};
  globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'x',actions:[{op:'add',module:'library',data:{bookId:'b1',pages:[1,2]}}]})}]}}]}));let r=await worker.fetch(req(x),env);assert.equal(r.status,200);
  globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'x',actions:[{op:'add_reading',module:'library',data:{bookId:'b1',pages:[1,2]}}]})}]}}]}));r=await worker.fetch(req(x),env);assert.equal(r.status,502);
  const weigh={domain:'app',query:'peso',context:{module:'hydration',date:'2026-11-04',records:[{id:'weigh:today',module:'hydration',date:'2026-11-04',label:'Pesagem',value:90,unit:'kg'}],permissions:['write:hydration']}};
  globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'x',actions:[{op:'update',module:'hydration',id:'weigh:today',data:{kg:89.5}}]})}]}}]}));r=await worker.fetch(req(weigh),env);assert.equal(r.status,200);
  x.context.module='settings';x.context.permissions=['write:settings'];globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'x',actions:[{op:'update',module:'settings',id:'goal:initialWeight',data:{key:'initialWeight',value:1}}]})}]}}]}));r=await worker.fetch(req(x),env);assert.equal(r.status,502);
});
test('nutrition additions are local and reject unsupported unit conversions', async () => {
  let calls=0; globalThis.fetch=async()=>{calls++;throw new Error('network forbidden');};
  const x=appInput(); x.context.module='nutrition'; x.context.permissions=['write:nutrition']; x.query='registre 2 ovos';
  const r=await worker.fetch(req(x),env); assert.equal(r.status,200); const data=await r.json(); assert.equal(calls,0); assert.deepEqual(data.actions,[]); assert.match(data.message,/gramas/);
});
