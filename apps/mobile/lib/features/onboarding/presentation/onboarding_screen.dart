import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_providers.dart';
import '../../../core/brief/brief_formatters.dart';
import '../../../core/brief/brief_repository.dart';
import '../../../core/config/app_config.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/onboarding/onboarding_repository.dart';
import '../../../core/shopify/shopify_oauth.dart';
import '../../../core/sync/sync_status.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';
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

  static const _shopifyScopes = [
    'Orders and refunds — for profit and margin tracking',
    'Products and variants — for SKU economics',
    'Inventory levels — for stockout alerts',
    'Shop profile — for timezone and currency',
  ];

  @override
  void initState() {
    super.initState();
    _bootstrapReturningUser();
  }

  Future<void> _bootstrapReturningUser() async {
    final session = await ref.read(authSessionProvider.future);
    if (!mounted || session == null) return;
    setState(() => _connectedShop = session.shopDomain);
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

      final session = await ref.read(authControllerProvider.notifier).completeConnect(connectToken);
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

  Future<void> _skipLocalDevSetup() async {
    await ref.read(authRepositoryProvider).seedDevSession();
    await ref.read(authControllerProvider.notifier).refreshSession();
    await ref.read(onboardingRepositoryProvider).markCompleted();
    ref.invalidate(authSessionProvider);
    ref.invalidate(onboardingCompletedProvider);
    if (mounted) context.go('/home');
  }

  Future<void> _finishOnboarding() async {
    await ref.read(onboardingRepositoryProvider).markCompleted();
    ref.invalidate(onboardingCompletedProvider);
    if (mounted) context.go('/home');
  }

  String _firstBriefMessage(WidgetRef ref) {
    final schedule = ref.watch(briefingScheduleProvider).valueOrNull;
    if (schedule != null && schedule.nextBriefingAt.isNotEmpty) {
      final parsed = DateTime.tryParse(schedule.nextBriefingAt);
      if (parsed != null) {
        return 'Your first brief arrives ${DateFormat('EEE, MMM d · h:mm a').format(parsed.toLocal())}.';
      }
    }

    final brief = ref.watch(dailyBriefProvider).valueOrNull;
    if (brief != null && brief.nextBriefingAt.isNotEmpty) {
      return 'Your first brief arrives by ${formatNextBriefingDateTime(brief)}.';
    }

    final time = schedule?.briefingTimeLocal ?? '06:00';
    return 'Your first brief arrives at $time.';
  }

  bool _syncComplete(SyncStatus status) =>
      status.overallPercent >= 100 ||
      status.storeStatus == 'ready' ||
      status.tasks.every((t) => t.status == SyncTaskStatus.complete);

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final syncStatus = ref.watch(syncStatusProvider);
    final isWelcome = _phase == OnboardingPhase.welcome;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Column(
          children: [
            if (!isWelcome) ...[
              const SizedBox(height: MorganSpace.md),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: MorganLogo(size: 36, showWordmark: true),
                ),
              ),
            ],
            Padding(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.xl,
                MorganSpace.lg,
                MorganSpace.xl,
                MorganSpace.sm,
              ),
              child: OnboardingStepIndicator(currentIndex: _stepIndex, labels: _stepLabels),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
                child: _buildStepContent(context, syncStatus),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.xl,
                MorganSpace.sm,
                MorganSpace.xl,
                MorganSpace.xl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_errorMessage != null) ...[
                    Text(
                      _errorMessage!,
                      style: theme.textTheme.bodySmall?.copyWith(color: p.loss),
                    ),
                    const SizedBox(height: MorganSpace.sm),
                  ],
                  _buildPrimaryAction(context, syncStatus),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent(BuildContext context, AsyncValue<SyncStatus> syncStatus) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return switch (_phase) {
      OnboardingPhase.welcome => Center(
          child: SingleChildScrollView(
            child: MorganFadeIn(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const MorganLogo(size: 72),
                  const SizedBox(height: MorganSpace.xxl),
                  Text(
                    'Morgan — your AI CFO,\nnot a dashboard',
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    style: theme.textTheme.headlineMedium,
                  ),
                  const SizedBox(height: MorganSpace.md),
                  Text(
                    'Daily briefings, ranked profit actions, and cash clarity — '
                    'grounded in your Shopify data. Connect once and Morgan handles the rest.',
                    textAlign: TextAlign.center,
                    maxLines: 3,
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
        ),
      OnboardingPhase.connectShopify => SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Connect Shopify', style: theme.textTheme.headlineMedium),
              const SizedBox(height: MorganSpace.sm),
              Text(
                'Authorize Morgan to read your store. We never change products or orders without you.',
                maxLines: 3,
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: MorganSpace.lg),
              MorganSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('What Morgan reads', style: theme.textTheme.titleSmall),
                    const SizedBox(height: MorganSpace.sm),
                    ..._shopifyScopes.map(
                      (scope) => Padding(
                        padding: const EdgeInsets.only(bottom: MorganSpace.xs),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.check_rounded, size: 16, color: p.accent),
                            const SizedBox(width: MorganSpace.xs),
                            Expanded(child: Text(scope, style: theme.textTheme.bodySmall)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: MorganSpace.lg),
              if (_isConnecting) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(MorganRadius.pill),
                  child: const LinearProgressIndicator(minHeight: 4),
                ),
                const SizedBox(height: MorganSpace.sm),
                Text(
                  'Complete sign-in in your browser…',
                  style: theme.textTheme.bodySmall,
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
              'Morgan is preparing your historical data and first briefing.',
              maxLines: 3,
              style: theme.textTheme.bodyMedium,
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
                maxLines: 3,
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: MorganSpace.lg),
              syncStatus.when(
                data: (status) => SyncProgressPanel(
                  status: status,
                  firstBriefMessage: _firstBriefMessage(ref),
                ),
                loading: () => SyncProgressPanel(
                  status: SyncProgressPanel.placeholderStatus,
                  firstBriefMessage: _firstBriefMessage(ref),
                ),
                error: (_, __) => SyncProgressPanel(
                  status: SyncProgressPanel.placeholderStatus,
                  firstBriefMessage: _firstBriefMessage(ref),
                ),
              ),
              const SizedBox(height: MorganSpace.xl),
              OptionalIntegrationsPanel(
                onSkip: syncStatus.valueOrNull != null && _syncComplete(syncStatus.value!)
                    ? _finishOnboarding
                    : null,
              ),
            ],
          ),
        ),
    };
  }

  Widget _buildPrimaryAction(BuildContext context, AsyncValue<SyncStatus> syncStatus) {
    final syncComplete = syncStatus.valueOrNull != null && _syncComplete(syncStatus.value!);

    return switch (_phase) {
      OnboardingPhase.welcome => Column(
          children: [
            MorganPrimaryButton(
              label: 'Get started',
              onPressed: () => _goToPhase(OnboardingPhase.connectShopify),
            ),
            if (AppConfig.canSkipSetup)
              Align(
                alignment: Alignment.center,
                child: TextButton(
                  onPressed: _skipLocalDevSetup,
                  child: const Text('Skip setup (local dev)'),
                ),
              ),
          ],
        ),
      OnboardingPhase.connectShopify => Column(
          children: [
            if (_hasLinkedStore)
              Align(
                alignment: Alignment.center,
                child: TextButton(
                  onPressed: _isConnecting ? null : _skipConnectIfLinked,
                  child: const Text('Skip — store already linked'),
                ),
              ),
            MorganPrimaryButton(
              label: _isConnecting ? 'Connecting…' : 'Connect Shopify',
              onPressed: _isConnecting ? null : _connectShopify,
            ),
          ],
        ),
      OnboardingPhase.connectConfirmed => MorganPrimaryButton(
          label: 'Continue',
          onPressed: () => _goToPhase(OnboardingPhase.syncProgress),
        ),
      OnboardingPhase.syncProgress => MorganPrimaryButton(
          label: syncComplete ? 'Open Morgan' : 'Continue to Morgan',
          onPressed: _finishOnboarding,
        ),
    };
  }
}
