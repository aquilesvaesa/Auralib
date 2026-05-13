import 'package:flutter/foundation.dart';

/// Config base de la app: URL del backend según target.
///
/// - Emulador Android: `10.0.2.2:3100` apunta al `localhost` del Mac.
/// - Dispositivo físico: hay que pasar la IP LAN del Mac vía `--dart-define=API_BASE_URL=...`.
/// - Producción: pasar URL HTTPS del backend desplegado.
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3100',
  );

  static const String appName = 'AuraLib';

  /// `true` mientras `flutter run --release` no se haya configurado.
  static bool get isDebug => kDebugMode;
}
