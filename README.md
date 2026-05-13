# AuraLib

> Tu biblioteca musical, sonando donde quieras.

Aplicación móvil **Android** que unifica tu biblioteca de Qobuz y te permite
reproducirla en el destino que elijas: el dispositivo (jack, Bluetooth, USB DAC)
o un **DAC en red DLNA/UPnP** (HiBy R4, etc.).

> **Estado actual:** v0.1 en desarrollo (mayo 2026). Reemplaza a los proyectos
> anteriores `DacToDock` (Android nativo) y `DacToDockWeb` (Angular), que
> quedan archivados como referencia.

## Estructura del monorepo

```
Auralib/
├── app/                  # Cliente Flutter (Android v1)
├── api/                  # Backend NestJS (cuentas, Qobuz, Last.fm, MusicBrainz)
├── docs/                 # Documentación de producto y técnica
│   ├── PRODUCT_GUIDE.md  # Visión, alcance v1, funcionalidades
│   ├── ARCHITECTURE.md   # Arquitectura técnica + decisiones
│   ├── BACKEND_API.md    # Contrato REST que consume el cliente
│   └── QA_TESTING.md     # Distribución a testers (Firebase App Distribution)
├── scripts/              # Scripts de desarrollo y build
└── .github/workflows/    # CI (lint + test) - pendiente
```

## Quick start

Guía detallada (pruebas, emulador vs físico, hosting del API): **[`docs/RUN_TEST_DEPLOY.md`](docs/RUN_TEST_DEPLOY.md)**.

### Backend (api/)

```bash
cd api
cp .env.example .env       # editar valores
npm install
npm run dev                # http://localhost:3100
```

### Cliente Flutter (app/)

```bash
# Una vez (instalar Flutter): https://docs.flutter.dev/get-started/install/macos
# Opción A — Homebrew:
brew install --cask flutter
# Opción B — ZIP oficial en una carpeta fija (ej. ~/Alvarodev/flutter):
#   export PATH="$HOME/Alvarodev/flutter/bin:$PATH"
#   (añádelo a ~/.zshrc para que persista). El repo incluye .vscode/settings.json
#   con dart.flutterSdkPath para Cursor/VS Code apuntando a ese SDK.
flutter doctor

cd app
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run                # con un emulador o dispositivo conectado
```

> En el emulador, el cliente apunta a `http://10.0.2.2:3100`. En dispositivo
> físico se necesita la IP LAN del Mac.

## Documentación

- **[Ejecución, pruebas y despliegue (`docs/RUN_TEST_DEPLOY.md`)](docs/RUN_TEST_DEPLOY.md)** — orden para levantar API + app, `API_BASE_URL`, smoke tests y **dónde alojar el API** en producción.
- [Guía de producto v1 (`docs/PRODUCT_GUIDE.md`)](docs/PRODUCT_GUIDE.md)
- [Arquitectura técnica (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- [Contrato del backend (`docs/BACKEND_API.md`)](docs/BACKEND_API.md)
- [Distribución a QA (`docs/QA_TESTING.md`)](docs/QA_TESTING.md)

## Stack

- **Cliente:** Flutter 3.x (Dart 3+) · Riverpod · go_router · dio · Firebase Auth · just_audio · Material 3
- **Backend:** NestJS 10 + Fastify · TypeScript · Firebase Admin · puppeteer-core (extractor Qobuz)
- **Auth:** Firebase Authentication (email/contraseña en v1)
- **Distribución v1:** Firebase App Distribution (gratis, sin Play Console)

## Roadmap inmediato

1. ✅ Bootstrap del monorepo + backend depurado.
2. ⏳ Login Firebase + listar biblioteca Qobuz.
3. ⏳ Reproductor local con `just_audio` + MediaSession.
4. ⏳ Cliente UPnP/DLNA con descubrimiento SSDP nativo.
5. ⏳ Discografía enriquecida (Last.fm + MusicBrainz).
6. ⏳ Pulido UI/UX, ícono, splash, build de release.
7. ⏳ Distribución vía Firebase App Distribution a QA.

## Licencia

Propietaria. Ver [`LICENSE`](LICENSE).
