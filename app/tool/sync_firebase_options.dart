// Genera lib/firebase_options.dart desde android/app/google-services.json
// (no requiere Firebase CLI ni flutterfire).
//
// Uso, desde la carpeta `app/`:
//   dart run tool/sync_firebase_options.dart
//
// Requisito: haber colocado google-services.json en android/app/

import 'dart:convert';
import 'dart:io';

const _androidPackage = 'com.auralib.auralib';
const _jsonRelative = 'android/app/google-services.json';
const _outRelative = 'lib/firebase_options.dart';

void main(List<String> args) {
  final jsonFile = File(_jsonRelative);
  if (!jsonFile.existsSync()) {
    stderr
      ..writeln('No se encontró $_jsonRelative')
      ..writeln('Descarga google-services.json desde Firebase Console → tu app Android '
          'y colócalo en android/app/');
    exitCode = 1;
    return;
  }

  Map<String, dynamic> map;
  try {
    map = jsonDecode(jsonFile.readAsStringSync()) as Map<String, dynamic>;
  } catch (e, st) {
    stderr.writeln('JSON inválido: $e\n$st');
    exitCode = 1;
    return;
  }

  final projectInfo = map['project_info'] as Map<String, dynamic>?;
  if (projectInfo == null) {
    stderr.writeln('El JSON no contiene project_info.');
    exitCode = 1;
    return;
  }

  final clients = map['client'] as List<dynamic>?;
  if (clients == null || clients.isEmpty) {
    stderr.writeln('El JSON no contiene client[].');
    exitCode = 1;
    return;
  }

  final client = _pickAndroidClient(clients);
  if (client == null) {
    stderr.writeln('No se encontró un cliente Android con package $_androidPackage.');
    exitCode = 1;
    return;
  }

  final clientInfo = client['client_info'] as Map<String, dynamic>?;
  final apiKeyList = client['api_key'] as List<dynamic>?;
  if (clientInfo == null || apiKeyList == null || apiKeyList.isEmpty) {
    stderr.writeln('Faltan client_info o api_key en el cliente elegido.');
    exitCode = 1;
    return;
  }

  final appId = clientInfo['mobilesdk_app_id'] as String?;
  final currentKey = (apiKeyList.first as Map<String, dynamic>)['current_key'] as String?;
  if (appId == null || currentKey == null) {
    stderr.writeln('Faltan mobilesdk_app_id o current_key.');
    exitCode = 1;
    return;
  }

  final projectId = projectInfo['project_id'] as String?;
  final number = projectInfo['project_number'];
  final messagingSenderId = number == null ? '' : number.toString();
  var storageBucket = projectInfo['storage_bucket'] as String?;
  if (storageBucket == null || storageBucket.isEmpty) {
    storageBucket = '$projectId.appspot.com';
  }

  if (projectId == null || projectId.isEmpty || messagingSenderId.isEmpty) {
    stderr.writeln('Faltan project_id o project_number en project_info.');
    exitCode = 1;
    return;
  }

  final out = File(_outRelative);
  out.writeAsStringSync(_dartFile(
    apiKey: currentKey,
    appId: appId,
    messagingSenderId: messagingSenderId,
    projectId: projectId,
    storageBucket: storageBucket,
  ));

  stdout.writeln('Escrito ${_outRelative} desde $_jsonRelative');
}

Map<String, dynamic>? _pickAndroidClient(List<dynamic> clients) {
  Map<String, dynamic>? firstAndroid;
  for (final raw in clients) {
    if (raw is! Map<String, dynamic>) continue;
    final ci = raw['client_info'];
    if (ci is! Map<String, dynamic>) continue;
    final aci = ci['android_client_info'];
    if (aci is! Map<String, dynamic>) continue;
    firstAndroid ??= raw;
    final pkg = aci['package_name'] as String?;
    if (pkg == _androidPackage) {
      return raw;
    }
  }
  return firstAndroid;
}

String _dartFile({
  required String apiKey,
  required String appId,
  required String messagingSenderId,
  required String projectId,
  required String storageBucket,
}) {
  String lit(String s) => jsonEncode(s);

  return '''
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
          'Añade FirebaseOptions para \$defaultTargetPlatform tras flutterfire configure.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: ${lit(apiKey)},
    appId: ${lit(appId)},
    messagingSenderId: ${lit(messagingSenderId)},
    projectId: ${lit(projectId)},
    storageBucket: ${lit(storageBucket)},
  );
}
''';
}
