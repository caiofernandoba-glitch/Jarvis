import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import worker from '../src/worker.js';
import {localNutrition} from '../src/taco.js';
globalThis.crypto ??= webcrypto;
const env={JARVIS_TOKEN_SECRET:'chat-test-secret',ALLOW_IN_MEMORY_RATE_LIMITER:'true',RATE_LIMIT_PER_MINUTE:'100',ALLOW_INSECURE_LOCAL:'true'};
const input=(query,permissions=['read:nutrition','write:nutrition'],module='home')=>({domain:'app',query,context:{module,date:'2026-11-05',records:[],history:[],permissions}});
async function run(x) {
 const p=Buffer.from(JSON.stringify({v:1,sub:'general-chat-test',scope:'assistant',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 const t=p+'.'+createHmac('sha256',env.JARVIS_TOKEN_SECRET).update(p).digest('base64url');
 const original=globalThis.fetch; let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('Gemini must not run');};
 try{ const r=await worker.fetch(new Request('http://localhost/v1/assistant',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify(x)}),env);assert.equal(r.status,200);assert.equal(calls,0);return await r.json(); }finally{globalThis.fetch=original;}
}
const priorFood='Registrar alimentação\n2 bananas pratas médias';
const pendingWeight=localNutrition(input(priorFood)).message;
const followup=(query,original=priorFood,answer=pendingWeight)=>{const x=input(query);x.context.history=[{role:'user',text:original},{role:'assistant',text:answer}];return x;};
test('90gr follow-up uses pending banana and TACO with no Gemini',async()=>{const r=await run(followup('90gr'));assert.deepEqual(r.actions[0].data,{n:'Banana, prata, crua',amount:90,unit:'g',k:88.2,p:1.17,c:23.4,f:0.09,fi:1.8});});
test('mass aliases and native current message in history resolve deterministically',async()=>{for(const q of ['90 g','90gr','90 grs','90 gramas','0,09 kg','90g sem casca']){const x=followup(q);x.context.history.push({role:'user',text:q});assert.equal((await run(x)).actions[0].data.k,88.2);}});
test('direct gr alias also uses local table',async()=>{assert.equal((await run(input('Registrar 90gr banana prata'))).actions[0].data.k,88.2);});
test('bare weight has no Gemini fallback and cannot invent a food',async()=>{const r=await run(input('90gr'));assert.deepEqual(r.actions,[]);assert.match(r.message,/qual alimento/);});
test('follow-up preserves read-only permission and information-only intent',async()=>{let x=followup('90gr');x.context.permissions=['read:nutrition'];assert.deepEqual((await run(x)).actions,[]);x=followup('90gr','Quantas calorias tem 2 bananas pratas médias?');const r=await run(x);assert.deepEqual(r.actions,[]);assert.match(r.message,/88.2 kcal/);});
test('follow-up refuses stale, ambiguous, historic, multiple-food and completed contexts',async()=>{for(const original of ['Registrar arroz','Registrar alimentação\n2 bananas pratas médias\n2 ovos','Registrar 90 g banana prata','não registre 2 bananas pratas médias','Registrar 2 bananas pratas médias ontem'])assert.deepEqual((await run(followup('90gr',original))).actions,[]);for(const answer of ['Tudo bem, vamos falar de contas.','Estimativa nutricional calculada. Nada foi salvo ainda.'])assert.deepEqual((await run(followup('90gr',priorFood,answer))).actions,[]);});
test('screenshot failed-macros turn can recover only with pending original food',async()=>{const x=followup('90gr');x.context.history.push({role:'user',text:'90gr'},{role:'assistant',text:'Preciso dos valores de calorias porque não possuo uma base de dados nutricional integrada.'},{role:'user',text:'90gr'});assert.equal((await run(x)).actions[0].data.k,88.2);});
test('food screen messages also preserve pending weight continuity',async()=>{const r=await run({domain:'food',query:'90gr',context:{date:'2026-11-05',messages:[{role:'user',text:priorFood},{role:'assistant',text:pendingWeight}]}});assert.equal(r.foods[0].k,88.2);});
test('new screenshot exact header and plural phrase stays local without Gemini',async()=>{
 const r=await run(input('Registrar alimentação\n2 bananas pratas médias'));
 assert.deepEqual(r.actions,[]);assert.match(r.message,/Encontrei na TACO: Banana, prata, crua/);assert.match(r.message,/peso total em gramas/);
});
test('header on the same line is not a food name',async()=>{const r=await run(input('Registrar alimentação 180 g de banana prata'));assert.equal(r.actions[0].data.k,176.4);});
test('header with grams on second line computes local proposal',async()=>{const r=await run(input('Registrar alimentação\n180 g de banana prata'));assert.equal(r.actions[0].data.k,176.4);});
test('standalone units and empty headers stay local without invented weight',async()=>{for(const q of ['2 bananas pratas médias','Registrar alimentação','Registrar alimentação\n2 alimentos desconhecidos']){const r=await run(input(q));assert.deepEqual(r.actions,[]);assert.match(r.message,/gramas/);}});
test('screenshot phrase in home chat finds TACO banana and asks only for edible weight',async()=>{
 const r=await run(input('Adicionar 2 bananas pratas média'));
 assert.deepEqual(r.actions,[]);assert.match(r.message,/Encontrei na TACO: Banana, prata, crua/);assert.match(r.message,/peso total em gramas/);assert.match(r.message,/não preciso que você informe calorias ou macros/);
});
test('home chat computes banana grams from table and returns only a proposal',async()=>{
 const r=await run(input('Adicionar 180 g de banana prata'));
 assert.equal(r.actions.length,1);assert.equal(r.actions[0].module,'nutrition');assert.deepEqual(r.actions[0].data,{n:'Banana, prata, crua',amount:180,unit:'g',k:176.4,p:2.34,c:46.8,f:0.18,fi:3.6});assert.match(r.message,/nada foi salvo/);
});
test('plural banana with grams is resolved without guessing weight',async()=>{const r=await run(input('Adicionar 180 g de bananas pratas'));assert.equal(r.actions[0].data.k,176.4);});
test('home chat rice still preserves variety and preparation',async()=>{const r=await run(input('Adicionar 250 g de arroz tipo 1 cozido'));assert.equal(r.actions[0].data.k,320);});
test('home chat does not grant missing write permissions or expand a finance-only scope',async()=>{
 for(const p of [['read:nutrition'],['read:gringotts','write:gringotts'],[]]) {const r=await run(input('Adicionar 180 g de banana prata',p));assert.deepEqual(r.actions,[]);}
});
test('food information question never proposes a write',async()=>{const r=await run(input('calorias em 180 g de banana prata?'));assert.deepEqual(r.actions,[]);assert.match(r.message,/176.4 kcal/);});
test('general chat does not divert water, finance, navigation, or greeting',()=>{
 for(const q of ['Registre 500 ml de água','Adicionar conta de luz 120 reais','abrir alimentação','Olá, bom dia'])assert.equal(localNutrition(input(q)),null,q);
});
test('negated and historical food requests do not create proposals',async()=>{for(const q of ['não registre 180 g de banana prata','registre 180 g de banana prata ontem'])assert.deepEqual((await run(input(q))).actions,[]);});
