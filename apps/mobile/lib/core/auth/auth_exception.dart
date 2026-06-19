class AuthException implements Exception {
  const AuthException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => 'AuthException($code): $message';
}

class ReauthRequiredException extends AuthException {
  const ReauthRequiredException({String? returnTo})
      : returnTo = returnTo,
        super('Session expired — reconnect Shopify', code: 'reauth_required');

  final String? returnTo;
}
