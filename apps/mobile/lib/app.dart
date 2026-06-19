import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/auth_lifecycle.dart';
import 'core/theme/morgan_theme.dart';
import 'core/theme/theme_provider.dart';
import 'routing/app_router.dart';

class MorganApp extends ConsumerWidget {
  const MorganApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeMode = ref.watch(themeModeProvider);

    return AuthLifecycleObserver(
      child: MaterialApp.router(
        title: 'Morgan',
        debugShowCheckedModeBanner: false,
        theme: MorganTheme.light(),
        darkTheme: MorganTheme.dark(),
        themeMode: switch (themeMode) {
          MorganThemeMode.system => ThemeMode.system,
          MorganThemeMode.light => ThemeMode.light,
          MorganThemeMode.dark => ThemeMode.dark,
        },
        routerConfig: router,
      ),
    );
  }
}
