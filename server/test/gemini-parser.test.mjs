import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/worker.js';
function token(){const p=Buffer.from(JSON.stringify({v:1,sub:'parser-test',scope:'assistant',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${p}.${createHmac('sha256','test-secret').update(p).digest('base64url')}`;}
const env={GEMINI_API_KEY:'test-key',JARVIS_TOKEN_SECRET:'test-secret',ALLOW_IN_MEMORY_RATE_LIMITER:'true',RATE_LIMIT_PER_MINUTE:'100',ALLOW_INSECURE_LOCAL:'true'};
function input(){return {domain:'app',query:'registre água',context:{module:'hydration',date:'2026-11-04',records:[],permissions:['write:hydration']}};}
function request(){return new Request('http://localhost/v1/assistant',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token()}`},body:JSON.stringify(input())});}
function response(parts,finishReason='STOP'){return new Response(JSON.stringify({candidates:[{content:{parts},finishReason}]}),{status:200});}
const valid=JSON.stringify({message:'Registrado.',actions:[{op:'add',module:'hydration',data:{ml:500}}]});
const originalFetch=globalThis.fetch;test.after(()=>globalThis.fetch=originalFetch);
test('joins only non-thought text parts before parsing Gemini JSON',async()=>{globalThis.fetch=async()=>response([{thought:true,text:'interno'},{text:valid.slice(0,20)},{text:valid.slice(20)}]);const r=await worker.fetch(request(),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),JSON.parse(valid));});
test('rejects Gemini candidates stopped by truncation or safety block',async()=>{for(const finishReason of ['MAX_TOKENS','SAFETY']){globalThis.fetch=async()=>response([{text:valid}],finishReason);const r=await worker.fetch(request(),env);assert.equal(r.status,502);}});
test('accepts only a whole Markdown JSON fence for app',async()=>{globalThis.fetch=async()=>response([{text:`\n\`\`\`json\n${valid}\n\`\`\`\n`}]);let r=await worker.fetch(request(),env);assert.equal(r.status,200);globalThis.fetch=async()=>response([{text:`Resposta:\n\`\`\`json\n${valid}\n\`\`\``}]);r=await worker.fetch(request(),env);assert.equal(r.status,502);});
