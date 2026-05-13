import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/app_config.dart';
import '../features/auth/application/auth_providers.dart';
import '../firebase_options.dart';
import '../shared/theme/app_theme.dart';
import 'router/app_router.dart';

class AuraLibApp extends ConsumerWidget {
  const AuraLibApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(firebaseAuthStateProvider, (previous, next) {
      final user = next.asData?.value;
      if (user == null || AppConfig.skipFirebase || DefaultFirebaseOptions.isPlaceholderClient) {
        return;
      }
      // Evita llamar /auth/me otra vez por el mismo uid (p. ej. al abrir /sources/qobuz y
      // reconstruir AuraLibApp): un 401 espurio aquí cerraba sesión con signOut().
      final prevUser = previous?.asData?.value;
      if (prevUser != null && prevUser.uid == user.uid) {
        return;
      }
      unawaited(_validateSessionWithBackend(ref));
    });

    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'AuraLib',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.dark,
      routerConfig: router,
    );
  }
}

Future<void> _validateSessionWithBackend(WidgetRef ref) async {
  try {
    await ref.read(authRepositoryProvider).fetchMe();
  } on DioException catch (e) {
    final code = e.response?.statusCode;
    if (code == 401 || code == 403) {
      // No hacer signOut aquí: este callback puede repetirse al navegar y un 401 puntual
      // cerraba la sesión al abrir rutas como /sources/qobuz. El login ya valida /me al entrar.
      debugPrint(
        'AuraLib: /auth/me devolvió $code (no se cierra sesión automáticamente). '
        '${e.response?.data}',
      );
    }
  } catch (_) {
    // Errores de red u otros: no cerrar sesión automáticamente.
  }
}
