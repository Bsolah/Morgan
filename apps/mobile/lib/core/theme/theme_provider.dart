import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum MorganThemeMode { system, light, dark }

final themeModeProvider = StateProvider<MorganThemeMode>((_) => MorganThemeMode.system);

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
