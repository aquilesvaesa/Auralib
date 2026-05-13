import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../errors/api_error.dart';

/// Cliente HTTP global con interceptor que adjunta el ID token de Firebase
/// o el token dev del backend en modo [AppConfig.skipFirebase].
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final dev = AppConfig.devBearerPayload;
        if (dev != null) {
          options.headers['Authorization'] = 'Bearer $dev';
          return handler.next(options);
        }
        try {
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            final token = await user.getIdToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
        } catch (_) {
          // Sin Firebase inicializado o sin sesión: el backend responderá 401 si la ruta lo exige.
        }
        handler.next(options);
      },
      onError: (DioException e, handler) {
        final api = ApiError.tryParseDio(e);
        if (api != null && kDebugMode) {
          debugPrint('API ${api.code}: ${api.message}');
        }
        handler.next(e);
      },
    ),
  );

  return dio;
});
