import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class LibraryPage extends ConsumerWidget {
  const LibraryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi biblioteca'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Aquí se listarán tus álbumes favoritos de Qobuz.\n\n'
            '(esqueleto inicial — pendiente: integrar API y mostrar la lista real)',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        destinations: const [
          NavigationDestination(icon: Icon(Icons.library_music_outlined), label: 'Biblioteca'),
          NavigationDestination(icon: Icon(Icons.search_outlined), label: 'Buscar'),
          NavigationDestination(icon: Icon(Icons.queue_music_outlined), label: 'Cola'),
        ],
        selectedIndex: 0,
        onDestinationSelected: (_) {},
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/library/player'),
        icon: const Icon(Icons.play_arrow_rounded),
        label: const Text('Player'),
      ),
    );
  }
}
