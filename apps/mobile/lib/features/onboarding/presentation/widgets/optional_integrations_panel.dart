import 'package:flutter/material.dart';

import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';
import '../../../../shared/widgets/morgan_surface.dart';

class OptionalIntegrationsPanel extends StatelessWidget {
  const OptionalIntegrationsPanel({
    super.key,
    this.onSkip,
  });

  final VoidCallback? onSkip;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('OPTIONAL', style: theme.textTheme.labelMedium),
        const SizedBox(height: MorganSpace.sm),
        MorganSurface(
          child: Column(
            children: [
              _IntegrationRow(
                icon: Icons.campaign_outlined,
                title: 'Meta Ads',
                subtitle: 'Unlock POAS and ad waste alerts',
                onConnect: () {},
              ),
              Divider(height: 1, color: p.borderSubtle),
              _IntegrationRow(
                icon: Icons.account_balance_outlined,
                title: 'Bank account',
                subtitle: 'Forecast cash runway with Plaid',
                onConnect: () {},
              ),
            ],
          ),
        ),
        const SizedBox(height: MorganSpace.sm),
        Text(
          'You can connect these anytime from Settings.',
          style: theme.textTheme.bodySmall,
        ),
        if (onSkip != null) ...[
          const SizedBox(height: MorganSpace.md),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(onPressed: onSkip, child: const Text('Skip for now')),
          ),
        ],
      ],
    );
  }
}

class _IntegrationRow extends StatelessWidget {
  const _IntegrationRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onConnect,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onConnect;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MorganSpace.xs),
      child: Row(
        children: [
          Icon(icon, color: p.textMuted, size: 20),
          const SizedBox(width: MorganSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleSmall),
                Text(subtitle, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          TextButton(onPressed: onConnect, child: const Text('Connect')),
        ],
      ),
    );
  }
}
