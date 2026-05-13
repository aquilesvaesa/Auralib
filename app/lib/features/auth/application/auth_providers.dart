import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../firebase_options.dart';
import '../../../core/http/dio_provider.dart';
import '../data/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(dioProvider));
});

/// Estado de sesión Firebase (null si no hay usuario o modo `SKIP_FIREBASE`).
final firebaseAuthStateProvider = StreamProvider<User?>((ref) {
  if (AppConfig.skipFirebase || DefaultFirebaseOptions.isPlaceholderClient) {
    return Stream<User?>.value(null);
  }
  return FirebaseAuth.instance.authStateChanges();
});
