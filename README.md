# J.A.R.V.I.S — código-fonte preservado

Snapshot do aplicativo Android **2.3-rc16 / versionCode 30**, pacote `br.com.caio.jarvis`.

Este repositório foi preparado **somente para disponibilizar o código**. O aplicativo não foi editado, recompilado nem implantado durante a publicação. Nenhum workflow de compilação automática é incluído.

## O que está preservado

- HTML, JavaScript, CSS, tabelas e dados embarcados, imagens, fontes e PDF.js exatamente como no APK de referência.
- Código Java Android, manifesto, recursos e script original de compilação.
- Layouts e funções de alimentação, água, peso, finanças/Gringotts, estudos, biblioteca, backups, navegação e assistente IA.
- Código complementar do servidor de IA, sua configuração não secreta e testes, na pasta `server/`.

Os **23 arquivos de assets foram comparados byte a byte com o APK RC16** antes da publicação. A relação de arquivos e verificações está em [`docs/source-snapshot.json`](docs/source-snapshot.json). Os fontes Java e recursos foram copiados sem alterações. O DEX do APK também corresponde ao artefato da compilação original disponível no ambiente de origem.

**Dados do celular:** registros feitos após a instalação vivem no armazenamento local do aplicativo, e não no código-fonte. Eles não foram extraídos do aparelho nem enviados ao GitHub. Os dados já embarcados no APK foram preservados. Faça um backup pelo próprio app antes de qualquer manutenção futura.

## Estrutura

```text
output/
  jarvis.html                        # Interface e lógica principal
  jarvis-assets/                     # CSS, JS, Gringotts, imagens, fontes e PDF.js
  demo-integrado/alimentos-taco.json  # Base nutricional embarcada
  jarvis-android/
    AndroidManifest.xml
    src/br/com/caio/jarvis/           # MainActivity e ActivationDiagnostics
    res/                             # Tema e ícones Android
    tests/                           # Teste de diagnóstico nativo
    build-apk.sh                     # Script ORIGINAL, sem alterações
scripts/
  build-local.sh                     # Prepara caminhos locais e chama o original
  verify-source.py                   # Confere integridade sem compilar
  test-jarvis-rc16-visual.py           # Teste visual histórico, opcional
  test-jarvis-rc15.py                  # Regressão histórica, opcional
config/signing.example.env           # Somente nomes/caminhos de exemplo
server/                             # Backend complementar da IA
  src/                              # Worker e base TACO
  test/                             # Testes Node
  tools/                            # Utilitários de administração/base nutricional
  package.json
  wrangler.jsonc
  README.md
  .dev.vars.example
```

A estrutura original de `output/` foi mantida porque o script de compilação usa esses caminhos relativos. Não é um projeto Gradle: a compilação original usa diretamente as ferramentas oficiais do Android SDK, sem dependências Java externas ou AndroidX.

## Requisitos para reconstruir o APK futuramente

- Linux x86-64, Bash, `zip` e `unzip`.
- JDK 17, com `javac`, `java` e `keytool`.
- Android SDK: **Platform 35** e **Build Tools 35.0.0**.
- Um keystore de assinatura local com alias **`jarvisrelease`** e um arquivo privado contendo sua senha.
- Python 3 para a verificação de integridade, opcional para a compilação.

Instale as ferramentas oficiais do Android SDK e aceite as respectivas licenças. Exemplo, quando o `sdkmanager` já estiver no PATH:

```bash
sdkmanager --licenses
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
```

Não são necessários serviços de IA, tokens nem conexão com o servidor para compilar o APK. A execução das funções de IA exige configuração do backend e ativação do dispositivo.

## Assinatura e configurações seguras

**O keystore original e sua senha NÃO estão no GitHub.** Eles são necessários para assinar uma atualização instalável por cima da versão existente. Guarde o material original em local privado; não o envie a outra IA nem o adicione ao repositório.

Para um APK independente de testes, é possível gerar outro keystore local. A ferramenta solicitará a senha interativamente:

