import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/morgan_colors.dart';
import '../theme/morgan_tokens.dart';
import 'auth_controller.dart';
import 'biometric_service.dart';
import '../../shared/widgets/morgan_logo.dart';
import '../../shared/widgets/morgan_primary_button.dart';

class BiometricUnlockScreen extends ConsumerStatefulWidget {
  const BiometricUnlockScreen({super.key});

  @override
  ConsumerState<BiometricUnlockScreen> createState() => _BiometricUnlockScreenState();
}

class _BiometricUnlockScreenState extends ConsumerState<BiometricUnlockScreen> {
  bool _unlocking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    if (_unlocking) return;

    setState(() {
      _unlocking = true;
      _error = null;
    });

    final biometric = ref.read(biometricServiceProvider);
    final success = await biometric.authenticate(reason: 'Unlock Morgan');

    if (!mounted) return;

    if (success) {
      ref.read(authControllerProvider.notifier).unlock();
      final pending = ref.read(authControllerProvider).pendingRoute;
      context.go(pending ?? '/home');
      return;
    }

    setState(() {
      _unlocking = false;
      _error = 'Could not verify your identity.';
    });
  }

  Future<void> _reauthWithShopify() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) context.go('/onboarding?reauth=1');
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
            children: [
              const Spacer(flex: 2),
              const MorganLogo(size: 64),
              const SizedBox(height: MorganSpace.xxl),
              Text(
                'Unlock Morgan',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: MorganSpace.sm),
              Text(
                'Use Face ID or fingerprint to continue.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
              if (_error != null) ...[
                const SizedBox(height: MorganSpace.md),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: theme.textTheme.bodySmall?.copyWith(color: p.loss),
                ),
              ],
              const Spacer(flex: 3),
              MorganPrimaryButton(
                label: _unlocking ? 'Unlocking…' : 'Try again',
                onPressed: _unlocking ? null : _unlock,
              ),
              const SizedBox(height: MorganSpace.sm),
              TextButton(
                onPressed: _reauthWithShopify,
                child: const Text('Sign in with Shopify again'),
              ),
              const SizedBox(height: MorganSpace.xl),
            ],
          ),
        ),
      ),
    );
  }
}
