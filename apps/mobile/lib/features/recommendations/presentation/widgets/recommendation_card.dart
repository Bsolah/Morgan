import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/recommendations/recommendation.dart';
import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';
import '../../../../shared/widgets/morgan_surface.dart';

class RecommendationCard extends StatelessWidget {
  const RecommendationCard({
    super.key,
    required this.recommendation,
    this.onTap,
    this.inProgress = false,
  });

  final Recommendation recommendation;
  final VoidCallback? onTap;
  final bool inProgress;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final expiryLabel = DateFormat('MMM d').format(recommendation.expiresAt);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(MorganRadius.md),
      child: MorganSurface(
        borderColor: inProgress ? p.accent.withValues(alpha: 0.35) : null,
        child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: inProgress ? p.accent.withValues(alpha: 0.15) : p.accentMuted,
              borderRadius: BorderRadius.circular(MorganRadius.xs),
            ),
            child: inProgress
                ? Icon(Icons.timelapse_rounded, size: 16, color: p.accent)
                : Text(
                    '${recommendation.rank}',
                    style: theme.textTheme.labelMedium?.copyWith(color: p.accent),
                  ),
          ),
          const SizedBox(width: MorganSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(recommendation.title, style: theme.textTheme.titleMedium),
                if (inProgress) ...[
                  const SizedBox(height: MorganSpace.xxs),
                  Text(
                    'Tracking impact over 30 days',
                    style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
                  ),
                ],
                const SizedBox(height: MorganSpace.xs),
                Text(
                  recommendation.impactRangeLabel,
                  style: theme.textTheme.titleSmall?.copyWith(color: p.profit),
                ),
                const SizedBox(height: MorganSpace.sm),
                Wrap(
                  spacing: MorganSpace.xs,
                  runSpacing: MorganSpace.xxs,
                  children: [
                    _MetaChip(label: recommendation.categoryLabel, color: p.accent),
                    _MetaChip(label: recommendation.effortLabel, color: p.textSecondary),
                    _MetaChip(label: recommendation.confidenceLabel, color: p.textSecondary),
                  ],
                ),
                const SizedBox(height: MorganSpace.xs),
                Text(
                  'Expires $expiryLabel',
                  style: theme.textTheme.bodySmall?.copyWith(color: p.textMuted),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
        ],
      ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final p = context.morgan;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: MorganSpace.sm,
        vertical: MorganSpace.xxs,
      ),
      decoration: BoxDecoration(
        color: p.surfaceMuted,
        borderRadius: BorderRadius.circular(MorganRadius.pill),
        border: Border.all(color: p.borderSubtle),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelMedium?.copyWith(color: color),
      ),
    );
  }
}
