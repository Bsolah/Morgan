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
    background: Color(0xFFF7F5F0),
    surface: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF0EBE0),
    textPrimary: Color(0xFF1A1814),
    textSecondary: Color(0xFF5C574E),
    textMuted: Color(0xFF949088),
    // Primary — dark shiny gold
    accent: Color(0xFF876B1E),
    accentMuted: Color(0xFFF5EDD5),
    accentOn: Color(0xFFFFFBF4),
    // Secondary — deep slate blue (gold complement)
    gold: Color(0xFF3B5270),
    goldMuted: Color(0xFFE9EEF3),
    profit: Color(0xFF0F7B5F),
    profitMuted: Color(0xFFE4F2ED),
    loss: Color(0xFFC23B3B),
    lossMuted: Color(0xFFFCEAEA),
    warning: Color(0xFFB45309),
    border: Color(0xFFE8E2D6),
    borderSubtle: Color(0xFFEDE8DE),
    navBar: Color(0xFFFAF8F4),
    isDark: false,
  );

  static const dark = MorganPalette(
    background: Color(0xFF0C0B0A),
    surface: Color(0xFF161514),
    surfaceElevated: Color(0xFF1E1D1A),
    surfaceMuted: Color(0xFF242220),
    textPrimary: Color(0xFFF5F3EE),
    textSecondary: Color(0xFFA8A49A),
    textMuted: Color(0xFF6E6A62),
    // Primary — metallic shiny gold
    accent: Color(0xFFCFAA3C),
    accentMuted: Color(0xFF2C2414),
    accentOn: Color(0xFF140F06),
    // Secondary — soft steel blue
    gold: Color(0xFF6E95B8),
    goldMuted: Color(0xFF1C2632),
    profit: Color(0xFF34D399),
    profitMuted: Color(0xFF0D281F),
    loss: Color(0xFFF87171),
    lossMuted: Color(0xFF2D1515),
    warning: Color(0xFFFBBF24),
    border: Color(0xFF2E2C28),
    borderSubtle: Color(0xFF22201C),
    navBar: Color(0xFF121110),
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
