# AuraLib API

Backend NestJS para AuraLib. Provee:

- Autenticación de usuarios (verificación de Firebase ID Tokens).
- Conexión y gestión de cuentas Qobuz (incluye extractor del secret vía Puppeteer).
- Biblioteca unificada y por fuente.
- Discografía enriquecida con Last.fm + MusicBrainz.
- Resolución de URLs streameables firmadas (`POST /api/v1/qobuz/track-url`).
- Settings: API key personal de Last.fm.

## Requisitos

- Node.js 20+
- Una instalación local de Chrome/Chromium (para `puppeteer-core`).
- Proyecto Firebase con cuenta de servicio.

## Setup

```bash
cp .env.example .env
# Editar .env con tus valores
npm install
npm run dev
```

El API queda en `http://localhost:3100`. El cliente Flutter en emulador
debe llamarlo con `http://10.0.2.2:3100`; en dispositivo físico, con la
IP LAN del servidor.

## Endpoints principales

- `GET  /api/v1/health`
- `GET  /api/v1/auth/me`
- `GET  /api/v1/sources`
- `POST /api/v1/sources/qobuz/connect`
- `POST /api/v1/sources/qobuz/callback`
- `POST /api/v1/sources/qobuz/verify`
- `POST /api/v1/sources/qobuz/disconnect`
- `GET  /api/v1/library/unified`
- `GET  /api/v1/library/by-source/qobuz`
- `GET  /api/v1/library/qobuz/discography?artist=...`
- `POST /api/v1/library/sync/qobuz`
- `GET  /api/v1/library/sync/jobs/:jobId`
- `GET  /api/v1/settings/discography-providers`
- `POST /api/v1/settings/lastfm-key`
- `DELETE /api/v1/settings/lastfm-key`
- `POST /api/v1/qobuz/track-url`  ⭐ nuevo: para reproducción local o DLNA en cliente

Detalles de contrato en `../docs/BACKEND_API.md`.

## Estructura

```
src/
├── app.module.ts
├── main.ts
├── health.controller.ts
├── auth/                 # FirebaseAuthService + AuthGuard
├── library/              # LibraryController
├── qobuz/                # QobuzController + QobuzPlaybackService (resolveTrack)
├── providers/            # qobuzApiClient, lastFmApiClient, musicBrainzApiClient, ...
├── security/             # tokenCrypto
├── services/             # SourceAccountService, sourceAccountStore, ...
├── settings/             # SettingsController
├── sources/              # SourcesController
└── types/                # domain.ts
```

## Lo que NO está acá (por diseño)

- **No** hay control UPnP/DLNA. El cliente Android lo hace directo.
- **No** hay `playbackState` server-side. El cliente sabe qué está sonando.
- **No** hay endpoints específicos del frontend Angular antiguo.
