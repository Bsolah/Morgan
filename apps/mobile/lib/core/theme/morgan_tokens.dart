import 'package:flutter/material.dart';

/// Morgan design tokens — 4pt grid, single source of truth.
abstract final class MorganSpace {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 40;
  static const double huge = 48;

  static const double screenH = 20;
  static const double screenV = 24;
  static const double card = 20;
}

abstract final class MorganRadius {
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double pill = 100;
}

abstract final class MorganDuration {
  static const fast = Duration(milliseconds: 150);
  static const normal = Duration(milliseconds: 280);
  static const slow = Duration(milliseconds: 420);
}

abstract final class MorganElevation {
  static List<BoxShadow> card(bool isDark) => [
        BoxShadow(
          color: isDark ? const Color(0x40000000) : const Color(0x0A1A1A18),
          blurRadius: isDark ? 24 : 20,
          offset: const Offset(0, 4),
        ),
        BoxShadow(
          color: isDark ? const Color(0x18000000) : const Color(0x051A1A18),
          blurRadius: isDark ? 8 : 6,
          offset: const Offset(0, 1),
        ),
      ];
}
