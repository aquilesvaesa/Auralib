// ignore_for_file: lines_longer_than_80_chars
//
// Reemplaza este archivo ejecutando en `app/`:
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=<tu-proyecto-firebase>
//
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  /// `true` mientras el repo tenga la plantilla; sustituye con `flutterfire configure`.
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
    apiKey: 'CONFIGURE_ME',
    appId: '1:000000000000:android:0000000000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'auralib-configure-firebase',
    storageBucket: 'auralib-configure-firebase.appspot.com',
  );
}
