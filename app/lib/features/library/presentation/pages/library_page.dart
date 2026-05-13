import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class LibraryPage extends ConsumerWidget {
  const LibraryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Biblioteca'),
        actions: [
          IconButton(
            tooltip: 'Reproductor',
            icon: const Icon(Icons.play_circle_outline),
            onPressed: () => context.push('/player'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Text(
            'Discoteca',
            style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            'Colección y sincronización con Qobuz.',
            style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterChip(label: 'Todos', selected: true, onSelected: (_) {}),
                _FilterChip(label: 'Favoritos', selected: false, onSelected: (_) {}),
                _FilterChip(label: 'Hi-Res', selected: false, onSelected: (_) {}),
                _FilterChip(label: 'Por artista', selected: false, onSelected: (_) {}),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Divider(height: 1, color: cs.outline.withValues(alpha: 0.5)),
          const SizedBox(height: 32),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Aquí se listarán tus álbumes favoritos de Qobuz.\n\n'
                '(esqueleto UX — pendiente: integrar API y rejilla de portadas)',
                textAlign: TextAlign.center,
                style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: onSelected,
        showCheckmark: false,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        side: BorderSide(
          color: selected ? Colors.transparent : cs.outline.withValues(alpha: 0.4),
        ),
        selectedColor: cs.surfaceContainerHigh,
        labelStyle: TextStyle(
          color: selected ? cs.onSurface : cs.onSurfaceVariant,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
        ),
      ),
    );
  }
}