```bash
mkdir -p "$HOME/.config/jarvis"
keytool -genkeypair -keystore "$HOME/.config/jarvis/jarvis-release.jks" \
  -alias jarvisrelease -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Jarvis Local"
chmod 600 "$HOME/.config/jarvis/jarvis-release.jks"
```

Crie separadamente um arquivo privado contendo somente a senha do keystore, com permissão `600`. A senha da chave deve ser a mesma do keystore. Não use um segredo real em exemplos compartilhados, logs ou linha de comando versionada.

```bash
cp config/signing.example.env config/signing.local.env
# Edite apenas config/signing.local.env com os caminhos do seu ambiente.
chmod 600 config/signing.local.env
```

O arquivo local e todo o material de assinatura são ignorados pelo Git. O script lê quatro variáveis: `ANDROID_SDK_ROOT`, `JAVA_HOME`, `JARVIS_KEYSTORE` e `JARVIS_SIGNING_PASSWORD_FILE`. Aceita também essas variáveis diretamente no ambiente.

## Compilar futuramente

**Estes comandos são instruções para uso posterior; não foram executados durante a publicação.**

```bash
python3 scripts/verify-source.py
bash scripts/build-local.sh
```

O wrapper verifica os arquivos privados e prepara links locais nos caminhos esperados, depois executa o script original sem alterar Java, HTML ou recursos.

Saída esperada:

```text
output/jarvis-android/J.A.R.V.I.S-v2.3-rc16.apk
```

O pacote e a versão permanecem os do snapshot. A assinatura, timestamps de ZIP e ambiente podem produzir bytes diferentes dos do APK original. Não se promete identidade binária de uma nova compilação.

## Executar

### Android

Depois de uma compilação futura e com o dispositivo conectado/autorizado:

```bash
adb install -r output/jarvis-android/J.A.R.V.I.S-v2.3-rc16.apk
```

**Somente use `-r` sobre o app instalado se a chave de assinatura for a mesma.** Com outra chave, o Android recusará a atualização. Não desinstale o app atual para contornar isso sem antes exportar e conferir um backup, pois a desinstalação remove os dados locais.

### Prévia no navegador

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory output
```

Abra `http://127.0.0.1:8000/jarvis.html`. A prévia permite analisar a interface, mas não substitui o Android: exportação/importação nativa, seleção de arquivos, segurança/ativação da IA e demais recursos de `JarvisNative` exigem o app e sua WebView. O servidor local serve também os arquivos auxiliares usados pela interface.

## IA e backend

Leia [`server/README.md`](server/README.md). O APK mantém o endereço do servidor já existente porque modificar esse valor alteraria o aplicativo. Esse endereço é público e **não é uma credencial**. O código de ativação e transporte permanece intacto. Tokens de dispositivo são obtidos/configurados em execução e protegidos pelo Android Keystore; a chave do provedor permanece no backend.

O diretório `server/` contém o código complementar atual encontrado no ambiente de origem, não um dump de produção. Não contém os segredos nem o estado dos Durable Objects. Testes e utilitários do backend não são necessários para reconstruir o APK.

## Validação feita nesta publicação

- Conferência dos 23 assets com o APK RC16, sem diferenças.
- Preservação por hash dos fontes Java e dos recursos originais.
- Verificação estática dos caminhos, dependências e sintaxe dos scripts de preparação.
- Triagem de segredos antes do envio; exclusão de keystores, senhas, tokens, arquivos locais e logs de implantação.
- **Nenhuma compilação nova nem teste físico foi executado**, conforme solicitado.

O projeto contém os insumos de código necessários para recompilar com o SDK/JDK e uma assinatura local. Essa conclusão é de completude estática, não uma alegação de build executado nesta etapa.

## Para a próxima IA

Leia [`docs/HANDOFF.md`](docs/HANDOFF.md) antes de editar qualquer arquivo. Não substitua o projeto por uma estrutura nova, não limpe os dados existentes e não execute builds/deploys sem autorização. Dependências incorporadas preservam seus avisos de licença (Poppins e PDF.js). Este snapshot não concede nova licença geral sobre o código próprio.
