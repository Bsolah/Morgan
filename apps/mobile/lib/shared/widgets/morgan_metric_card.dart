import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import '../../core/theme/morgan_typography.dart';
import 'morgan_info_tooltip.dart';
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
    this.infoTooltip,
    this.onTap,
    this.valueColor,
    this.compact = false,
  });

  final String label;
  final String value;
  final String? delta;
  final MetricTrend? trend;
  final String? subtitle;
  final String? infoTooltip;
  final VoidCallback? onTap;
  final Color? valueColor;
  final bool compact;

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

    final valueStyle = MorganTypography.metricValue(
      p,
      size: compact ? 22 : 28,
    ).copyWith(color: valueColor);

    final card = MorganSurface(
      padding: compact
          ? const EdgeInsets.symmetric(
              horizontal: MorganSpace.md,
              vertical: MorganSpace.sm,
            )
          : const EdgeInsets.all(MorganSpace.card),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label.toUpperCase(), style: theme.textTheme.labelMedium)),
              if (infoTooltip != null)
                MorganInfoTooltip(
                  message: infoTooltip!,
                  semanticsLabel: 'More information about $label',
                ),
            ],
          ),
          SizedBox(height: compact ? MorganSpace.xs : MorganSpace.sm),
          Text(value, style: valueStyle),
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
    return Semantics(
      button: true,
      label: _accessibilityLabel(),
      child: GestureDetector(onTap: onTap, child: card),
    );
  }

  String _accessibilityLabel() {
    final parts = <String>[label, value];
    if (delta != null) parts.add(delta!);
    if (subtitle != null) parts.add(subtitle!);
    return parts.join('. ');
  }
}
