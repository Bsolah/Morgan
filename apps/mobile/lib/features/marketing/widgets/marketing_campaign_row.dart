import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/marketing/marketing_repository.dart';
import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';

class MarketingCampaignRow extends StatelessWidget {
  const MarketingCampaignRow({
    super.key,
    required this.name,
    required this.spend,
    required this.metricLabel,
    required this.metricValue,
    this.metricColor,
    this.subtitle,
    this.onTap,
  });

  final String name;
  final double spend;
  final String metricLabel;
  final String metricValue;
  final Color? metricColor;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final money = NumberFormat.compactCurrency(symbol: '\$');

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: MorganSpace.card,
          vertical: MorganSpace.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: theme.textTheme.titleSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: MorganSpace.xxs),
                    Text(
                      subtitle!,
                      style: theme.textTheme.labelSmall?.copyWith(color: p.loss),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: MorganSpace.sm),
            SizedBox(
              width: 56,
              child: Text(
                money.format(spend),
                style: theme.textTheme.bodySmall,
                textAlign: TextAlign.end,
              ),
            ),
            const SizedBox(width: MorganSpace.sm),
            SizedBox(
              width: 52,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(metricLabel, style: theme.textTheme.labelSmall?.copyWith(color: p.textMuted)),
                  Text(
                    metricValue,
                    style: theme.textTheme.titleSmall?.copyWith(color: metricColor ?? p.textPrimary),
                    textAlign: TextAlign.end,
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 18),
          ],
        ),
      ),
    );
  }
}

String marketingChannelLabel(String channel) {
  return switch (channel.toLowerCase()) {
    'meta' => 'Meta',
    'google_ads' => 'Google Ads',
    _ => channel.replaceAll('_', ' '),
  };
}
