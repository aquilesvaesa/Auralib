import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/errors/api_error.dart';
import '../../../../firebase_options.dart';
import '../../application/auth_providers.dart';
import '../auth_messages.dart';
import '../widgets/firebase_not_configured_panel.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    try {
      final cred = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
      await cred.user?.getIdToken(true);
      await ref.read(authRepositoryProvider).fetchMe();
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(messageForFirebaseAuth(e))),
        );
      }
    } on DioException catch (e) {
      final api = ApiError.tryParseDio(e);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              api?.message ??
                  'No se pudo validar la sesión con el servidor. Comprueba la URL del API.',
            ),
          ),
        );
      }
      await FirebaseAuth.instance.signOut();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (AppConfig.skipFirebase) {
      return Scaffold(
        appBar: AppBar(title: const Text('Login')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Estás en modo SKIP_FIREBASE.\n'
              'Usa --dart-define=DEV_AUTH_UID=... y DEV_AUTH_EMAIL=... para entrar al shell.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    if (DefaultFirebaseOptions.isPlaceholderClient) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Firebase: plantilla CONFIGURE_ME'),
          automaticallyImplyLeading: false,
        ),
        body: const SafeArea(
          child: FirebaseNotConfiguredPanel(),
        ),
      );
    }

    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 24),
                    Icon(Icons.library_music_rounded, size: 72, color: cs.primary),
                    const SizedBox(height: 16),
                    Text(
                      'AuraLib',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Tu biblioteca musical, sonando donde quieras.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: cs.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: _email,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      autofillHints: const [AutofillHints.email],
                      enabled: !_loading,
                      validator: (v) {
                        final s = v?.trim() ?? '';
                        if (s.isEmpty) return 'Introduce tu correo';
                        if (!s.contains('@')) return 'Correo no válido';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      decoration: const InputDecoration(labelText: 'Contraseña'),
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      enabled: !_loading,
                      onFieldSubmitted: (_) => _submit(),
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Introduce la contraseña';
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Entrar'),
                    ),
                    TextButton(
                      onPressed: _loading ? null : () => context.push('/register'),
                      child: const Text('Crear cuenta'),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
