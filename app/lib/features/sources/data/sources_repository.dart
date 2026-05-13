import 'package:dio/dio.dart';

import '../domain/source_account_view.dart';

class SourcesRepository {
  SourcesRepository(this._dio);

  final Dio _dio;

  Future<List<SourceAccountView>> listSources() async {
    final response = await _dio.get<List<dynamic>>('/api/v1/sources');
    final raw = response.data ?? <dynamic>[];
    return raw
        .map((e) => SourceAccountView.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  Future<Map<String, dynamic>> connectQobuz({String? email, String? password}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/sources/qobuz/connect',
      data: <String, dynamic>{
        if (email != null && email.isNotEmpty) 'email': email,
        if (password != null && password.isNotEmpty) 'password': password,
      },
    );
    return Map<String, dynamic>.from(response.data ?? const {});
  }

  Future<Map<String, dynamic>> verifyQobuz() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/sources/qobuz/verify');
    return Map<String, dynamic>.from(response.data ?? const {});
  }

  Future<Map<String, dynamic>> disconnectQobuz() async {
    final response = await _dio.post<Map<String, dynamic>>('/api/v1/sources/qobuz/disconnect');
    return Map<String, dynamic>.from(response.data ?? const {});
  }
}
