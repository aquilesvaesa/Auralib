# Arquitectura técnica — AuraLib

## 1. Vista general

```
┌──────────────────────────── Dispositivo Android ──────────────────────────┐
│                                                                            │
│   Flutter UI (Riverpod, go_router, Material 3)                             │
│                                                                            │
│   just_audio (ExoPlayer)              Cliente UPnP/DLNA                    │
│      │                                       │                             │
│      ▼                                       ▼                             │
│   Salida del sistema:               SSDP discovery + SOAP                  │
│   jack / BT / USB DAC               (HiBy R4 en LAN)                       │
│                                                                            │
└─────────────────┬───────────────────────────────────┬─────────────────────┘
                  │ HTTPS Bearer (Firebase ID token)  │ Multicast UDP + SOAP
                  ▼                                   ▼
        ┌──────────────────┐                   ┌──────────────┐
        │ Backend NestJS   │                   │ DAC HiBy R4  │
        │ (cloud / Mac LAN)│                   │ Modo UPnP    │
        ├──────────────────┤                   └──────────────┘
        │ Firebase Auth    │
        │ Qobuz API        │  ◄──── puppeteer-core (Chrome) extrae secret
        │ Last.fm + MB     │
        │ Sync favoritos   │
        │ track-url        │
        └──────────────────┘
```

## 2. Decisiones clave

### 2.1 Cliente Flutter en lugar de Kotlin nativo
- **Por qué**: una sola base que abre puertas a iOS / desktop / web a futuro.
- **Riesgo aceptado**: capa de abstracción extra; mitigado con `just_audio`
  (que internamente usa Media3) y `MethodChannel` para SSDP cuando se necesite
  performance/control fino.

### 2.2 UPnP/DLNA en el cliente, NO en el backend
- **Antes**: el Nest hacía SSDP + SOAP al DAC. Eso obligaba a que el Nest
  estuviera en la **misma WiFi** del DAC. QA se complicaba con túneles.
- **Ahora**: el cliente Android, que ya está en la WiFi del usuario, hace
  SSDP nativo y manda los SOAP `SetAVTransportURI` / `Play` / `Pause` al renderer.
- **Beneficio**: el backend puede estar en cualquier nube; cero túneles para QA.

### 2.3 Backend cloud compartido
- **Por qué**: el extractor de Qobuz necesita Chromium (Puppeteer). Reescribirlo
  en Dart/Android no es viable. El backend sigue siendo NestJS, ahora con
  endpoints más finos y sin código UPnP.
- **Despliegue v1**: corre local en el Mac del owner (`localhost:3100`) durante
  desarrollo. Para QA se sube a Cloud Run / Render / Fly.io.

### 2.4 Auth Firebase
- **Por qué**: SDK móvil maduro, free tier amplio, JWT firmado verificable
  desde el backend con `firebase-admin`.
- **v1**: sólo email/contraseña.

### 2.5 Estado en Riverpod (no Bloc)
- **Por qué**: menos boilerplate, integración natural con `riverpod_generator`,
  testing simple, comunidad activa.

### 2.6 Audio local con `just_audio`
- **Por qué**: encapsula ExoPlayer (Media3) sin escribir Kotlin. MediaSession,
  notificación, lockscreen y soporte de salidas del sistema (jack/BT/USB) gratis.
- **Plan B**: si v2 necesita features muy específicas (DRM, audio espacial),
  bajar a un plugin propio sobre Media3.

## 3. Capas del cliente

```
lib/
├── app/                    # MaterialApp.router + GoRouter + theme aplicado
├── core/                   # Cosas transversales sin dominio propio
│   ├── config/             # AppConfig (API_BASE_URL via --dart-define)
│   ├── http/               # dioProvider con Firebase ID token interceptor
│   ├── storage/            # SharedPreferences wrapper
│   ├── errors/             # Mapeo de errores HTTP -> dominio
│   └── utils/
├── features/               # Feature-first
│   ├── auth/               # data | domain | presentation
│   ├── library/
│   ├── discography/
│   ├── player/             # just_audio + estado de cola
│   ├── settings/
│   ├── sources/            # Conectar/desconectar Qobuz
│   └── upnp/               # SSDP, registry, control SOAP
└── shared/
    ├── theme/              # AppTheme (Material 3, paleta cobre/grafito)
    ├── widgets/            # MiniPlayer, AlbumCover, etc.
    └── l10n/
```

Cada feature sigue `data → domain → presentation` con providers Riverpod.

## 4. Flujo de reproducción

### "Este dispositivo"
1. Usuario tap en track.
2. `PlayerController` llama a `POST /api/v1/qobuz/track-url`.
3. Backend devuelve `{ uri, formatId, mimeType, durationSec, metadata }`.
4. `AudioPlayer.setUrl(uri)` + `play()`.
5. `just_audio_background` actualiza la notificación de reproducción.

### "DAC en red (DLNA)"
1. Usuario tap en track.
2. Cliente verifica que haya renderer seleccionado (sino lo busca con SSDP).
3. `PlayerController` llama a `POST /api/v1/qobuz/track-url`.
4. Cliente arma DIDL-Lite con `metadata` y manda `SetAVTransportURI` + `Play` al renderer.
5. Polling a `GetTransportInfo` / `GetPositionInfo` cada 1-2 s mientras suena.

## 5. Persistencia

| Dato | Dónde vive | Cómo se sincroniza |
|------|------------|---------------------|
| Cuenta usuario | Firebase Auth | SDK |
| Token Qobuz cifrado | Backend (sourceAccountStore) | Endpoints existentes |
| Favoritos / biblioteca | Backend cache + Qobuz | Sync manual y/o automática |
| Discografía cache | Backend (TTL corto) | Endpoint actual |
| Renderer DLNA seleccionado | Local (`shared_preferences`) | No se sincroniza entre dispositivos |
| API base URL | Local (`shared_preferences`) | Sólo override del owner |

## 6. Permisos Android requeridos

- `INTERNET`
- `ACCESS_WIFI_STATE`
- `CHANGE_WIFI_MULTICAST_STATE`  (para SSDP)
- `POST_NOTIFICATIONS`           (Android 13+, para MediaSession)
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK`  (audio en background)

## 7. Build y firma

- `minSdkVersion = 26`, `compileSdkVersion = 35`.
- Keystore de release **único y guardado offline** (no en el repo).
- `key.properties` en `.gitignore`.
- Versionado SemVer (1.0.0, 1.0.1, …).
