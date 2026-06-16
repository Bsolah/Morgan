import 'package:flutter/material.dart';

import '../../../core/theme/morgan_colors.dart';
import '../../../core/theme/morgan_tokens.dart';
import '../../../shared/widgets/morgan_fade_in.dart';
import '../../../shared/widgets/morgan_section_header.dart';
import '../../../shared/widgets/morgan_surface.dart';

class RecommendationsScreen extends StatelessWidget {
  const RecommendationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;

    return Scaffold(
      backgroundColor: p.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: MorganSpace.huge),
          children: [
            const MorganScreenHeader(
              title: 'Actions',
              subtitle: 'Ranked by profit impact',
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MorganSpace.screenH),
              child: Column(
                children: [
                  MorganFadeIn(
                    child: _ActionItem(
                      rank: 1,
                      title: 'Pause Campaign X',
                      impact: 'Save ~\$420/wk',
                      effort: 'Low effort',
                      confidence: 'High confidence',
                    ),
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  MorganFadeIn(
                    delay: const Duration(milliseconds: 60),
                    child: _ActionItem(
                      rank: 2,
                      title: 'Reorder Blue Tee (M)',
                      impact: 'Avoid \$800 stockout',
                      effort: 'Medium effort',
                      confidence: 'High confidence',
                    ),
                  ),
                  const SizedBox(height: MorganSpace.sm),
                  MorganFadeIn(
                    delay: const Duration(milliseconds: 120),
                    child: _ActionItem(
                      rank: 3,
                      title: 'Review discount codes',
                      impact: 'Recover ~\$1.1K/mo margin',
                      effort: 'Low effort',
                      confidence: 'Medium confidence',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionItem extends StatelessWidget {
  const _ActionItem({
    required this.rank,
    required this.title,
    required this.impact,
    required this.effort,
    required this.confidence,
  });

  final int rank;
  final String title;
  final String impact;
  final String effort;
  final String confidence;

  @override
  Widget build(BuildContext context) {
    final p = context.morgan;
    final theme = Theme.of(context);

    return MorganSurface(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: p.accentMuted,
              borderRadius: BorderRadius.circular(MorganRadius.xs),
            ),
            child: Text(
              '$rank',
              style: theme.textTheme.labelMedium?.copyWith(color: p.accent),
            ),
          ),
          const SizedBox(width: MorganSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleMedium),
                const SizedBox(height: MorganSpace.xs),
                Text(impact, style: theme.textTheme.titleSmall?.copyWith(color: p.profit)),
                const SizedBox(height: MorganSpace.xxs),
                Text('$effort · $confidence', style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: p.textMuted, size: 20),
        ],
      ),
    );
  }
}
