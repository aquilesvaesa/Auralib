// GENERADO POR tool/sync_firebase_options.dart — no editar a mano.
// Regenerar: (desde app/) dart run tool/sync_firebase_options.dart
//
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static bool get isPlaceholderClient {
    return android.apiKey == 'CONFIGURE_ME' ||
        android.projectId == 'auralib-configure-firebase' ||
        android.messagingSenderId == '000000000000';
  }

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Firebase Web no está configurado para AuraLib v1.');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'Añade FirebaseOptions para $defaultTargetPlatform tras flutterfire configure.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: "AIzaSyCfEt-0EXR1-i9JNvU9xXIKqcGfSrrLMn0",
    appId: "1:740634901626:android:132c77e436b40a7fffcfc3",
    messagingSenderId: "740634901626",
    projectId: "auralib",
    storageBucket: "auralib.firebasestorage.app",
  );
}
