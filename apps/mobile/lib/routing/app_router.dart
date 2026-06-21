import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_providers.dart';
import '../core/config/app_config.dart';
import '../core/onboarding/onboarding_repository.dart';
import '../features/alerts/presentation/alert_detail_screen.dart';
import '../features/alerts/presentation/alerts_screen.dart';
import '../features/chat/presentation/chat_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/onboarding/presentation/onboarding_screen.dart';
import '../features/recommendations/presentation/recommendation_detail_screen.dart';
import '../features/recommendations/presentation/recommendations_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../shared/widgets/morgan_shell.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final _routerRefreshProvider = Provider<ValueNotifier<int>>((ref) {
  final notifier = ValueNotifier(0);
  ref.onDispose(notifier.dispose);
  ref.listen(authSessionProvider, (previous, next) => notifier.value++);
  ref.listen(onboardingCompletedProvider, (previous, next) => notifier.value++);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authSessionProvider);
  final onboardingState = ref.watch(onboardingCompletedProvider);
  final refresh = ref.watch(_routerRefreshProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppConfig.canSkipSetup ? '/home' : '/onboarding',
    refreshListenable: refresh,
    redirect: (context, state) {
      final isOnboarding = state.matchedLocation == '/onboarding';
      final connected = authState.maybeWhen(
        data: (session) => session?.isConnected ?? false,
        orElse: () => false,
      );
      final onboardingComplete = onboardingState.maybeWhen(
        data: (value) => value,
        orElse: () => false,
      );

      if (!connected && !isOnboarding) return '/onboarding';
      if (connected && onboardingComplete && isOnboarding) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/recommendations/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => RecommendationDetailScreen(
          recommendationId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/alerts/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => AlertDetailScreen(
          alertId: state.pathParameters['id']!,
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MorganShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/recommendations',
                builder: (context, state) => const RecommendationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/chat',
                builder: (context, state) => const ChatScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/alerts',
                builder: (context, state) => const AlertsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/settings',
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
