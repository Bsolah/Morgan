import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../routing/app_router.dart';
import '../navigation/morgan_deep_link.dart';
import 'auth_controller.dart';

class DeepLinkHandler {
  DeepLinkHandler(this._ref);

  final Ref _ref;
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;
  String? _lastHandledConnectToken;

  Future<void> init() async {
    final initial = await _appLinks.getInitialLink();
    if (initial != null) {
      await _handleUri(initial);
    }

    _subscription = _appLinks.uriLinkStream.listen(_handleUri);
  }

  void dispose() {
    _subscription?.cancel();
  }

  Future<void> _handleUri(Uri uri) async {
    if (uri.scheme != 'morgan') return;

    final errorCode = uri.queryParameters['shopify_error'];
    if (errorCode != null) return;

    final connectToken = uri.queryParameters['connect_token'];
    if (connectToken != null && connectToken.isNotEmpty) {
      if (connectToken == _lastHandledConnectToken) return;

      _lastHandledConnectToken = connectToken;

      try {
        await _ref.read(authControllerProvider.notifier).completeConnect(connectToken);
      } catch (_) {
        _lastHandledConnectToken = null;
      }
      return;
    }

    final path = resolveMorganDeepLinkPath(uri);
    if (path != null) {
      _ref.read(appRouterProvider).go(path);
    }
  }
}

final deepLinkHandlerProvider = Provider<DeepLinkHandler>((ref) {
  final handler = DeepLinkHandler(ref);
  ref.onDispose(handler.dispose);
  return handler;
});
