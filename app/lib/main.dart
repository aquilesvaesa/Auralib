import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio_background/just_audio_background.dart';

import 'app/app.dart';
import 'core/config/app_config.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!AppConfig.skipFirebase) {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    } catch (e, st) {
      debugPrint('Firebase.initializeApp falló: $e\n$st\n'
          'Ejecuta en app/: dart pub global activate flutterfire_cli && flutterfire configure\n'
          'O usa --dart-define=SKIP_FIREBASE=true con DEV_AUTH_UID y DEV_AUTH_EMAIL para API dev.');
      if (kReleaseMode) {
        rethrow;
      }
    }
  }

  await JustAudioBackground.init(
    androidNotificationChannelId: 'com.auralib.audio',
    androidNotificationChannelName: 'AuraLib reproducción',
    androidNotificationOngoing: true,
  );

  runApp(const ProviderScope(child: AuraLibApp()));
}
