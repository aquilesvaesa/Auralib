import 'package:dio/dio.dart';

import '../domain/auth_me_user.dart';

class AuthRepository {
  AuthRepository(this._dio);

  final Dio _dio;

  static const String mePath = '/api/v1/auth/me';

  Future<AuthMeUser> fetchMe() async {
    final response = await _dio.get<Map<String, dynamic>>(mePath);
    final data = response.data;
    if (data == null) {
      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Respuesta vacía de /auth/me',
      );
    }
    final user = data['user'];
    if (user is! Map<String, dynamic>) {
      throw DioException(
        requestOptions: response.requestOptions,
        message: 'Formato inválido en /auth/me',
      );
    }
    return AuthMeUser.fromJson(user);
  }
}
