#!/usr/bin/env bash
# Genera el APK release. Requiere keystore configurado en android/key.properties.
#
# Uso:
#   scripts/build-apk.sh                              # release apuntando a backend default
#   scripts/build-apk.sh https://api.tu-dominio.com   # release apuntando a backend de prod
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}/app"

if ! command -v flutter >/dev/null 2>&1; then
  echo "[build-apk] Flutter no está instalado."
  exit 1
fi

API_BASE_URL="${1:-https://api.example.com}"

echo "[build-apk] Construyendo APK release contra ${API_BASE_URL}"
flutter clean
flutter pub get
flutter build apk --release --dart-define=API_BASE_URL="${API_BASE_URL}"

echo "[build-apk] APK generado en:"
echo "            $(pwd)/build/app/outputs/flutter-apk/app-release.apk"
