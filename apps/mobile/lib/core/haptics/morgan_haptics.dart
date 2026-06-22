import 'package:flutter/services.dart';

/// Light tactile feedback for key merchant actions (accept, mark read).
abstract final class MorganHaptics {
  static void lightImpact() {
    HapticFeedback.lightImpact();
  }
}
