import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/morgan_colors.dart';

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: MorganColors.heroGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: MorganColors.brandGradient,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'AI CFO FOR SHOPIFY',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ShaderMask(
                  shaderCallback: (bounds) => MorganColors.brandGradient.createShader(bounds),
                  child: Text(
                    'Morgan',
                    style: theme.textTheme.displaySmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Your AI CFO for Shopify — daily briefings, profit actions, and answers grounded in your store data.',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: MorganColors.textSecondary,
                    fontWeight: FontWeight.w400,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 32),
                const _StepRow(number: '1', title: 'Connect Shopify', subtitle: 'Install and sync your store'),
                const SizedBox(height: 12),
                const _StepRow(number: '2', title: 'Get your first brief', subtitle: 'Usually within 24 hours'),
                const SizedBox(height: 12),
                const _StepRow(number: '3', title: 'Act on recommendations', subtitle: 'Increase profit, reduce risk'),
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: MorganColors.brandGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x334F46E5),
                          blurRadius: 16,
                          offset: Offset(0, 6),
                        ),
                      ],
                    ),
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                      ),
                      onPressed: () => context.go('/home'),
                      child: const Text('Continue'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.number, required this.title, required this.subtitle});

  final String number;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: MorganColors.brandGradient,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: MorganColors.textPrimary)),
              Text(subtitle, style: const TextStyle(color: MorganColors.textMuted)),
            ],
          ),
        ),
      ],
    );
  }
}
