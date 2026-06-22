import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'morgan_colors.dart';
import 'morgan_tokens.dart';
import 'morgan_typography.dart';

class MorganTheme {
  static ThemeData light() => _build(MorganPalette.light);
  static ThemeData dark() => _build(MorganPalette.dark);

  static ThemeData _build(MorganPalette p) {
    final textTheme = MorganTypography.textTheme(p);

    return ThemeData(
      useMaterial3: true,
      brightness: p.isDark ? Brightness.dark : Brightness.light,
      scaffoldBackgroundColor: p.background,
      colorScheme: ColorScheme(
        brightness: p.isDark ? Brightness.dark : Brightness.light,
        primary: p.accent,
        onPrimary: p.accentOn,
        secondary: p.gold,
        onSecondary: p.isDark ? const Color(0xFFE8EEF4) : const Color(0xFFFFFBF4),
        surface: p.surface,
        onSurface: p.textPrimary,
        error: p.loss,
        onError: p.accentOn,
      ),
      textTheme: textTheme,
      extensions: [MorganPaletteTheme(palette: p)],
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: p.background,
        foregroundColor: p.textPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: p.isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      dividerTheme: DividerThemeData(color: p.borderSubtle, thickness: 1),
      cardTheme: CardThemeData(
        elevation: 0,
        color: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MorganRadius.md),
          side: BorderSide(color: p.borderSubtle),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.accent,
          foregroundColor: p.accentOn,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl, vertical: MorganSpace.md),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MorganRadius.sm)),
          textStyle: textTheme.titleMedium?.copyWith(color: p.accentOn, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.accent,
          textStyle: textTheme.titleSmall?.copyWith(color: p.accent),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: p.surfaceMuted,
        labelStyle: textTheme.bodySmall!.copyWith(color: p.textSecondary),
        side: BorderSide(color: p.borderSubtle),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(MorganRadius.pill)),
        padding: const EdgeInsets.symmetric(horizontal: MorganSpace.sm, vertical: MorganSpace.xxs),
      ),
    );
  }
}
