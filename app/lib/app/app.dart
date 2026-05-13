import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
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
      next.whenData((user) {
        if (user == null || AppConfig.skipFirebase || DefaultFirebaseOptions.isPlaceholderClient) return;
        unawaited(_validateSessionWithBackend(ref));
      });
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
      await FirebaseAuth.instance.signOut();
    }
  } catch (_) {
    // Errores de red u otros: no cerrar sesión automáticamente.
  }
}
