import 'package:dio/dio.dart';

import '../config/app_config.dart';

/// Error JSON del backend: `{ "error": { "code", "message", "details?" } }`.
class ApiError implements Exception {
  ApiError({
    required this.code,
    required this.message,
    this.details,
    this.statusCode,
  });

  final String code;
  final String message;
  final Object? details;
  final int? statusCode;

  @override
  String toString() => 'ApiError($code, $message)';

  static ApiError? tryParseDio(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final err = data['error'];
      if (err is Map<String, dynamic>) {
        return ApiError(
          code: err['code'] as String? ?? 'UNKNOWN',
          message: err['message'] as String? ?? e.message ?? 'Error de red',
          details: err['details'],
          statusCode: e.response?.statusCode,
        );
      }
    }
    return null;
  }

  static ApiError fromDio(DioException e) {
    return tryParseDio(e) ??
        ApiError(
          code: 'HTTP_${e.response?.statusCode ?? 'UNKNOWN'}',
          message: e.message ?? 'Error de red',
          statusCode: e.response?.statusCode,
        );
  }

  /// Mensaje legible para UI (timeouts, sin conexión al API, etc.).
  static String userFacingDioMessage(DioException e) {
    final timedOut = e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.connectionError ||
        (e.type == DioExceptionType.unknown &&
            (e.message?.toLowerCase().contains('timeout') ?? false));

    if (timedOut) {
      final base = AppConfig.apiBaseUrl;
      final isEmulatorHost = base.contains('10.0.2.2');
      final lines = <String>[
        'No se alcanza el API en $base (tiempo de espera o sin conexión).',
        'Comprueba que el backend Nest esté en marcha (puerto 3100) y la misma red Wi‑Fi.',
      ];
      if (isEmulatorHost) {
        lines.add(
          'La URL por defecto 10.0.2.2 solo funciona en el emulador Android. '
          'En tablet o móvil físico usa la IP LAN de tu Mac, por ejemplo:\n'
          'flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3100',
        );
      }
      return lines.join('\n\n');
    }
    return (tryParseDio(e) ?? fromDio(e)).message;
  }
}
