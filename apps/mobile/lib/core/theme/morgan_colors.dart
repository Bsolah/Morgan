import 'package:flutter/material.dart';

/// Morgan semantic color palette — light & dark.
class MorganPalette {
  const MorganPalette({
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.surfaceMuted,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.accent,
    required this.accentMuted,
    required this.accentOn,
    required this.gold,
    required this.goldMuted,
    required this.profit,
    required this.profitMuted,
    required this.loss,
    required this.lossMuted,
    required this.warning,
    required this.border,
    required this.borderSubtle,
    required this.navBar,
    required this.isDark,
  });

  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color surfaceMuted;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color accent;
  final Color accentMuted;
  final Color accentOn;
  final Color gold;
  final Color goldMuted;
  final Color profit;
  final Color profitMuted;
  final Color loss;
  final Color lossMuted;
  final Color warning;
  final Color border;
  final Color borderSubtle;
  final Color navBar;
  final bool isDark;

  static const light = MorganPalette(
    background: Color(0xFFF5F4F1),
    surface: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEEEDEA),
    textPrimary: Color(0xFF1A1A18),
    textSecondary: Color(0xFF5C5C57),
    textMuted: Color(0xFF94948E),
    accent: Color(0xFF4F5BFF),
    accentMuted: Color(0xFFECEEFF),
    accentOn: Color(0xFFFFFFFF),
    gold: Color(0xFFB8953E),
    goldMuted: Color(0xFFF8F3E8),
    profit: Color(0xFF0F7B5F),
    profitMuted: Color(0xFFE4F2ED),
    loss: Color(0xFFC23B3B),
    lossMuted: Color(0xFFFCEAEA),
    warning: Color(0xFFB45309),
    border: Color(0xFFE5E4E0),
    borderSubtle: Color(0xFFEDEBE7),
    navBar: Color(0xFFFAFAF8),
    isDark: false,
  );

  static const dark = MorganPalette(
    background: Color(0xFF0C0C0E),
    surface: Color(0xFF161618),
    surfaceElevated: Color(0xFF1E1E22),
    surfaceMuted: Color(0xFF222226),
    textPrimary: Color(0xFFF5F5F3),
    textSecondary: Color(0xFFA8A8A2),
    textMuted: Color(0xFF6E6E68),
    accent: Color(0xFF7B85FF),
    accentMuted: Color(0xFF252840),
    accentOn: Color(0xFFFFFFFF),
    gold: Color(0xFFD4AF5E),
    goldMuted: Color(0xFF2A2418),
    profit: Color(0xFF34D399),
    profitMuted: Color(0xFF0D281F),
    loss: Color(0xFFF87171),
    lossMuted: Color(0xFF2D1515),
    warning: Color(0xFFFBBF24),
    border: Color(0xFF2A2A2E),
    borderSubtle: Color(0xFF1F1F23),
    navBar: Color(0xFF121214),
    isDark: true,
  );
}

/// Extension for easy palette access from BuildContext.
extension MorganPaletteContext on BuildContext {
  MorganPalette get morgan => Theme.of(this).extension<MorganPaletteTheme>()!.palette;
}

class MorganPaletteTheme extends ThemeExtension<MorganPaletteTheme> {
  const MorganPaletteTheme({required this.palette});

  final MorganPalette palette;

  @override
  MorganPaletteTheme copyWith({MorganPalette? palette}) =>
      MorganPaletteTheme(palette: palette ?? this.palette);

  @override
  MorganPaletteTheme lerp(ThemeExtension<MorganPaletteTheme>? other, double t) {
    if (other is! MorganPaletteTheme) return this;
    return t < 0.5 ? this : other;
  }
}
