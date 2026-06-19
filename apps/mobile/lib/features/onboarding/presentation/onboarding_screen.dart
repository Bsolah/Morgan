import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_repository.dart';
import '../../../core/auth/biometric_service.dart';
import '../../../core/shopify/shopify_oauth.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../core/finance/finance_config.dart';
import '../../../core/finance/finance_repository.dart';
import '../../../core/network/api_client.dart';
import '../../finance/widgets/cogs_method_picker.dart';
import '../../../core/sync/sync_repository.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_primary_button.dart';

enum _OnboardingStep { welcome, connecting, connected, financeProfile, error }

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({
    super.key,
    this.returnTo,
    this.isReauth = false,
  });

  final String? returnTo;
  final bool isReauth;

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _shopController = TextEditingController();
  _OnboardingStep _step = _OnboardingStep.welcome;
  String? _errorMessage;
  String? _connectedShop;
  bool _biometricOffered = false;
  CogsMethod _cogsMethod = CogsMethod.shopify;
  double? _manualCogsPct;
  String? _manualCogsPctError;
  bool _quickbooksConnected = false;
  bool _xeroConnected = false;
  bool _financeSaving = false;
  String? _financeError;
  Timer? _syncPollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final existingShop = ref.read(authControllerProvider).session?.shopDomain;
      if (existingShop != null && _shopController.text.isEmpty) {
        _shopController.text = existingShop;
      }
    });
  }

  @override
  void dispose() {
    _syncPollTimer?.cancel();
    _shopController.dispose();
    super.dispose();
  }

  void _startSyncPolling() {
    _syncPollTimer?.cancel();
    ref.invalidate(syncStatusProvider);
    _syncPollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      ref.invalidate(syncStatusProvider);
    });
  }

  void _stopSyncPolling() {
    _syncPollTimer?.cancel();
    _syncPollTimer = null;
  }

  Future<void> _connectShopify() async {
    final shop = normalizeShopInput(_shopController.text);
    if (!isValidShopDomain(shop)) {
      setState(() {
        _step = _OnboardingStep.error;
        _errorMessage = shopifyOAuthErrorMessages['invalid_shop'];
      });
      return;
    }

    if (widget.returnTo != null) {
      await ref.read(authRepositoryProvider).savePendingRoute(widget.returnTo);
    }

    setState(() {
      _step = _OnboardingStep.connecting;
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
          _step = _OnboardingStep.error;
          _errorMessage = shopifyOAuthErrorMessage(errorCode);
        });
        return;
      }

      final connectToken = uri.queryParameters['connect_token'];
      if (connectToken == null || connectToken.isEmpty) {
        setState(() {
          _step = _OnboardingStep.error;
          _errorMessage = shopifyOAuthErrorMessages['server_error'];
        });
        return;
      }

      final session = await ref.read(authControllerProvider.notifier).completeConnect(connectToken);

      setState(() {
        _step = _OnboardingStep.connected;
        _connectedShop = session.shopDomain;
      });

      _startSyncPolling();

      if (!widget.isReauth) {
        await _loadFinanceDefaults();
      }
    } catch (_) {
      setState(() {
        _step = _OnboardingStep.error;
        _errorMessage = shopifyOAuthErrorMessages['server_error'];
      });
    }
  }

  Future<void> _offerBiometricIfAvailable() async {
    if (_biometricOffered) return;
    _biometricOffered = true;

    final biometric = ref.read(biometricServiceProvider);
    final supported = await biometric.isDeviceSupported();
    final canCheck = await biometric.canCheckBiometrics();
    if (!supported || !canCheck || !mounted) return;

    final enable = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Enable biometric unlock?'),
        content: const Text(
          'Use Face ID or fingerprint to open Morgan without signing in again.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not now')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Enable')),
        ],
      ),
    );

    if (enable == true) {
      await ref.read(authControllerProvider.notifier).enableBiometric();
    }
  }

  Future<void> _loadFinanceDefaults() async {
    try {
      ref.watch(apiClientProvider);
      final config = await ref.read(financeRepositoryProvider).getConfig();
      if (!mounted) return;
      setState(() {
        _cogsMethod = config.cogsMethod;
        _manualCogsPct = config.manualCogsPct;
        _quickbooksConnected = config.quickbooksConnected;
        _xeroConnected = config.xeroConnected;
      });
    } catch (_) {
      // Defaults remain Shopify unit cost.
    }
  }

  void _goToFinanceProfile() {
    _stopSyncPolling();
    setState(() => _step = _OnboardingStep.financeProfile);
  }

  Future<void> _saveFinanceProfile() async {
    if (_cogsMethod == CogsMethod.manualPct) {
      final error = validateManualCogsPct(_manualCogsPct);
      if (error != null) {
        setState(() => _manualCogsPctError = error);
        return;
      }
    }

    setState(() {
      _financeSaving = true;
      _financeError = null;
      _manualCogsPctError = null;
    });

    try {
      await ref.read(financeRepositoryProvider).updateConfig(
            UpdateFinanceConfigRequest(
              cogsMethod: _cogsMethod,
              manualCogsPct: _cogsMethod == CogsMethod.manualPct ? _manualCogsPct : null,
            ),
          );
      ref.invalidate(financeConfigProvider);
      if (!mounted) return;
      _finishOnboarding();
    } catch (_) {
      if (!mounted) return;
      setState(() => _financeError = 'Could not save COGS method. Try again.');
    } finally {
      if (mounted) setState(() => _financeSaving = false);
    }
  }

  Future<void> _finishOnboarding() async {
    _offerBiometricIfAvailable();
    final returnTo = widget.returnTo ?? ref.read(authControllerProvider).pendingRoute;
    context.go(returnTo ?? '/home');
  }

  void _continueAfterConnect() {
    if (widget.isReauth) {
      _finishOnboarding();
      return;
    }
    _goToFinanceProfile();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: _step == _OnboardingStep.financeProfile
            ? ListView(
                padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
                children: [
                  const SizedBox(height: MorganSpace.xxl),
                  const MorganLogo(size: 56, showWordmark: true),
                  const SizedBox(height: MorganSpace.xxl),
                  Text('How should Morgan calculate costs?', style: theme.textTheme.headlineMedium),
                  const SizedBox(height: MorganSpace.sm),
                  Text(
                    'Pick the method that best matches how you track product costs today.',
                    style: theme.textTheme.bodyLarge,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                  CogsMethodPicker(
                    selected: _cogsMethod,
                    quickbooksConnected: _quickbooksConnected,
                    xeroConnected: _xeroConnected,
                    manualPct: _manualCogsPct,
                    manualPctError: _manualCogsPctError,
                    onSelected: (method) => setState(() {
                      _cogsMethod = method;
                      _manualCogsPctError = null;
                    }),
                    onManualPctChanged: (value) => setState(() {
                      _manualCogsPct = value;
                      _manualCogsPctError = null;
                    }),
                  ),
                  if (_financeError != null) ...[
                    const SizedBox(height: MorganSpace.md),
                    Text(_financeError!, style: theme.textTheme.bodyMedium?.copyWith(color: p.loss)),
                  ],
                  const SizedBox(height: MorganSpace.xl),
                  MorganPrimaryButton(
                    label: _financeSaving ? 'Saving…' : 'Continue',
                    onPressed: _financeSaving ? null : _saveFinanceProfile,
                  ),
                  const SizedBox(height: MorganSpace.xl),
                ],
              )
            : Padding(
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: MorganSpace.xxl),
              MorganFadeIn(child: const MorganLogo(size: 56, showWordmark: true)),
              const Spacer(),
              if (_step == _OnboardingStep.welcome) ...[
                if (widget.isReauth) ...[
                  MorganFadeIn(
                    child: Text(
                      'Session expired',
                      style: theme.textTheme.labelMedium?.copyWith(color: p.warning, letterSpacing: 1.2),
                    ),
                  ),
                  const SizedBox(height: MorganSpace.sm),
                ],
                MorganFadeIn(
                  child: Text(
                    widget.isReauth ? 'Reconnect your\nShopify store' : 'Your AI CFO',
                    style: widget.isReauth
                        ? theme.textTheme.headlineMedium
                        : theme.textTheme.labelMedium?.copyWith(color: p.accent, letterSpacing: 1.4),
                  ),
                ),
                if (!widget.isReauth) const SizedBox(height: MorganSpace.sm),
                if (!widget.isReauth)
                  MorganFadeIn(
                    delay: const Duration(milliseconds: 80),
                    child: Text(
                      'Connect your\nShopify store',
                      style: theme.textTheme.displayMedium,
                    ),
                  ),
                const SizedBox(height: MorganSpace.md),
                MorganFadeIn(
                  delay: const Duration(milliseconds: 120),
                  child: Text(
                    widget.isReauth
                        ? 'Sign in again with Shopify to continue where you left off.'
                        : 'Morgan syncs orders, products, and payouts to deliver your daily financial brief.',
                    style: theme.textTheme.bodyLarge,
                  ),
                ),
                const SizedBox(height: MorganSpace.xl),
                MorganFadeIn(
                  delay: const Duration(milliseconds: 160),
                  child: TextField(
                    controller: _shopController,
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
                ),
              ] else if (_step == _OnboardingStep.connecting) ...[
                Text('Connecting to Shopify…', style: theme.textTheme.headlineMedium),
                const SizedBox(height: MorganSpace.md),
                Text(
                  'Complete sign-in in your browser, then you\'ll return here automatically.',
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: MorganSpace.xl),
                const Center(child: CircularProgressIndicator()),
              ] else if (_step == _OnboardingStep.connected) ...[
                Text('Store connected', style: theme.textTheme.headlineMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(
                  _connectedShop ?? '',
                  style: theme.textTheme.titleMedium?.copyWith(color: p.accent),
                ),
                const SizedBox(height: MorganSpace.md),
                _ConnectedSyncProgress(),
              ] else ...[
                Text('Connection failed', style: theme.textTheme.headlineMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(_errorMessage ?? shopifyOAuthErrorMessages['server_error']!, style: theme.textTheme.bodyLarge),
              ],
              const Spacer(),
              if (_step == _OnboardingStep.welcome)
                MorganPrimaryButton(
                  label: widget.isReauth ? 'Reconnect Shopify' : 'Connect Shopify',
                  onPressed: _connectShopify,
                )
              else if (_step == _OnboardingStep.connected)
                MorganPrimaryButton(label: 'Continue', onPressed: _continueAfterConnect)
              else if (_step == _OnboardingStep.error)
                MorganPrimaryButton(
                  label: 'Try again',
                  onPressed: () => setState(() => _step = _OnboardingStep.welcome),
                ),
              const SizedBox(height: MorganSpace.xl),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConnectedSyncProgress extends ConsumerWidget {
  const _ConnectedSyncProgress();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final p = context.morgan;
    final sync = ref.watch(syncStatusProvider);

    return sync.when(
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Preparing order history import…', style: theme.textTheme.bodyLarge),
          const SizedBox(height: MorganSpace.md),
          const LinearProgressIndicator(),
        ],
      ),
      error: (_, __) => Text(
        'We\'re syncing your store data. Your first briefing arrives within 24 hours.',
        style: theme.textTheme.bodyLarge,
      ),
      data: (status) {
        final progress = status.progressPercent != null ? status.progressPercent! / 100 : null;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(status.label, style: theme.textTheme.bodyLarge),
            const SizedBox(height: MorganSpace.sm),
            if (progress != null) ...[
              LinearProgressIndicator(value: progress.clamp(0, 1)),
              const SizedBox(height: MorganSpace.xs),
              Text(
                status.showPartialBrief
                    ? 'Early briefing is being prepared.'
                    : 'Your first briefing unlocks after 50% of orders are imported.',
                style: theme.textTheme.bodySmall,
              ),
            ] else ...[
              const LinearProgressIndicator(),
            ],
            if (status.error != null) ...[
              const SizedBox(height: MorganSpace.sm),
              Text(status.error!, style: theme.textTheme.bodySmall?.copyWith(color: p.loss)),
            ],
          ],
        );
      },
    );
  }
}
