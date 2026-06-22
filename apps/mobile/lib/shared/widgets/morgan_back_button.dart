import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/morgan_colors.dart';

/// Consistent back control for routes pushed outside [MorganShell].
class MorganBackButton extends StatelessWidget {
  const MorganBackButton({
    super.key,
    this.fallbackRoute = '/home',
    this.tooltip = 'Back',
  });

  final String fallbackRoute;
  final String tooltip;

  static void navigateBack(BuildContext context, {String fallbackRoute = '/home'}) {
    if (context.canPop()) {
      context.pop();
      return;
    }
    context.go(fallbackRoute);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Semantics(
      button: true,
      label: tooltip,
      child: IconButton(
        onPressed: () => navigateBack(context, fallbackRoute: fallbackRoute),
        tooltip: tooltip,
        icon: Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: p.textPrimary),
        style: IconButton.styleFrom(
          minimumSize: const Size(44, 44),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}
