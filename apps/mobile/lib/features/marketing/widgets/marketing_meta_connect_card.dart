import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_primary_button.dart';
import '../../../shared/widgets/morgan_surface.dart';

/// Inline CTA when Meta Ads is not connected (US-UX-11-01).
class MarketingMetaConnectCard extends StatelessWidget {
  const MarketingMetaConnectCard({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.campaign_outlined, color: p.accent, size: 22),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Connect Meta Ads', style: theme.textTheme.titleSmall),
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      'Link Meta to unlock POAS, campaign trends, and ad-waste alerts.',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.md),
          MorganPrimaryButton(
            label: 'Connect Meta',
            onPressed: () => context.push('/settings/integrations'),
          ),
        ],
      ),
    );
  }
}
