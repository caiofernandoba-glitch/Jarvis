// Opt-in smoke test: never runs in npm test; requires real credentials supplied by operator.
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import worker from '../src/worker.js';
const required = ['GEMINI_API_KEY','JARVIS_TOKEN_SECRET'];
if (!required.every(k => process.env[k])) { console.log('SKIP: defina GEMINI_API_KEY e JARVIS_TOKEN_SECRET para o smoke test real.'); process.exit(0); }
const p = Buffer.from(JSON.stringify({v:1,sub:'real-test-device',scope:'assistant',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
const token = `${p}.${createHmac('sha256',process.env.JARVIS_TOKEN_SECRET).update(p).digest('base64url')}`;
const env = { GEMINI_API_KEY:process.env.GEMINI_API_KEY, JARVIS_TOKEN_SECRET:process.env.JARVIS_TOKEN_SECRET, GEMINI_MODEL:process.env.GEMINI_MODEL || 'gemini-2.5-flash', ALLOW_IN_MEMORY_RATE_LIMITER:'true', RATE_LIMIT_PER_MINUTE:'5', ALLOW_INSECURE_LOCAL:'true' };
const r = await worker.fetch(new Request('http://localhost/v1/assistant',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({domain:'reading_summary',query:'Resuma em uma frase: disciplina é fazer o necessário.',context:{module:'library',date:'2026-11-04',records:[{excerpt:'disciplina é fazer o necessário.'}],history:[],permissions:[]}})}),env);
const body = await r.json().catch(()=>({}));
const report = { at:new Date().toISOString(), status:r.status, ok:r.ok, responseKeys:Object.keys(body), errorCode:body?.error?.code || null }; // no token/key/text persisted
await mkdir('reports',{recursive:true}); await writeFile('reports/real-gemini-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
process.exit(r.ok ? 0 : 1);
