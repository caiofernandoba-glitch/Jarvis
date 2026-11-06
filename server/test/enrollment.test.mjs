import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;
import worker, { RateLimiter } from '../src/worker.js';

class Storage {
  constructor() { this.data = new Map(); }
  async get(key) { return this.data.get(key); }
  async put(key, value) { if (typeof key === 'object') for (const [k, v] of Object.entries(key)) this.data.set(k, v); else this.data.set(key, value); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
  async list({ prefix = '' } = {}) { return new Map([...this.data].filter(([key]) => key.startsWith(prefix))); }
  async transaction(fn) { return fn(this); }
}
function environment(extra = {}) {
  const state = { storage:new Storage() }; const limiter = new RateLimiter(state);
  return { JARVIS_TOKEN_SECRET:'test-enrollment-secret', ALLOW_INSECURE_LOCAL:'true', RATE_LIMITER:{ idFromName:n => n, get:() => ({ fetch:(r, init) => limiter.fetch(typeof r === 'string' ? new Request(r, init) : r) }) }, ...extra, _state:state };
}
const enc = new TextEncoder();
const b64url = bytes => Buffer.from(bytes).toString('base64url');
async function identity() { const pair = await crypto.subtle.generateKey({ name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' }, true, ['sign','verify']); return { pair, publicKey:Buffer.from(await crypto.subtle.exportKey('spki', pair.publicKey)).toString('base64') }; }
async function signed(pair, text) { return b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(text)))); }
async function enrollment(identity, nonce = b64url(crypto.getRandomValues(new Uint8Array(32)))) { return { publicKey:identity.publicKey, nonce, signature:await signed(identity.pair, `jarvis-device-enrollment-v1\n${identity.publicKey}\n${nonce}`) }; }
async function call(env, path, method = 'POST', body, ip = '198.51.100.7') { return worker.fetch(new Request(`http://localhost${path}`, { method, headers:{ ...(body ? {'content-type':'application/json'} : {}), 'cf-connecting-ip':ip }, body:body ? JSON.stringify(body) : undefined }), env); }
async function claim(identity, requestId, nonce = b64url(crypto.getRandomValues(new Uint8Array(32)))) { return { requestId, nonce, signature:await signed(identity.pair, `jarvis-device-claim-v1\n${requestId}\n${nonce}`) }; }

let device;
test.before(async () => { device = await identity(); });
test('enrollment pending, public status, and malformed input are constrained', async () => {
  const env = environment(); const r = await call(env, '/v1/device/enroll', 'POST', await enrollment(device)); assert.equal(r.status, 201); const out = await r.json(); assert.equal(out.status, 'pending'); assert.match(out.requestId, /^[a-f0-9]{32}$/); assert.match(out.fingerprint, /^[a-f0-9]{64}$/); assert.deepEqual(Object.keys(out).sort(), ['expiresAt','fingerprint','requestId','status']);
  const status = await call(env, `/v1/device/request/${out.requestId}`, 'GET'); assert.equal(status.status, 200); assert.deepEqual(await status.json(), out);
  const bad = await call(env, '/v1/device/enroll', 'POST', { publicKey:'x', nonce:'x', signature:'x', extra:true }); assert.equal(bad.status, 400);
});
test('wrong proof cannot claim and unapproved proof remains pending', async () => {
  const env = environment(); const e = await enrollment(device); const created = await (await call(env, '/v1/device/enroll', 'POST', e)).json(); const bad = await call(env, '/v1/device/claim', 'POST', { ...(await claim(device, created.requestId)), signature:b64url(new Uint8Array(256)) }); assert.equal(bad.status, 400);
  const pending = await call(env, '/v1/device/claim', 'POST', await claim(device, created.requestId)); assert.equal(pending.status, 202); assert.equal((await pending.json()).status, 'pending');
});
test('approved claim mints usable device token, revokes on approval removal, and consumes request', async () => {
  const env = environment(); const created = await (await call(env, '/v1/device/enroll', 'POST', await enrollment(device))).json(); env.JARVIS_APPROVED_DEVICE = created.fingerprint;
  const approved = await call(env, '/v1/device/claim', 'POST', await claim(device, created.requestId)); assert.equal(approved.status, 200); const result = await approved.json(); assert.equal(result.status, 'approved'); assert.equal(typeof result.token, 'string');
  const assistant = await worker.fetch(new Request('http://localhost/v1/assistant', { method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${result.token}`}, body:JSON.stringify({domain:'food_research',query:'x',context:{}}) }), { ...env, GEMINI_API_KEY:'x', ALLOW_IN_MEMORY_RATE_LIMITER:'true' }); assert.notEqual(assistant.status, 401);
  const replay = await call(env, '/v1/device/claim', 'POST', await claim(device, created.requestId)); assert.equal(replay.status, 409);
  delete env.JARVIS_APPROVED_DEVICE;
  const revoked = await worker.fetch(new Request('http://localhost/v1/assistant', { method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${result.token}`}, body:'{}' }), { ...env, GEMINI_API_KEY:'x' }); assert.equal(revoked.status, 401);
});
test('replay, expiration and enrollment limits are enforced', async () => {
  const env = environment(); const first = await enrollment(device); const created = await (await call(env, '/v1/device/enroll', 'POST', first)).json(); const replay = await call(env, '/v1/device/enroll', 'POST', first); assert.equal(replay.status, 409);
  const record = env._state.storage.data.get(`req:${created.requestId}`); record.expiresAtMs = Date.now() - 1; env._state.storage.data.set(`req:${created.requestId}`, record);
  const expired = await call(env, `/v1/device/request/${created.requestId}`, 'GET'); assert.equal(expired.status, 404);
  const limitEnv = environment(); const other = await identity(); for (let i=0; i<3; i++) assert.equal((await call(limitEnv, '/v1/device/enroll', 'POST', await enrollment(other))).status, 201); const limited = await call(limitEnv, '/v1/device/enroll', 'POST', await enrollment(other)); assert.equal(limited.status, 429);
});
test('five kilobyte and HTTP method limits apply before enrollment processing', async () => {
  const env = environment(); const wrongMethod = await call(env, '/v1/device/enroll', 'GET'); assert.equal(wrongMethod.status, 405); const large = await worker.fetch(new Request('http://localhost/v1/device/enroll', { method:'POST', headers:{'content-type':'application/json'}, body:'x'.repeat(6*1024) }), env); assert.equal(large.status, 413);
});
