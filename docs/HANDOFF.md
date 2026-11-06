# Orientação para a próxima IA

## Objetivo desta entrega

Disponibilizar o código-fonte completo do J.A.R.V.I.S Android 2.3-rc16 / código 30 para análise futura. Não houve modificação do aplicativo, nova compilação, atualização de dependência, migração de dados ou deploy nesta etapa.

## Regras antes de alterar

1. Preserve funcionalidades, tabelas, dados embarcados, layout, configurações e chaves de armazenamento.
2. Não substitua `jarvis.html` por uma demonstração simplificada. Há múltiplas camadas históricas de CSS/JS incorporadas e arquivos auxiliares ativos.
3. Preserve o pacote `br.com.caio.jarvis`, o domínio de assets da WebView e o contrato da ponte `JarvisNative`.
4. Não mexa na assinatura nem sugira desinstalar o app instalado: uma troca de chave impede atualização sobre ele; a desinstalação apaga dados locais.
5. O keystore original, a senha, tokens, backups do celular e segredos do servidor não estão no GitHub.
6. A IA nativa usa um proxy HTTPS. A chave Gemini não deve ir para HTML, Java ou APK. Mantenha autenticação, origem confiável da WebView e os limites/validações.
7. `docs/source-snapshot.json` registra a referência de integridade; uma edição futura fará a verificação de preservação apontar diferenças, o que é esperado. Não atualize esse registro silenciosamente para esconder alterações.
8. Não execute builds, testes que alterem dados, publicação ou deploy sem autorização do proprietário.

## Referência e validação

- APK de referência: `J.A.R.V.I.S-v2.3-rc16.apk`.
- Assets: 23/23 comparados byte a byte antes da publicação.
- Java, manifesto, recursos e script de compilação original: copiados sem alterações.
- A ferramenta original usa JDK 17 e Android SDK Platform 35 / Build Tools 35.0.0, sem Gradle.
- O código do servidor é um complemento separado; o estado/segredos de produção precisam permanecer fora do Git.
- Validação desta entrega é estática, não um novo build nem teste físico.

Os testes visuais históricos usam Playwright e Chromium e podem depender de preparação específica do ambiente original. Consulte-os como evidência/guia e use um perfil isolado, nunca os dados reais do usuário. Eles não fazem parte da compilação do APK.
