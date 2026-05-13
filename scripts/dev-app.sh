#!/usr/bin/env bash
# Levanta el cliente Flutter (dispositivo o emulador conectado).
#
# Uso:
#   scripts/dev-app.sh                          # apunta al backend en 10.0.2.2:3100 (emulador)
#   scripts/dev-app.sh http://192.168.1.20:3100 # apunta a una IP LAN (dispositivo físico)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}/app"

if ! command -v flutter >/dev/null 2>&1; then
  echo "[dev-app] Flutter no está instalado. Instalalo con:"
  echo "          brew install --cask flutter && flutter doctor"
  exit 1
fi

API_BASE_URL="${1:-http://10.0.2.2:3100}"

if [ ! -d .dart_tool ]; then
  echo "[dev-app] Instalando dependencias..."
  flutter pub get
fi

echo "[dev-app] Levantando Flutter contra ${API_BASE_URL}"
flutter run --dart-define=API_BASE_URL="${API_BASE_URL}"
