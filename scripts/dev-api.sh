#!/usr/bin/env bash
# Levanta el backend AuraLib API en modo dev (tsx watch).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}/api"

if [ ! -d node_modules ]; then
  echo "[dev-api] Instalando dependencias por primera vez..."
  npm install
fi

if [ ! -f .env ]; then
  echo "[dev-api] No hay .env; copiando .env.example. Editalo antes de continuar."
  cp .env.example .env
  exit 1
fi

echo "[dev-api] Iniciando AuraLib API en http://localhost:3100"
npm run dev
