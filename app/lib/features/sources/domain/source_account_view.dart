/// Vista pública de una cuenta de fuente (respuesta de `GET /api/v1/sources`).
class SourceAccountView {
  const SourceAccountView({
    required this.source,
    required this.status,
    this.externalUserId,
    this.lastVerifiedAt,
    this.hasAccessToken = false,
  });

  final String source;
  final String status;
  final String? externalUserId;
  final String? lastVerifiedAt;
  final bool hasAccessToken;

  bool get isConnected => status == 'connected';

  factory SourceAccountView.fromJson(Map<String, dynamic> json) {
    return SourceAccountView(
      source: json['source'] as String? ?? '',
      status: json['status'] as String? ?? 'disconnected',
      externalUserId: json['externalUserId'] as String?,
      lastVerifiedAt: json['lastVerifiedAt'] as String?,
      hasAccessToken: json['hasAccessToken'] as bool? ?? false,
    );
  }
}
