package br.com.caio.jarvis;
public final class ActivationDiagnosticsTest {
    private static int count;
    private static void test(String stage, Throwable e, String expected) {
        String actual=ActivationDiagnostics.code(stage,e);
        if(!expected.equals(actual))throw new AssertionError(expected+" != "+actual);
        String advice=ActivationDiagnostics.advice(actual);
        if(advice==null || advice.isEmpty() || advice.contains("SECRET"))throw new AssertionError("unsafe/empty advice");
        count++;
    }
    public static void main(String[] args) {
        test("ENROLL",new java.net.UnknownHostException("SECRET"),"ENROLL/DNS");
        test("ENROLL",new javax.net.ssl.SSLHandshakeException("SECRET"),"ENROLL/TLS");
        test("ENROLL",new java.net.SocketTimeoutException("SECRET"),"ENROLL/TIMEOUT");
        test("ENROLL",new java.net.ConnectException("SECRET"),"ENROLL/CONNECTION");
        test("SIGN",new java.security.InvalidKeyException("SECRET"),"SIGN/KEYSTORE");
        test("KEY",new java.security.KeyStoreException("SECRET"),"KEY/KEYSTORE");
        test("ENROLL",new java.io.IOException("Ativação indisponível (HTTP 429)."),"ENROLL/HTTP_429");
        test("ENROLL",new java.io.IOException("Ativação indisponível (HTTP 503)."),"ENROLL/HTTP_503");
        test("ENROLL",new java.io.IOException("SECRET HTTP 401"),"ENROLL/IO");
        test("VALIDATE",new java.io.IOException("SECRET"),"VALIDATE/IO");
        test("SAVE",new java.io.IOException("SECRET"),"SAVE/IO");
        test("KEY",new IllegalStateException("SECRET"),"KEY/INTERNAL");
        test("CLAIM",new java.io.IOException("A solicitação ainda aguarda aprovação."),"CLAIM/PENDING");
        test("ENROLL",new RuntimeException("SECRET",new java.net.UnknownHostException()),"ENROLL/DNS");
        test("SECRET stage",new Exception("SECRET"),"UNKNOWN/INTERNAL");
        System.out.println("PASS "+count+" activation diagnostic cases; exception text not displayed.");
    }
}
