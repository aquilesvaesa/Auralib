import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config/app_config.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/discover/presentation/pages/descubre_page.dart';
import '../../features/library/presentation/pages/library_page.dart';
import '../../features/player/presentation/pages/player_page.dart';
import '../../features/settings/presentation/settings_page.dart';
import '../shell/app_shell.dart';
import 'go_router_refresh.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

String? _authRedirect(GoRouterState state) {
  final loc = state.matchedLocation;
  try {
    if (AppConfig.skipFirebase) {
      final hasDev = AppConfig.devBearerPayload != null;
      if (!hasDev && loc != '/login') {
        return '/login';
      }
      if (hasDev && loc == '/login') {
        return '/biblioteca';
      }
      return null;
    }
    final user = FirebaseAuth.instance.currentUser;
    final isLogin = loc == '/login';
    if (user == null && !isLogin) {
      return '/login';
    }
    if (user != null && isLogin) {
      return '/biblioteca';
    }
    return null;
  } catch (_) {
    if (loc != '/login') {
      return '/login';
    }
    return null;
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  GoRouterRefreshStream? authRefresh;
  late final Listenable refreshListenable;

  if (AppConfig.skipFirebase) {
    refreshListenable = ValueNotifier<int>(0);
  } else {
    authRefresh = GoRouterRefreshStream(FirebaseAuth.instance.authStateChanges());
    refreshListenable = authRefresh;
  }

  ref.onDispose(() {
    authRefresh?.dispose();
  });

  final skipWithDev =
      AppConfig.skipFirebase && AppConfig.devBearerPayload != null;

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: skipWithDev ? '/biblioteca' : '/login',
    refreshListenable: refreshListenable,
    redirect: (context, state) => _authRedirect(state),
    routes: [
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (_, __) => const LoginPage(),
      ),
      GoRoute(
        path: '/library',
        redirect: (_, __) => '/biblioteca',
      ),
      GoRoute(
        path: '/monitor',
        redirect: (_, __) => '/biblioteca',
      ),
      GoRoute(
        path: '/inspector',
        redirect: (_, __) => '/descubre',
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/biblioteca',
                name: 'biblioteca',
                builder: (_, __) => const LibraryPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/descubre',
                name: 'descubre',
                builder: (_, __) => const DescubrePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/ajustes',
                name: 'ajustes',
                builder: (_, __) => const SettingsPage(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/player',
        name: 'player',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const PlayerPage(),
      ),
    ],
  );
});
