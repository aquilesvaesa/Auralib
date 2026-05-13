# AuraLib (cliente Flutter)

Cliente Android (v1) de AuraLib.

## Estado del esqueleto

Este directorio contiene la **estructura base** del proyecto: `lib/`, `pubspec.yaml`,
`analysis_options.yaml`, etc. Faltan los archivos generados automáticamente por
`flutter create` (proyecto Android: `android/`, `gradle wrapper`, `MainActivity`,
manifest, etc.).

## Cómo terminar el bootstrap (una sola vez)

1. **Instalar Flutter**: <https://docs.flutter.dev/get-started/install/macos>
   ```bash
   brew install --cask flutter
   flutter doctor   # resolver lo que falte (Android SDK, licencias, etc.)
   ```
2. **Generar los archivos de plataforma Android dentro de este directorio** sin
   pisar lo nuestro:
   ```bash
   cd /Users/alvaroarias/AlvaroDev/Auralib/app
   flutter create --org com.auralib --project-name auralib --platforms=android .
   ```
   El comando completa `android/`, `MainActivity.kt`, manifest, etc. Mantiene
   `lib/`, `pubspec.yaml`, `analysis_options.yaml` y demás archivos existentes.

3. **Instalar dependencias**:
   ```bash
   flutter pub get
   dart run build_runner build --delete-conflicting-outputs
   ```

4. **Configurar Firebase** (cuando armes el proyecto Firebase):
   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure --project=<ID-DE-TU-PROYECTO-FIREBASE>
   ```
   Esto **sobrescribe** `lib/firebase_options.dart` y genera `android/app/google-services.json`
   (este último ya está en `.gitignore`). Hasta entonces el repo incluye un `firebase_options.dart`
   placeholder: en debug, si la init falla, revisa la consola o usa el modo `SKIP_FIREBASE` abajo.

5. **Generar ícono y splash** (cuando agregues los PNG en `assets/icons/`):
   ```bash
   dart run flutter_native_splash:create
   dart run flutter_launcher_icons
   ```

## Levantar la app

- **Emulador**: `flutter run`
- **Dispositivo físico**: `flutter run --dart-define=API_BASE_URL=http://192.168.1.X:3100`

### Sin Firebase aún (solo debug, API con token dev del Nest)

Si el backend está en marcha y acepta `Bearer dev:<uid>:<email>`:

```bash
flutter run --dart-define=SKIP_FIREBASE=true \
  --dart-define=DEV_AUTH_UID=testuid \
  --dart-define=DEV_AUTH_EMAIL=dev@example.com \
  --dart-define=API_BASE_URL=http://192.168.1.X:3100
```

La app entra directo al shell (Biblioteca) y `dio` envía el bearer dev. Ver `docs/BACKEND_API.md` en el monorepo.

## Estructura

```
lib/
├── main.dart                 # bootstrap + JustAudioBackground.init
├── app/
│   ├── app.dart              # MaterialApp.router
│   └── router/app_router.dart
├── core/
│   ├── config/app_config.dart
│   ├── http/dio_provider.dart
│   ├── errors/
│   ├── storage/
│   └── utils/
├── features/
│   ├── auth/        (data | domain | presentation)
│   ├── library/     (data | domain | presentation)
│   ├── discography/
│   ├── player/
│   ├── settings/
│   ├── sources/
│   └── upnp/
└── shared/
    ├── theme/app_theme.dart
    ├── widgets/
    └── l10n/
```

## Roadmap del cliente

1. **Fase 1**: Login Firebase real + provider de auth con Riverpod.
2. **Fase 2**: Sources (conectar Qobuz) + listado biblioteca.
3. **Fase 3**: Reproductor local con `just_audio` + MediaSession.
4. **Fase 4**: Cliente UPnP (descubrimiento + control DAC).
5. **Fase 5**: Discografía enriquecida.
6. **Fase 6**: Pulido (UI, ícono, splash, permisos, build release).
