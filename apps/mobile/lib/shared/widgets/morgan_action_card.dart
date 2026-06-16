import 'package:flutter/material.dart';

import '../../core/theme/morgan_colors.dart';
import '../../core/theme/morgan_tokens.dart';
import 'morgan_surface.dart';

class MorganActionCard extends StatelessWidget {
  const MorganActionCard({
    super.key,
    required this.title,
    required this.body,
    this.impact,
    this.onReview,
    this.icon = Icons.bolt_rounded,
  });

  final String title;
  final String body;
  final String? impact;
  final VoidCallback? onReview;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      color: p.goldMuted,
      borderColor: p.isDark ? p.gold.withValues(alpha: 0.25) : const Color(0xFFE8DFC8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: p.gold.withValues(alpha: p.isDark ? 0.2 : 0.15),
                  borderRadius: BorderRadius.circular(MorganRadius.xs),
                ),
                child: Icon(icon, size: 18, color: p.gold),
              ),
              const SizedBox(width: MorganSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Recommended action', style: theme.textTheme.labelMedium?.copyWith(color: p.gold)),
                    Text(title, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: MorganSpace.sm),
          Text(body, style: theme.textTheme.bodyMedium?.copyWith(color: p.textPrimary.withValues(alpha: 0.85))),
          if (impact != null) ...[
            const SizedBox(height: MorganSpace.sm),
            Text(
              impact!,
              style: theme.textTheme.titleSmall?.copyWith(color: p.profit, fontWeight: FontWeight.w600),
            ),
          ],
          if (onReview != null) ...[
            const SizedBox(height: MorganSpace.md),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(onPressed: onReview, child: const Text('Review action')),
            ),
          ],
        ],
      ),
    );
  }
}

class MorganBriefCard extends StatelessWidget {
  const MorganBriefCard({
    super.key,
    required this.headline,
    required this.narrative,
    this.dateLabel,
  });

  final String headline;
  final String narrative;
  final String? dateLabel;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle),
              ),
              const SizedBox(width: MorganSpace.xs),
              Text('DAILY BRIEF', style: theme.textTheme.labelMedium),
              const Spacer(),
              if (dateLabel != null)
                Text(dateLabel!, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: MorganSpace.md),
          Text(headline, style: theme.textTheme.titleLarge?.copyWith(height: 1.3)),
          const SizedBox(height: MorganSpace.sm),
          Text(narrative, style: theme.textTheme.bodyLarge),
        ],
      ),
    );
  }
}
