import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/errors/api_error.dart';
import '../../application/sources_providers.dart';
import '../../domain/source_account_view.dart';

class QobuzSourcesPage extends ConsumerStatefulWidget {
  const QobuzSourcesPage({super.key});

  @override
  ConsumerState<QobuzSourcesPage> createState() => _QobuzSourcesPageState();
}

class _QobuzSourcesPageState extends ConsumerState<QobuzSourcesPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  SourceAccountView? _qobuz(List<SourceAccountView> list) {
    for (final a in list) {
      if (a.source == 'qobuz') return a;
    }
    return null;
  }

  Future<void> _reload() async {
    ref.invalidate(sourcesListProvider);
    await ref.read(sourcesListProvider.future);
  }

  Future<void> _connect() async {
    setState(() => _busy = true);
    try {
      await ref.read(sourcesRepositoryProvider).connectQobuz(
            email: _email.text.trim(),
            password: _password.text,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Qobuz conectado.')),
        );
        _password.clear();
      }
      await _reload();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiError.userFacingDioMessage(e)),
            duration: const Duration(seconds: 8),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() => _busy = true);
    try {
      await ref.read(sourcesRepositoryProvider).verifyQobuz();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Token Qobuz verificado correctamente.')),
        );
      }
      await _reload();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiError.userFacingDioMessage(e)),
            duration: const Duration(seconds: 8),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disconnect() async {
    setState(() => _busy = true);
    try {
      await ref.read(sourcesRepositoryProvider).disconnectQobuz();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Qobuz desconectado.')),
        );
      }
      await _reload();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiError.userFacingDioMessage(e)),
            duration: const Duration(seconds: 8),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(sourcesListProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Qobuz'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _busy ? null : () => context.pop(),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) {
          final msg = e is DioException
              ? ApiError.userFacingDioMessage(e)
              : 'No se pudo cargar las fuentes: $e';
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: ListView(
                shrinkWrap: true,
                children: [
                  SelectableText(msg, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 12),
                  SelectableText(
                    'URL actual del API: ${AppConfig.apiBaseUrl}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontFamily: 'monospace',
                          color: cs.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(onPressed: _reload, child: const Text('Reintentar')),
                ],
              ),
            ),
          );
        },
        data: (list) {
          final q = _qobuz(list);
          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                SelectableText(
                  'API: ${AppConfig.apiBaseUrl}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontFamily: 'monospace',
                        color: cs.outline,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Conecta tu cuenta Qobuz con el email y contraseña de Qobuz '
                  '(no el inicio solo con Google/Microsoft salvo que tengas contraseña en qobuz.com).',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                if (q != null) ...[
                  Row(
                    children: [
                      Text('Estado: ', style: Theme.of(context).textTheme.titleSmall),
                      Chip(
                        label: Text(q.status),
                        visualDensity: VisualDensity.compact,
                        backgroundColor: q.isConnected ? cs.primaryContainer : cs.surfaceContainerHighest,
                      ),
                    ],
                  ),
                  if (q.externalUserId != null && q.externalUserId!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    SelectableText('Usuario Qobuz: ${q.externalUserId}', style: Theme.of(context).textTheme.bodySmall),
                  ],
                  const SizedBox(height: 20),
                ],
                if (q == null || !q.isConnected) ...[
                  TextField(
                    controller: _email,
                    decoration: const InputDecoration(labelText: 'Email Qobuz'),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    enabled: !_busy,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    decoration: const InputDecoration(labelText: 'Contraseña Qobuz'),
                    obscureText: true,
                    enabled: !_busy,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _connect,
                    child: _busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Conectar'),
                  ),
                ] else ...[
                  FilledButton.tonal(
                    onPressed: _busy ? null : _verify,
                    child: const Text('Verificar token'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _busy ? null : _disconnect,
                    child: const Text('Desconectar'),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
