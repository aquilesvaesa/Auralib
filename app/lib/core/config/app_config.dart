import 'package:flutter/foundation.dart';

/// Config base de la app: URL del backend según target.
///
/// - Emulador Android: `10.0.2.2:3100` apunta al `localhost` del Mac.
/// - Dispositivo físico: hay que pasar la IP LAN del Mac vía `--dart-define=API_BASE_URL=...`.
/// - Producción: pasar URL HTTPS del backend desplegado.
///
/// **Modo sin Firebase (solo debug):** antes de `flutterfire configure`:
/// `flutter run --dart-define=SKIP_FIREBASE=true --dart-define=DEV_AUTH_UID=... --dart-define=DEV_AUTH_EMAIL=...`
/// El backend acepta `Authorization: Bearer dev:<uid>:<email>` en desarrollo
/// (ver `docs/BACKEND_API.md` en la raíz del monorepo).
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3100',
  );

  static const String appName = 'AuraLib';

  /// `true` mientras `flutter run --release` no se haya configurado.
  static bool get isDebug => kDebugMode;

  static const bool skipFirebase = bool.fromEnvironment('SKIP_FIREBASE', defaultValue: false);

  static const String devAuthUid = String.fromEnvironment('DEV_AUTH_UID', defaultValue: '');

  static const String devAuthEmail = String.fromEnvironment('DEV_AUTH_EMAIL', defaultValue: '');

  static String? get devBearerPayload {
    if (!skipFirebase) return null;
    if (devAuthUid.isEmpty || devAuthEmail.isEmpty) return null;
    return 'dev:$devAuthUid:$devAuthEmail';
  }
}
