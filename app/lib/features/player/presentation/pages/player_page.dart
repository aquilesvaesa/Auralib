import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PlayerPage extends ConsumerWidget {
  const PlayerPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        title: const Text('Reproductor'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Container(
                decoration: BoxDecoration(
                  color: cs.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(Icons.album_outlined, size: 96, color: cs.onSurfaceVariant),
              ),
            ),
            const SizedBox(height: 24),
            Text('Sin pista activa', style: Theme.of(context).textTheme.titleLarge),
            Text('—', style: Theme.of(context).textTheme.bodyMedium),
            const Spacer(),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 0, label: Text('Este dispositivo'), icon: Icon(Icons.phone_android)),
                ButtonSegment(value: 1, label: Text('DAC en red'), icon: Icon(Icons.speaker_outlined)),
              ],
              selected: const {0},
              onSelectionChanged: (_) {},
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                IconButton(
                  iconSize: 36,
                  onPressed: () {},
                  icon: const Icon(Icons.skip_previous_rounded),
                ),
                FloatingActionButton(
                  onPressed: () {},
                  child: const Icon(Icons.play_arrow_rounded, size: 32),
                ),
                IconButton(
                  iconSize: 36,
                  onPressed: () {},
                  icon: const Icon(Icons.skip_next_rounded),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
