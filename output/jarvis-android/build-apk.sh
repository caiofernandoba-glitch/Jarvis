#!/usr/bin/env bash
# Rebuilds the signed installable APK from the current final Bible HTML.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/output/jarvis-android"
SDK="$ROOT/tools/android-sdk"
JDK="$ROOT/tools/jdk17"
BT="$SDK/build-tools/35.0.0"
PLATFORM="$SDK/platforms/android-35/android.jar"
SOURCE="$ROOT/output/jarvis.html"
BUILD="$APP/build"
OUT="$APP/J.A.R.V.I.S-v2.3-rc16.apk"
export JAVA_HOME="$JDK" PATH="$JDK/bin:$PATH"
[ -f "$SOURCE" ] || { echo "Fonte não encontrada: $SOURCE" >&2; exit 1; }
rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/dex" "$BUILD/res" "$BUILD/unsigned/assets"
# Always copy the final HTML only at build time; parent UI work is never altered.
cp "$SOURCE" "$BUILD/unsigned/assets/jarvis.html"
cp -R "$ROOT/output/jarvis-assets" "$BUILD/unsigned/assets/"
mkdir -p "$BUILD/unsigned/assets/demo-integrado"
[ ! -f "$ROOT/output/demo-integrado/alimentos-taco.json" ] || cp "$ROOT/output/demo-integrado/alimentos-taco.json" "$BUILD/unsigned/assets/demo-integrado/"
"$BT/aapt2" compile --dir "$APP/res" -o "$BUILD/res.zip"
"$BT/aapt2" link -o "$BUILD/unsigned/resources.apk" -I "$PLATFORM" --manifest "$APP/AndroidManifest.xml" --java "$BUILD/rjava" "$BUILD/res.zip"
find "$APP/src" -name '*.java' -print0 | xargs -0 "$JDK/bin/javac" -encoding UTF-8 -source 8 -target 8 -classpath "$PLATFORM" -d "$BUILD/classes"
find "$BUILD/classes" -name '*.class' -print0 | xargs -0 "$BT/d8" --lib "$PLATFORM" --min-api 23 --output "$BUILD/dex"
cp "$BUILD/unsigned/resources.apk" "$BUILD/unsigned.apk"
(cd "$BUILD/unsigned" && zip -q -r "$BUILD/unsigned.apk" assets)
(cd "$BUILD/dex" && zip -q -j "$BUILD/unsigned.apk" classes.dex)
KEY="$APP/keystore/jarvis-release.jks"
mkdir -p "$(dirname "$KEY")"
if [ ! -f "$KEY" ]; then
  # Persistent local signing key; deliberately kept outside the distributable APK.
  "$JDK/bin/keytool" -genkeypair -keystore "$KEY" -storepass:file "$APP/keystore/.signing-password" -keypass:file "$APP/keystore/.signing-password" -alias jarvisrelease -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=Caio JARVIS, OU=Android, O=Caio, L=Taboao da Serra, ST=SP, C=BR' >/dev/null
fi
"$BT/zipalign" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
"$BT/apksigner" sign --ks "$KEY" --ks-pass "file:$APP/keystore/.signing-password" --ks-key-alias jarvisrelease --out "$OUT" "$BUILD/aligned.apk"
"$BT/apksigner" verify --verbose --print-certs "$OUT"
"$BT/aapt" dump badging "$OUT"
echo "APK pronto: $OUT"
