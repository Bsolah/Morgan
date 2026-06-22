import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_surface.dart';

class MarginTargetProgress extends StatelessWidget {
  const MarginTargetProgress({
    super.key,
    required this.currentMarginPct,
    required this.targetMarginPct,
    required this.belowTarget,
  });

  final double? currentMarginPct;
  final double targetMarginPct;
  final bool belowTarget;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    if (currentMarginPct == null || targetMarginPct <= 0) {
      return const SizedBox.shrink();
    }

    final progress = (currentMarginPct! / targetMarginPct).clamp(0.0, 1.0);
    final progressPct = (progress * 100).round();
    final barColor = belowTarget ? p.warning : p.profit;

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Progress to target', style: theme.textTheme.labelMedium),
              ),
              Text(
                '$progressPct%',
                style: theme.textTheme.titleSmall?.copyWith(color: barColor),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(MorganRadius.sm),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: p.borderSubtle,
              color: barColor,
            ),
          ),
          const SizedBox(height: MorganSpace.xs),
          Text(
            '${currentMarginPct!.toStringAsFixed(1)}% of ${targetMarginPct.toStringAsFixed(0)}% target',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
