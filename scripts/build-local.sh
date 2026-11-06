#!/usr/bin/env bash
# Preparation wrapper only. Original app sources and build script are untouched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f config/signing.local.env ]]; then
  set -a
  source config/signing.local.env
  set +a
fi
: "${ANDROID_SDK_ROOT:?Configure ANDROID_SDK_ROOT}"
: "${JAVA_HOME:?Configure JAVA_HOME for JDK 17}"
: "${JARVIS_KEYSTORE:?Provide a private signing keystore}"
: "${JARVIS_SIGNING_PASSWORD_FILE:?Provide a private password file}"
SDK="$(realpath "$ANDROID_SDK_ROOT")"
JDK="$(realpath "$JAVA_HOME")"
KEY="$(realpath "$JARVIS_KEYSTORE")"
PASSFILE="$(realpath "$JARVIS_SIGNING_PASSWORD_FILE")"
[[ -f "$SDK/platforms/android-35/android.jar" ]] || { echo 'Missing SDK platform 35' >&2; exit 1; }
for tool in aapt aapt2 d8 zipalign apksigner; do
  [[ -x "$SDK/build-tools/35.0.0/$tool" ]] || { echo "Missing Android build tool: $tool" >&2; exit 1; }
done
[[ -x "$JDK/bin/javac" && -x "$JDK/bin/java" ]] || { echo 'Missing JDK executables' >&2; exit 1; }
[[ -f "$KEY" && -s "$PASSFILE" ]] || { echo 'Missing private signing files' >&2; exit 1; }
# The ORIGINAL script uses alias jarvisrelease and an external password file.
# Never write/copy the private key or password into versioned files.
link_once() {
  local target="$1" destination="$2"
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ "$(realpath "$destination")" == "$target" ]] || { echo "Existing path differs: $destination" >&2; exit 1; }
  else
    ln -s "$target" "$destination"
  fi
}
mkdir -p tools output/jarvis-android/keystore
link_once "$SDK" tools/android-sdk
link_once "$JDK" tools/jdk17
link_once "$KEY" output/jarvis-android/keystore/jarvis-release.jks
link_once "$PASSFILE" output/jarvis-android/keystore/.signing-password
exec bash output/jarvis-android/build-apk.sh
