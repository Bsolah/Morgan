import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/shopify/shopify_oauth.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_logo.dart';
import '../../../shared/widgets/morgan_primary_button.dart';

enum _OnboardingStep { welcome, connecting, connected, error }

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _shopController = TextEditingController();
  _OnboardingStep _step = _OnboardingStep.welcome;
  String? _errorMessage;
  String? _connectedShop;

  @override
  void dispose() {
    _shopController.dispose();
    super.dispose();
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

      final repo = ref.read(authRepositoryProvider);
      final session = await repo.exchangeConnectToken(connectToken);

      ref.invalidate(authSessionProvider);

      setState(() {
        _step = _OnboardingStep.connected;
        _connectedShop = session.shopDomain;
      });
    } catch (_) {
      setState(() {
        _step = _OnboardingStep.error;
        _errorMessage = shopifyOAuthErrorMessages['server_error'];
      });
    }
  }

  void _continueToHome() {
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: MorganSpace.xxl),
              MorganFadeIn(child: const MorganLogo(size: 56, showWordmark: true)),
              const Spacer(),
              if (_step == _OnboardingStep.welcome) ...[
                MorganFadeIn(
                  child: Text(
                    'Your AI CFO',
                    style: theme.textTheme.labelMedium?.copyWith(color: p.accent, letterSpacing: 1.4),
                  ),
                ),
                const SizedBox(height: MorganSpace.sm),
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
                    'Morgan syncs orders, products, and payouts to deliver your daily financial brief.',
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
                Text(
                  'We\'re syncing your store data. Your first briefing arrives within 24 hours.',
                  style: theme.textTheme.bodyLarge,
                ),
              ] else ...[
                Text('Connection failed', style: theme.textTheme.headlineMedium),
                const SizedBox(height: MorganSpace.sm),
                Text(_errorMessage ?? shopifyOAuthErrorMessages['server_error']!, style: theme.textTheme.bodyLarge),
              ],
              const Spacer(),
              if (_step == _OnboardingStep.welcome)
                MorganPrimaryButton(label: 'Connect Shopify', onPressed: _connectShopify)
              else if (_step == _OnboardingStep.connected)
                MorganPrimaryButton(label: 'Continue', onPressed: _continueToHome)
              else if (_step == _OnboardingStep.error)
                MorganPrimaryButton(label: 'Try again', onPressed: () => setState(() => _step = _OnboardingStep.welcome)),
              const SizedBox(height: MorganSpace.xl),
            ],
          ),
        ),
      ),
    );
  }
}
