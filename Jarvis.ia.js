// Configuração do Assistente de Acompanhamento (Estilo F.R.I.D.A.Y. / Bora)
const API_KEY = "SUA_CHAVE_DE_API_AQUI"; // Chave da API do Google Gemini (ou do provedor escolhido)
const MODEL_NAME = "gemini-1.5-flash"; // Modelo veloz e otimizado

async function enviarMensagemParaIA(textoUsuario) {
  const mensagensContainer = document.getElementById('ai23Messages');
  if (!mensagensContainer) return;

  // 1. Exibe a mensagem do usuário na tela
  adicionarMensagemNaTela(textoUsuario, 'usuario');

  // Exibe indicador de "Digitando..." / Processando
  const idProcessando = adicionarMensagemNaTela("Processando...", 'ia', true);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    // Prompt de sistema para dar a personalidade e focar no acompanhamento diário
    const promptSistema = "Você é a assistente pessoal do Caio. Seja direta, acolhedora, inteligente e ajude-o a acompanhar o dia a dia, metas e rotina de forma veloz.";

    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptSistema + "\n\nUsuário: " + textoUsuario }
            ]
          }
        ]
      })
    });

    const dados = await resposta.json();
    
    // Remove o indicador de processamento
    removerMensagemDaTela(idProcessando);

    if (dados.candidates && dados.candidates[0].content.parts[0].text) {
      const respostaIA = dados.candidates[0].content.parts[0].text;
      adicionarMensagemNaTela(respostaIA, 'ia');
    } else {
      adicionarMensagemNaTela("Desculpe, chefe, tive um breve soluço na rede. Pode repetir?", 'ia');
    }

  } catch (erro) {
    removerMensagemDaTela(idProcessando);
    adicionarMensagemNaTela("Erro de conexão ao contatar o servidor de IA.", 'ia');
    console.error("Erro na API de IA:", erro);
  }
}

// Funções auxiliares para manipular o DOM sem mexer no layout existente
function adicionarMensagemNaTela(texto, remetente, temporario = false) {
  const mensagensContainer = document.getElementById('ai23Messages');
  const div = document.createElement('div');
  const idUnico = 'msg-' + Date.now();
  
  div.id = idUnico;
  div.className = remetente === 'usuario' ? 'ai23-user-msg' : 'ai23-ia-msg';
  div.innerText = texto;
  
  mensagensContainer.appendChild(div);
  mensagensContainer.scrollTop = mensagensContainer.scrollHeight;
  
  return idUnico;
}

function removerMensagemDaTela(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Vinculando ao seu botão e input existentes (#ai23Send e #ai23Input)
document.addEventListener('DOMContentLoaded', () => {
  const botaoEnviar = document.getElementById('ai23Send');
  const inputTexto = document.getElementById('ai23Input');

  if (botaoEnviar && inputTexto) {
    botaoEnviar.addEventListener('click', () => {
      const texto = inputTexto.value.trim();
      if (texto) {
        inputTexto.value = '';
        enviarMensagemParaIA(texto);
      }
    });

    inputTexto.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        botaoEnviar.click();
      }
    });
  }
});
