import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../auth/application/auth_providers.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(firebaseAuthStateProvider);
    final firebaseUser = AppConfig.skipFirebase ? null : FirebaseAuth.instance.currentUser;
    final accountSubtitle = AppConfig.skipFirebase
        ? (AppConfig.devBearerPayload != null
            ? 'Dev: ${AppConfig.devAuthEmail}'
            : 'Activa SKIP_FIREBASE con DEV_AUTH_UID y DEV_AUTH_EMAIL para el API')
        : (firebaseUser?.email ?? firebaseUser?.uid ?? 'Sin sesión');

    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          ListTile(
            leading: const Icon(Icons.account_circle_outlined),
            title: const Text('Cuenta'),
            subtitle: Text(accountSubtitle),
            onTap: () {},
          ),
          if (!AppConfig.skipFirebase && firebaseUser != null)
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Cerrar sesión'),
              onTap: () async {
                await FirebaseAuth.instance.signOut();
              },
            ),
          ListTile(
            leading: const Icon(Icons.cloud_outlined),
            title: const Text('Fuentes (Qobuz)'),
            subtitle: const Text('Conectar / desconectar / sincronizar'),
            onTap: () => context.push('/sources/qobuz'),
          ),
          ListTile(
            leading: const Icon(Icons.library_music_outlined),
            title: const Text('Discografía'),
            subtitle: const Text('Last.fm + MusicBrainz'),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.speaker_group_outlined),
            title: const Text('DAC (DLNA/UPnP)'),
            subtitle: const Text('Descubrir y seleccionar renderer'),
            onTap: () {},
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Acerca de AuraLib'),
            subtitle: Text('v0.1.0 · API ${AppConfig.apiBaseUrl}'),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}
