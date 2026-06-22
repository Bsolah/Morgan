import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:morgan_mobile/core/theme/morgan_colors.dart';
import 'package:morgan_mobile/core/theme/morgan_theme.dart';
import 'package:morgan_mobile/core/theme/morgan_typography.dart';
import 'package:morgan_mobile/core/theme/theme_provider.dart';

void main() {
  group('Morgan theme foundation', () {
    test('dark palette uses UX spec background and surfaces', () {
      const p = MorganPalette.dark;
      expect(p.background, const Color(0xFF0C0B0A));
      expect(p.surface, const Color(0xFF161514));
      expect(p.surfaceElevated, const Color(0xFF1E1D1A));
      expect(p.isDark, isTrue);
    });

    test('dark theme applies palette to scaffold and app bar', () {
      final theme = MorganTheme.dark();
      expect(theme.scaffoldBackgroundColor, MorganPalette.dark.background);
      expect(theme.appBarTheme.backgroundColor, MorganPalette.dark.background);
      expect(theme.brightness, Brightness.dark);
    });

    test('typography hierarchy matches UX scale', () {
      final text = MorganTypography.textTheme(MorganPalette.dark);
      expect(text.headlineSmall?.fontSize, 20);
      expect(text.headlineMedium?.fontSize, 22);
      expect(text.titleLarge?.fontSize, 22);
      expect(text.titleMedium?.fontSize, 18);
      expect(text.bodyMedium?.fontSize, 14);
      expect(text.bodyLarge?.fontSize, 16);
      expect(text.labelMedium?.fontSize, 11);
      expect(MorganTypography.metricValue(MorganPalette.dark).fontSize, 28);
    });

    test('theme mode defaults to dark', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(themeModeProvider), MorganThemeMode.dark);
    });

    test('system UI overlay uses light icons on dark background', () {
      final overlay = MorganTheme.systemUiOverlay(MorganPalette.dark);
      expect(overlay.statusBarIconBrightness, Brightness.light);
      expect(overlay.systemNavigationBarColor, MorganPalette.dark.background);
    });
  });
}
