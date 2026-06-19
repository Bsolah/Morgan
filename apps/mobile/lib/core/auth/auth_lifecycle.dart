import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';
import 'auth_controller.dart';
import 'deep_link_handler.dart';

/// Locks the app on resume when biometric unlock is enabled.
class AuthLifecycleObserver extends ConsumerStatefulWidget {
  const AuthLifecycleObserver({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AuthLifecycleObserver> createState() => _AuthLifecycleObserverState();
}

class _AuthLifecycleObserverState extends ConsumerState<AuthLifecycleObserver> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(deepLinkHandlerProvider).init();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(authControllerProvider.notifier).lockForBiometric();
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
