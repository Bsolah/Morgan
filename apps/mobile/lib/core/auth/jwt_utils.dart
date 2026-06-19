import 'dart:convert';

/// Reads JWT `exp` (seconds since epoch) without verifying the signature.
DateTime? jwtExpiresAt(String token) {
  final parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    final normalized = base64Url.normalize(parts[1]);
    final payload = jsonDecode(utf8.decode(base64Url.decode(normalized))) as Map<String, dynamic>;
    final exp = payload['exp'];
    if (exp is! num) return null;
    return DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000, isUtc: true);
  } catch (_) {
    return null;
  }
}

bool isAccessTokenExpired(String accessToken, {Duration skew = const Duration(seconds: 60)}) {
  final expiresAt = jwtExpiresAt(accessToken);
  if (expiresAt == null) return true;
  return DateTime.now().toUtc().isAfter(expiresAt.subtract(skew));
}
