import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../core/auth/biometric_unlock_screen.dart';
import '../features/alerts/presentation/alert_detail_screen.dart';
import '../features/finance/presentation/cogs_method_screen.dart';
import '../features/integrations/presentation/integrations_hub_screen.dart';
import '../features/integrations/presentation/quickbooks_account_mapping_screen.dart';
import '../features/integrations/presentation/xero_account_mapping_screen.dart';
import '../features/inventory/presentation/inventory_settings_screen.dart';
import '../features/inventory/presentation/inventory_overview_screen.dart';
import '../features/inventory/presentation/inventory_sku_detail_screen.dart';
import '../features/marketing/presentation/campaign_detail_screen.dart';
import '../features/marketing/presentation/marketing_overview_screen.dart';
import '../features/cash/presentation/cash_overview_screen.dart';
import '../features/cash/presentation/cash_unmatched_screen.dart';
import '../features/alerts/presentation/alerts_screen.dart';
import '../features/chat/presentation/chat_screen.dart';
import '../features/brief/presentation/brief_detail_screen.dart';
import '../features/brief/presentation/brief_history_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/onboarding/presentation/onboarding_screen.dart';
import '../features/profit/presentation/profit_dashboard_screen.dart';
import '../features/profit/presentation/sku_detail_screen.dart';
import '../features/profit/presentation/profit_leak_detail_screen.dart';
import '../features/recommendations/presentation/recommendation_detail_screen.dart';
import '../features/recommendations/presentation/recommendations_screen.dart';
import '../features/scenarios/presentation/scenario_planner_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../shared/widgets/morgan_shell.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final _routerRefreshProvider = Provider<ValueNotifier<int>>((ref) {
  final notifier = ValueNotifier(0);
  ref.onDispose(notifier.dispose);
  ref.listen(authControllerProvider, (previous, next) => notifier.value++);
  return notifier;
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);
  final refresh = ref.watch(_routerRefreshProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/onboarding',
    refreshListenable: refresh,
    redirect: (context, state) {
      final location = state.matchedLocation;
      final isOnboarding = location == '/onboarding';
      final isUnlock = location == '/unlock';

      switch (auth.status) {
        case AuthStatus.loading:
          return null;

        case AuthStatus.unauthenticated:
          if (!isOnboarding) return '/onboarding';
          return null;

        case AuthStatus.reauthRequired:
          if (!isOnboarding) {
            final returnTo = auth.pendingRoute;
            if (returnTo != null && returnTo.isNotEmpty) {
              return '/onboarding?returnTo=${Uri.encodeComponent(returnTo)}';
            }
            return '/onboarding?reauth=1';
          }
          return null;

        case AuthStatus.biometricLocked:
          if (!isUnlock) return '/unlock';
          return null;

        case AuthStatus.authenticated:
          if (isOnboarding || isUnlock) {
            final pending = auth.pendingRoute;
            if (pending != null && pending.isNotEmpty) return pending;
            return '/home';
          }
          return null;
      }
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/unlock',
        builder: (context, state) => const BiometricUnlockScreen(),
      ),
      GoRoute(
        path: '/brief/history',
        builder: (context, state) => const BriefHistoryScreen(),
      ),
      GoRoute(
        path: '/brief/:date',
        builder: (context, state) => BriefDetailScreen(date: state.pathParameters['date']!),
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
      GoRoute(
        path: '/scenarios',
        builder: (context, state) => const ScenarioPlannerScreen(),
      ),
      GoRoute(
        path: '/settings/inventory',
        builder: (context, state) => const InventorySettingsScreen(),
      ),
      GoRoute(
        path: '/settings/cogs',
        builder: (context, state) => const CogsMethodScreen(),
      ),
      GoRoute(
        path: '/settings/integrations',
        builder: (context, state) => const IntegrationsHubScreen(),
      ),
      GoRoute(
        path: '/settings/integrations/quickbooks/mapping',
        builder: (context, state) => const QuickBooksAccountMappingScreen(),
      ),
      GoRoute(
        path: '/settings/integrations/xero/mapping',
        builder: (context, state) => const XeroAccountMappingScreen(),
      ),
      GoRoute(
        path: '/integrations/meta',
        builder: (context, state) => const IntegrationsHubScreen(),
      ),
      GoRoute(
        path: '/inventory',
        builder: (context, state) => const InventoryOverviewScreen(),
      ),
      GoRoute(
        path: '/inventory/sku/:sku',
        builder: (context, state) => InventorySkuDetailScreen(sku: state.pathParameters['sku']!),
      ),
      GoRoute(
        path: '/marketing',
        builder: (context, state) => const MarketingOverviewScreen(),
      ),
      GoRoute(
        path: '/marketing/campaigns/:channel/:campaignId',
        builder: (context, state) {
          final windowDays = int.tryParse(state.uri.queryParameters['windowDays'] ?? '') ?? 7;
          return CampaignDetailScreen(
            channel: state.pathParameters['channel']!,
            campaignId: state.pathParameters['campaignId']!,
            windowDays: windowDays,
          );
        },
      ),
      GoRoute(
        path: '/cash',
        builder: (context, state) => const CashOverviewScreen(),
      ),
      GoRoute(
        path: '/cash/unmatched',
        builder: (context, state) => const CashUnmatchedScreen(),
      ),
      GoRoute(
        path: '/profit',
        builder: (context, state) => const ProfitDashboardScreen(),
      ),
      GoRoute(
        path: '/profit/leaks/:id',
        builder: (context, state) => ProfitLeakDetailScreen(leakId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/profit/sku/:sku',
        builder: (context, state) => SkuDetailScreen(sku: state.pathParameters['sku']!),
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
                builder: (context, state) => ChatScreen(
                  initialPrompt: state.uri.queryParameters['prompt'],
                ),
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
