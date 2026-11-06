package br.com.caio.jarvis;

/** Safe diagnostics: never returns exception messages, credentials or identifiers. */
final class ActivationDiagnostics {
    static String code(String stage, Throwable error) {
        String prefix = stage != null && stage.matches("[A-Z_]{1,24}") ? stage : "UNKNOWN";
        Throwable e = error;
        for (int i=0; e != null && i<8; i++, e=e.getCause()) {
            if (e instanceof java.net.UnknownHostException) return prefix+"/DNS";
            if (e instanceof javax.net.ssl.SSLException) return prefix+"/TLS";
            if (e instanceof java.net.SocketTimeoutException) return prefix+"/TIMEOUT";
            if (e instanceof java.net.ConnectException) return prefix+"/CONNECTION";
            if (e instanceof java.security.GeneralSecurityException) return prefix+"/KEYSTORE";
        }
        String m=error == null ? "" : error.getMessage();
        if(m != null && m.matches("Ativação indisponível \\(HTTP [1-5][0-9]{2}\\)\\.")) {
            int p=m.indexOf("HTTP ")+5;
            return prefix+"/HTTP_"+m.substring(p,p+3);
        }
        if ("A solicitação ainda aguarda aprovação.".equals(m)) return prefix+"/PENDING";
        if(error instanceof java.io.IOException) return prefix+"/IO";
        return prefix+"/INTERNAL";
    }
    static String advice(String code) {
        if(code.endsWith("/DNS") || code.endsWith("/CONNECTION")) return "Não foi possível conectar ao servidor. Confira a internet; um teste em outra rede pode ajudar a identificar o bloqueio.";
        if(code.endsWith("/TLS")) return "A conexão segura não foi estabelecida. Confira data e hora automáticas do Android. Não desative a segurança da conexão.";
        if(code.endsWith("/TIMEOUT")) return "O servidor não respondeu dentro do prazo. Você pode tentar novamente.";
        if(code.endsWith("/KEYSTORE")) return "O Android não conseguiu usar a chave segura deste aplicativo. Não apague dados nem desinstale.";
        if(code.endsWith("/PENDING")) return "A solicitação ainda aguarda aprovação. Use Verificar liberação após a aprovação.";
        if(code.endsWith("/HTTP_429")) return "O servidor limitou temporariamente novas solicitações. Aguarde alguns minutos antes de tentar novamente.";
        if(code.startsWith("VALIDATE/")) return "A resposta de ativação não passou na validação. Confira data e hora automáticas do Android e envie este código para Hermione.";
        return "A ativação não foi concluída. Envie este código para Hermione. Seus registros foram mantidos.";
    }
}
