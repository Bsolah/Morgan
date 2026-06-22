import 'package:flutter/material.dart';

import '../../../../core/recommendations/recommendation.dart';
import '../../../../core/theme/morgan_colors.dart';
import '../../../../core/theme/morgan_tokens.dart';
import '../../../../shared/widgets/morgan_surface.dart';

class RecommendationCard extends StatelessWidget {
  const RecommendationCard({
    super.key,
    required this.recommendation,
    this.onTap,
    this.onAccept,
    this.onDismiss,
    this.inProgress = false,
    this.acting = false,
  });

  final Recommendation recommendation;
  final VoidCallback? onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDismiss;
  final bool inProgress;
  final bool acting;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);
    final body = recommendation.body.trim();

    return MorganSurface(
      borderColor: inProgress ? p.accent.withValues(alpha: 0.35) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(MorganRadius.md),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.card,
                MorganSpace.card,
                MorganSpace.card,
                MorganSpace.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _CategoryPill(label: recommendation.categoryLabel),
                  const SizedBox(height: MorganSpace.sm),
                  Text(recommendation.title, style: theme.textTheme.titleMedium),
                  const SizedBox(height: MorganSpace.xs),
                  Text(
                    recommendation.impactRangeLabel,
                    style: theme.textTheme.titleSmall?.copyWith(color: p.profit),
                  ),
                  if (body.isNotEmpty) ...[
                    const SizedBox(height: MorganSpace.sm),
                    Text(
                      body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: p.textPrimary.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                  if (inProgress) ...[
                    const SizedBox(height: MorganSpace.sm),
                    Text(
                      'Tracking impact over 30 days',
                      style: theme.textTheme.bodySmall?.copyWith(color: p.accent),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (!inProgress && (onAccept != null || onDismiss != null))
            Padding(
              padding: const EdgeInsets.fromLTRB(
                MorganSpace.card,
                0,
                MorganSpace.card,
                MorganSpace.card,
              ),
              child: Row(
                children: [
                  if (onDismiss != null)
                    Expanded(
                      child: TextButton(
                        onPressed: acting ? null : onDismiss,
                        child: const Text('Dismiss'),
                      ),
                    ),
                  if (onAccept != null && onDismiss != null)
                    const SizedBox(width: MorganSpace.sm),
                  if (onAccept != null)
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed: acting ? null : onAccept,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 44),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(MorganRadius.sm),
                          ),
                        ),
                        child: Text(acting ? 'Saving…' : 'Accept'),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _CategoryPill extends StatelessWidget {
  const _CategoryPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: MorganSpace.sm,
        vertical: MorganSpace.xxs,
      ),
      decoration: BoxDecoration(
        color: p.accentMuted,
        borderRadius: BorderRadius.circular(MorganRadius.pill),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelMedium?.copyWith(color: p.accent),
      ),
    );
  }
}
