import 'package:flutter/material.dart';

import '../../core/theme/morgan_motion.dart';
import '../../core/theme/morgan_tokens.dart';

/// Fast cross-fade on tab switch; skipped when reduced motion is enabled.
class MorganShellTabFade extends StatefulWidget {
  const MorganShellTabFade({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  State<MorganShellTabFade> createState() => _MorganShellTabFadeState();
}

class _MorganShellTabFadeState extends State<MorganShellTabFade>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fade;
  int _lastIndex = 0;

  @override
  void initState() {
    super.initState();
    _lastIndex = widget.navigationShell.currentIndex;
    _controller = AnimationController(
      vsync: this,
      duration: MorganDuration.fast,
      value: 1,
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
  }

  @override
  void didUpdateWidget(covariant MorganShellTabFade oldWidget) {
    super.didUpdateWidget(oldWidget);
    final index = widget.navigationShell.currentIndex;
    if (index == _lastIndex) return;
    _lastIndex = index;

    if (MorganMotion.isReducedMotion(context)) return;

    _controller.duration = MorganMotion.tabFadeDuration(context);
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MorganMotion.isReducedMotion(context)) {
      return widget.navigationShell;
    }
    return FadeTransition(
      opacity: _fade,
      child: widget.navigationShell,
    );
  }
}
