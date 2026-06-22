import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum MorganThemeMode { system, light, dark }

/// Dark theme by default (US-UX-00-01). Merchants can override in Settings → Appearance.
final themeModeProvider = StateProvider<MorganThemeMode>((_) => MorganThemeMode.dark);

final resolvedBrightnessProvider = Provider<Brightness>((ref) {
  final mode = ref.watch(themeModeProvider);
  switch (mode) {
    case MorganThemeMode.light:
      return Brightness.light;
    case MorganThemeMode.dark:
      return Brightness.dark;
    case MorganThemeMode.system:
      return WidgetsBinding.instance.platformDispatcher.platformBrightness;
  }
});
