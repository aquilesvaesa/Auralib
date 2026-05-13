import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          ListTile(
            leading: const Icon(Icons.account_circle_outlined),
            title: const Text('Cuenta'),
            subtitle: const Text('Gestionar perfil y sesión'),
            onTap: () {},
          ),
          ListTile(
            leading: const Icon(Icons.cloud_outlined),
            title: const Text('Fuentes (Qobuz)'),
            subtitle: const Text('Conectar / desconectar / sincronizar'),
            onTap: () {},
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
            subtitle: Text('v${0.1} · API ${AppConfig.apiBaseUrl}'),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}
