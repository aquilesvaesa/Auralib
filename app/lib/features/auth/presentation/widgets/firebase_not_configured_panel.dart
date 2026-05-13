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
        const SizedBox(height: 8),
        SelectableText(
          'Detectado: apiKey = CONFIGURE_ME (plantilla del repo)',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontFamily: 'monospace',
                color: cs.tertiary,
              ),
        ),
        const SizedBox(height: 12),
        Text(
          'El error «API key not valid» al crear cuenta aparece porque este proyecto '
          'sigue usando la plantilla de `lib/firebase_options.dart` (sin claves reales). '
          'Ese archivo lo usa Flutter en tiempo de ejecución; no basta con tener solo `google-services.json`.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        Card(
          color: cs.errorContainer.withValues(alpha: 0.35),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '¿Ya guardaste SHA en Firebase y el JSON en android/app/?',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: cs.onErrorContainer,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Eso no actualiza solo `firebase_options.dart`. Mientras ese archivo siga con '
                  '`CONFIGURE_ME`, verás esta pantalla. El paso que te falta es ejecutar '
                  '`flutterfire configure` en la carpeta `app/` y volver a compilar.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: cs.onErrorContainer,
                      ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Text('Qué hacer (orden recomendado)', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        const _Step(
          n: 1,
          text: 'Si ya tienes `android/app/google-services.json`, en `app/` ejecuta (sin Firebase CLI):',
          code: './setup_local.sh\n# o:\ndart run tool/sync_firebase_options.dart',
        ),
        const _Step(
          n: 2,
          text: 'O con FlutterFire (requiere `firebase` CLI + login):',
          code:
              'dart pub global activate flutterfire_cli\nflutterfire configure --project=<TU_PROYECTO>',
        ),
        const _Step(
          n: 3,
          text: 'Confirma `android/app/google-services.json` (descarga de la consola o lo completa flutterfire).',
        ),
        const _Step(
          n: 4,
          text: 'En Firebase → app Android `com.auralib.auralib` → huellas SHA-1 y SHA-256 del keystore debug.',
        ),
        const _Step(
          n: 5,
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
