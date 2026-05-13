import 'package:dio/dio.dart';

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
}
