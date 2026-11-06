# Servidor complementar da IA do Jarvis

Código atual do Cloudflare Worker encontrado junto ao aplicativo. Não é necessário para compilar o APK, mas faz parte da arquitetura do assistente.

## Arquivos

- `src/worker.js`: autenticação, matrícula/aprovação de dispositivos, limites, contratos e chamadas ao Gemini.
- `src/taco.js`, `src/taco-data.js` e `src/taco-data.json`: dados e interpretação nutricional.
- `test/`: testes locais; `test/real-gemini.mjs` é separado e faz chamadas externas quando configurado.
- `tools/`: geração/auditoria de dados e emissão local de token.
- `wrangler.jsonc`: configuração não secreta, binding Durable Object `RATE_LIMITER`, migrations e modelo original.

Os fontes foram copiados sem alterações. Arquivos temporários, logs, resultados de deploy, credenciais e estado do serviço não foram incluídos.

## Configuração segura

Use Node.js 20 ou superior e uma instalação compatível do Wrangler oficial da Cloudflare. Para desenvolvimento, copie `.dev.vars.example` para `.dev.vars` e preencha somente no computador local. O modelo mantém o valor existente em `wrangler.jsonc`; sua disponibilidade depende da conta do provedor.

Segredos suportados pelo código:

- `GEMINI_API_KEY`: chave do provedor, somente no backend.
- `JARVIS_TOKEN_SECRET`: segredo de assinatura HMAC dos tokens de dispositivo.
- `JARVIS_DEVICE_TOKEN`: alternativa de token piloto para um único dispositivo.
- `JARVIS_APPROVED_DEVICE`: configuração privada de aprovação, quando utilizada.

Para produção, configure com `wrangler secret put NOME_DO_SEGREDO`. Nunca coloque valores em `wrangler.jsonc`, código, README, issues ou commits. As flags `ALLOW_INSECURE_LOCAL` e `ALLOW_IN_MEMORY_RATE_LIMITER` são de testes locais e não devem ser ativadas em produção.

## Testes e execução futura

```bash
cd server
npm test
# Opcional, somente após configurar credenciais e autorizar chamadas externas:
# npm run test:real
```

Um Wrangler instalado separadamente permite `wrangler dev` e, mediante autorização, `wrangler deploy`. Essas etapas exigem conta Cloudflare, autenticação local e os segredos do operador. Nada foi executado nem implantado na publicação deste repositório.

O APK preservado usa o endereço do serviço original. Mudar o host, desativar a proteção HTTPS ou alterar a ativação exigiria uma edição posterior explicitamente autorizada. Dados de produção e tokens reais de dispositivos não estão neste repositório.

Os utilitários de auditoria histórica podem citar arquivos de referência externos e relatórios não necessários para compilar o aplicativo. As bases nutricionais já utilizadas pelo código estão incluídas.
