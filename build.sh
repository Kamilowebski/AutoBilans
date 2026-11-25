#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_JAR:?Set ANDROID_JAR to the Android 35 platform jar}"
: "${BUILD_TOOLS:?Set BUILD_TOOLS to the Android SDK build-tools directory}"
: "${ZXING_JAR:?Set ZXING_JAR to ZXing core 3.5.3}"
: "${SIGNING_KEYSTORE:?Set SIGNING_KEYSTORE to the app signing keystore}"
java_bin="${JAVA_HOME:+$JAVA_HOME/bin/}"
export JAVA_HOME
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT
mkdir -p "$build/classes" "$build/dex" "$build/generated"
"$BUILD_TOOLS/aapt2" compile --dir res -o "$build/resources.zip"
"$BUILD_TOOLS/aapt2" link -I "$ANDROID_JAR" --manifest AndroidManifest.xml --java "$build/generated" -A assets -o "$build/base.apk" "$build/resources.zip"
"${java_bin}javac" --release 8 -encoding UTF-8 -cp "$ANDROID_JAR:$ZXING_JAR" -d "$build/classes" java/pl/autobilans/app/*.java "$build/generated/pl/autobilans/app/R.java"
"${java_bin}jar" cf "$build/classes.jar" -C "$build/classes" .
if [[ -n "${R8_JAR:-}" ]]; then
    d8=("${java_bin}java" -cp "$R8_JAR" com.android.tools.r8.D8)
else
    d8=("$BUILD_TOOLS/d8")
fi
"${d8[@]}" --min-api 26 --lib "$ANDROID_JAR" --output "$build/dex" "$build/classes.jar" "$ZXING_JAR"
(cd "$build/dex" && zip -q -0 "$build/base.apk" classes.dex)
"$BUILD_TOOLS/zipalign" -f 4 "$build/base.apk" "$build/aligned.apk"
password_args=()
if [[ -n "${AUTOBILANS_KEYSTORE_PASSWORD:-}" ]]; then
    password_args=(--ks-pass env:AUTOBILANS_KEYSTORE_PASSWORD)
fi
"$BUILD_TOOLS/apksigner" sign --v4-signing-enabled false --ks "$SIGNING_KEYSTORE" "${password_args[@]}" --out "${1:-AutoBilans.apk}" "$build/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose "${1:-AutoBilans.apk}"
