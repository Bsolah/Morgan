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
    final success = await biometric.authenticate(
      reason: 'Unlock Morgan to view your financial briefings',
    );

    if (!mounted) return;

    if (success) {
      ref.read(authControllerProvider.notifier).unlock();
      final pending = ref.read(authControllerProvider).pendingRoute;
      context.go(pending ?? '/home');
      return;
    }

    setState(() {
      _unlocking = false;
      _error = 'Biometric unlock failed. Try again or sign out.';
    });
  }

  Future<void> _signOut() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) context.go('/onboarding');
  }

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final shopDomain = ref.watch(authControllerProvider).session?.shopDomain;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: MorganSpace.xxl),
              const MorganLogo(size: 56, showWordmark: true),
              const Spacer(),
              Text('Welcome back', style: theme.textTheme.headlineMedium),
              const SizedBox(height: MorganSpace.sm),
              if (shopDomain != null)
                Text(shopDomain, style: theme.textTheme.titleMedium?.copyWith(color: p.accent)),
              const SizedBox(height: MorganSpace.md),
              Text(
                'Use Face ID or fingerprint to open Morgan.',
                style: theme.textTheme.bodyLarge,
              ),
              if (_error != null) ...[
                const SizedBox(height: MorganSpace.md),
                Text(_error!, style: theme.textTheme.bodyMedium?.copyWith(color: p.loss)),
              ],
              const Spacer(),
              if (_unlocking)
                const Center(child: CircularProgressIndicator())
              else
                MorganPrimaryButton(label: 'Unlock', onPressed: _unlock),
              const SizedBox(height: MorganSpace.sm),
              TextButton(
                onPressed: _signOut,
                child: const Text('Sign out'),
              ),
              const SizedBox(height: MorganSpace.xl),
            ],
          ),
        ),
      ),
    );
  }
}
