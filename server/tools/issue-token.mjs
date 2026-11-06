#!/usr/bin/env node
/** Uso ADMIN LOCAL: JARVIS_TOKEN_SECRET='...' node tools/issue-token.mjs <device-id> [dias] */
import { createHmac } from 'node:crypto';
const [subject, daysArg = '30'] = process.argv.slice(2);
const secret = process.env.JARVIS_TOKEN_SECRET;
const days = Number(daysArg);
if (!secret || !subject || !/^[A-Za-z0-9._:-]{1,128}$/.test(subject) || !Number.isInteger(days) || days < 1 || days > 365) {
  console.error('Uso: JARVIS_TOKEN_SECRET=... node tools/issue-token.mjs <device-id seguro> [dias 1..365]');
  process.exit(2);
}
const payload = Buffer.from(JSON.stringify({ v: 1, sub: subject, scope: 'assistant', exp: Math.floor(Date.now() / 1000) + days * 86400 })).toString('base64url');
const sig = createHmac('sha256', secret).update(payload).digest('base64url');
// Token é exibido apenas ao administrador local. Não é gravado e não deve entrar em logs, Git ou APK.
process.stdout.write(`${payload}.${sig}\n`);
