import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import '../../core/theme/morgan_typography.dart';
import 'morgan_surface.dart';

enum MetricTrend { up, down, neutral }

class MorganMetricCard extends StatelessWidget {
  const MorganMetricCard({
    super.key,
    required this.label,
    required this.value,
    this.delta,
    this.trend,
    this.subtitle,
    this.onTap,
  });

  final String label;
  final String value;
  final String? delta;
  final MetricTrend? trend;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    Color? deltaColor;
    Color? deltaBg;
    if (trend != null && delta != null) {
      switch (trend!) {
        case MetricTrend.up:
          deltaColor = p.profit;
          deltaBg = p.profitMuted;
        case MetricTrend.down:
          deltaColor = p.loss;
          deltaBg = p.lossMuted;
        case MetricTrend.neutral:
          deltaColor = p.textMuted;
          deltaBg = p.surfaceMuted;
      }
    }

    final card = MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: theme.textTheme.labelMedium),
          const SizedBox(height: MorganSpace.sm),
          Text(value, style: MorganTypography.metricValue(p)),
          if (delta != null && deltaColor != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.xs, vertical: MorganSpace.xxs),
              decoration: BoxDecoration(
                color: deltaBg,
                borderRadius: BorderRadius.circular(MorganRadius.xs),
              ),
              child: Text(delta!, style: MorganTypography.metricDelta(p, deltaColor)),
            ),
          ],
          if (subtitle != null) ...[
            const SizedBox(height: MorganSpace.xs),
            Text(subtitle!, style: theme.textTheme.bodySmall),
          ],
        ],
      ),
    );

    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}
