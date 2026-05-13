#!/usr/bin/env bash
# Genera lib/firebase_options.dart desde android/app/google-services.json (Mac/Linux).
# Uso: desde esta carpeta (`app/`):  ./setup_local.sh

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f android/app/google-services.json ]]; then
  echo "❌ Falta android/app/google-services.json"
  echo "   Descárgalo en Firebase Console → Project settings → tu app Android com.auralib.auralib"
  exit 1
fi

echo "→ Generando lib/firebase_options.dart …"
dart run tool/sync_firebase_options.dart

echo ""
echo "✅ Listo. Siguiente: flutter pub get && flutter run"
echo "   (Si ves pantalla de ayuda CONFIGURE_ME, este script ya debería haberla quitado.)"
