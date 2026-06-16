import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/morgan_theme.dart';
import 'routing/app_router.dart';

class MorganApp extends ConsumerWidget {
  const MorganApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Morgan',
      debugShowCheckedModeBanner: false,
      theme: MorganTheme.light,
      routerConfig: router,
    );
  }
}
