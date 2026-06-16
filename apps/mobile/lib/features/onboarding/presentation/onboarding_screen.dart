import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/onboarding/onboarding_repository.dart';
import '../../../core/shopify/shopify_oauth.dart';
import '../../../core/sync/sync_status.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import 'widgets/onboarding_step_indicator.dart';
import 'widgets/optional_integrations_panel.dart';
import 'widgets/sync_progress_panel.dart';

enum OnboardingPhase { welcome, connectShopify, connectConfirmed, syncProgress }

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _shopController = TextEditingController();
  OnboardingPhase _phase = OnboardingPhase.welcome;
  bool _isConnecting = false;
  String? _errorMessage;
  String? _connectedShop;

  static const _stepLabels = ['Welcome', 'Connect', 'Confirmed', 'Sync'];

  @override
  void initState() {
    super.initState();
    _bootstrapReturningUser();
  }

  Future<void> _bootstrapReturningUser() async {
    final session = await ref.read(authSessionProvider.future);
    if (!mounted || session == null) return;
    setState(() {
      _connectedShop = session.shopDomain;
    });
  }

  @override
  void dispose() {
    _shopController.dispose();
    super.dispose();
  }

  int get _stepIndex => switch (_phase) {
        OnboardingPhase.welcome => 0,
        OnboardingPhase.connectShopify => 1,
        OnboardingPhase.connectConfirmed => 2,
        OnboardingPhase.syncProgress => 3,
      };

  bool get _hasLinkedStore {
    final session = ref.read(authSessionProvider).maybeWhen(data: (s) => s, orElse: () => null);
    return session?.isConnected ?? false;
  }

  void _goToPhase(OnboardingPhase phase) {
    setState(() {
      _phase = phase;
      _errorMessage = null;
    });
  }

  Future<void> _connectShopify() async {
    final shop = normalizeShopInput(_shopController.text);
    if (!isValidShopDomain(shop)) {
      setState(() => _errorMessage = shopifyOAuthErrorMessages['invalid_shop']);
      return;
    }

    setState(() {
      _isConnecting = true;
      _errorMessage = null;
    });

    try {
      final startUrl = buildShopifyOAuthStartUrl(shop);
      final result = await FlutterWebAuth2.authenticate(
        url: startUrl,
        callbackUrlScheme: 'morgan',
      );

      final uri = Uri.parse(result);
      final errorCode = uri.queryParameters['shopify_error'];
      if (errorCode != null) {
        setState(() {
          _isConnecting = false;
          _errorMessage = shopifyOAuthErrorMessage(errorCode);
        });
        return;
      }

      final connectToken = uri.queryParameters['connect_token'];
      if (connectToken == null || connectToken.isEmpty) {
        setState(() {
          _isConnecting = false;
          _errorMessage = shopifyOAuthErrorMessages['server_error'];
        });
        return;
      }

      final repo = ref.read(authRepositoryProvider);
      final session = await repo.exchangeConnectToken(connectToken);
      ref.invalidate(authSessionProvider);

      setState(() {
        _isConnecting = false;
        _connectedShop = session.shopDomain;
        _phase = OnboardingPhase.connectConfirmed;
      });
    } catch (_) {
      setState(() {
        _isConnecting = false;
        _errorMessage = shopifyOAuthErrorMessages['server_error'];
      });
    }
  }

  void _skipConnectIfLinked() {
    final session = ref.read(authSessionProvider).maybeWhen(data: (s) => s, orElse: () => null);
    if (session == null) return;
    setState(() {
      _connectedShop = session.shopDomain;
      _phase = OnboardingPhase.connectConfirmed;
    });
  }

  Future<void> _finishOnboarding() async {
    await ref.read(onboardingRepositoryProvider).markCompleted();
    ref.invalidate(onboardingCompletedProvider);
    if (mounted) context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final syncStatus = ref.watch(syncStatusProvider);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: MorganSpace.lg),
              MorganFadeIn(child: const MorganLogo(size: 44, showWordmark: true)),
              const SizedBox(height: MorganSpace.lg),
              OnboardingStepIndicator(currentIndex: _stepIndex, labels: _stepLabels),
              const SizedBox(height: MorganSpace.xl),
              Expanded(child: _buildStepContent(context, syncStatus)),
              if (_errorMessage != null) ...[
                Text(_errorMessage!, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
                const SizedBox(height: MorganSpace.sm),
              ],
              _buildPrimaryAction(context),
              const SizedBox(height: MorganSpace.xl),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent(BuildContext context, AsyncValue<SyncStatus> syncStatus) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return switch (_phase) {
      OnboardingPhase.welcome => SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Morgan — your AI CFO, not a dashboard',
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: MorganSpace.md),
              Text(
                'Daily briefings, profit actions, and cash clarity — grounded in your Shopify data.',
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: MorganSpace.xl),
              const _ValueBullet(
                title: 'Morning brief',
                subtitle: 'Know what changed and why',
              ),
              const SizedBox(height: MorganSpace.md),
              const _ValueBullet(
                title: 'Ranked actions',
                subtitle: 'Focus on what moves profit',
              ),
              const SizedBox(height: MorganSpace.md),
              const _ValueBullet(
                title: 'Ask Morgan',
                subtitle: 'Answers backed by your store data',
              ),
            ],
          ),
        ),
      OnboardingPhase.connectShopify => SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Connect Shopify', style: theme.textTheme.headlineMedium),
              const SizedBox(height: MorganSpace.sm),
              Text(
                'Enter your store domain to authorize Morgan. We read orders, products, inventory, and payouts.',
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: MorganSpace.xl),
              if (_isConnecting) ...[
                const Center(child: CircularProgressIndicator()),
                const SizedBox(height: MorganSpace.md),
                Text(
                  'Complete sign-in in your browser…',
                  style: theme.textTheme.bodyMedium,
                ),
              ] else
                TextField(
                  controller: _shopController,
                  enabled: !_isConnecting,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  decoration: InputDecoration(
                    labelText: 'Store domain',
                    hintText: 'mystore.myshopify.com',
                    filled: true,
                    fillColor: p.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(MorganRadius.sm),
                      borderSide: BorderSide(color: p.borderSubtle),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(MorganRadius.sm),
                      borderSide: BorderSide(color: p.borderSubtle),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(MorganRadius.sm),
                      borderSide: BorderSide(color: p.accent, width: 1.5),
                    ),
                  ),
                  onSubmitted: (_) => _connectShopify(),
                ),
            ],
          ),
        ),
      OnboardingPhase.connectConfirmed => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Store connected', style: theme.textTheme.headlineMedium),
            const SizedBox(height: MorganSpace.sm),
            Text(
              _connectedShop ?? '',
              style: theme.textTheme.titleMedium?.copyWith(color: p.accent),
            ),
            const SizedBox(height: MorganSpace.md),
            Text(
              'Morgan will sync your historical data and prepare your first briefing.',
              style: theme.textTheme.bodyLarge,
            ),
          ],
        ),
      OnboardingPhase.syncProgress => SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Sync in progress', style: theme.textTheme.headlineMedium),
              const SizedBox(height: MorganSpace.sm),
              Text(
                'This runs in the background. You can continue while we finish.',
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: MorganSpace.lg),
              syncStatus.when(
                data: (status) => SyncProgressPanel(status: status),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, e) {
                  final session = ref.read(authSessionProvider).maybeWhen(
                        data: (value) => value,
                        orElse: () => null,
                      );
                  return SyncProgressPanel(
                    status: SyncStatus(
                      storeId: session?.storeId ?? '',
                      overallPercent: 0,
                      etaMinutes: 4,
                      storeStatus: 'syncing',
                      tasks: const [
                        SyncTaskProgress(
                          id: 'orders',
                          label: 'Orders',
                          percent: 0,
                          status: SyncTaskStatus.pending,
                        ),
                        SyncTaskProgress(
                          id: 'products',
                          label: 'Products',
                          percent: 0,
                          status: SyncTaskStatus.pending,
                        ),
                        SyncTaskProgress(
                          id: 'inventory',
                          label: 'Inventory',
                          percent: 0,
                          status: SyncTaskStatus.pending,
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: MorganSpace.xl),
              OptionalIntegrationsPanel(onSkip: _finishOnboarding),
            ],
          ),
        ),
    };
  }

  Widget _buildPrimaryAction(BuildContext context) {
    return switch (_phase) {
      OnboardingPhase.welcome => MorganPrimaryButton(
          label: 'Get started',
          onPressed: () => _goToPhase(OnboardingPhase.connectShopify),
        ),
      OnboardingPhase.connectShopify => Column(
          children: [
            if (_hasLinkedStore) ...[
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _isConnecting ? null : _skipConnectIfLinked,
                  child: const Text('Skip — store already linked'),
                ),
              ),
              const SizedBox(height: MorganSpace.xs),
            ],
            MorganPrimaryButton(
              label: _isConnecting ? 'Connecting…' : 'Connect Shopify',
              onPressed: _isConnecting ? () {} : _connectShopify,
            ),
          ],
        ),
      OnboardingPhase.connectConfirmed => MorganPrimaryButton(
          label: 'Continue',
          onPressed: () => _goToPhase(OnboardingPhase.syncProgress),
        ),
      OnboardingPhase.syncProgress => MorganPrimaryButton(
          label: 'Continue to Morgan',
          onPressed: _finishOnboarding,
        ),
    };
  }
}

class _ValueBullet extends StatelessWidget {
  const _ValueBullet({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 8,
          height: 8,
          margin: const EdgeInsets.only(top: 6),
          decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle),
        ),
        const SizedBox(width: MorganSpace.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.titleSmall),
              Text(subtitle, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ],
    );
  }
}
