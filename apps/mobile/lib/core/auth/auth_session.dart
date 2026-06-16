class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.storeId,
    required this.shopDomain,
  });

  final String accessToken;
  final String refreshToken;
  final String storeId;
  final String shopDomain;

  bool get isConnected => shopDomain.isNotEmpty;
}
