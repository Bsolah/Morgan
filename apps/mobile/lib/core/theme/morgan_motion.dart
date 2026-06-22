import 'package:flutter/material.dart';

import 'morgan_tokens.dart';

/// Motion helpers — reduced-motion checks and capped list stagger delays.
abstract final class MorganMotion {
  /// True when the OS or app has requested reduced / no motion.
  static bool isReducedMotion(BuildContext context) {
    return MediaQuery.disableAnimationsOf(context);
  }

  /// Per-item stagger delay for list reveals; cumulative delay is capped at [maxTotal].
  static Duration listStaggerDelay(
    int index, {
    Duration step = const Duration(milliseconds: 40),
    Duration maxTotal = const Duration(milliseconds: 300),
  }) {
    final ms = (step.inMilliseconds * index).clamp(0, maxTotal.inMilliseconds);
    return Duration(milliseconds: ms);
  }

  /// Duration for tab body cross-fade; zero when reduced motion is enabled.
  static Duration tabFadeDuration(BuildContext context) {
    return isReducedMotion(context) ? Duration.zero : MorganDuration.fast;
  }
}
