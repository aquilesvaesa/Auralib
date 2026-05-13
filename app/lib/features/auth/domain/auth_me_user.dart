/// Respuesta de `GET /api/v1/auth/me`: `{ "user": { "uid", "email" } }`.
class AuthMeUser {
  const AuthMeUser({required this.uid, this.email});

  final String uid;
  final String? email;

  factory AuthMeUser.fromJson(Map<String, dynamic> json) {
    return AuthMeUser(
      uid: json['uid'] as String,
      email: json['email'] as String?,
    );
  }
}
