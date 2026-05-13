import 'package:flutter/material.dart';

/// Contenido explicativo cuando `firebase_options.dart` sigue siendo la plantilla del repo.
/// Sin `flutterfire configure` + `google-services.json`, Auth en Android falla (p. ej. reCAPTCHA "API key not valid").
class FirebaseNotConfiguredPanel extends StatelessWidget {
  const FirebaseNotConfiguredPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Icon(Icons.cloud_off_outlined, size: 64, color: cs.primary),
        const SizedBox(height: 16),
        Text(
          'Firebase no está configurado en este build',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        Text(
          'El error «API key not valid» al crear cuenta aparece porque este proyecto '
          'sigue usando la plantilla de `firebase_options.dart` (sin claves reales) y '
          'normalmente falta `android/app/google-services.json`.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 24),
        Text('Qué hacer', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        const _Step(
          n: 1,
          text: 'En la carpeta `app/` ejecuta:',
          code:
              'dart pub global activate flutterfire_cli\nflutterfire configure --project=<TU_PROYECTO>',
        ),
        const _Step(
          n: 2,
          text: 'Confirma que existe `android/app/google-services.json` (descarga de la consola o lo genera flutterfire).',
        ),
        const _Step(
          n: 3,
          text: 'En Firebase → tu app Android `com.auralib.auralib` → añade la huella SHA-1 (y SHA-256) del keystore debug.',
        ),
        const _Step(
          n: 4,
          text: 'El backend Nest debe usar el mismo proyecto Firebase (credencial de servicio / ADC).',
        ),
        const SizedBox(height: 20),
        Text('Solo desarrollo API (sin Firebase)', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        const SelectableText(
          'flutter run --dart-define=SKIP_FIREBASE=true '
          '--dart-define=DEV_AUTH_UID=devuid '
          '--dart-define=DEV_AUTH_EMAIL=dev@local.test',
          style: TextStyle(fontFamily: 'monospace', fontSize: 12),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text, this.code});

  final int n;
  final String text;
  final String? code;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 28,
            child: Text('$n.', style: Theme.of(context).textTheme.titleSmall),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: Theme.of(context).textTheme.bodyMedium),
                if (code != null) ...[
                  const SizedBox(height: 6),
                  SelectableText(code!, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
