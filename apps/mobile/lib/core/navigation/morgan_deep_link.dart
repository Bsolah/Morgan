String? resolveMorganDeepLinkPath(Uri uri) {
  if (uri.scheme != 'morgan') return null;

  final errorCode = uri.queryParameters['shopify_error'];
  if (errorCode != null) return null;

  final connectToken = uri.queryParameters['connect_token'];
  if (connectToken != null && connectToken.isNotEmpty) return null;

  if (uri.host == 'home') return '/home';
  if (uri.path == '/home' || uri.path == 'home') return '/home';

  if (uri.host.isNotEmpty && (uri.path.isEmpty || uri.path == '/')) {
    return '/${uri.host}';
  }

  if (uri.path.isNotEmpty) {
    return uri.path.startsWith('/') ? uri.path : '/${uri.path}';
  }

  return null;
}

String? resolveMorganDeepLinkFromData(Map<String, dynamic> data) {
  final deepLink = data['deep_link'];
  if (deepLink is! String || deepLink.isEmpty) return null;
  return resolveMorganDeepLinkPath(Uri.parse(deepLink));
}
