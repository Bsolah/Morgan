import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'morgan_colors.dart';

abstract final class MorganTypography {
  static TextTheme textTheme(MorganPalette p) {
    final base = GoogleFonts.interTextTheme();

    return TextTheme(
      displayLarge: base.displayLarge?.copyWith(
        fontSize: 40,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.2,
        height: 1.1,
        color: p.textPrimary,
      ),
      displayMedium: base.displayMedium?.copyWith(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.8,
        height: 1.15,
        color: p.textPrimary,
      ),
      headlineLarge: base.headlineLarge?.copyWith(
        fontSize: 28,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.6,
        height: 1.2,
        color: p.textPrimary,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.4,
        height: 1.25,
        color: p.textPrimary,
      ),
      titleLarge: base.titleLarge?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
        color: p.textPrimary,
      ),
      titleMedium: base.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.1,
        color: p.textPrimary,
      ),
      titleSmall: base.titleSmall?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: p.textPrimary,
      ),
      bodyLarge: base.bodyLarge?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 1.55,
        color: p.textSecondary,
      ),
      bodyMedium: base.bodyMedium?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.5,
        color: p.textSecondary,
      ),
      bodySmall: base.bodySmall?.copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 1.45,
        color: p.textMuted,
      ),
      labelLarge: base.labelLarge?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.6,
        color: p.textMuted,
      ),
      labelMedium: base.labelMedium?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.8,
        color: p.textMuted,
      ),
      labelSmall: base.labelSmall?.copyWith(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.0,
        color: p.textMuted,
      ),
    ).apply(
      bodyColor: p.textSecondary,
      displayColor: p.textPrimary,
    );
  }

  static TextStyle metricValue(MorganPalette p, {double size = 28}) => GoogleFonts.jetBrainsMono(
        fontSize: size,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.5,
        color: p.textPrimary,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle metricDelta(MorganPalette p, Color color) => GoogleFonts.jetBrainsMono(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );
}
