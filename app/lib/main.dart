import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio_background/just_audio_background.dart';

import 'app/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await JustAudioBackground.init(
    androidNotificationChannelId: 'com.auralib.audio',
    androidNotificationChannelName: 'AuraLib reproducción',
    androidNotificationOngoing: true,
  );

  // Firebase.initializeApp se hace dentro de bootstrap() cuando agreguemos firebase_options.dart.

  runApp(const ProviderScope(child: AuraLibApp()));
}
